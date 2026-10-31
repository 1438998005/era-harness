import * as path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import type { ApiHandler, buildApiHandler } from "@core/api"
import { parseAssistantMessageV2, ToolUse } from "@core/assistant-message"
import { discoverAvailableSkills } from "@core/context/instructions/user-instructions/skills"
import { formatResponse } from "@core/prompts/responses"
import { PromptRegistry } from "@core/prompts/system-prompt"
import type { SystemPromptContext } from "@core/prompts/system-prompt/types"
import { readGlobalMemoryDocument } from "@core/storage/globalMemory"
import { checkRepeatedToolCall, LOOP_DETECTION_SOFT_THRESHOLD, toolCallSignature } from "@core/task/loop-detection"
import { StreamResponseHandler } from "@core/task/StreamResponseHandler"
import { formatGlobalMemoryForPrompt } from "@shared/global-memory"
import { ClineAssistantToolUseBlock, ClineStorageMessage, ClineTextContentBlock, ClineUserContent } from "@shared/messages"
import { Logger } from "@shared/services/Logger"
import { ClineDefaultTool, ClineTool } from "@shared/tools"
import { ContextManager } from "@/core/context/context-management/ContextManager"
import { checkContextWindowExceededError } from "@/core/context/context-management/context-error-handling"
import { getContextWindowInfo } from "@/core/context/context-management/context-window-utils"
import { HostRegistryInfo } from "@/registry"
import { ClineError, ClineErrorType } from "@/services/error"
import { ApiFormat } from "@/shared/proto/cline/models"
import { calculateApiCostAnthropic } from "@/utils/cost"
import { isNextGenModelFamily } from "@/utils/model-utils"
import { TaskState } from "../../TaskState"
import { ToolExecutorCoordinator } from "../ToolExecutorCoordinator"
import { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import { SubagentBuilder } from "./SubagentBuilder"
import { budgetMessage, checkSubagentBudget, SUBAGENT_BUDGET, type SubagentBudgetReason } from "./subagentBudget"

const MAX_EMPTY_ASSISTANT_RETRIES = 3
const MAX_INITIAL_STREAM_ATTEMPTS = 3
const INITIAL_STREAM_RETRY_BASE_DELAY_MS = 2_000

export type SubagentRunStatus = "completed" | "failed"

export interface SubagentRunResult {
	status: SubagentRunStatus
	result?: string
	error?: string
	stats: SubagentRunStats
	/** 因预算/超时中止时带上原因，供 UI 标记 */
	budgetReason?: SubagentBudgetReason
}

interface SubagentProgressUpdate {
	stats?: SubagentRunStats
	latestToolCall?: string
	status?: "running" | "completed" | "failed"
	result?: string
	error?: string
}

interface SubagentRunStats {
	toolCalls: number
	inputTokens: number
	outputTokens: number
	cacheWriteTokens: number
	cacheReadTokens: number
	totalCost: number
	contextTokens: number
	contextWindow: number
	contextUsagePercentage: number
}

interface SubagentRequestUsageState {
	inputTokens: number
	outputTokens: number
	cacheWriteTokens: number
	cacheReadTokens: number
	totalTokens: number
	totalCost?: number
}

interface SubagentUsageState {
	currentRequest: SubagentRequestUsageState
	lastRequest?: SubagentRequestUsageState
}

interface SubagentToolCall {
	toolUseId: string
	id?: string
	call_id?: string
	signature?: string
	name: string
	input: unknown
	isNativeToolCall: boolean
}

interface SubagentContextState {
	conversationHistoryDeletedRange?: [number, number]
}

function createEmptyRequestUsageState(): SubagentRequestUsageState {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheWriteTokens: 0,
		cacheReadTokens: 0,
		totalTokens: 0,
	}
}

function serializeToolResult(result: unknown): string {
	if (typeof result === "string") {
		return result
	}

	if (Array.isArray(result)) {
		return result
			.map((item) => {
				if (!item || typeof item !== "object") {
					return String(item)
				}

				const maybeText = (item as { text?: string }).text
				if (typeof maybeText === "string") {
					return maybeText
				}

				return JSON.stringify(item)
			})
			.join("\n")
	}

	return JSON.stringify(result, null, 2)
}

function toToolUseParams(input: unknown): Partial<Record<string, string>> {
	if (!input || typeof input !== "object") {
		return {}
	}

	const params: Record<string, string> = {}
	for (const [key, value] of Object.entries(input)) {
		params[key] = typeof value === "string" ? value : JSON.stringify(value)
	}

	return params
}

function formatToolArgPreview(value: string, maxLength = 48): string {
	const normalized = value.replace(/\s+/g, " ").trim()
	if (normalized.length <= maxLength) {
		return normalized
	}
	return `${normalized.slice(0, maxLength - 3)}...`
}

function formatToolCallPreview(toolName: string, params: Partial<Record<string, string>>): string {
	const entries = Object.entries(params).filter(([, value]) => value !== undefined)
	const visibleEntries = entries.slice(0, 3)
	const omittedCount = Math.max(0, entries.length - visibleEntries.length)

	const args = visibleEntries
		.map(([key, value]) => `${key}=${formatToolArgPreview(value ?? "")}`)
		.concat(omittedCount > 0 ? [`...+${omittedCount}`] : [])
		.join(", ")

	return `${toolName}(${args})`
}

function normalizeToolCallArguments(argumentsPayload: unknown): string {
	if (typeof argumentsPayload === "string") {
		return argumentsPayload
	}

	try {
		return JSON.stringify(argumentsPayload ?? {})
	} catch {
		return "{}"
	}
}

function resolveToolUseId(call: { id?: string; call_id?: string; name?: string }, index: number): string {
	const id = call.id?.trim()
	if (id) {
		return id
	}

	const callId = call.call_id?.trim()
	if (callId) {
		return callId
	}

	const fallbackId = `subagent_tool_${Date.now()}_${index + 1}`
	Logger.warn(`[SubagentRunner] Missing tool call id for '${call.name || "unknown"}'; using fallback '${fallbackId}'`)
	return fallbackId
}

function toAssistantToolUseBlock(call: SubagentToolCall): ClineAssistantToolUseBlock {
	return {
		type: "tool_use",
		id: call.toolUseId,
		name: call.name,
		input: call.input,
		call_id: call.call_id,
		signature: call.signature,
	}
}

function parseNonNativeToolCalls(assistantText: string): SubagentToolCall[] {
	const parsedBlocks = parseAssistantMessageV2(assistantText)

	return parsedBlocks
		.filter((block): block is ToolUse => block.type === "tool_use")
		.filter((block) => !block.partial)
		.map((block, index) => ({
			toolUseId: resolveToolUseId({ call_id: block.call_id, name: block.name }, index),
			name: block.name,
			input: block.params,
			call_id: block.call_id,
			signature: block.signature,
			isNativeToolCall: false,
		}))
}

function pushSubagentToolResultBlock(toolResultBlocks: any[], call: SubagentToolCall, label: string, content: string): void {
	if (call.isNativeToolCall) {
		toolResultBlocks.push({
			type: "tool_result",
			tool_use_id: call.toolUseId,
			call_id: call.call_id,
			content,
		})
		return
	}

	toolResultBlocks.push({
		type: "text",
		text: `${label} Result:\n${content}`,
	})
}

export class SubagentRunner {
	private readonly agent: SubagentBuilder
	private readonly apiHandler: ApiHandler
	private readonly allowedTools: ClineDefaultTool[]
	private activeApiAbort: (() => void) | undefined
	private abortRequested = false
	private activeCommandExecutions = 0
	private abortingCommands = false
	/** 预算/超时原因：一旦设置，所有退出路径都返回可读原因而不是笼统的 cancelled */
	private budgetReason: SubagentBudgetReason | undefined
	private turnCount = 0
	private startedAt = 0
	private lastChunkAt = 0
	/** 只有「正在等 API chunk」时才允许空闲看门狗开火；工具执行耗时长不算卡死 */
	private awaitingChunk = false
	/** 进度回调的异常只 warn 一次：中止后每次 say 都会抛，刷屏没有意义 */
	private progressErrorLogged = false

	constructor(
		private baseConfig: TaskConfig,
		subagentName = "subagent",
	) {
		this.agent = new SubagentBuilder(baseConfig, subagentName)
		this.apiHandler = this.agent.getApiHandler()
		this.allowedTools = this.agent.getAllowedTools()
	}

	async abort(): Promise<void> {
		this.abortRequested = true

		try {
			this.activeApiAbort?.()
		} catch (error) {
			Logger.error("[SubagentRunner] failed to abort active API stream", error)
		}

		if (this.activeCommandExecutions > 0 && !this.abortingCommands && this.baseConfig.callbacks.cancelRunningCommandTool) {
			this.abortingCommands = true
			try {
				await this.baseConfig.callbacks.cancelRunningCommandTool()
			} catch (error) {
				Logger.error("[SubagentRunner] failed to cancel running command execution", error)
			} finally {
				this.abortingCommands = false
			}
		}
	}

	private shouldAbort(): boolean {
		return this.abortRequested || this.baseConfig.taskState.abort
	}

	private async getWorkspaceMetadataEnvironmentBlock(): Promise<string | null> {
		try {
			const workspacesJson =
				(await this.baseConfig.workspaceManager?.buildWorkspacesJson()) ??
				JSON.stringify(
					{
						workspaces: {
							[this.baseConfig.cwd]: {
								hint: path.basename(this.baseConfig.cwd) || this.baseConfig.cwd,
							},
						},
					},
					null,
					2,
				)

			return `<environment_details>\n# Workspace Configuration\n${workspacesJson}\n</environment_details>`
		} catch (error) {
			Logger.warn("[SubagentRunner] Failed to build workspace metadata block", error)
			return null
		}
	}

	async run(prompt: string, onProgress: (update: SubagentProgressUpdate) => void | Promise<void>): Promise<SubagentRunResult> {
		this.abortRequested = false
		this.budgetReason = undefined
		this.turnCount = 0
		this.progressErrorLogged = false
		this.startedAt = Date.now()
		this.lastChunkAt = this.startedAt
		this.awaitingChunk = false
		const state = new TaskState()
		let emptyAssistantResponseRetries = 0
		const contextState: SubagentContextState = {}
		const contextManager = new ContextManager()
		const usageState: SubagentUsageState = {
			currentRequest: createEmptyRequestUsageState(),
		}
		const stats: SubagentRunStats = {
			toolCalls: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheWriteTokens: 0,
			cacheReadTokens: 0,
			totalCost: 0,
			contextTokens: 0,
			contextWindow: 0,
			contextUsagePercentage: 0,
		}

		void this.emit(onProgress, { status: "running", stats })

		let idleWatchdog: ReturnType<typeof setInterval> | undefined

		try {
			const mode = this.baseConfig.services.stateManager.getGlobalSettingsKey("mode")
			const apiConfiguration = this.baseConfig.services.stateManager.getApiConfiguration()
			const api = this.apiHandler
			this.activeApiAbort = api.abort?.bind(api)

			// 空闲看门狗：只在「等 API chunk」时生效；工具执行耗时长不算卡死。
			// 一旦空闲超限，先记原因再 abort，保证退出路径能给出可读文案。
			idleWatchdog = setInterval(() => {
				if (!this.awaitingChunk) {
					return
				}
				if (Date.now() - this.lastChunkAt <= SUBAGENT_BUDGET.maxIdleMs) {
					return
				}
				this.budgetReason = this.budgetReason ?? "idle"
				void this.abort()
			}, 5_000)

			const providerId = (
				mode === "plan" ? apiConfiguration.planModeApiProvider : apiConfiguration.actModeApiProvider
			) as string
			const providerInfo = {
				providerId,
				model: api.getModel(),
				mode,
				customPrompt: this.baseConfig.services.stateManager.getGlobalSettingsKey("customPrompt"),
			}
			stats.contextWindow = providerInfo.model.info.contextWindow || 0
			const nativeToolCallsRequested =
				providerInfo.model.info.apiFormat === ApiFormat.OPENAI_RESPONSES ||
				!!this.baseConfig.services.stateManager.getGlobalStateKey("nativeToolCallEnabled")

			const host = HostRegistryInfo.get()
			const remoteSkillEntries = this.baseConfig.services.stateManager.getRemoteConfigSettings().remoteGlobalSkills || []
			const availableSkills = await discoverAvailableSkills(this.baseConfig.cwd, {
				remoteSkillEntries,
				globalSkillsToggles: this.baseConfig.services.stateManager.getGlobalSettingsKey("globalSkillsToggles") ?? {},
				localSkillsToggles: this.baseConfig.services.stateManager.getWorkspaceStateKey("localSkillsToggles") ?? {},
				remoteSkillsToggles: this.baseConfig.services.stateManager.getGlobalStateKey("remoteSkillsToggles") ?? {},
			})
			const configuredSkillNames = this.agent.getConfiguredSkills()
			const skills =
				configuredSkillNames !== undefined
					? configuredSkillNames
							.map((skillName) => {
								const skill = availableSkills.find((candidate) => candidate.name === skillName)
								if (!skill) {
									Logger.warn(`[SubagentRunner] Configured skill '${skillName}' not found for subagent run.`)
								}
								return skill
							})
							.filter((skill): skill is (typeof availableSkills)[number] => Boolean(skill))
					: availableSkills

			// 子代理也要知道用户偏好（称呼/语言），但不暴露写入工具（tool 的 contextRequirements 已排除子代理）
			const subagentMemoryDocument = await readGlobalMemoryDocument()

			const context: SystemPromptContext = {
				providerInfo,
				cwd: this.baseConfig.cwd,
				ide: host?.platform || "Unknown",
				skills,
				focusChainSettings: this.baseConfig.focusChainSettings,
				yoloModeToggled: false,
				enableNativeToolCalls: nativeToolCallsRequested,
				enableParallelToolCalling: false,
				isSubagentRun: true,
				globalMemory: formatGlobalMemoryForPrompt(subagentMemoryDocument),
				globalMemoryEnabled: subagentMemoryDocument.enabled,
			}

			const promptRegistry = PromptRegistry.getInstance()
			const generatedSystemPrompt = await promptRegistry.get(context)
			const systemPrompt = this.agent.buildSystemPrompt(generatedSystemPrompt)
			const useNativeToolCalls = !!promptRegistry.nativeTools?.length
			const nativeTools = useNativeToolCalls ? this.agent.buildNativeTools(context) : undefined
			const workspaceMetadataEnvironmentBlock = await this.getWorkspaceMetadataEnvironmentBlock()

			if (useNativeToolCalls && (!nativeTools || nativeTools.length === 0)) {
				const error = "Subagent tool requires native tool calling support."
				void this.emit(onProgress, { status: "failed", error, stats })
				return { status: "failed", error, stats }
			}

			if (this.shouldAbort()) {
				await this.abort()
				const error = "Subagent run cancelled."
				void this.emit(onProgress, { status: "failed", error, stats: { ...stats } })
				return { status: "failed", error, stats }
			}

			const conversation: ClineStorageMessage[] = [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: prompt,
						} as ClineTextContentBlock,
						// Server-side task loop checks require workspace metadata to be present in the
						// initial user message of subagent runs.
						...(workspaceMetadataEnvironmentBlock
							? [
									{
										type: "text",
										text: workspaceMetadataEnvironmentBlock,
									} as ClineTextContentBlock,
								]
							: []),
					],
				},
			]

			while (true) {
				this.turnCount += 1
				const preTurnBudget = this.checkBudget(stats)
				if (preTurnBudget) {
					const error = budgetMessage(preTurnBudget)
					void this.emit(onProgress, { status: "failed", error, stats: { ...stats } })
					return { status: "failed", error, stats, budgetReason: preTurnBudget }
				}
				if (
					usageState.lastRequest &&
					this.shouldCompactBeforeNextRequest(usageState.lastRequest.totalTokens, api, providerInfo.model.id)
				) {
					const compactResult = this.compactConversationForContextWindow(
						contextManager,
						conversation,
						contextState.conversationHistoryDeletedRange,
					)
					contextState.conversationHistoryDeletedRange = compactResult.conversationHistoryDeletedRange
					if (compactResult.didCompact) {
						Logger.warn("[SubagentRunner] Proactively compacted context before next subagent request.")
					}
					// Prevent repeated compaction attempts off the same token sample.
					usageState.lastRequest = undefined
				}

				const streamHandler = new StreamResponseHandler()
				const { toolUseHandler } = streamHandler.getHandlers()
				usageState.currentRequest = createEmptyRequestUsageState()
				const requestUsage = usageState.currentRequest

				let assistantText = ""
				let assistantTextSignature: string | undefined
				let requestId: string | undefined

				const stream = this.createMessageWithInitialChunkRetry(
					api,
					systemPrompt,
					conversation,
					nativeTools,
					providerInfo.providerId,
					providerInfo.model.id,
					contextManager,
					contextState,
				)

				this.awaitingChunk = true
				this.lastChunkAt = Date.now()
				for await (const chunk of stream) {
					this.lastChunkAt = Date.now()
					switch (chunk.type) {
						case "usage":
							requestId = requestId ?? chunk.id
							stats.inputTokens += chunk.inputTokens || 0
							stats.outputTokens += chunk.outputTokens || 0
							stats.cacheWriteTokens += chunk.cacheWriteTokens || 0
							stats.cacheReadTokens += chunk.cacheReadTokens || 0
							requestUsage.inputTokens += chunk.inputTokens || 0
							requestUsage.outputTokens += chunk.outputTokens || 0
							requestUsage.cacheWriteTokens += chunk.cacheWriteTokens || 0
							requestUsage.cacheReadTokens += chunk.cacheReadTokens || 0
							requestUsage.totalTokens =
								requestUsage.inputTokens +
								requestUsage.outputTokens +
								requestUsage.cacheWriteTokens +
								requestUsage.cacheReadTokens
							requestUsage.totalCost = chunk.totalCost ?? requestUsage.totalCost
							stats.contextTokens = requestUsage.totalTokens
							stats.contextUsagePercentage =
								stats.contextWindow > 0 ? (stats.contextTokens / stats.contextWindow) * 100 : 0
							void this.emit(onProgress, { stats: { ...stats } })
							break
						case "text":
							requestId = requestId ?? chunk.id
							assistantText += chunk.text || ""
							assistantTextSignature = chunk.signature || assistantTextSignature
							break
						case "tool_calls":
							requestId = requestId ?? chunk.id
							toolUseHandler.processToolUseDelta(
								{
									id: chunk.tool_call.function?.id,
									type: "tool_use",
									name: chunk.tool_call.function?.name,
									input: normalizeToolCallArguments(chunk.tool_call.function?.arguments),
									signature: chunk.signature,
								},
								chunk.tool_call.call_id,
							)
							break
						case "reasoning":
							requestId = requestId ?? chunk.id
							break
					}

					if (this.shouldAbort()) {
						await this.abort()
						const cancelledError = this.budgetReason ? budgetMessage(this.budgetReason) : "Subagent run cancelled."
						void this.emit(onProgress, { status: "failed", error: cancelledError, stats: { ...stats } })
						return {
							status: "failed",
							error: cancelledError,
							stats,
							...(this.budgetReason ? { budgetReason: this.budgetReason } : {}),
						}
					}
				}
				this.awaitingChunk = false

				const calculatedRequestCost =
					requestUsage.totalCost ??
					calculateApiCostAnthropic(
						providerInfo.model.info,
						requestUsage.inputTokens,
						requestUsage.outputTokens,
						requestUsage.cacheWriteTokens,
						requestUsage.cacheReadTokens,
					)
				requestUsage.totalTokens =
					requestUsage.inputTokens +
					requestUsage.outputTokens +
					requestUsage.cacheWriteTokens +
					requestUsage.cacheReadTokens
				stats.totalCost += calculatedRequestCost || 0
				usageState.lastRequest = { ...requestUsage }

				const postRequestBudget = this.checkBudget(stats)
				if (postRequestBudget) {
					const error = budgetMessage(postRequestBudget)
					void this.emit(onProgress, { status: "failed", error, stats: { ...stats } })
					return { status: "failed", error, stats, budgetReason: postRequestBudget }
				}

				const nativeFinalizedToolCalls = toolUseHandler.getAllFinalizedToolUses().map((toolCall, index) => ({
					toolUseId: resolveToolUseId(toolCall, index),
					id: toolCall.id,
					call_id: toolCall.call_id,
					signature: toolCall.signature,
					name: toolCall.name,
					input: toolCall.input,
					isNativeToolCall: true,
				}))
				const parsedNonNativeToolCalls = parseNonNativeToolCalls(assistantText)
				const fallbackNonNativeToolCalls = nativeFinalizedToolCalls.map((toolCall) => ({
					...toolCall,
					isNativeToolCall: false,
				}))

				let finalizedToolCalls: SubagentToolCall[] = []
				if (useNativeToolCalls) {
					finalizedToolCalls = nativeFinalizedToolCalls
				} else if (parsedNonNativeToolCalls.length > 0) {
					finalizedToolCalls = parsedNonNativeToolCalls
				} else if (fallbackNonNativeToolCalls.length > 0) {
					// Defensive fallback: if non-native mode receives structured tool call chunks,
					// execute them but serialize results as plain text to avoid tool_result pairing mismatches.
					Logger.warn(
						"[SubagentRunner] Received structured tool_calls while native tool calling is disabled; falling back to non-native result serialization.",
					)
					finalizedToolCalls = fallbackNonNativeToolCalls
				}
				const assistantContent = [] as any[]
				if (assistantText.trim().length > 0) {
					assistantContent.push({
						type: "text",
						text: assistantText,
						signature: assistantTextSignature,
					})
				}
				if (useNativeToolCalls) {
					assistantContent.push(...finalizedToolCalls.map(toAssistantToolUseBlock))
				}

				if (assistantContent.length > 0) {
					conversation.push({
						role: "assistant",
						content: assistantContent,
						id: requestId,
					})
				}

				if (finalizedToolCalls.length === 0) {
					emptyAssistantResponseRetries += 1
					if (emptyAssistantResponseRetries > MAX_EMPTY_ASSISTANT_RETRIES) {
						const error = "Subagent did not call attempt_completion."
						void this.emit(onProgress, { status: "failed", error, stats: { ...stats } })
						return { status: "failed", error, stats }
					}

					// Mirror the main loop's no-tools-used nudge so empty/blank model turns
					// can recover without surfacing an immediate hard failure in subagent UI.
					if (assistantContent.length === 0) {
						conversation.push({
							role: "assistant",
							content: [
								{
									type: "text",
									text: "Failure: I did not provide a response.",
								},
							],
							id: requestId,
						})
					}
					conversation.push({
						role: "user",
						content: [
							{
								type: "text",
								text: formatResponse.noToolsUsed(useNativeToolCalls),
							},
						],
					})
					await delay(0)
					continue
				}
				emptyAssistantResponseRetries = 0

				const toolResultBlocks = [] as ClineUserContent[]
				for (const call of finalizedToolCalls) {
					const toolName = call.name as ClineDefaultTool
					const toolCallParams = toToolUseParams(call.input)

					if (toolName === ClineDefaultTool.ATTEMPT) {
						const completionResult = toolCallParams.result?.trim()
						if (!completionResult) {
							const missingResultError = formatResponse.missingToolParameterError("result")
							pushSubagentToolResultBlock(toolResultBlocks, call, toolName, missingResultError)
							continue
						}

						stats.toolCalls += 1
						void this.emit(onProgress, { stats: { ...stats } })
						void this.emit(onProgress, { status: "completed", result: completionResult, stats: { ...stats } })
						return { status: "completed", result: completionResult, stats }
					}

					if (!this.allowedTools.includes(toolName)) {
						const deniedResult = formatResponse.toolError(`Tool '${toolName}' is not available inside subagent runs.`)
						pushSubagentToolResultBlock(toolResultBlocks, call, toolName, deniedResult)
						continue
					}

					// 与主循环同一套循环检测：子代理此前直接调 handler，绕过了 ToolExecutor，
					// 于是「同一文件反复读」永远不会熔断（2026-10-31 事故 1936 次工具调用）。
					const callSignature = toolCallSignature(toolCallParams, toolName)
					const loopCheck = checkRepeatedToolCall(state, toolName, callSignature)
					state.lastToolName = toolName
					state.lastToolParams = callSignature
					if (loopCheck.hardEscalation) {
						const error = `子代理已中止：检测到重复调用 ${toolName} 且参数完全相同（窗口内 ${loopCheck.windowCount} 次），继续只会烧钱。`
						void this.emit(onProgress, { status: "failed", error, stats: { ...stats } })
						return { status: "failed", error, stats }
					}

					const toolCallBlock: ToolUse = {
						type: "tool_use",
						name: toolName,
						params: toolCallParams,
						partial: false,
						isNativeToolCall: call.isNativeToolCall,
						call_id: call.call_id || call.toolUseId,
						signature: call.signature,
					}

					if (call.call_id) {
						state.toolUseIdMap.set(call.call_id, call.toolUseId)
					}

					const latestToolCall = formatToolCallPreview(toolName, toolCallParams)
					void this.emit(onProgress, { latestToolCall })

					const subagentConfig = this.createSubagentTaskConfig(state)
					const handler = this.baseConfig.coordinator.getHandler(toolName)
					let toolResult: unknown

					if (!handler) {
						toolResult = formatResponse.toolError(`No handler registered for tool '${toolName}'.`)
					} else {
						try {
							toolResult = await handler.execute(subagentConfig, toolCallBlock)
						} catch (error) {
							toolResult = formatResponse.toolError((error as Error).message)
						}
					}

					stats.toolCalls += 1
					void this.emit(onProgress, { stats: { ...stats } })

					const postToolBudget = this.checkBudget(stats)
					if (postToolBudget) {
						const error = budgetMessage(postToolBudget)
						void this.emit(onProgress, { status: "failed", error, stats: { ...stats } })
						return { status: "failed", error, stats, budgetReason: postToolBudget }
					}

					const serializedToolResult = serializeToolResult(toolResult)
					const loopWarning = loopCheck.softWarning
						? `[loop warning] 同一调用（${toolName}）在最近窗口中重复了 ${Math.max(loopCheck.windowCount, LOOP_DETECTION_SOFT_THRESHOLD)} 次。不要继续重复；用已有内容作答，或换参数/换文件。\n\n`
						: ""
					const toolDescription = handler?.getDescription(toolCallBlock) || `[${toolName}]`
					pushSubagentToolResultBlock(toolResultBlocks, call, toolDescription, `${loopWarning}${serializedToolResult}`)
				}

				conversation.push({
					role: "user",
					content: toolResultBlocks,
				})

				await delay(0)
			}
		} catch (error) {
			if (this.budgetReason) {
				const budgetError = budgetMessage(this.budgetReason)
				void this.emit(onProgress, { status: "failed", error: budgetError, stats: { ...stats } })
				return { status: "failed", error: budgetError, stats, budgetReason: this.budgetReason }
			}
			if (this.shouldAbort()) {
				const cancelledError = "Subagent run cancelled."
				void this.emit(onProgress, { status: "failed", error: cancelledError, stats: { ...stats } })
				return { status: "failed", error: cancelledError, stats }
			}

			const errorText = (error as Error).message || "Subagent execution failed."
			Logger.error("[SubagentRunner] run failed", error)
			void this.emit(onProgress, { status: "failed", error: errorText, stats: { ...stats } })
			return { status: "failed", error: errorText, stats }
		} finally {
			if (idleWatchdog) {
				clearInterval(idleWatchdog)
			}
			this.awaitingChunk = false
			this.activeApiAbort = undefined
		}
	}

	/**
	 * 发一条进度回调，并**接住它的 rejection**。
	 *
	 * `onProgress` 由 `SubagentToolHandler` 传进来，是个 async 函数（内部要 `await say`）。
	 * 中止瞬间 `Task.say()` 会抛 `Cline instance aborted`，而这里十几处调用都不需要等它完成——
	 * 以前是裸调用，返回值里的 rejection 没人接管，直接变成 unhandled rejection（能掀翻宿主进程）。
	 * 进度只是 UI 提示，失败不该影响子代理本身的结论，所以吞掉并只 warn 一次。
	 */
	private async emit(
		onProgress: (update: SubagentProgressUpdate) => void | Promise<void>,
		update: SubagentProgressUpdate,
	): Promise<void> {
		try {
			await onProgress(update)
		} catch (error) {
			if (!this.progressErrorLogged) {
				this.progressErrorLogged = true
				Logger.warn(`[subagent] 进度回调失败（后续同类错误不再记录）：${error}`)
			}
		}
	}

	/** 当前预算快照 → 超标原因；每轮/每次工具后都调一次，保证不会多跑一步 */
	private checkBudget(stats: SubagentRunStats): SubagentBudgetReason | undefined {
		const now = Date.now()
		return checkSubagentBudget({
			turns: this.turnCount,
			toolCalls: stats.toolCalls,
			costCny: stats.totalCost,
			// 只算真实计费的 input/output，不含 cacheReads：
			// 缓存命中会把同一段上下文反复计数，含进去会误杀正常任务
			totalTokens: stats.inputTokens + stats.outputTokens,
			elapsedMs: now - this.startedAt,
			// 只在「等 chunk」时算空闲；工具执行耗时长不应被判成卡死
			idleMs: this.awaitingChunk ? now - this.lastChunkAt : 0,
		})
	}

	/**
	 * 等一个 chunk 最多 maxIdleMs；超时就 abort 并抛错。
	 *
	 * 只靠 `api.abort()` 不够——底层 HTTP 流若不响应 abort，`for await` 会永久挂起
	 * （2026-10-31 实测卡了 93 分钟）。Promise.race 保证即使底层 promise 永不 settle，
	 * 子代理也能在 90 秒后退出。
	 */
	private async withIdleTimeout<T>(promise: Promise<T>): Promise<T> {
		let timer: ReturnType<typeof setTimeout> | undefined
		try {
			return await Promise.race([
				promise,
				new Promise<T>((_resolve, reject) => {
					timer = setTimeout(() => {
						this.budgetReason = this.budgetReason ?? "idle"
						try {
							this.activeApiAbort?.()
						} catch {
							// abort 失败不影响判定：下面直接抛错退出
						}
						reject(new Error(budgetMessage("idle")))
					}, SUBAGENT_BUDGET.maxIdleMs)
				}),
			])
		} finally {
			if (timer) {
				clearTimeout(timer)
			}
		}
	}

	private createSubagentTaskConfig(state: TaskState): TaskConfig {
		const baseCallbacks = this.baseConfig.callbacks
		const coordinator = new ToolExecutorCoordinator()
		const validator = new ToolValidator(this.baseConfig.services.clineIgnoreController)

		for (const tool of this.allowedTools) {
			coordinator.registerByName(tool, validator)
		}

		return {
			...this.baseConfig,
			api: this.apiHandler,
			coordinator,
			taskState: state,
			isSubagentExecution: true,
			vscodeTerminalExecutionMode: "backgroundExec",
			callbacks: {
				...baseCallbacks,
				say: async () => undefined,
				sayAndCreateMissingParamError: async (_toolName, paramName) =>
					formatResponse.toolError(formatResponse.missingToolParameterError(paramName)),
				executeCommandTool: async (command: string, timeoutSeconds: number | undefined) => {
					this.activeCommandExecutions += 1
					try {
						return await baseCallbacks.executeCommandTool(command, timeoutSeconds, {
							useBackgroundExecution: true,
							suppressUserInteraction: true,
						})
					} finally {
						this.activeCommandExecutions = Math.max(0, this.activeCommandExecutions - 1)
					}
				},
			},
		}
	}

	private shouldRetryInitialStreamError(error: unknown, providerId: string, modelId: string): boolean {
		// Mirror main loop behavior: do not auto-retry auth/balance failures.
		const parsedError = ClineError.transform(error, modelId, providerId)
		const isAuthError = parsedError.isErrorType(ClineErrorType.Auth)
		const isBalanceError = parsedError.isErrorType(ClineErrorType.Balance)

		if (isAuthError || isBalanceError) {
			return false
		}

		return true
	}

	private compactConversationForContextWindow(
		contextManager: ContextManager,
		conversation: ClineStorageMessage[],
		conversationHistoryDeletedRange: [number, number] | undefined,
	): {
		didCompact: boolean
		conversationHistoryDeletedRange: [number, number] | undefined
	} {
		const optimizationResult = this.optimizeConversationForContextWindow(contextManager, conversation)
		let didCompact = optimizationResult.didOptimize
		let updatedDeletedRange = conversationHistoryDeletedRange

		if (optimizationResult.didOptimize && !optimizationResult.needToTruncate) {
			return {
				didCompact: true,
				conversationHistoryDeletedRange: updatedDeletedRange,
			}
		}

		const deletedRange = contextManager.getNextTruncationRange(conversation, conversationHistoryDeletedRange, "quarter")
		if (deletedRange[1] < deletedRange[0]) {
			return {
				didCompact,
				conversationHistoryDeletedRange: updatedDeletedRange,
			}
		}

		if (
			conversationHistoryDeletedRange &&
			deletedRange[0] === conversationHistoryDeletedRange[0] &&
			deletedRange[1] === conversationHistoryDeletedRange[1]
		) {
			return {
				didCompact,
				conversationHistoryDeletedRange: updatedDeletedRange,
			}
		}

		updatedDeletedRange = deletedRange
		didCompact = true
		return {
			didCompact,
			conversationHistoryDeletedRange: updatedDeletedRange,
		}
	}

	private optimizeConversationForContextWindow(
		contextManager: ContextManager,
		conversation: ClineStorageMessage[],
	): {
		didOptimize: boolean
		needToTruncate: boolean
	} {
		const timestamp = Date.now()
		const optimizationResult = contextManager.attemptFileReadOptimizationInMemory(conversation, undefined, timestamp)
		if (!optimizationResult.anyContextUpdates) {
			return { didOptimize: false, needToTruncate: true }
		}

		const optimizedConversation = optimizationResult.optimizedConversationHistory.map(
			(message) => message as ClineStorageMessage,
		)
		conversation.splice(0, conversation.length, ...optimizedConversation)
		return { didOptimize: true, needToTruncate: optimizationResult.needToTruncate }
	}

	private shouldCompactBeforeNextRequest(
		requestTotalTokens: number,
		api: ReturnType<typeof buildApiHandler>,
		modelId: string,
	): boolean {
		const { contextWindow, maxAllowedSize } = getContextWindowInfo(api)
		const useAutoCondense = this.baseConfig.services.stateManager.getGlobalSettingsKey("useAutoCondense")
		if (useAutoCondense && isNextGenModelFamily(modelId)) {
			const autoCondenseThreshold = 0.75
			const roundedThreshold = autoCondenseThreshold ? Math.floor(contextWindow * autoCondenseThreshold) : maxAllowedSize
			const thresholdTokens = Math.min(roundedThreshold, maxAllowedSize)
			return requestTotalTokens >= thresholdTokens
		}

		return requestTotalTokens >= maxAllowedSize
	}

	private async *createMessageWithInitialChunkRetry(
		api: ReturnType<typeof buildApiHandler>,
		systemPrompt: string,
		fullConversation: ClineStorageMessage[],
		nativeTools: ClineTool[] | undefined,
		providerId: string,
		modelId: string,
		contextManager: ContextManager,
		contextState: SubagentContextState,
	) {
		for (let attempt = 1; attempt <= MAX_INITIAL_STREAM_ATTEMPTS; attempt += 1) {
			const truncatedConversation = contextManager
				.getTruncatedMessages(fullConversation, contextState.conversationHistoryDeletedRange)
				.map((message) => message as ClineStorageMessage)
			const stream = api.createMessage(systemPrompt, truncatedConversation, nativeTools)
			const iterator = stream[Symbol.asyncIterator]()

			try {
				const firstChunk = await this.withIdleTimeout(iterator.next())
				if (!firstChunk.done) {
					yield firstChunk.value
				}

				while (true) {
					const next = await this.withIdleTimeout(iterator.next())
					if (next.done) {
						return
					}
					yield next.value
				}
			} catch (error) {
				// 预算/超时导致的异常不再重试——重试只会继续烧钱
				if (this.budgetReason) {
					throw error
				}
				if (checkContextWindowExceededError(error)) {
					const compactResult = this.compactConversationForContextWindow(
						contextManager,
						fullConversation,
						contextState.conversationHistoryDeletedRange,
					)
					contextState.conversationHistoryDeletedRange = compactResult.conversationHistoryDeletedRange
					if (!compactResult.didCompact || this.shouldAbort() || attempt >= MAX_INITIAL_STREAM_ATTEMPTS) {
						throw error
					}
					Logger.warn(
						`[SubagentRunner] Context window exceeded on initial stream attempt ${attempt}; compacted conversation and retrying.`,
					)
					continue
				}

				const shouldRetry =
					!this.shouldAbort() &&
					!this.budgetReason &&
					attempt < MAX_INITIAL_STREAM_ATTEMPTS &&
					this.shouldRetryInitialStreamError(error, providerId, modelId)
				if (!shouldRetry) {
					throw error
				}

				const delayMs = INITIAL_STREAM_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
				Logger.warn(`[SubagentRunner] Initial stream failed. Retrying attempt ${attempt + 1}.`, error)
				await delay(delayMs)
			}
		}
	}
}

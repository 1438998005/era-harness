import type { ToolUse } from "@core/assistant-message"
import { recordAudit } from "@core/logging/auditLog"
import { formatResponse } from "@core/prompts/responses"
import {
	ClineAskUseSubagents,
	ClineSaySubagentStatus,
	ClineSubagentUsageInfo,
	SubagentStatusItem,
} from "@shared/ExtensionMessage"
import { telemetryService } from "@/services/telemetry"
import {
	providerSupportsSubagents,
	resolveSubagentsEnabled,
	SUBAGENTS_UNAVAILABLE_FREE_PROVIDER_MESSAGE,
} from "@/shared/subagents"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import { showNotificationForApproval } from "../../utils"
import { AgentConfigLoader } from "../subagent/AgentConfigLoader"
import { SubagentRunner, type SubagentRunResult } from "../subagent/SubagentRunner"
import { budgetMessage, SUBAGENT_BUDGET, SUBAGENT_CALL_BUDGET } from "../subagent/subagentBudget"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

const MAX_SUBAGENT_PROMPTS = 5
const PROMPT_KEYS = ["prompt_1", "prompt_2", "prompt_3", "prompt_4", "prompt_5"] as const

function resolveConfiguredSubagentName(toolName: string): string | undefined {
	return AgentConfigLoader.getInstance().resolveSubagentNameForTool(toolName)
}

function collectPrompts(block: ToolUse, configuredSubagentName?: string): string[] {
	if (configuredSubagentName) {
		const dynamicPrompt = block.params.prompt?.trim() || block.params.prompt_1?.trim()
		return dynamicPrompt ? [dynamicPrompt] : []
	}

	return PROMPT_KEYS.map((key) => block.params[key]?.trim()).filter((prompt): prompt is string => !!prompt)
}

function excerpt(text: string | undefined, maxChars = 1200): string {
	if (!text) {
		return ""
	}

	const trimmed = text.trim()
	if (trimmed.length <= maxChars) {
		return trimmed
	}

	return `${trimmed.slice(0, maxChars)}...`
}

export class UseSubagentsToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.USE_SUBAGENTS

	getDescription(_block: ToolUse): string {
		const configuredSubagentName = resolveConfiguredSubagentName(_block.name)
		return configuredSubagentName ? `[subagent: ${configuredSubagentName}]` : "[subagents]"
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const configuredSubagentName = resolveConfiguredSubagentName(block.name)
		const prompts = configuredSubagentName
			? [
					uiHelpers
						.removeClosingTag(block, "prompt", block.params.prompt?.trim() || block.params.prompt_1?.trim())
						?.trim(),
				].filter((prompt): prompt is string => !!prompt)
			: PROMPT_KEYS.map((key) => uiHelpers.removeClosingTag(block, key, block.params[key]?.trim()))
					.map((prompt) => prompt?.trim())
					.filter((prompt): prompt is string => !!prompt)

		if (prompts.length === 0) {
			return
		}

		const partialMessage = JSON.stringify({ prompts } satisfies ClineAskUseSubagents)
		const autoApproveResult = uiHelpers.shouldAutoApproveTool(this.name)
		const [shouldAutoApprove] = Array.isArray(autoApproveResult) ? autoApproveResult : [autoApproveResult, false]

		if (shouldAutoApprove) {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("ask", "use_subagents")
			await uiHelpers.say("use_subagents", partialMessage, undefined, undefined, block.partial)
		} else {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "use_subagents")
			await uiHelpers.ask("use_subagents", partialMessage, block.partial).catch(() => {})
		}
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		// #100：子代理不能再开子代理。每层各有一份预算，嵌套一层就把上限翻一倍。
		// 默认允许工具集里本来就没有 use_subagents，这里拦的是「用户在自定义 agent 里显式配了」的情况。
		if (config.isSubagentExecution) {
			return formatResponse.toolError("子代理不能再开子代理：每层各有一份预算会让开销成倍放大。需要并行请回到主对话调用。")
		}

		// #94：生效值 = 用户开关 ∧ provider 支持。免费模型下工具本来不进提示词，
		// 这里兵行险着地拦一次（模型可能凭旧上下文强行调用），并给出可读原因。
		const apiConfig = config.services.stateManager.getApiConfiguration()
		const currentMode = config.services.stateManager.getGlobalSettingsKey("mode")
		const provider = (currentMode === "plan" ? apiConfig.planModeApiProvider : apiConfig.actModeApiProvider) as string
		const subagentsEnabled = resolveSubagentsEnabled(
			config.services.stateManager.getGlobalSettingsKey("subagentsEnabled"),
			provider,
		)
		if (!subagentsEnabled) {
			recordAudit({
				event: "tool",
				taskId: config.taskId,
				turn: config.taskState.apiRequestCount,
				tool: this.name,
				outcome: "denied",
				provider,
				model: config.api.getModel().id,
				message: !providerSupportsSubagents(provider) ? "provider=free" : "user-disabled",
			})
			if (!providerSupportsSubagents(provider)) {
				return formatResponse.toolError(SUBAGENTS_UNAVAILABLE_FREE_PROVIDER_MESSAGE)
			}
			return formatResponse.toolError("Subagents are disabled. Enable them in Settings > Features to use this tool.")
		}

		const configuredSubagentName = resolveConfiguredSubagentName(block.name)
		const prompts = collectPrompts(block, configuredSubagentName)

		if (prompts.length === 0) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, configuredSubagentName ? "prompt" : "prompt_1")
		}

		if (!configuredSubagentName && prompts.length > MAX_SUBAGENT_PROMPTS) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(
				`Too many subagent prompts provided (${prompts.length}). Maximum is ${MAX_SUBAGENT_PROMPTS}.`,
			)
		}

		const modelId = config.api.getModel().id
		const approvalPayload: ClineAskUseSubagents = { prompts }
		const approvalBody = JSON.stringify(approvalPayload)

		const autoApproveResult = config.autoApprover?.shouldAutoApproveTool(this.name)
		const [autoApproveSafe] = Array.isArray(autoApproveResult) ? autoApproveResult : [autoApproveResult, false]
		const didAutoApprove = !!autoApproveSafe

		if (didAutoApprove) {
			telemetryService.captureToolUsage(
				config.ulid,
				this.name,
				config.api.getModel().id,
				provider,
				true,
				true,
				undefined,
				block.isNativeToolCall,
			)
		} else {
			showNotificationForApproval(
				prompts.length === 1
					? `Cline wants to use ${configuredSubagentName ? `the '${configuredSubagentName}' subagent` : "a subagent"}`
					: `Cline wants to use ${prompts.length} subagents`,
				config.autoApprovalSettings.enableNotifications,
			)
			const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("use_subagents", approvalBody, config)
			if (!didApprove) {
				telemetryService.captureToolUsage(
					config.ulid,
					this.name,
					config.api.getModel().id,
					provider,
					false,
					false,
					undefined,
					block.isNativeToolCall,
				)
				return formatResponse.toolDenied()
			}
			telemetryService.captureToolUsage(
				config.ulid,
				this.name,
				config.api.getModel().id,
				provider,
				false,
				true,
				undefined,
				block.isNativeToolCall,
			)
		}

		config.taskState.consecutiveMistakeCount = 0

		const entries: SubagentStatusItem[] = prompts.map((prompt, index) => ({
			index: index + 1,
			prompt,
			status: "pending",
			toolCalls: 0,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
			contextTokens: 0,
			contextWindow: 0,
			contextUsagePercentage: 0,
			latestToolCall: undefined,
		}))

		const emitStatus = async (status: ClineSaySubagentStatus["status"], partial: boolean) => {
			const completed = entries.filter((entry) => entry.status === "completed" || entry.status === "failed").length
			const successes = entries.filter((entry) => entry.status === "completed").length
			const failures = entries.filter((entry) => entry.status === "failed").length
			const toolCalls = entries.reduce((acc, entry) => acc + (entry.toolCalls || 0), 0)
			const inputTokens = entries.reduce((acc, entry) => acc + (entry.inputTokens || 0), 0)
			const outputTokens = entries.reduce((acc, entry) => acc + (entry.outputTokens || 0), 0)
			const contextWindow = entries.reduce((acc, entry) => Math.max(acc, entry.contextWindow || 0), 0)
			const maxContextTokens = entries.reduce((acc, entry) => Math.max(acc, entry.contextTokens || 0), 0)
			const maxContextUsagePercentage = entries.reduce((acc, entry) => Math.max(acc, entry.contextUsagePercentage || 0), 0)

			const payload: ClineSaySubagentStatus = {
				status,
				total: entries.length,
				completed,
				successes,
				failures,
				toolCalls,
				inputTokens,
				outputTokens,
				contextWindow,
				maxContextTokens,
				maxContextUsagePercentage,
				items: entries,
			}

			await config.callbacks.say("subagent", JSON.stringify(payload), undefined, undefined, partial)
		}

		let statusUpdateQueue: Promise<void> = Promise.resolve()
		const queueStatusUpdate = (status: ClineSaySubagentStatus["status"], partial: boolean): Promise<void> => {
			statusUpdateQueue = statusUpdateQueue.catch(() => undefined).then(() => emitStatus(status, partial))
			return statusUpdateQueue
		}

		await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "subagent")
		await queueStatusUpdate("running", true)

		const runners = prompts.map(() => new SubagentRunner(config, configuredSubagentName))
		const abortPollInterval = setInterval(() => {
			if (!config.taskState.abort) {
				return
			}
			clearInterval(abortPollInterval)
			void Promise.allSettled(runners.map((runner) => runner.abort()))
		}, 100)

		/** 调用级预算被触发的原因；undefined = 没触发 */
		let callBudgetReason: "callCost" | "callTokens" | undefined
		/** 调用级预算超限：把还没跑完的一并标失败并 abort */
		const abortRemaining = (reason: "callCost" | "callTokens", totalCost: number) => {
			callBudgetReason = reason
			const message = budgetMessage(reason)
			for (const [entryIndex, entry] of entries.entries()) {
				if (entry.status === "pending" || entry.status === "running") {
					entry.status = "failed"
					entry.error = message
					void runners[entryIndex].abort()
				}
			}
			recordAudit({
				event: "api",
				action: "usage",
				tool: "use_subagents",
				taskId: config.taskId,
				provider,
				model: modelId,
				cost: totalCost,
				outcome: "error",
				message,
				source: "subagent",
			})
		}

		const execution = prompts.map((prompt, index) =>
			runners[index].run(prompt, async (update) => {
				const current = entries[index]
				if (update.status === "running") {
					current.status = "running"
				}
				if (update.status === "completed") {
					current.status = "completed"
				}
				if (update.status === "failed") {
					current.status = "failed"
				}
				if (update.result !== undefined) {
					current.result = update.result
				}
				if (update.error !== undefined) {
					current.error = update.error
				}
				if (update.latestToolCall !== undefined) {
					current.latestToolCall = update.latestToolCall
				}
				if (update.stats) {
					current.toolCalls = update.stats.toolCalls || 0
					current.inputTokens = update.stats.inputTokens || 0
					current.outputTokens = update.stats.outputTokens || 0
					current.totalCost = update.stats.totalCost || 0
					current.contextTokens = update.stats.contextTokens || 0
					current.contextWindow = update.stats.contextWindow || 0
					current.contextUsagePercentage = update.stats.contextUsagePercentage || 0
				}

				// 调用级总预算：任一子代理烧钱过快时，把还没跑完的一并停掉。
				// 单代理预算能拦住 96 元，这一层拦的是「5 个各 3 元」的合计上限。
				if (!callBudgetReason) {
					const totalCost = entries.reduce((acc, entry) => acc + (entry.totalCost || 0), 0)
					if (totalCost >= SUBAGENT_CALL_BUDGET.maxTotalCostCny) {
						abortRemaining("callCost", totalCost)
					} else if (totalCost === 0) {
						// 套餐 provider 把价格置 0 → 费用这一层永不触发，只能按用量兜底（#98）
						const totalTokens = entries.reduce(
							(acc, entry) => acc + (entry.inputTokens || 0) + (entry.outputTokens || 0),
							0,
						)
						if (totalTokens >= SUBAGENT_CALL_BUDGET.maxTotalTokens) {
							abortRemaining("callTokens", totalCost)
						}
					}
				}

				await queueStatusUpdate("running", true)
			}),
		)

		// 定时器必须进 finally：runner 卡死或中途抛错时，100ms 的轮询会一直留着（S4）。
		// 再套一层墙钟：单个 runner 的 withIdleTimeout 已能保证退出，但底层流若不响应 abort，
		// allSettled 仍可能永久挂起——那样连 finally 都进不去。
		let wallTimer: ReturnType<typeof setTimeout> | undefined
		const wallClock = new Promise<"timeout">((resolve) => {
			wallTimer = setTimeout(() => resolve("timeout"), SUBAGENT_BUDGET.maxWallMs + 60_000)
		})
		let settled: PromiseSettledResult<SubagentRunResult>[] | "timeout"
		try {
			settled = await Promise.race([Promise.allSettled(execution), wallClock])
		} finally {
			clearInterval(abortPollInterval)
			if (wallTimer) {
				clearTimeout(wallTimer)
			}
		}
		if (settled === "timeout") {
			await Promise.allSettled(runners.map((runner) => runner.abort()))
			const wallError = budgetMessage("wall")
			settled = prompts.map(() => ({ status: "rejected", reason: new Error(wallError) }) as PromiseRejectedResult)
		}
		let usageTokensIn = 0
		let usageTokensOut = 0
		let usageCacheWrites = 0
		let usageCacheReads = 0
		let usageCost = 0
		settled.forEach((result, index) => {
			if (result.status === "rejected") {
				entries[index].status = "failed"
				entries[index].error = (result.reason as Error)?.message || "Subagent execution failed"
				return
			}
			entries[index].status = result.value.status
			entries[index].result = result.value.result
			// 调用级预算把剩余 runner abort 时，底层返回的是笼统的 cancelled；
			// 这里改写成可读的总预算原因，否则 UI 看不到「为什么剩下的没跑」。
			const cancelledByCallBudget =
				Boolean(callBudgetReason) && result.value.status === "failed" && !result.value.budgetReason
			entries[index].error =
				cancelledByCallBudget && callBudgetReason ? budgetMessage(callBudgetReason) : result.value.error
			entries[index].toolCalls = result.value.stats.toolCalls || 0
			entries[index].inputTokens = result.value.stats.inputTokens || 0
			entries[index].outputTokens = result.value.stats.outputTokens || 0
			entries[index].totalCost = result.value.stats.totalCost || 0
			entries[index].contextTokens = result.value.stats.contextTokens || 0
			entries[index].contextWindow = result.value.stats.contextWindow || 0
			entries[index].contextUsagePercentage = result.value.stats.contextUsagePercentage || 0

			usageTokensIn += result.value.stats.inputTokens || 0
			usageTokensOut += result.value.stats.outputTokens || 0
			usageCacheWrites += result.value.stats.cacheWriteTokens || 0
			usageCacheReads += result.value.stats.cacheReadTokens || 0
			usageCost += result.value.stats.totalCost || 0

			// 子代理费用不再只活在 UI 气泡里：落审计才能在任务被中止/窗口重载后对账。
			recordAudit({
				event: "api",
				action: "usage",
				tool: "use_subagents",
				taskId: config.taskId,
				provider,
				model: modelId,
				inputTokens: result.value.stats.inputTokens || 0,
				outputTokens: result.value.stats.outputTokens || 0,
				cacheReadTokens: result.value.stats.cacheReadTokens || 0,
				cacheWriteTokens: result.value.stats.cacheWriteTokens || 0,
				cost: result.value.stats.totalCost || 0,
				source: "subagent",
				subagentIndex: entries[index].index,
				message: entries[index].status,
			})
		})

		const failures = entries.filter((entry) => entry.status === "failed").length
		try {
			await queueStatusUpdate(failures > 0 ? "failed" : "completed", false)
		} catch {
			// 任务已被中止时 say 会抛 Cline instance aborted；费用已落审计，不能让 UI 反噬任务
		}

		const subagentUsagePayload: ClineSubagentUsageInfo = {
			source: "subagents",
			tokensIn: usageTokensIn,
			tokensOut: usageTokensOut,
			cacheWrites: usageCacheWrites,
			cacheReads: usageCacheReads,
			cost: usageCost,
		}
		try {
			await config.callbacks.say("subagent_usage", JSON.stringify(subagentUsagePayload))
		} catch {
			// 同上：中止后不再让「发费用汇总」把 tool 执行变成异常
		}

		const successCount = entries.length - failures
		const totalToolCalls = entries.reduce((acc, entry) => acc + (entry.toolCalls || 0), 0)
		const maxContextUsagePercentage = entries.reduce((acc, entry) => Math.max(acc, entry.contextUsagePercentage || 0), 0)
		const maxContextTokens = entries.reduce((acc, entry) => Math.max(acc, entry.contextTokens || 0), 0)
		const contextWindow = entries.reduce((acc, entry) => Math.max(acc, entry.contextWindow || 0), 0)

		const summary = [
			"Subagent results:",
			`Total: ${entries.length}`,
			`Succeeded: ${successCount}`,
			`Failed: ${failures}`,
			`Tool calls: ${totalToolCalls}`,
			`Total cost: ¥${usageCost.toFixed(2)}`,
			...(callBudgetReason ? [`⚠️ ${budgetMessage(callBudgetReason)}`] : []),
			`Peak context usage: ${maxContextTokens.toLocaleString()} / ${contextWindow.toLocaleString()} (${maxContextUsagePercentage.toFixed(1)}%)`,
			"",
			...entries.map((entry) => {
				const header = `[${entry.index}] ${entry.status.toUpperCase()} - ${entry.prompt}`
				const detail = entry.status === "completed" ? excerpt(entry.result) : excerpt(entry.error)
				return detail ? `${header}\n${detail}` : header
			}),
		].join("\n")

		return formatResponse.toolResult(summary)
	}
}

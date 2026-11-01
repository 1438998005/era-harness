import { buildApiHandler } from "@core/api"
import { PromptRegistry } from "@core/prompts/system-prompt"
import { ClineToolSet } from "@core/prompts/system-prompt/registry/ClineToolSet"
import type { SystemPromptContext } from "@core/prompts/system-prompt/types"
import { ClineDefaultTool } from "@shared/tools"
import { ApiProvider } from "@/shared/api"
import { getProviderModelIdKey } from "@/shared/storage/provider-keys"
import type { TaskConfig } from "../types/TaskConfig"
import type { AgentBaseConfig } from "./AgentConfigLoader"
import { AgentConfigLoader } from "./AgentConfigLoader"

export type AgentConfig = Partial<AgentBaseConfig>

export const SUBAGENT_DEFAULT_ALLOWED_TOOLS: ClineDefaultTool[] = [
	ClineDefaultTool.FILE_READ,
	ClineDefaultTool.LIST_FILES,
	ClineDefaultTool.SEARCH,
	ClineDefaultTool.LIST_CODE_DEF,
	ClineDefaultTool.BASH,
	ClineDefaultTool.USE_SKILL,
	ClineDefaultTool.ATTEMPT,
]

/**
 * 子代理一律不给的工具（即使自定义 agent 的 YAML 里显式写了也不生效）。
 *
 * - `USE_SUBAGENTS`：防嵌套翻倍（#100）
 * - 写盘类：子代理的职责是探索代码；给了写权限就等于「YAML + 全局自动批准 = 静默改盘」（#112）
 */
const SUBAGENT_FORBIDDEN_TOOLS = new Set<ClineDefaultTool>([
	ClineDefaultTool.USE_SUBAGENTS,
	ClineDefaultTool.FILE_NEW,
	ClineDefaultTool.FILE_EDIT,
	ClineDefaultTool.APPLY_PATCH,
	ClineDefaultTool.NEW_RULE,
	ClineDefaultTool.GLOBAL_MEMORY,
	// #125：下面这批要么自带副作用、要么没有可用的审批通道，YAML 授予也不生效。
	// - MCP：等价于把「能起进程/写盘」的服务端交给无审批通道的子代理（#112 同源通道）
	// - NEW_TASK / ASK：会向真实用户弹窗（新建任务 / 追问），子代理没有这个通道
	// - RUN_GAME：拉起 GUI 进程并重写游戏目录引擎产物（handler 里另有硬拒兜底）
	ClineDefaultTool.MCP_USE,
	ClineDefaultTool.MCP_ACCESS,
	ClineDefaultTool.NEW_TASK,
	ClineDefaultTool.ASK,
	ClineDefaultTool.RUN_GAME,
])

export const SUBAGENT_SYSTEM_SUFFIX = `\n\n# Subagent Execution Mode
You are running as a research subagent. Your job is to explore the codebase and gather information to answer the question.
Explore, read related files, trace through call chains, and build a complete picture before reporting back.
You can read files, list directories, search for patterns, list code definitions, and run commands.
Only use execute_command for readonly operations like ls, grep, git log, git diff, gh, etc.
When it makes sense, be clever about chaining commands or in-command scripting in execute_command to quickly get relevant context - and using pipes / filters to help narrow results.
Do not run commands that modify files or system state.
When you have a comprehensive answer, call the attempt_completion tool.
The attempt_completion result field is sent directly to the main agent, so put your full final findings there.
Stop exploring as soon as you can answer; do not read more than ~30 files.
If you find yourself reading the same file or directory repeatedly, stop and report what you have.
Unless the subagent prompt explicitly asks for detailed analysis, keep the result concise and focus on the files the main agent should read next.
Include a section titled "Relevant file paths" and list only file paths, one per line.
Do not include line numbers, summaries, or per-file explanations unless explicitly requested.
`

export class SubagentBuilder {
	private readonly agentConfig: AgentConfig = {}
	private readonly allowedTools: ClineDefaultTool[]
	private readonly apiHandler: ReturnType<typeof buildApiHandler>

	constructor(
		private readonly baseConfig: TaskConfig,
		subagentName?: string,
	) {
		const subagentConfig = AgentConfigLoader.getInstance().getCachedConfig(subagentName)
		this.agentConfig = subagentConfig ?? {}
		this.allowedTools = this.resolveAllowedTools(this.agentConfig.tools)

		const mode = this.baseConfig.services.stateManager.getGlobalSettingsKey("mode")
		const apiConfiguration = this.baseConfig.services.stateManager.getApiConfiguration()
		const effectiveApiConfiguration = {
			...apiConfiguration,
			ulid: this.baseConfig.ulid,
		} as Record<string, unknown>
		this.applyModelOverride(effectiveApiConfiguration, mode, this.agentConfig.modelId)
		this.apiHandler = buildApiHandler(effectiveApiConfiguration as typeof apiConfiguration, mode)
	}

	getApiHandler(): ReturnType<typeof buildApiHandler> {
		return this.apiHandler
	}

	getAllowedTools(): ClineDefaultTool[] {
		return this.allowedTools
	}

	getConfiguredSkills(): string[] | undefined {
		return this.agentConfig.skills
	}

	buildSystemPrompt(generatedSystemPrompt: string): string {
		const configuredSystemPrompt = this.agentConfig?.systemPrompt?.trim()
		const systemPrompt = configuredSystemPrompt || generatedSystemPrompt
		return `${systemPrompt}${this.buildAgentIdentitySystemPrefix()}${SUBAGENT_SYSTEM_SUFFIX}`
	}

	buildNativeTools(context: SystemPromptContext) {
		const family = PromptRegistry.getInstance().getModelFamily(context)
		const toolSets = ClineToolSet.getToolsForVariantWithFallback(family, this.allowedTools)
		const filteredToolSpecs = toolSets
			.map((toolSet) => toolSet.config)
			.filter(
				(toolSpec) =>
					this.allowedTools.includes(toolSpec.id) &&
					(!toolSpec.contextRequirements || toolSpec.contextRequirements(context)),
			)

		const converter = ClineToolSet.getNativeConverter(context.providerInfo.providerId, context.providerInfo.model.id)
		return filteredToolSpecs.map((tool) => converter(tool, context))
	}

	private resolveAllowedTools(configuredTools?: ClineDefaultTool[]): ClineDefaultTool[] {
		const sourceTools = configuredTools && configuredTools.length > 0 ? configuredTools : SUBAGENT_DEFAULT_ALLOWED_TOOLS
		// #100：用户的自定义 agent 配置里可能写了 use_subagents。允许它会让子代理再起子代理，
		// 每层各有一份预算（轮次/费用/token 都是按 runner 计的），嵌套一层就把上限翻一倍。
		// 这里直接摘掉；`SubagentToolHandler.execute` 还有一道运行时守卫兜底。
		//
		// #112：写盘工具也一并摘掉。`AgentConfigLoader` 的 `tools` 是 `z.nativeEnum(ClineDefaultTool)`，
		// 用户 YAML 里写 `tools: [write_to_file]` 就能拿到写权限；而 `shouldAutoApproveToolWithPath`
		// 只看全局自动批准设置、**不看 isSubagentExecution**，于是「YAML 授予写工具 + 开了 editFiles
		// 自动批准」= 子代理静默写盘。子代理的职责是探索代码，不需要落盘。
		return Array.from(new Set([...sourceTools, ClineDefaultTool.ATTEMPT])).filter(
			(tool) => !SUBAGENT_FORBIDDEN_TOOLS.has(tool),
		)
	}

	private buildAgentIdentitySystemPrefix(): string {
		const name = this.agentConfig?.name?.trim()
		const description = this.agentConfig?.description?.trim()
		if (!name && !description) {
			return ""
		}

		const lines = ["# Agent Profile"]
		if (name) {
			lines.push(`Name: ${name}`)
		}
		if (description) {
			lines.push(`Description: ${description}`)
		}

		return `${lines.join("\n")}\n\n`
	}

	private applyModelOverride(apiConfiguration: Record<string, unknown>, _mode: string, modelId?: string): void {
		const trimmedModelId = modelId?.trim()
		if (!trimmedModelId) {
			return
		}

		const mode = _mode === "plan" ? "plan" : "act"
		const provider = apiConfiguration[_mode === "plan" ? "planModeApiProvider" : "actModeApiProvider"] as ApiProvider
		apiConfiguration[getProviderModelIdKey(provider as ApiProvider, mode)] = trimmedModelId
	}
}

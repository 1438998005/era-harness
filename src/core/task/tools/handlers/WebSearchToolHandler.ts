import { ClineAsk, ClineSayTool } from "@shared/ExtensionMessage"
import { ClineDefaultTool } from "@shared/tools"
import { DeepSeekWebClient } from "@/services/deepseek-web/DeepSeekWebClient"
import { parsePartialArrayString } from "@/shared/array"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { ToolResponse } from "../.."
import { showNotificationForApproval } from "../../utils"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

/**
 * web_search：era harness 联网搜索工具。
 * 底层为 DeepSeek 官方 Search API（Bearer 鉴权，按次计费 5 元/千次）。
 * 未配置 DeepSeek API Key 时返回明确的中文提示，不静默失败。
 */
export class WebSearchToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.WEB_SEARCH

	getDescription(block: ToolUse): string {
		return `[${block.name} for '${block.params.query}']`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const query = block.params.query || ""
		const sharedMessageProps: ClineSayTool = {
			tool: "webSearch",
			path: uiHelpers.removeClosingTag(block, "query", query),
			content: `Searching for: ${uiHelpers.removeClosingTag(block, "query", query)}`,
			operationIsLocatedInWorkspace: false,
		} satisfies ClineSayTool

		const partialMessage = JSON.stringify(sharedMessageProps)
		await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
		await uiHelpers.ask("tool" as ClineAsk, partialMessage, block.partial).catch(() => {})
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const query: string | undefined = block.params.query
		const allowedDomainsRaw: string | undefined = block.params.allowed_domains
		const blockedDomainsRaw: string | undefined = block.params.blocked_domains

		if (!query) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "query")
		}
		config.taskState.consecutiveMistakeCount = 0

		const apiKey = config.services.stateManager.getApiConfiguration()?.deepSeekApiKey
		if (!apiKey) {
			return formatResponse.toolError("未配置 DeepSeek API Key，无法联网搜索。请在设置中填写 DeepSeek API Key。")
		}

		const allowedDomains = parsePartialArrayString(allowedDomainsRaw || "[]")
		const blockedDomains = parsePartialArrayString(blockedDomainsRaw || "[]")
		if (allowedDomains.length > 0 && blockedDomains.length > 0) {
			return formatResponse.toolError("allowed_domains 与 blocked_domains 不能同时提供，请只用一个。")
		}

		// 审批流（尊重用户的自动批准设置）
		const sharedMessageProps: ClineSayTool = {
			tool: "webSearch",
			path: query,
			content: `Searching for: ${query}`,
			operationIsLocatedInWorkspace: false,
		}
		const completeMessage = JSON.stringify(sharedMessageProps)

		if (config.callbacks.shouldAutoApproveTool(this.name)) {
			await config.callbacks.removeLastPartialMessageIfExistsWithType("ask", "tool")
			await config.callbacks.say("tool", completeMessage, undefined, undefined, false)
		} else {
			showNotificationForApproval(`era harness 想搜索：${query}`, config.autoApprovalSettings.enableNotifications)
			await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "tool")
			const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("tool", completeMessage, config)
			if (!didApprove) {
				return formatResponse.toolDenied()
			}
		}

		try {
			const client = new DeepSeekWebClient(apiKey)
			const results = await client.search(query, {
				count: 10,
				needContent: false,
				oriQuestion: query,
				domainFilters: { allowed: allowedDomains, blocked: blockedDomains },
			})

			if (results.length === 0) {
				return formatResponse.toolResult(`没有找到与「${query}」相关的搜索结果。可以换用更具体的关键词重试。`)
			}

			const lines = results.map((r, i) => {
				const parts = [`${i + 1}. [${r.title || "(无标题)"}](${r.url})`]
				const digest = r.summary || r.snippet
				if (digest) {
					parts.push(`   ${digest}`)
				}
				return parts.join("\n")
			})
			return formatResponse.toolResult(`「${query}」的搜索结果（共 ${results.length} 条）：\n\n${lines.join("\n\n")}`)
		} catch (error) {
			return formatResponse.toolError((error as Error).message)
		}
	}
}

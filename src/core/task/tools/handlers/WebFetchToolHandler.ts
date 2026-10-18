import { ClineAsk, ClineSayTool } from "@shared/ExtensionMessage"
import { ClineDefaultTool } from "@shared/tools"
import { DeepSeekWebClient } from "@/services/deepseek-web/DeepSeekWebClient"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { ToolResponse } from "../.."
import { showNotificationForApproval } from "../../utils"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

/**
 * web_fetch：era harness 网页抓取工具。
 * 底层为 DeepSeek 官方 Fetch API（Bearer 鉴权，按次计费 5 元/千次，返回现成 markdown）。
 * 未配置 DeepSeek API Key 时返回明确的中文提示，不静默失败。
 */
export class WebFetchToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.WEB_FETCH

	getDescription(block: ToolUse): string {
		return `[${block.name} for '${block.params.url}']`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const url = block.params.url || ""
		const sharedMessageProps: ClineSayTool = {
			tool: "webFetch",
			path: uiHelpers.removeClosingTag(block, "url", url),
			content: `Fetching URL: ${uiHelpers.removeClosingTag(block, "url", url)}`,
			operationIsLocatedInWorkspace: false,
		} satisfies ClineSayTool

		const partialMessage = JSON.stringify(sharedMessageProps)
		await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
		await uiHelpers.ask("tool" as ClineAsk, partialMessage, block.partial).catch(() => {})
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const url: string | undefined = block.params.url

		if (!url) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "url")
		}
		config.taskState.consecutiveMistakeCount = 0

		if (!/^https?:\/\//i.test(url.trim())) {
			return formatResponse.toolError("URL 必须是完整的 http(s) 链接，例如 https://example.com/docs")
		}

		const apiKey = config.services.stateManager.getApiConfiguration()?.deepSeekApiKey
		if (!apiKey) {
			return formatResponse.toolError("未配置 DeepSeek API Key，无法抓取网页。请在设置中填写 DeepSeek API Key。")
		}

		// 审批流（尊重用户的自动批准设置）
		const sharedMessageProps: ClineSayTool = {
			tool: "webFetch",
			path: url,
			content: `Fetching URL: ${url}`,
			operationIsLocatedInWorkspace: false,
		}
		const completeMessage = JSON.stringify(sharedMessageProps)

		if (config.callbacks.shouldAutoApproveTool(this.name)) {
			await config.callbacks.removeLastPartialMessageIfExistsWithType("ask", "tool")
			await config.callbacks.say("tool", completeMessage, undefined, undefined, false)
		} else {
			showNotificationForApproval(`era harness 想抓取网页：${url}`, config.autoApprovalSettings.enableNotifications)
			await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "tool")
			const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("tool", completeMessage, config)
			if (!didApprove) {
				return formatResponse.toolDenied()
			}
		}

		try {
			const client = new DeepSeekWebClient(apiKey)
			const result = await client.fetchUrl(url.trim())

			if (!result.content) {
				return formatResponse.toolError(`未能获取 ${url} 的正文内容（页面可能不可用或内容类型不支持）。`)
			}

			const header = result.title ? `# ${result.title}\n\n来源：${url}\n\n` : `来源：${url}\n\n`
			return formatResponse.toolResult(`${header}${result.content}`)
		} catch (error) {
			return formatResponse.toolError((error as Error).message)
		}
	}
}

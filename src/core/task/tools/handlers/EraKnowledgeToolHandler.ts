import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import {
	findKnowledge,
	formatKnowledgeEntry,
	formatKnowledgeHits,
	KNOWLEDGE_ENTRIES,
	KNOWLEDGE_ENTRY_COUNT,
	KNOWLEDGE_SNAPSHOT_AT,
	listKnowledgeSummaries,
	searchKnowledge,
} from "@eraharness/knowledge/index"
import { getReadablePath, isLocatedInWorkspace } from "@utils/path"
import { telemetryService } from "@/services/telemetry"
import { truncateContent } from "@/shared/content-limits"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

const MAX_OUTPUT_BYTES = 8 * 1024
const SEARCH_LIMIT = 8

/**
 * era_knowledge：查内嵌纪律/机制知识库（纯离线，只读）。
 *
 * 与 MCP 那对工具（`lookup_knowledge` / `search_knowledge`）共用核心库同一份条目表，
 * 区别只在载体：这里是扩展内的原生工具，用户不必配置 MCP 就能用；MCP 那对留给
 * 独立进程/其他宿主。所以输出走 markdown 文本而不是 JSON——读者是模型。
 */

/** 每次返回都自报家门：条目数是快照值，模型据此判断「这是内置快照，不是最新正本」 */
function originHeader(): string {
	return `> 内置知识库 ${KNOWLEDGE_ENTRY_COUNT} 条（快照 ${KNOWLEDGE_SNAPSHOT_AT}）。内嵌副本是集群知识库的快照，⛔ 当作本工程实测结论；本工程的事实要读代码确认。`
}

function formatCatalog(): string {
	const lines = listKnowledgeSummaries(KNOWLEDGE_ENTRIES).map((item) => `- \`${item.id}\`（${item.domain}）——${item.summary}`)
	return [
		"## 目录",
		lines.join("\n"),
		"",
		"取全文：mode=lookup + entry_id=<条目 id>；按关键词：mode=search + query=<词>。",
	].join("\n")
}

/** 查不到 id 时给全目录，让模型自己挑，⛔ 只回「没有这条」 */
function suggestEntries(id: string): string {
	const hits = searchKnowledge(KNOWLEDGE_ENTRIES, id, 5)
	const head = `知识库没有 id 为「${id}」的条目（id 要精确匹配）。`
	if (hits.length > 0) {
		return `${head}\n按「${id}」检索到的相近条目：\n${formatKnowledgeHits(hits, id)}`
	}
	return `${head}\n${formatCatalog()}`
}

export class EraKnowledgeToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.ERA_KNOWLEDGE

	// 参数都是可选的（mode 可推导），不需要 ToolValidator
	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const target = block.params.entry_id || block.params.query || block.params.mode || ""
		return `[${block.name} for '${target}']`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 参数很少，等完整块再处理
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const requestedMode = (block.params.mode || "").trim().toLowerCase()
		const id = (block.params.entry_id || "").trim()
		const query = (block.params.query || "").trim()

		// mode 省略时按给了哪个参数推断，少一次模型自我纠错
		const mode =
			requestedMode === "lookup" || requestedMode === "search" || requestedMode === "list"
				? requestedMode
				: id
					? "lookup"
					: query
						? "search"
						: "list"

		try {
			let body: string

			if (mode === "list") {
				body = formatCatalog()
			} else if (mode === "search") {
				if (!query) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "query")
				}
				const hits = searchKnowledge(KNOWLEDGE_ENTRIES, query, SEARCH_LIMIT)
				body = [
					formatKnowledgeHits(hits, query),
					"",
					hits.length > 0 ? "取全文：mode=lookup + entry_id=<上面的条目 id>。" : formatCatalog(),
				].join("\n")
			} else {
				if (!id) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "entry_id")
				}
				const entry = findKnowledge(KNOWLEDGE_ENTRIES, id)
				body = entry ? formatKnowledgeEntry(entry) : suggestEntries(id)
			}

			const result = truncateContent(`${originHeader()}\n\n${body}`, MAX_OUTPUT_BYTES)

			const sharedMessageProps = {
				tool: "searchFiles",
				path: getReadablePath(config.cwd, "."),
				content: result,
				operationIsLocatedInWorkspace: await isLocatedInWorkspace("."),
			}
			const completeMessage = JSON.stringify(sharedMessageProps)

			if (await config.callbacks.shouldAutoApproveToolWithPath(block.name, ".")) {
				await config.callbacks.say("tool", completeMessage, undefined, undefined, false)
			} else {
				const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("tool", completeMessage, config)
				if (!didApprove) {
					return formatResponse.toolDenied()
				}
			}

			telemetryService.captureToolUsage(
				config.ulid,
				block.name,
				config.api.getModel().id,
				config.services.stateManager.getApiConfiguration().actModeApiProvider as string,
				true,
				true,
				{
					isMultiRootEnabled: config.isMultiRootEnabled || false,
					usedWorkspaceHint: false,
					resolvedToNonPrimary: false,
					resolutionMethod: "primary_fallback",
				},
				block.isNativeToolCall,
			)

			config.taskState.consecutiveMistakeCount = 0
			return result
		} catch (error) {
			config.taskState.consecutiveMistakeCount++
			const errorMessage = error instanceof Error ? error.message : String(error)
			return formatResponse.toolError(`查内嵌知识库失败：${errorMessage}`)
		}
	}
}

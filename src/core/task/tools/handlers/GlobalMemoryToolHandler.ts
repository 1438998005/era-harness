import type { ToolUse } from "@core/assistant-message"
import { recordAudit } from "@core/logging/auditLog"
import { formatResponse } from "@core/prompts/responses"
import { readGlobalMemoryDocument, removeGlobalMemoryEntry, upsertGlobalMemoryEntry } from "@core/storage/globalMemory"
import { GLOBAL_MEMORY_LIMITS, type GlobalMemoryDocument } from "@shared/global-memory"
import { ClineDefaultTool } from "@shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

const SOURCE_LABEL: Record<string, string> = {
	plugin: "插件",
	model: "模型",
	user: "用户",
}

function formatTimestamp(ts: number): string {
	try {
		return new Date(ts).toISOString().slice(0, 16).replace("T", " ")
	} catch {
		return "-"
	}
}

function formatEntryList(document: GlobalMemoryDocument): string {
	if (document.entries.length === 0) {
		return `## 全局记忆（0/${GLOBAL_MEMORY_LIMITS.maxEntries}）\n\n当前没有条目。`
	}

	const lines = document.entries.map((entry, index) => {
		const tags = entry.tags.length > 0 ? `（${entry.tags.join("、")}）` : ""
		const source = SOURCE_LABEL[entry.source] ?? entry.source
		return `${index + 1}. [${entry.id}] ${entry.text}${tags} — 来源：${source}，更新：${formatTimestamp(entry.updatedAt)}`
	})

	return [
		`## 全局记忆（${document.entries.length}/${GLOBAL_MEMORY_LIMITS.maxEntries}）`,
		"",
		lines.join("\n"),
		"",
		"修改用 update + entry_id；删除用 remove + entry_id。清空只能由用户在设置页操作。",
	].join("\n")
}

function parseTags(raw: string | undefined): string[] | undefined {
	if (!raw?.trim()) {
		return undefined
	}
	return raw
		.split(/[,，;；]/)
		.map((tag) => tag.trim())
		.filter(Boolean)
}

function summaryLine(document: GlobalMemoryDocument): string {
	return `当前 ${document.entries.length}/${GLOBAL_MEMORY_LIMITS.maxEntries} 条（注入上限 ${Math.round(
		GLOBAL_MEMORY_LIMITS.maxPromptBytes / 1024,
	)}KB）`
}

/**
 * global_memory：模型读写跨项目用户偏好的唯一入口。
 *
 * 与文件读写工具的区别：
 * - 落在 globalStorage（工作区之外），所以不走路径/身份范围检查；
 * - 写入只经过这里，文档必先 normalize，模型写不坏 JSON；
 * - 没有 clear 模式：清空必须由用户在设置页点两次，避免模型一把抹掉用户偏好。
 */
export class GlobalMemoryToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.GLOBAL_MEMORY

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const mode = (block.params.mode || "").trim().toLowerCase()
		const target = block.params.entry_id || block.params.text || ""
		return `[${block.name} ${mode}${target ? ` '${target.slice(0, 40)}'` : ""}]`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 记忆操作很快，参数齐了再执行
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		// 纵深防御：子代理默认看不到这个工具，但用户在 agent 配置里显式列出时仍可能被调。
		if (config.isSubagentExecution) {
			return formatResponse.toolError(
				"全局记忆只允许主任务读写；子任务请把需要长期保留的偏好写在结果里，由主任务决定是否写入。",
			)
		}

		const requestedMode = (block.params.mode || "list").trim().toLowerCase()
		const entryId = (block.params.entry_id || "").trim()
		const text = (block.params.text || "").trim()
		const tags = parseTags(block.params.tags)

		try {
			// 关闭状态对所有模式一律拒绝：工具本应被隐藏，这里再拦一道，
			// 防止模型凭历史对话里的工具名继续读写。
			const current = await readGlobalMemoryDocument()
			if (!current.enabled) {
				config.taskState.consecutiveMistakeCount = 0
				return "全局记忆当前已关闭（用户可在「设置 → 记忆」重新开启）；本次没有读取或写入任何条目。"
			}

			if (requestedMode === "list") {
				config.taskState.consecutiveMistakeCount = 0
				return formatEntryList(current)
			}

			if (requestedMode === "add") {
				if (!text) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "text")
				}

				const result = await upsertGlobalMemoryEntry({ text, tags, source: "model" })
				recordAudit({
					event: "memory",
					taskId: config.taskId,
					action: "add",
					target: result.entry.id,
					outcome: "ok",
					message: result.created ? "created" : "updated-existing",
				})
				await config.callbacks.say(
					"info",
					result.created
						? `全局记忆 +1：${result.entry.text}（${summaryLine(result.document)}）`
						: `全局记忆已更新：${result.entry.text}（${summaryLine(result.document)}）`,
				)
				config.taskState.consecutiveMistakeCount = 0
				return [
					result.created
						? `已新增全局记忆 [${result.entry.id}]：${result.entry.text}`
						: `已有相同内容，已更新 [${result.entry.id}]：${result.entry.text}`,
					summaryLine(result.document),
					"用户可在「设置 → 记忆」修改、删除、清空或关闭。",
				].join("\n")
			}

			if (requestedMode === "update") {
				if (!entryId) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "entry_id")
				}
				if (!text) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "text")
				}

				const result = await upsertGlobalMemoryEntry({ id: entryId, text, tags, source: "model" })
				recordAudit({
					event: "memory",
					taskId: config.taskId,
					action: "update",
					target: result.entry.id,
					outcome: "ok",
				})
				await config.callbacks.say("info", `全局记忆已更新：${result.entry.text}（${summaryLine(result.document)}）`)
				config.taskState.consecutiveMistakeCount = 0
				return `已更新 [${result.entry.id}]：${result.entry.text}\n${summaryLine(result.document)}`
			}

			if (requestedMode === "remove") {
				if (!entryId) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "entry_id")
				}

				const target = current.entries.find((entry) => entry.id === entryId)
				const document = await removeGlobalMemoryEntry(entryId)
				recordAudit({
					event: "memory",
					taskId: config.taskId,
					action: "remove",
					target: entryId,
					outcome: "ok",
				})
				await config.callbacks.say("info", `全局记忆 -1：${target?.text ?? entryId}（${summaryLine(document)}）`)
				config.taskState.consecutiveMistakeCount = 0
				return `已删除 [${entryId}]。${summaryLine(document)}`
			}

			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(
				`global_memory 的 mode 只能是 list / add / update / remove，收到「${requestedMode}」。`,
			)
		} catch (error) {
			config.taskState.consecutiveMistakeCount++
			const message = error instanceof Error ? error.message : String(error)
			recordAudit({
				event: "memory",
				taskId: config.taskId,
				action: requestedMode,
				outcome: "error",
				message,
			})
			return formatResponse.toolError(`全局记忆操作失败：${message}`)
		}
	}
}

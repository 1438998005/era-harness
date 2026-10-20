import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import {
	findSetting,
	formatSetting,
	formatSettingHits,
	formatUncovered,
	listSettingSummaries,
	SETTINGS_CATALOG,
	SETTINGS_CATEGORIES,
	SETTINGS_SNAPSHOT_AT,
	searchSettings,
	UNCOVERED_SETTINGS,
} from "@eraharness/settings/index"
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
const SEARCH_LIMIT = 6

/**
 * setting_help：查**插件自身**的设置项说明（纯离线，只读）。
 *
 * 与 `era_knowledge` 的分工：那边讲 EraBasic 游戏工程的纪律与机制，这边讲
 * 「era harness 自己的开关是干什么的」。数据来自核心库构建时生成的目录
 * （`@eraharness/settings`），所以改设置页后必须重跑 `npm run build:settings`，
 * 否则这里答的是旧文案——`scripts/gate-baseline.mjs` 的「生成物新鲜度」闸门盯着这件事。
 */

/** 每次返回都自报家门：条目数是快照值，模型据此知道「可能没覆盖到最新设置」 */
function originHeader(): string {
	return `> 内置设置目录 ${SETTINGS_CATALOG.length} 项（手写补充快照 ${SETTINGS_SNAPSHOT_AT}）。这是插件随版本内嵌的说明，⛔ 不是运行时读到的当前值；某个开关现在开没开，要看设置页或 state。`
}

function formatCatalog(): string {
	const groups = listSettingSummaries(SETTINGS_CATALOG, SETTINGS_CATEGORIES)
	const blocks = groups.map((group) =>
		[`### ${group.title}`, ...group.items.map((item) => `- \`${item.key}\`（${item.title}）——${item.summary}`)].join("\n"),
	)
	return [
		"## 目录",
		blocks.join("\n\n"),
		"",
		`取单条：key=<设置键>；按关键词：query=<词>。另有 ${Object.keys(UNCOVERED_SETTINGS).length} 项明确未收录（需要时用 query 查不到就直说未收录，⛔ 别猜）。`,
	].join("\n")
}

/** 键写错 / 只写了半截时补救，⛔ 只回「没有这项」 */
function suggestSettings(key: string): string {
	const head = `设置目录里没有「${key}」。`
	const uncovered = Object.entries(UNCOVERED_SETTINGS).find(
		([candidate]) => candidate.replace(/[._-]/g, "").toLowerCase() === key.replace(/[._-]/g, "").toLowerCase(),
	)
	if (uncovered) {
		return `${head}\n\n${formatUncovered(uncovered[0], uncovered[1])}`
	}
	const hits = searchSettings(SETTINGS_CATALOG, key, 5)
	if (hits.length > 0) {
		return `${head}\n按「${key}」检索到的相近项：\n${formatSettingHits(hits, key)}`
	}
	return `${head}\n${formatCatalog()}`
}

export class SettingHelpToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.SETTING_HELP

	// 参数都可选（key 优先、query 次之、都给空则列目录），不需要 ToolValidator
	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const target = block.params.key || block.params.query || ""
		return `[${block.name} for '${target}']`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 参数很少，等完整块再处理
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const key = (block.params.key || "").trim()
		const query = (block.params.query || "").trim()

		try {
			let body: string

			if (key) {
				const record = findSetting(SETTINGS_CATALOG, key)
				body = record ? formatSetting(record) : suggestSettings(key)
			} else if (query) {
				const hits = searchSettings(SETTINGS_CATALOG, query, SEARCH_LIMIT)
				body = [formatSettingHits(hits, query), "", hits.length > 0 ? "取单条：key=<上面的键>。" : formatCatalog()].join(
					"\n",
				)
			} else {
				body = formatCatalog()
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
			return formatResponse.toolError(`查插件设置说明失败：${errorMessage}`)
		}
	}
}

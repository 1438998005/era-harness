import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import {
	discoverReference,
	findReference,
	formatReferenceEntry,
	formatReferenceHits,
	listReferenceNames,
	REFERENCE_ENTRIES,
	REFERENCE_ENTRY_COUNT,
	REFERENCE_FETCHED_AT,
	REFERENCE_NAME_COUNT,
	REFERENCE_SOURCE_SHA,
	type ReferenceEntry,
	type ReferenceSourceOptions,
	resolveReferenceOnline,
	searchReference,
} from "@eraharness/reference/index"
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
const SEARCH_LIMIT = 10

/**
 * 在线开关走环境变量而不是 VS Code 配置：核心层拿不到 vscode 模块，
 * 而 MCP server 用的是同一套环境变量，两处保持一致。
 */
function referenceSourceOptions(): ReferenceSourceOptions {
	const mode = (process.env.ERA_HARNESS_REFERENCE_ONLINE ?? "auto").trim().toLowerCase()
	return {
		mode: mode === "off" ? "off" : "auto",
		baseUrl: process.env.ERA_HARNESS_REFERENCE_BASE?.trim() || undefined,
	}
}

/** 一条命中在返回里必须自报家门：模型据此判断「这批参数是不是最新版」 */
function describeOrigin(origin: "online" | "local" | "discovered", sourceNote: string, fallbackReason?: string): string {
	if (origin === "online") {
		return "> 来源：在线上游（本次为最新版本）"
	}
	if (origin === "discovered") {
		return "> 来源：上游文档站（本地快照未收录，本次在线发现）"
	}
	const reason = fallbackReason ? `；在线不可用（${fallbackReason}）` : ""
	return `> 来源：${sourceNote}${reason}`
}

/** 目录归属：Reference 是 API 页，Emuera 是语法/规格，tutorial 是教程 */
function sourceGroup(entry: ReferenceEntry): string {
	const dir = entry.sourcePath?.split("/")[1]
	if (dir === "Reference") {
		return "Reference（API 指令）"
	}
	if (dir === "Emuera") {
		return "Emuera（语法/规格）"
	}
	if (dir === "tutorial") {
		return "tutorial（教程）"
	}
	return "其他"
}

function formatNameIndex(): string {
	const groups = new Map<string, number>()
	for (const entry of REFERENCE_ENTRIES) {
		const group = sourceGroup(entry)
		groups.set(group, (groups.get(group) ?? 0) + 1)
	}

	const allNames = listReferenceNames(REFERENCE_ENTRIES)
	const directives = allNames.filter((name) => /^[#@[]/.test(name))
	const plain = allNames.filter((name) => !/^[#@[]/.test(name))
	// 725 个名字全列会撑爆输出上限，这里只给「抓取抓手」：全部函数头指令 + 常用 API 的前 200 个
	const shownPlain = plain.slice(0, 200)

	return [
		`内置指令库共 ${REFERENCE_ENTRY_COUNT} 条 / ${REFERENCE_NAME_COUNT} 个可检索名字。`,
		`来源分布：${[...groups].map(([group, count]) => `${group} ${count}`).join("，")}。`,
		`快照对应上游 ${REFERENCE_SOURCE_SHA.slice(0, 8)}（抓取于 ${REFERENCE_FETCHED_AT}）。`,
		"",
		"> ⚠ 这是**精选子集**，不是上游文档全量。manual / eramaker / EMEE / Skia 等目录未收录；",
		"> lookup 未命中时会自动向上游文档站检索一次。",
		"",
		"## 函数头指令与特殊块（`#` / `@` / `[ ]`）",
		directives.length > 0 ? directives.join(" ") : "（无）",
		"",
		`## 常用 API（前 ${shownPlain.length} 个，共 ${plain.length} 个）`,
		shownPlain.join(" "),
		"",
		"## 用法",
		"- 精确查某条：mode=lookup + name=<指令名>（`#LOCALSIZE` 与 `LOCALSIZE` 都能查到）",
		"- 按关键词检索：mode=search + query=<关键字>",
		"- 别名（同页变体）可以直接 lookup，不必先查页面名。",
	].join("\n")
}

/** 查不到时的降级建议：先用检索找相近的，再让模型自己挑 */
function suggestAlternatives(name: string): string {
	const hits = searchReference(REFERENCE_ENTRIES, name, 5)
	const boundary =
		"（内置库覆盖 Reference API + Emuera 语法/规格 + tutorial 教程，不是上游全量；" + "中文关键词命中率低于英文原名。）"
	if (hits.length === 0) {
		return (
			`指令库里没有「${name}」${boundary}\n` +
			"可以：① 换成英文原名或更短的关键词用 mode=search；② 用 mode=names 看库里有什么；" +
			"③ 直接用 web_fetch 读上游文档站 https://qirchen421.github.io/emuera.sk.doc/zh/index.html 。"
		)
	}
	return `指令库里没有「${name}」${boundary}。相近的有：\n${formatReferenceHits(hits, name)}`
}

function withOriginHeader(entry: ReferenceEntry, header: string): string {
	return `${header}\n\n${formatReferenceEntry(entry)}`
}

export class EraReferenceToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.ERA_REFERENCE

	// 参数都是可选的（mode 可推导），参数校验在 execute 里按模式做，不需要 ToolValidator
	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const target = block.params.name || block.params.query || block.params.mode || ""
		return `[${block.name} for '${target}']`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 参数很少，等完整块再处理
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const requestedMode = (block.params.mode || "").trim().toLowerCase()
		const name = (block.params.name || "").trim()
		const query = (block.params.query || "").trim()

		// mode 省略时按给了哪个参数推断，少一次模型自我纠错
		const mode =
			requestedMode === "lookup" || requestedMode === "search" || requestedMode === "names"
				? requestedMode
				: name
					? "lookup"
					: query
						? "search"
						: "names"

		try {
			let body: string

			if (mode === "names") {
				body = formatNameIndex()
			} else if (mode === "search") {
				if (!query) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "query")
				}
				const hits = searchReference(REFERENCE_ENTRIES, query, SEARCH_LIMIT)
				body = `${formatReferenceHits(hits, query)}\n\n> 索引来自内置快照（${REFERENCE_SOURCE_SHA.slice(0, 8)}）；取单条正文时会在可用的情况下换成上游最新版。`
			} else {
				if (!name) {
					config.taskState.consecutiveMistakeCount++
					return await config.callbacks.sayAndCreateMissingParamError(this.name, "name")
				}
				const found = findReference(REFERENCE_ENTRIES, name)
				if (found) {
					const resolved = await resolveReferenceOnline(found.entry, REFERENCE_SOURCE_SHA, referenceSourceOptions())
					body = withOriginHeader(
						resolved.entry,
						describeOrigin(resolved.origin, resolved.sourceNote, resolved.fallbackReason),
					)
				} else {
					// 本地没有 ≠ 上游没有：用上游搜索索引定位那一页再解析回来。
					// 这是「库里没有就凭记忆猜」这个死角的唯一出口。
					const discovered = await discoverReference(name, referenceSourceOptions())
					if ("entries" in discovered) {
						body = [
							describeOrigin("discovered", ""),
							"",
							...discovered.entries.map((entry) => formatReferenceEntry(entry)),
							"",
							`> 该页（${discovered.slug}）未进内置快照，下次重新打包会收录。`,
						].join("\n")
					} else {
						body = `${suggestAlternatives(name)}\n\n（在线发现也未成功：${discovered.error}）`
					}
				}
			}

			const result = truncateContent(body, MAX_OUTPUT_BYTES)

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
			return formatResponse.toolError(`查指令手册失败：${errorMessage}`)
		}
	}
}

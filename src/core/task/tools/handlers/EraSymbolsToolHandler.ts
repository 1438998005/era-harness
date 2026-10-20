import type { Dirent } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import type { ToolUse } from "@core/assistant-message"
import { type EraProjectProfile, getEraProjectProfile, getEraScanRoots, isBackupScopePath } from "@core/era/project-profile"
import { getExtraWorkspaceRoots } from "@core/era/workspace-extra-roots"
import { formatResponse } from "@core/prompts/responses"
import { analyzeErb } from "@core/update/merge"
import { readTextFile } from "@eraharness/encoding/encoding"
import { rawRipgrepLines } from "@services/ripgrep"
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

const MAX_SYMBOLS = 200
const MAX_FILES_SCANNED = 300
const MAX_OUTPUT_BYTES = 8 * 1024
/** 文件列举时的最大深度；脚本可能嵌在多层角色目录里 */
const MAX_WALK_DEPTH = 12

/**
 * 生态级通用噪音目录：不含 EraBasic 脚本，且一出现就是海量文件。
 * 不列举编辑器/AI 客户端目录（都是隐藏目录，由 isNoiseDir 的通则覆盖），
 * 也不跳过 dist/out/build —— 脚本完全可能就在那里。
 */
const NOISE_DIR_NAMES = new Set(["node_modules", "__pycache__", "system volume information", "$recycle.bin"])

function isNoiseDir(name: string): boolean {
	return name.startsWith(".") || NOISE_DIR_NAMES.has(name.toLowerCase())
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isScriptFileName(name: string): boolean {
	const lower = name.toLowerCase()
	return lower.endsWith(".erb") || lower.endsWith(".erh")
}

/**
 * ripgrep 的脚本过滤：扩展名由引擎决定（可以写死），备份目录名由探测得出（不能写死）。
 */
function buildScriptGlobs(profile: EraProjectProfile): string[] {
	const globs = ["-g", "*.erb", "-g", "*.ERB", "-g", "*.erh", "-g", "*.ERH"]
	for (const name of profile.backupDirNames) {
		globs.push("-g", `!**/${name}/**`)
	}
	return globs
}

function parseRipgrepLine(raw: string): { filePath: string; lineNumber: number; text: string } | undefined {
	const match = /^(.*?):(\d+):(.*)$/.exec(raw)
	if (!match) {
		return undefined
	}
	return { filePath: match[1]!, lineNumber: Number.parseInt(match[2]!, 10), text: match[3]! }
}

/**
 * 把绝对路径转成「相对某个扫描根」的展示路径。
 * 多个工程根时用命中的那个，都不命中就退回工作区根，再不行就用绝对路径。
 */
function toDisplayPath(filePath: string, roots: string[], cwd: string): string {
	const normalized = filePath.replace(/\\/g, "/")
	for (const root of roots) {
		const rel = path.relative(root, filePath)
		if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
			return rel.replace(/\\/g, "/")
		}
	}
	const relToCwd = path.relative(cwd, filePath)
	if (relToCwd && !relToCwd.startsWith("..") && !path.isAbsolute(relToCwd)) {
		return relToCwd.replace(/\\/g, "/")
	}
	return normalized
}

async function listScriptFiles(root: string, profile: EraProjectProfile): Promise<string[]> {
	const result: string[] = []
	const backupNames = new Set(profile.backupDirNames.map((name) => name.toLowerCase()))

	const walk = async (dir: string, depth: number): Promise<void> => {
		if (depth > MAX_WALK_DEPTH) {
			return
		}
		const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as Dirent[])
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				const lower = entry.name.toLowerCase()
				if (isNoiseDir(entry.name) || backupNames.has(lower)) {
					continue
				}
				await walk(fullPath, depth + 1)
			} else if (entry.isFile() && isScriptFileName(entry.name)) {
				result.push(fullPath)
			}
		}
	}

	await walk(root, 0)
	return result
}

/**
 * 每条 ripgrep 命中都要确认「这行真的是标签，不是注释/字符串里的假标签」。
 * analyzeErb 是整文件级解析，同一个文件可能被多条命中反复触发 ——
 * 在 2000+ 文件的工程里那是上百次重复读盘 + 重复解析，必须按文件缓存。
 */
async function collectKnownSymbols(filePath: string, cache: Map<string, Set<string>>): Promise<Set<string>> {
	const hit = cache.get(filePath)
	if (hit) {
		return hit
	}
	const known = new Set<string>()
	try {
		const fileText = await readTextFile(filePath)
		const structure = analyzeErb(fileText.text)
		for (const label of structure.labels) {
			known.add(label)
		}
		for (const label of structure.localLabels) {
			known.add(label)
		}
	} catch (_error) {
		// 读不到就当没有：调用方会根据空集合过滤掉这条命中
	}
	cache.set(filePath, known)
	return known
}

export class EraSymbolsToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.ERA_SYMBOLS

	constructor(private validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[${block.name} for '${block.params.query || ""}']`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 参数很少，等完整块再处理
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const queryValidation = this.validator.assertRequiredParams(block, "query")
		if (!queryValidation.ok) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "query")
		}

		const query = (block.params.query || "").trim()
		const kind = (block.params.kind || "label").trim().toLowerCase()

		// 扫描根来自运行时探测：工作区根、子目录里的工程、多根工作区都覆盖
		const extraRoots = await getExtraWorkspaceRoots(config.cwd)
		const profile = getEraProjectProfile(config.cwd, extraRoots)
		const roots = getEraScanRoots(config.cwd, extraRoots)

		try {
			let body: string

			if (kind === "file") {
				const collected: string[] = []
				for (const root of roots) {
					collected.push(...(await listScriptFiles(root, profile)))
				}
				const matched = collected.filter((file) => path.basename(file).toLowerCase().includes(query.toLowerCase()))
				body =
					matched.length === 0
						? `没有找到文件名包含 "${query}" 的脚本文件。可以试试 kind=label 查标签。`
						: `找到 ${matched.length} 个文件：\n${matched
								.slice(0, MAX_SYMBOLS)
								.map((file) => `- ${toDisplayPath(file, roots, config.cwd)}`)
								.join("\n")}`
			} else {
				const prefix =
					kind === "call" ? "^[ \\t]*(?:TRY)?(?:CALLTRAIN|CALLFORM|CALL|JUMPFORM|JUMP|GOTO|GOSUB)[ \\t]+" : "^[ \\t]*@"
				const pattern = `${prefix}${escapeRegex(query)}`
				const args = [
					"--line-number",
					"--no-heading",
					"--color",
					"never",
					"--max-count",
					"50",
					...buildScriptGlobs(profile),
					"-e",
					pattern,
					...roots,
				]
				const lines = await rawRipgrepLines(args)

				const parsed = lines
					.map(parseRipgrepLine)
					.filter((item): item is { filePath: string; lineNumber: number; text: string } => item !== undefined)

				const seen = new Set<string>()
				const formatted: string[] = []
				const symbolCache = new Map<string, Set<string>>()
				let scanned = 0

				for (const hit of parsed) {
					if (scanned >= MAX_FILES_SCANNED || formatted.length >= MAX_SYMBOLS) {
						break
					}
					// 备份目录里的命中一律丢弃：那是旧副本，改了不生效
					if (isBackupScopePath(hit.filePath, profile)) {
						continue
					}

					const relativePath = toDisplayPath(hit.filePath, roots, config.cwd)
					const labelMatch = kind === "call" ? null : /^[ \t]*@([^\s,()（）]+)/.exec(hit.text)
					const symbolName = kind === "call" ? query : labelMatch?.[1]

					// 用 analyzeErb 过滤注释/字符串里的假标签（按文件缓存，同一个文件只解析一次）
					if (kind !== "call" && symbolName) {
						scanned++
						const known = await collectKnownSymbols(hit.filePath, symbolCache)
						if (!known.has(symbolName) && !known.has(`@${symbolName}`)) {
							continue
						}
					}

					const key = `${relativePath}:${hit.lineNumber}:${symbolName}`
					if (seen.has(key)) {
						continue
					}
					seen.add(key)
					formatted.push(`${kind === "call" ? query : `@${symbolName}`}  ${relativePath}:${hit.lineNumber}`)
				}

				body =
					formatted.length === 0
						? `没有找到 ${kind === "call" ? "调用点" : "标签"} "${query}"。可以试试 kind=file 只搜文件名，或换一个更短的关键字。`
						: `找到 ${formatted.length} 个${kind === "call" ? "调用点" : "标签"}：\n${formatted.join("\n")}`
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
			return formatResponse.toolError(`查找脚本符号失败：${errorMessage}`)
		}
	}
}

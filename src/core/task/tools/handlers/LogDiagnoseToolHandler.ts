import type { Dirent } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import type { ToolUse } from "@core/assistant-message"
import { type EraProjectProfile, getEraProjectProfile, getEraScanRoots } from "@core/era/project-profile"
import { getExtraWorkspaceRoots } from "@core/era/workspace-extra-roots"
import { formatResponse } from "@core/prompts/responses"
import { resolveWorkspacePath } from "@core/workspace"
import { readTextFile } from "@eraharness/encoding/encoding"
import { parseLog } from "@eraharness/log/parser"
import { summarizeDiagnostics } from "@eraharness/log/taxonomy"
import type { Diagnostic, LogSession } from "@eraharness/log/types"
import { getReadablePath, isLocatedInWorkspace } from "@utils/path"
import { telemetryService } from "@/services/telemetry"
import { formatBytes, truncateContent } from "@/shared/content-limits"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

const MAX_DIAGNOSTICS_SHOWN = 40
const MAX_OUTPUT_BYTES = 8 * 1024
/**
 * 单次最多解析多少字节。
 *
 * 日志是引擎按会话写的，一局挂机几小时能到几百 MB。原先整份 readFile + 逐行正则
 * 会把扩展宿主卡死十几秒，而结果最后又被 truncate 到 8KB —— 先读全量再截毫无意义。
 * 8MB 远大于任何正常单会话日志，超出就只解析开头并如实告知。
 */
const MAX_LOG_READ_BYTES = 8 * 1024 * 1024
/** 日志探测：往下找几层、最多收集多少候选、最多走多少个目录 */
const LOG_SCAN_DEPTH = 3
const MAX_LOG_CANDIDATES = 200
const MAX_LOG_SCAN_DIRS = 300

const KIND_HINTS: Record<string, string> = {
	"unresolved-identifier": "标识符未定义：检查 ERH/ERB 顶部是否有 #DIM/#DIMS 声明，或名字是否拼错",
	"variable-not-in-function": "#DIM 不能写在函数内部，把声明移到文件顶部的声明区",
	"continue-outside-loop": "CONTINUE 只能出现在 REPEAT/FOR/WHILE/DO 循环里",
	"missing-next": "FOR 缺少对应的 NEXT",
	"callf-non-function": "CALLF 的目标必须是带 #FUNCTION 的函数",
	"unparseable-line": "这一行无法解析：常见原因是全角符号、缺半角空格或参数类型不符",
	"hash-line-not-after-declaration": "# 开头的声明行必须紧跟在函数定义之后",
	"skipend-missing": "PRINTDATA/STRDATA 块缺少 SKIPEND 或 DATAFORM 数量不匹配",
	"chara-array-too-many-args": "角色数组下标超出定义范围：检查 CSV 里的角色数量",
	"unclosed-triple-quote": "三引号字符串没有闭合",
	"arg-type-mismatch": "参数类型不匹配：字符串参数要加半角双引号，数值参数不要加",
	"unmatched-percent": "百分号没有配对（%变量%）",
	"text-after-command": "命令后面跟了多余文本：检查是否漏了半角空格或引号",
	"fatal-unexpected-error": "引擎致命错误：通常是 ERB 结构损坏，优先修这一条",
	other: "未归类：查看日志原文",
}

function severityRank(severity: number): number {
	// 引擎的 0 是提示级，排在最后
	return severity === 0 ? 99 : severity
}

/**
 * 日志扫描跳过的目录：隐藏目录 + 通用噪音目录，与工程探测保持同一套语义。
 * 不列举任何编辑器/AI 客户端的目录名（隐藏目录规则已覆盖），
 * 也不跳过 dist/out/build —— 引擎日志完全可能落在那里。
 */
const LOG_NOISE_DIRS = new Set(["node_modules", "__pycache__", "system volume information", "$recycle.bin"])

function isSkippedLogDir(name: string): boolean {
	return name.startsWith(".") || LOG_NOISE_DIRS.has(name.toLowerCase())
}

interface LogCandidate {
	filePath: string
	mtime: number
	size: number
}

/**
 * 日志文件特征：`.log` 一律接受；另外接住把引擎日志写成 `.txt` 的情况。
 * 不限定目录名，也不限定必须叫 emuera.log。
 */
function isLogLikeFile(name: string): boolean {
	const lower = name.toLowerCase()
	if (lower.endsWith(".log")) {
		return true
	}
	return lower.includes("emuera") && lower.endsWith(".txt")
}

async function collectLogCandidates(
	root: string,
	profile: EraProjectProfile,
	out: LogCandidate[],
	budget: { dirs: number },
): Promise<void> {
	const backupNames = new Set(profile.backupDirNames.map((name) => name.toLowerCase()))

	const walk = async (dir: string, depth: number): Promise<void> => {
		if (budget.dirs >= MAX_LOG_SCAN_DIRS || out.length >= MAX_LOG_CANDIDATES) {
			return
		}
		budget.dirs++

		let entries: Dirent[]
		try {
			entries = await fs.readdir(dir, { withFileTypes: true })
		} catch {
			return
		}

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				const lower = entry.name.toLowerCase()
				// 备份目录名来自运行时探测（不是硬编码）：备份里的日志通常是旧的，跳过省预算
				if (isSkippedLogDir(entry.name) || backupNames.has(lower)) {
					continue
				}
				if (depth < LOG_SCAN_DEPTH) {
					await walk(fullPath, depth + 1)
				}
				continue
			}
			if (!entry.isFile() || !isLogLikeFile(entry.name)) {
				continue
			}
			try {
				const stat = await fs.stat(fullPath)
				out.push({ filePath: fullPath, mtime: stat.mtimeMs, size: stat.size })
			} catch {
				// 读不到 stat 的文件直接跳过
			}
		}
	}

	await walk(root, 0)
}

/**
 * 自行找日志：从探测到的工程根（而不是某个固定目录名）往下搜。
 * 返回最新的一份和候选总数，便于告诉模型「我是在哪找到的」。
 */
export async function findNewestLog(
	cwd: string,
	extraRoots: readonly string[],
): Promise<{ filePath: string; total: number } | undefined> {
	const profile = getEraProjectProfile(cwd, extraRoots)
	const roots = getEraScanRoots(cwd, extraRoots)
	const candidates: LogCandidate[] = []
	const budget = { dirs: 0 }

	for (const root of roots) {
		await collectLogCandidates(root, profile, candidates, budget)
	}
	if (candidates.length === 0) {
		return undefined
	}

	candidates.sort((a, b) => b.mtime - a.mtime || b.size - a.size)
	return { filePath: candidates[0]!.filePath, total: candidates.length }
}

function formatDiagnostic(diagnostic: Diagnostic): string {
	const location = `${diagnostic.file}:${diagnostic.line}`
	const identifier = diagnostic.identifier ? ` \`${diagnostic.identifier}\`` : ""
	return `- [严重度 ${diagnostic.severity}] ${location} ${diagnostic.kind}${identifier} — ${diagnostic.message}`
}

export function formatSession(session: LogSession): string {
	const lines: string[] = []

	if (session.engine) {
		lines.push(`## 引擎\n${session.engine.raw}`)
	}
	if (session.variant) {
		lines.push(`## 变体\n${session.variant.name} ${session.variant.version}`)
	}

	if (session.fatalError) {
		const fatal = session.fatalError
		lines.push(`## 致命错误\n${fatal.exceptionClass}: ${fatal.exceptionMessage}`)
		if (fatal.detailLines.length > 0) {
			lines.push(fatal.detailLines.join("\n"))
		}
	}

	const summary = summarizeDiagnostics(session.diagnostics)
	lines.push(`## 诊断\n共 ${summary.total} 条`)

	if (summary.total === 0) {
		return lines.join("\n\n")
	}

	const severityText = Object.entries(summary.bySeverity)
		.sort((a, b) => severityRank(Number(a[0])) - severityRank(Number(b[0])))
		.map(([severity, count]) => `严重度 ${severity}: ${count} 条`)
		.join("，")
	lines.push(`严重度分布：${severityText}`)

	if (summary.byIdentifier.length > 0) {
		const topIdentifiers = summary.byIdentifier
			.slice(0, 10)
			.map((item) => `\`${item.identifier}\` ×${item.count}`)
			.join("、")
		lines.push(`出现最多的标识符：${topIdentifiers}`)
	}

	const sorted = [...session.diagnostics].sort(
		(a, b) => severityRank(a.severity) - severityRank(b.severity) || a.file.localeCompare(b.file),
	)
	lines.push("### 明细")
	lines.push(sorted.slice(0, MAX_DIAGNOSTICS_SHOWN).map(formatDiagnostic).join("\n"))
	if (sorted.length > MAX_DIAGNOSTICS_SHOWN) {
		lines.push(`（还有 ${sorted.length - MAX_DIAGNOSTICS_SHOWN} 条未显示）`)
	}

	const hints = Object.keys(summary.byKind)
		.map((kind) => KIND_HINTS[kind])
		.filter((hint): hint is string => Boolean(hint))
		.slice(0, 6)
	if (hints.length > 0) {
		lines.push(`## 建议\n${hints.map((hint) => `- ${hint}`).join("\n")}`)
	}

	return lines.join("\n\n")
}

export class LogDiagnoseToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.LOG_DIAGNOSE

	constructor(private validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		return `[${block.name} for '${block.params.log_path || "自动探测日志"}']`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 参数很少，等完整块再处理
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const requestedPath = block.params.log_path

		let absolutePath: string | undefined
		let displayPath: string

		if (requestedPath) {
			const accessValidation = this.validator.checkClineIgnorePath(requestedPath)
			if (!accessValidation.ok) {
				config.taskState.consecutiveMistakeCount++
				return formatResponse.toolError(formatResponse.clineIgnoreError(requestedPath))
			}
			const pathResult = resolveWorkspacePath(config, requestedPath, "LogDiagnoseToolHandler.execute")
			absolutePath = typeof pathResult === "string" ? pathResult : pathResult.absolutePath
			displayPath = typeof pathResult === "string" ? requestedPath : pathResult.displayPath
		} else {
			const extraRoots = await getExtraWorkspaceRoots(config.cwd)
			const discovered = await findNewestLog(config.cwd, extraRoots)
			if (discovered) {
				absolutePath = discovered.filePath
				const relative = path.relative(config.cwd, discovered.filePath).replace(/\\/g, "/")
				displayPath = relative && !relative.startsWith("..") ? relative : discovered.filePath.replace(/\\/g, "/")
			} else {
				absolutePath = undefined
				displayPath = ""
			}
		}

		if (!absolutePath) {
			config.taskState.consecutiveMistakeCount++
			return formatResponse.toolError(
				"没有找到日志文件（已在工作区里按 .log 特征搜过，不限定目录名）。可以：① 用 log_path 参数直接指定路径；② 确认程序确实生成了日志；③ 如果日志在别的目录，把那个目录一起加进工作区（多根工作区）后重试。",
			)
		}

		try {
			const fileStat = await fs.stat(absolutePath)
			const readResult = await readTextFile(absolutePath, { maxBytes: MAX_LOG_READ_BYTES })
			const session = parseLog(readResult.text)
			const sizeNote = readResult.truncated ? `，已截断：只解析了开头 ${formatBytes(readResult.byteLength)}` : ""
			const header = `## 日志\n${displayPath}（${formatBytes(fileStat.size)}${sizeNote}）`
			const body = formatSession(session)
			const truncationNote = readResult.truncated
				? `\n\n> 这份日志共 ${formatBytes(readResult.totalBytes)}，只解析了开头 ${formatBytes(readResult.byteLength)}。` +
					"较早的启动错误在开头，之后的运行期错误在尾部；需要尾部时请让用户新建会话或手动截取。"
				: ""
			const result = truncateContent(`${header}\n\n${body}${truncationNote}`, MAX_OUTPUT_BYTES)

			const sharedMessageProps = {
				tool: "readFile",
				path: getReadablePath(config.cwd, displayPath),
				content: result,
				operationIsLocatedInWorkspace: await isLocatedInWorkspace(displayPath),
			}
			const completeMessage = JSON.stringify(sharedMessageProps)

			if (await config.callbacks.shouldAutoApproveToolWithPath(block.name, displayPath)) {
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
			return formatResponse.toolError(`读取日志失败：${errorMessage}`)
		}
	}
}

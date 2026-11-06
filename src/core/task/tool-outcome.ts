/**
 * 工具执行结果的判定（纯函数，可单测，不引入宿主依赖）。
 *
 * 背景：Cline 的工具失败有三种形态——
 * 1. handler 抛异常 → 被 ToolExecutor.handleError 捕获，转成 toolError 文本返回给模型；
 * 2. handler 正常 resolve 一个 `formatResponse.toolError(...)` 文本；
 * 3. 用户在审批里点「拒绝」→ handler 正常 resolve `formatResponse.toolDenied()`（不抛异常）。
 * 只识别第 1 种，审计日志里会把 2、3 两种失败全记成 ok（排障时最容易踩的坑）。
 */
import type { AuditOutcome } from "../logging/audit-log-format"

/** 一次工具调用的结果——由执行路径直接返回，避免用可变字段旁路传递。 */
export type ToolExecutionResult = {
	outcome: AuditOutcome
	message?: string
	/** 报错现场的参数快照（dialect-guard 产出；仅 outcome=error 时由防线填充，审计层统一脱敏）。 */
	snapshot?: string
	/**
	 * 08 #238：疑似静默失败的提示位（exit 0 但零输出 / 命中 stderr 特征 / 输出被转储）。
	 * 刻意**不是** outcome 枚举：用户裁定不新增枚举，这类只进诊断包提示，
	 * 绝不混入 `summarizeToolFailures` 的「工具失败 N 次」口径。
	 */
	suspect?: boolean
}

const TOOL_ERROR_PREFIX = "The tool execution failed with the following error:"
export const TOOL_DENIED_TEXT = "The user denied this operation."

/** 把响应（字符串或内容块数组）压成纯文本。 */
function responseText(response: unknown): string {
	if (typeof response === "string") {
		return response
	}
	if (Array.isArray(response)) {
		return response
			.map((block) =>
				block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string"
					? (block as { text: string }).text
					: "",
			)
			.join("\n")
	}
	return ""
}

/**
 * 从 handler 的返回值里提取错误信息；不是 toolError（或没有错误文本）时返回 undefined。
 */
export function extractToolErrorMessage(response: unknown): string | undefined {
	const text = responseText(response)

	if (!text.startsWith(TOOL_ERROR_PREFIX)) {
		return undefined
	}
	const matched = /<error>\s*([\s\S]*?)\s*<\/error>/.exec(text)
	return (matched?.[1] ?? text.slice(TOOL_ERROR_PREFIX.length)).trim() || undefined
}

/**
 * 用户拒绝本次审批时 handler 返回的是固定文案（不是异常），单独识别后才能把
 * 审计记为 `denied`——这是日常最高频的「工具没执行」。
 *
 * 不能只做全等比较：handler 会在标准文案后追加说明（WriteToFile 会带「文件未更新/未创建」，
 * ApplyPatch 会带「补丁未应用」）。只认全等会把这两类最常见的拒绝记成 `ok`。
 * 同时兼容 ApplyPatch 的历史文案（`denied this patch operation`）。
 */
const DENIED_RE = /^the user denied this (operation|patch operation)\./i

export function isToolDenied(response: unknown): boolean {
	return DENIED_RE.test(responseText(response).trim())
}

/**
 * handler 返回值 → 审计结果（denied > error > ok）。
 * 抽成单函数是为了让「拒绝/失败到底能不能进日志」这件事被单测锁住，
 * 而不是只锁在 ToolExecutor 里没人测的分支上。
 */
export function outcomeFromToolResponse(response: unknown): ToolExecutionResult {
	if (isToolDenied(response)) {
		return { outcome: "denied", message: TOOL_DENIED_TEXT }
	}
	const message = extractToolErrorMessage(response)
	return message ? { outcome: "error", message } : { outcome: "ok" }
}

/**
 * 08 #238：命令执行的结构化元数据（由 CommandOrchestrator 的 exitCode/signal/outputLines
 * 透传而来）。纯类型、零宿主依赖；刻意不塞进给模型看的 `result` 文本（形状不许变）。
 */
export type CommandExecutionMeta = {
	/** 进程退出码；undefined 表示 shell 集成没给出（不算失败）。 */
	exitCode?: number
	/** 终止信号（没给 exitCode 但给了 signal 时判失败）。 */
	signal?: string
	/** 实际回传的命令输出长度（不含 statusMessage），用于「exit 0 + 零输出」判定。 */
	outputLength: number
	/** 命中 STDERR_HINT_PATTERNS 的特征列表（只给 suspect，绝不判 error）。 */
	stderrHints: string[]
	/** 输出未完整回传；见 CommandExecutor 里的保守判定说明。 */
	truncated: boolean
	/**
	 * 08 #238（review 修订）：用户点取消按钮终止了运行中的命令。
	 * 取消时 orchestrator 给不出 exitCode，且返回文案不匹配 denied / toolError 前缀，
	 * 缺这个字段就会被 `outcomeFromToolResponse` 判成 ok（#238 同类漏网）。
	 */
	cancelled?: boolean
}

/**
 * 08 #238：stderr 内容级特征的**单源**常量。只列已知工具/运行时报错的固定字面，
 * 刻意不泛化到任意 "error"/"failed"——合法命令输出里这些词太常见。
 * 命中只置 `suspect`，绝不判 error、不计入「工具失败 N 次」。
 */
export const STDERR_HINT_PATTERNS: readonly string[] = [
	"FINDSTR:",
	"SyntaxError",
	"Traceback",
	"系统找不到指定的路径",
	"'head' 不是内部或外部命令",
]

/** 从回传输出里扫出命中的 stderr 特征（单源判据、字面匹配、不泛化）。 */
export function collectCommandStderrHints(output: string): string[] {
	if (!output) {
		return []
	}
	return STDERR_HINT_PATTERNS.filter((pattern) => output.includes(pattern))
}

/**
 * 08 #238：命令结果判定的**唯一单源**。在 `outcomeFromToolResponse` 之后叠加命令的
 * 退出码/信号/输出特征：
 * - denied/error/cancelled 优先级最高，原样返回（用户拒绝/工具报错不可被覆盖）；
 * - 非零 exitCode / 仅有 signal → error（message 脱敏，绝不含命令输出正文）；
 * - 其余（含 stderr 特征、输出被转储、exit 0 零输出）→ 保持 ok，只置 `suspect`。
 */
export function commandOutcomeFromMeta(meta: CommandExecutionMeta | undefined, base: ToolExecutionResult): ToolExecutionResult {
	if (base.outcome !== "ok" || !meta) {
		return base
	}
	// 08 #238（review 修订）：用户中途取消不是成功。优先于 exitCode——取消时
	// orchestrator 给不出退出码，若只靠 exitCode 判据仍会回落成 ok。
	if (meta.cancelled) {
		return { outcome: "cancelled", message: "Command was cancelled by the user." }
	}
	if (meta.exitCode != null && meta.exitCode !== 0) {
		return { outcome: "error", message: `Command failed with exit code ${meta.exitCode}.` }
	}
	if (meta.exitCode == null && meta.signal) {
		return { outcome: "error", message: `Command terminated by signal ${meta.signal}.` }
	}
	const suspect = meta.stderrHints.length > 0 || meta.truncated || meta.outputLength === 0
	return suspect ? { ...base, suspect: true } : base
}

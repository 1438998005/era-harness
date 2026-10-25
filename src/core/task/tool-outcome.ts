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

/**
 * 诊断审计日志的**纯逻辑**部分（工作流 B）。
 *
 * 与落盘解耦的原因：审计内容必须能在测试里被验证（尤其是脱敏），
 * 而落盘依赖 HostProvider / vscode，不适合进纯函数测试。
 *
 * 两条硬纪律：
 * 1. **白名单**：只序列化这里显式列出的字段。调用方塞进来的未知键一律丢弃，
 *    所以 `block.params` 被误传时也不会把 prompt、diff、密钥写进日志。
 * 2. **脱敏**：所有字符串字段先截断再擦除形如 `sk-...` / `Bearer ...` / 长哈希的片段。
 */

export type AuditEventKind = "tool" | "task" | "memory" | "update"

export type AuditOutcome = "ok" | "error" | "denied" | "cancelled" | "info"

/** 调用方提供的原始条目（允许只填部分字段）。 */
export interface AuditEntry {
	taskId?: string
	turn?: number
	event: AuditEventKind
	/** 工具 id，如 read_file / replace_in_file */
	tool?: string
	/** 人工动作名，如 "check" / "install" / "add" */
	action?: string
	/** 目标路径或 URL（截断 + 脱敏） */
	target?: string
	/** 读取/编辑的行区间 */
	range?: [number, number]
	/** 搜索词（截断 + 脱敏） */
	query?: string
	/** 搜索的文件模式 */
	pattern?: string
	/** 去重键，用于把同一文件同一区间的多次调用对齐 */
	dedupeKey?: string
	cacheHit?: boolean
	readCount?: number
	outcome?: AuditOutcome
	/** 耗时（毫秒） */
	ms?: number
	provider?: string
	model?: string
	/** 短说明（错误信息等，截断 + 脱敏）；绝不写消息正文 */
	message?: string
}

/** 单个字符串字段的最大长度：路径足够用，正文一定被砍掉。 */
export const AUDIT_MAX_TEXT_CHARS = 300

/** 审计文件保留天数。 */
export const AUDIT_RETENTION_DAYS = 14

/** 单文件上限；超过后切到 `audit-YYYY-MM-DD-2.jsonl`。 */
export const AUDIT_MAX_FILE_BYTES = 8 * 1024 * 1024

/** 导出诊断包时附带的最近审计行数。 */
export const AUDIT_EXPORT_LINE_LIMIT = 500

/**
 * 敏感值形态。宁可多擦：审计日志是给外部排障用的，多几个星号无所谓，
 * 漏一个 key 就是事故。
 */
const SECRET_PATTERNS: RegExp[] = [
	/\bsk-[A-Za-z0-9_-]{8,}/g,
	/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
	/\b(xox[baprs]|ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_-]{8,}/g,
	// key=value / token: value 形态
	/\b(api[-_]?key|access[-_]?token|secret|password|authorization)\b\s*[:=]\s*["']?[^\s"',}]{4,}/gi,
	// 长十六进制/Base64 串（sk- 前缀之外的常见密钥形态）
	/\b[A-Fa-f0-9]{32,}\b/g,
	/\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
]

/** 擦除形如密钥的片段，并把换行压成 ⏎，保证一条日志只占一行。 */
export function scrubSecrets(text: string): string {
	let result = text
	for (const pattern of SECRET_PATTERNS) {
		result = result.replace(pattern, "[redacted]")
	}
	return result.replace(/[\r\n\t]+/g, " ").trim()
}

/** 截断 + 脱敏。非字符串一律返回 undefined，避免意外把对象序列化进来。 */
export function cleanAuditText(value: unknown, maxChars = AUDIT_MAX_TEXT_CHARS): string | undefined {
	if (typeof value !== "string") {
		return undefined
	}
	const trimmed = value.trim()
	if (!trimmed) {
		return undefined
	}
	const scrubbed = scrubSecrets(trimmed)
	return scrubbed.length > maxChars ? `${scrubbed.slice(0, maxChars)}…` : scrubbed
}

function cleanNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function cleanBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined
}

function cleanRange(value: unknown): [number, number] | undefined {
	if (!Array.isArray(value) || value.length !== 2) {
		return undefined
	}
	const [start, end] = value
	if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end)) {
		return undefined
	}
	return [start, end]
}

const EVENT_KINDS = new Set<AuditEventKind>(["tool", "task", "memory", "update"])
const OUTCOMES = new Set<AuditOutcome>(["ok", "error", "denied", "cancelled", "info"])

/**
 * 把任意输入收敛成可落盘的字段集合。
 * 返回 null 表示这条记录不该写（缺 event 或 event 非法）。
 */
export function sanitizeAuditEntry(entry: AuditEntry, now = Date.now()): Record<string, unknown> | null {
	if (!entry || !EVENT_KINDS.has(entry.event)) {
		return null
	}

	const record: Record<string, unknown> = {
		ts: now,
		event: entry.event,
	}

	const taskId = cleanAuditText(entry.taskId, 64)
	if (taskId) record.taskId = taskId

	const turn = cleanNumber(entry.turn)
	if (turn !== undefined) record.turn = turn

	const tool = cleanAuditText(entry.tool, 64)
	if (tool) record.tool = tool

	const action = cleanAuditText(entry.action, 64)
	if (action) record.action = action

	const target = cleanAuditText(entry.target)
	if (target) record.target = target

	const range = cleanRange(entry.range)
	if (range) record.range = range

	const query = cleanAuditText(entry.query)
	if (query) record.query = query

	const pattern = cleanAuditText(entry.pattern, 120)
	if (pattern) record.pattern = pattern

	const dedupeKey = cleanAuditText(entry.dedupeKey, 120)
	if (dedupeKey) record.dedupeKey = dedupeKey

	const cacheHit = cleanBoolean(entry.cacheHit)
	if (cacheHit !== undefined) record.cacheHit = cacheHit

	const readCount = cleanNumber(entry.readCount)
	if (readCount !== undefined) record.readCount = readCount

	if (entry.outcome && OUTCOMES.has(entry.outcome)) record.outcome = entry.outcome

	const ms = cleanNumber(entry.ms)
	if (ms !== undefined) record.ms = Math.max(0, Math.round(ms))

	const provider = cleanAuditText(entry.provider, 64)
	if (provider) record.provider = provider

	const model = cleanAuditText(entry.model, 64)
	if (model) record.model = model

	const message = cleanAuditText(entry.message, 200)
	if (message) record.message = message

	return record
}

/** 一行 JSONL（不含换行符）。非法条目返回 null。 */
export function serializeAuditEntry(entry: AuditEntry, now = Date.now()): string | null {
	const record = sanitizeAuditEntry(entry, now)
	return record ? JSON.stringify(record) : null
}

/** `audit-YYYY-MM-DD(-n)?.jsonl`；日期用本地时区，方便用户按「今天」找。 */
export function auditFileName(date: Date, index = 1): string {
	const yyyy = date.getFullYear()
	const mm = `${date.getMonth() + 1}`.padStart(2, "0")
	const dd = `${date.getDate()}`.padStart(2, "0")
	const suffix = index > 1 ? `-${index}` : ""
	return `audit-${yyyy}-${mm}-${dd}${suffix}.jsonl`
}

/** 从文件名解析日期（无效名返回 undefined）。 */
export function parseAuditFileDate(fileName: string): Date | undefined {
	const match = /^audit-(\d{4})-(\d{2})-(\d{2})(?:-\d+)?\.jsonl$/.exec(fileName)
	if (!match) {
		return undefined
	}
	const [, yyyy, mm, dd] = match
	const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
	return Number.isNaN(date.getTime()) ? undefined : date
}

/** 诊断包文件名：`diagnostics-YYYYMMDD-HHmmss.txt`。 */
export function diagnosticsFileName(date: Date): string {
	const yyyy = date.getFullYear()
	const datePart = [`${date.getMonth() + 1}`.padStart(2, "0"), `${date.getDate()}`.padStart(2, "0")].join("")
	const timePart = [
		`${date.getHours()}`.padStart(2, "0"),
		`${date.getMinutes()}`.padStart(2, "0"),
		`${date.getSeconds()}`.padStart(2, "0"),
	].join("")
	return `diagnostics-${yyyy}${datePart}-${timePart}.txt`
}

export interface DiagnosticsHeader {
	extensionVersion: string
	platform?: string
	vscodeVersion?: string
	generatedAt?: Date
	/** 已脱敏的设置摘要（键值都经过 cleanAuditText） */
	settings?: Record<string, unknown>
}

/**
 * 生成诊断包正文（不含审计行）：版本、环境、脱敏设置。
 * 刻意不写任何绝对路径以外的环境细节（用户名可能出现在路径里，但用户自己发的文件）。
 */
export function buildDiagnosticsHeader(header: DiagnosticsHeader): string {
	const lines: string[] = []
	const generatedAt = header.generatedAt ?? new Date()

	lines.push("era harness 诊断包")
	lines.push(`生成时间: ${generatedAt.toISOString()}`)
	lines.push(`插件版本: ${cleanAuditText(header.extensionVersion) ?? "unknown"}`)
	lines.push(`平台: ${cleanAuditText(header.platform) ?? process.platform}`)
	if (header.vscodeVersion) {
		lines.push(`VS Code: ${cleanAuditText(header.vscodeVersion) ?? "unknown"}`)
	}

	const settings = Object.entries(header.settings ?? {})
		.map(([key, value]) => [key, cleanAuditText(String(value ?? ""))] as const)
		.filter(([, value]) => !!value)

	if (settings.length > 0) {
		lines.push("")
		lines.push("设置摘要（已脱敏，不含密钥）:")
		for (const [key, value] of settings) {
			lines.push(`  ${key}: ${value}`)
		}
	}

	return lines.join("\n")
}

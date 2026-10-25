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

export type AuditEventKind = "tool" | "task" | "memory" | "update" | "api" | "parse"

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
	/**
	 * 报错现场的参数快照（dialect-guard 产出；仅 outcome=error 的工具调用携带）。
	 * 已排除 content/diff/command 正文类参数；外发前再过 scrubSecrets。
	 */
	snapshot?: string
	/** api 事件：本次请求的输入 token 数（含缓存命中） */
	inputTokens?: number
	/** api 事件：本次请求的输出 token 数 */
	outputTokens?: number
	/** api 事件：缓存读 token 数 */
	cacheReadTokens?: number
	/** api 事件：缓存写 token 数 */
	cacheWriteTokens?: number
	/** api 事件：本次请求费用（CNY/USD 视 provider 口径，与 UI 一致） */
	cost?: number
	/** api 事件：重试轮次（从 1 起） */
	attempt?: number
	/** api 事件：最大重试轮次 */
	maxAttempts?: number
	/** api 事件：重试退避（毫秒） */
	delayMs?: number
	/** parse 事件：归一化/修复命中摘要（如 `dsml=3,dots=1`），仅非零时携带 */
	repairs?: string
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

/** `message` 比其它字段更短：它只用来回答「失败在哪一类」，不需要整段错误。 */
const AUDIT_MESSAGE_MAX_CHARS = 80

/**
 * 错误文本里可能内嵌**文件正文**，截断挡不住（前 200 字就是正文）。
 * 典型来源：
 * - `formatResponse.diffError()` 把 `<file_content>` 原文塞进错误；
 * - `diff.ts` 的 SEARCH 不匹配把模型给的 SEARCH 块（就是文件内容）原样拼进 message；
 * - `attempt_completion` 的二次确认带 `<initial_task>`。
 * 审计包要能直接发给陌生人，所以必须先剥结构再截断。
 */
const CONTENT_BLOCK_RE = /<(file_content|final_file_content|initial_task|feedback)\b[^>]*>[\s\S]*?<\/\1>/gi
/** 没有闭合标签（错误文本被截断）时，从这里往后整段丢弃。 */
const UNCLOSED_CONTENT_BLOCK_RE = /<(file_content|final_file_content|initial_task|feedback)\b[^>]*>[\s\S]*$/i
export const SEARCH_MISMATCH_TEXT = "The SEARCH block does not match the file content."

/**
 * `message` 的归一规则：命中**头部**就把整段换掉，冒号后面的内容一个字都不留。
 *
 * 为什么钉头部而不是枚举结尾：`diff.ts` 有 4 处 throw、**3 种结尾**
 * （`does not match anything in the file.` / `is malformatted.` /
 * `matched an incorrect content in the file.`），全都把模型给的 SEARCH 块
 * （就是文件正文）拼在冒号后面。枚举结尾必然漏一个，将来新增第 4 种也不会有人
 * 回来补正则；而 `The SEARCH block:` 这个头是稳定的。
 */
const AUDIT_MESSAGE_RULES: Array<{ re: RegExp; replace: (match: RegExpExecArray) => string }> = [
	{
		// 兼容 ToolExecutor.handleError 拼出的前缀。生产形状是
		// `Error executing replace_in_file: `——**两段**（`ToolExecutor.ts:439` 传
		// `executing ${block.name}`，`:308` 拼 `Error ${action}: `）。
		// 但段数属于会漂移的细节（旧写法 `[a-z_]+` 只吃一段，前缀剥不掉 → 规则根本不命中），
		// 所以这里**不枚举段数**：`Error <任意说明>: ` 一律剥掉，钉的是 `The SEARCH block:` 这个头。
		re: /^(?:error\s+[^:\n]*:\s*)?the\s+search\s+block\s*:/i,
		replace: () => SEARCH_MISMATCH_TEXT,
	},
	{
		// MCP 的 isError 文本是服务端返回的**任意**内容（可能是整段 JSON 或文件正文），
		// 只留「哪一类失败」：`MCP tool returned an error (server/tool)`。
		re: /^(mcp tool returned an error\s*\([^)\n]*\))/i,
		replace: (match) => match[1].trim(),
	},
]

/** `message` 专用清洗：剥掉正文块 → 已知错误按头部归一 → 首句 → 80 字。 */
export function cleanAuditMessage(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined
	}
	let text = value.replace(CONTENT_BLOCK_RE, "[omitted]").replace(UNCLOSED_CONTENT_BLOCK_RE, "[omitted]")
	// <error> 只是包装，保留里面的短说明；真正的内容块已经在上面剥掉。
	text = text.replace(/<\/?error>/gi, " ").trim()

	for (const rule of AUDIT_MESSAGE_RULES) {
		const match = rule.re.exec(text)
		if (match) {
			text = rule.replace(match)
			break
		}
	}

	const scrubbed = scrubSecrets(text)
	if (!scrubbed) {
		return undefined
	}
	const firstSentence = scrubbed.split(/(?<=[.!?。！？])\s/)[0] || scrubbed
	return firstSentence.length > AUDIT_MESSAGE_MAX_CHARS ? `${firstSentence.slice(0, AUDIT_MESSAGE_MAX_CHARS)}…` : firstSentence
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

const EVENT_KINDS = new Set<AuditEventKind>(["tool", "task", "memory", "update", "api", "parse"])
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
		// D5（2026-10-25）：补 ISO 时间戳——epoch ms 无法直接与 UI/日志时间对账。
		iso: new Date(now).toISOString(),
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

	const message = cleanAuditMessage(entry.message)
	if (message) record.message = message

	// 报错现场快照：cap 放宽到 1000（排障要看到残片完整形状），scrub 仍走 cleanAuditText
	const snapshot = cleanAuditText(entry.snapshot, 1000)
	if (snapshot) record.snapshot = snapshot

	// api 事件的用量/重试字段
	const inputTokens = cleanNumber(entry.inputTokens)
	if (inputTokens !== undefined) record.inputTokens = inputTokens
	const outputTokens = cleanNumber(entry.outputTokens)
	if (outputTokens !== undefined) record.outputTokens = outputTokens
	const cacheReadTokens = cleanNumber(entry.cacheReadTokens)
	if (cacheReadTokens !== undefined) record.cacheReadTokens = cacheReadTokens
	const cacheWriteTokens = cleanNumber(entry.cacheWriteTokens)
	if (cacheWriteTokens !== undefined) record.cacheWriteTokens = cacheWriteTokens
	if (typeof entry.cost === "number" && Number.isFinite(entry.cost)) record.cost = entry.cost
	const attempt = cleanNumber(entry.attempt)
	if (attempt !== undefined) record.attempt = attempt
	const maxAttempts = cleanNumber(entry.maxAttempts)
	if (maxAttempts !== undefined) record.maxAttempts = maxAttempts
	const delayMs = cleanNumber(entry.delayMs)
	if (delayMs !== undefined) record.delayMs = delayMs

	// parse 事件的修复命中摘要
	const repairs = cleanAuditText(entry.repairs, 200)
	if (repairs) record.repairs = repairs

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

/** `audit-YYYY-MM-DD(-n)?.jsonl` 里的分片号（基础文件为 1）。 */
export function auditFileChunkIndex(fileName: string): number {
	const match = /^audit-\d{4}-\d{2}-\d{2}(?:-(\d+))?\.jsonl$/.exec(fileName)
	return match?.[1] ? Number(match[1]) : 1
}

/**
 * 审计文件降序比较（最新在前）：先比日期，再比分片号。
 *
 * 不能用文件名直接排序：`audit-…-2.jsonl` 里的 `-`(0x2D) 小于 `audit-….jsonl` 的 `.`(0x2E)，
 * 分片会排到基础文件前面；一旦只取最近 N 行就永远是当天最早那段，导出包丢掉故障现场。
 */
export function compareAuditFilesDesc(a: string, b: string): number {
	const dateA = parseAuditFileDate(a)?.getTime() ?? 0
	const dateB = parseAuditFileDate(b)?.getTime() ?? 0
	if (dateA !== dateB) {
		return dateB - dateA
	}
	return auditFileChunkIndex(b) - auditFileChunkIndex(a)
}

/**
 * 把「从新到旧」读取到的文件内容合并成导出文本：输出旧→新，且只保留最新的 limit 行。
 *
 * 抽成纯函数是为了锁住「最新事件必须在包里」这个 bug（只测文件排序锁不住拼接顺序）。
 */
export function collectRecentLines(fileContentsNewestFirst: string[], limit: number): string[] {
	const collected: string[] = []
	for (const content of fileContentsNewestFirst) {
		if (collected.length >= limit) {
			break
		}
		const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
		const take = lines.slice(Math.max(0, lines.length - (limit - collected.length)))
		collected.unshift(...take)
	}
	return collected.slice(-limit)
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

/**
 * D5（2026-10-25）：诊断包导出时的 update 事件折叠。
 *
 * 实测一轮装机（多次 check/install/cancel）可产生 17 条 update 事件，在 500 条窗口里
 * 挤占 tool/api/parse 等排障关键事件的额度。策略：保留最近 KEEP 条 update（回溯版本
 * 安装史仍有用），更早的折叠成一行机器可读摘要（19 §19.8：机器字段独占、不含正文）。
 * 其余事件全保留；总行数不超过 limit（超出时丢最老的，与 collectRecentLines 同语义）。
 */
const EXPORT_UPDATE_KEEP = 10

export function foldUpdateEventsForExport(lines: string[], limit: number): string[] {
	if (lines.length <= limit) {
		return lines
	}
	const parsed = lines.map((line, index) => {
		try {
			return { line, index, obj: JSON.parse(line) as { ts?: number; event?: string } }
		} catch {
			return { line, index, obj: undefined as { ts?: number; event?: string } | undefined }
		}
	})
	const updates = parsed.filter((p) => p.obj?.event === "update")
	const others = parsed.filter((p) => p.obj?.event !== "update")
	const keepUpdates = updates.slice(-EXPORT_UPDATE_KEEP)
	const foldedCount = updates.length - keepUpdates.length

	const kept = [...others, ...keepUpdates]
	// 恢复时间序：全部可解析时按 ts 排，否则按原顺序稳定兜底
	kept.sort((a, b) => {
		const ta = typeof a.obj?.ts === "number" ? a.obj.ts : undefined
		const tb = typeof b.obj?.ts === "number" ? b.obj.ts : undefined
		if (ta !== undefined && tb !== undefined && ta !== tb) return ta - tb
		return a.index - b.index
	})

	const result = kept.slice(-limit).map((p) => p.line)
	if (foldedCount > 0) {
		result.push(
			JSON.stringify({
				event: "update",
				action: "folded",
				folded: foldedCount,
				note: `另有 ${foldedCount} 条更早的 update 事件已折叠`,
			}),
		)
	}
	return result
}

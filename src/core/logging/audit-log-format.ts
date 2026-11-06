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

export type AuditEventKind = "tool" | "task" | "memory" | "update" | "updateGame" | "api" | "parse" | "error"

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
	/**
	 * 08 #238：疑似静默失败提示位（exit 0 零输出 / stderr 特征 / 输出被转储）。
	 * 不是 outcome 枚举，不计入「工具失败 N 次」；只供诊断包做「疑似静默失败」小计。
	 */
	suspect?: boolean
	/** 耗时（毫秒） */
	ms?: number
	provider?: string
	model?: string
	/** 短说明（错误信息等，截断 + 脱敏）；绝不写消息正文 */
	message?: string
	/** 结构化摘要（key=value，如更新计划的统计）；截断 + 脱敏，绝不写正文 */
	detail?: string
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
	/**
	 * KB 08 #247：连续同因流式失败的当前累计次数（从 1 起）。
	 * 只写在 `action:"stream_error_streak"` 的 api 事件上，供诊断包头部小计使用。
	 */
	streak?: number
	/** KB 08 #247：该次失败是否已达到升级阈值（N=3），只提示不退避、不阻断重试。 */
	streakEscalated?: boolean
	/** parse 事件：归一化/修复命中摘要（如 `dsml=3,dots=1`），仅非零时携带 */
	repairs?: string
	/** error 事件：错误来自哪一侧；subagent 用于子代理的独立费用行 */
	source?: "host" | "webview" | "subagent"
	/** api 事件：第几个子代理（1 起），仅 source=subagent */
	subagentIndex?: number
	/** error 事件：错误种类，如 grpc / unhandledRejection / uncaughtException / ui_error */
	errorKind?: string
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
	// 带固定前缀的云厂商密钥：**前缀本身就是识别特征**，长度够不上上面两条「长串」规则。
	// Google 的 AIza + 35 位共 39 字符（差 1 位不满足 {40,}）；AWS 的 AKIA + 16 位含非 hex 字母；
	// HuggingFace 的 hf_ 与 GitLab 的 glpat- 同理。漏掉这几种，provider 的 401 回显就会把 key 带进诊断包。
	// 尾部的 \b 只在最后一位必为单词字符时才加（含 `-` 的类不能用，否则匹配不上）。
	/\bAIza[0-9A-Za-z_-]{35}/g,
	/\bAKIA[0-9A-Z]{16}\b/g,
	/\bhf_[A-Za-z0-9]{20,}\b/g,
	/\bglpat-[A-Za-z0-9_-]{20,}/g,
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

const EVENT_KINDS = new Set<AuditEventKind>([
	"tool",
	"task",
	"memory",
	"update",
	// #185（2026-11-03）：游戏更新流程的事件。刻意与插件自升级的 "update" 分开——
	// 折叠逻辑只折 update/error，游戏更新一次只产生几条粗粒度事件，折叠只会把它藏起来。
	"updateGame",
	"api",
	"parse",
	"error",
])
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

	// 08 #238：suspect 只写真值（正常命令不带该字段），供诊断包单独小计；不碰 OUTCOMES 五态白名单。
	if (entry.suspect === true) record.suspect = true

	const ms = cleanNumber(entry.ms)
	if (ms !== undefined) record.ms = Math.max(0, Math.round(ms))

	const provider = cleanAuditText(entry.provider, 64)
	if (provider) record.provider = provider

	const model = cleanAuditText(entry.model, 64)
	if (model) record.model = model

	const message = cleanAuditMessage(entry.message)
	if (message) record.message = message

	// 结构化摘要（key=value）：更新流程的统计走这里，不挤 80 字的 message
	const detail = cleanAuditText(entry.detail, 300)
	if (detail) record.detail = detail

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

	// KB 08 #247：连续同因失败计数（api / stream_error_streak）。
	const streak = cleanNumber(entry.streak)
	if (streak !== undefined) record.streak = Math.max(0, Math.round(streak))
	if (entry.streakEscalated === true) record.streakEscalated = true

	// parse 事件的修复命中摘要
	const repairs = cleanAuditText(entry.repairs, 200)
	if (repairs) record.repairs = repairs

	// error 事件的来源侧与种类（message/snapshot 复用上面的通用清洗：先剥正文块再脱敏截断）
	const source = entry.source === "host" || entry.source === "webview" || entry.source === "subagent" ? entry.source : undefined
	if (source) record.source = source
	// #95：子代理序号是「第几个」，小数无意义（`cleanNumber` 只管 NaN/非数）：取整并夹到 0 以上
	const subagentIndexRaw = cleanNumber(entry.subagentIndex)
	if (subagentIndexRaw !== undefined) record.subagentIndex = Math.max(0, Math.round(subagentIndexRaw))
	const errorKind = cleanAuditText(entry.errorKind, 32)
	if (errorKind) record.errorKind = errorKind

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

/** 首次导出（找不到上次导出记录时）的回退窗口：只带最近 24 小时。 */
export const AUDIT_EXPORT_DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * #184（2026-11-03）：诊断包的记录窗口。
 *
 * 累加问题：导出永远取「留存期内最新 500 条」，每次导出都把几天前的老事件原样带上
 * （用户 11-03 导出，内容仍从 10-29 算起）。改为：有上次导出记录 → 只带那之后的事件
 *（逐次导出互不重复，更早的历史在上一份包文件里）；没有记录（首次导出/标记丢失）
 * → 回退最近 24 小时。
 */
export interface ExportWindow {
	sinceMs: number
	/** last-export = 跟着上次导出的水位走；default = 没有水位，用固定窗口 */
	source: "last-export" | "default"
}

/** `last-export.json` 的内容 → 上次导出时间；损坏/缺字段返回 undefined。 */
export function parseExportMarker(raw: string): Date | undefined {
	try {
		const parsed = JSON.parse(raw) as { iso?: unknown }
		if (typeof parsed?.iso === "string") {
			const date = new Date(parsed.iso)
			if (!Number.isNaN(date.getTime())) {
				return date
			}
		}
	} catch {
		// 半行 JSON：当作没有标记
	}
	return undefined
}

/** 导出窗口起点：有水位用水位，没有用默认窗口。水位在未来（时钟回拨）视为损坏，走默认。 */
export function exportWindowStart(marker: Date | undefined, now: Date): ExportWindow {
	if (marker && marker.getTime() <= now.getTime()) {
		return { sinceMs: marker.getTime(), source: "last-export" }
	}
	return { sinceMs: now.getTime() - AUDIT_EXPORT_DEFAULT_WINDOW_MS, source: "default" }
}

/**
 * 把「从新到旧」的文件内容按时间窗过滤：ts 在窗口内的行才保留。
 *
 * 解析失败或没有 ts 的行**保守保留**——半行 JSON 可能正是崩溃现场，宁多勿丢；
 * 窗口语义只对能确定时间的行生效。
 */
export function filterLinesWithinWindow(contentsNewestFirst: string[], sinceMs: number): string[] {
	const out: string[] = []
	for (const content of contentsNewestFirst) {
		const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
		const kept = lines.filter((line) => {
			try {
				const parsed = JSON.parse(line) as { ts?: unknown }
				if (typeof parsed?.ts === "number" && Number.isFinite(parsed.ts)) {
					return parsed.ts >= sinceMs
				}
			} catch {
				// 无法判定时间的行保守保留
			}
			return true
		})
		if (kept.length > 0) {
			out.push(kept.join("\n"))
		}
	}
	return out
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
	/**
	 * #63（2026-10-29）：包内 error 事件的小计。
	 * 不传就整段不出现——保持「老调用方零改动」的兼容性。
	 */
	errorStats?: ErrorEventStats
	/**
	 * KB 08 #247：包内连续同因流式失败的小计。
	 * 不传就整段不出现——保持「老调用方零改动」的兼容性。
	 */
	streamErrorStreak?: StreamErrorStreakSummary
	/**
	 * 08 #240：按模型聚合的健康度表（**只做可观测，不参与路由**）。
	 * 不传就整段不出现——保持「老调用方零改动」的兼容性。
	 */
	modelHealth?: readonly ModelHealthRow[]
	/**
	 * #184（2026-11-03）：本包审计事件覆盖窗口的说明行。
	 * 不传就不输出（老调用方零改动）。
	 */
	auditWindow?: { sinceIso: string; source: "last-export" | "default" }
}

/** error 事件来源侧的人话；未知侧原样显示（将来新增来源不用回来改这里）。 */
const ERROR_SOURCE_LABEL: Record<string, string> = {
	host: "宿主",
	webview: "界面",
	unknown: "来源未记",
}

/**
 * errorKind 的人话。键是**写入侧的真实取值**，改一处就要改三处（见注释里的出处），
 * 所以这里只做显示映射，不认识的值原样打出来——宁可露出 `xxx`，也不要静默归成「其它」。
 */
const ERROR_KIND_LABEL: Record<string, string> = {
	// 扩展宿主：core/controller/grpc-handler.ts（界面调过来的请求失败）
	grpc: "界面调用宿主失败",
	// 扩展宿主：core/logging/global-error-capture.ts
	unhandledRejection: "未处理的 Promise 拒绝",
	uncaughtException: "未捕获异常",
	// 界面：webview-ui/src/services/ui-error-reporter.ts
	"window.onerror": "界面脚本错误",
	unhandledrejection: "界面未处理拒绝",
	// 界面：webview-ui/src/components/chat/ChatErrorBoundary.tsx
	"react-error-boundary": "界面渲染崩溃",
}

/** 包内 error 事件的小计结果（#63）。 */
export interface ErrorEventStats {
	/** 包内 error 事件条数（不含「已折叠」摘要行，那行本身也带 event:"error"） */
	total: number
	/** 按来源侧小计，条数降序、同数按名字排（保证同一份包每次导出的行序一致） */
	bySource: Array<{ source: string; count: number }>
	/** 按「来源侧 + 种类」小计，排序同上 */
	byKind: Array<{ source: string; kind: string; count: number }>
	/**
	 * #203：包内 `event:"tool" && outcome:"error"` 的条数。
	 * 工具失败走 tool 事件、不属于 error 事件类；不写进头部时用户会看到
	 * 「运行时错误: 0 条」却明明刚吃过一条工具红字，以为诊断包没抓到。
	 * 可选字段：老调用方零改动。
	 */
	toolFailures?: number
	/**
	 * 08 #238：包内 `event:"tool" && suspect===true` 的条数。与 toolFailures **分列**：
	 * suspect 不是 error，用户裁定不新增 outcome 枚举，也不得混进「工具失败 N 次」。
	 */
	silentSuspects?: number
}

/**
 * KB 08 #247：包内 `action:"stream_error_streak"` 事件的小计。
 * 与 `ErrorEventStats` 分开：这类事件是 `event:"api"`，不是「运行时错误」，
 * 混进错误小计会让「错误 28 条」看起来像插件崩了 28 次，实为同一渠道空响应重试。
 */
export interface StreamErrorStreakSummary {
	/** 包内这类事件条数 */
	total: number
	/** 观察到的最长连续同因失败次数 */
	maxStreak: number
	/** 达到升级阈值（streakEscalated === true）的条数 */
	escalated: number
	/** 涉及的任务数 */
	tasks: number
}

/**
 * KB 08 #247：诊断包头部统计。只数**包内**（折叠之后）的行，
 * 口径与 `summarizeErrorEvents` / `summarizeToolFailures` 一致；解析失败的行跳过。
 * `streak` 走白名单数字字段，⛔ 不从 `detail` 里正则抠数字（格式漂移就静默失效）。
 */
export function summarizeStreamErrorStreaks(lines: readonly string[]): StreamErrorStreakSummary {
	const tasks = new Set<string>()
	let total = 0
	let maxStreak = 0
	let escalated = 0

	for (const line of lines) {
		let parsed: unknown
		try {
			parsed = JSON.parse(line)
		} catch {
			continue
		}
		if (!parsed || typeof parsed !== "object") continue
		const record = parsed as Record<string, unknown>
		if (record.event !== "api" || record.action !== "stream_error_streak") continue
		total++
		if (typeof record.streak === "number" && Number.isFinite(record.streak)) {
			maxStreak = Math.max(maxStreak, Math.max(0, Math.round(record.streak)))
		}
		if (record.streakEscalated === true) escalated++
		if (typeof record.taskId === "string" && record.taskId) tasks.add(record.taskId)
	}

	return { total, maxStreak, escalated, tasks: tasks.size }
}

/** 0 条也必须写出来：拿到包的人要能区分「没发生」和「功能没接上」。 */
export function describeStreamErrorStreaks(stats: StreamErrorStreakSummary): string[] {
	if (stats.total === 0) {
		return ["连续同因流式失败: 0 条（记录窗口内没有累计失败事件）"]
	}
	return [
		`连续同因流式失败: ${stats.total} 条（涉及 ${stats.tasks} 个任务，最长连续 ${stats.maxStreak} 次，达到升级阈值 ${stats.escalated} 条）`,
	]
}

/**
 * #203：统计诊断包内的工具失败次数，口径与 `summarizeErrorEvents` 一致——
 * 只数**包内**（折叠之后）的行、跳过折叠摘要与半行 JSON、不新增事件类也不碰脱敏。
 */
export function summarizeToolFailures(lines: readonly string[]): number {
	let count = 0
	for (const line of lines) {
		let parsed: unknown
		try {
			parsed = JSON.parse(line)
		} catch {
			continue
		}
		if (!parsed || typeof parsed !== "object") {
			continue
		}
		const record = parsed as Record<string, unknown>
		if (record.event === "tool" && record.outcome === "error" && record.action !== "folded") {
			count++
		}
	}
	return count
}

/**
 * 08 #238：统计诊断包内「疑似静默失败」条数，口径与 `summarizeToolFailures` 同族——
 * 只数**包内**（折叠之后）`event:"tool" && suspect===true` 的行、跳过折叠摘要与半行 JSON。
 * 刻意与 `summarizeToolFailures` 分开：suspect 不是 error，绝不混入「工具失败 N 次」。
 */
export function summarizeSilentSuspects(lines: readonly string[]): number {
	let count = 0
	for (const line of lines) {
		let parsed: unknown
		try {
			parsed = JSON.parse(line)
		} catch {
			continue
		}
		if (!parsed || typeof parsed !== "object") {
			continue
		}
		const record = parsed as Record<string, unknown>
		if (record.event === "tool" && record.suspect === true && record.action !== "folded") {
			count++
		}
	}
	return count
}

/**
 * 08 #240：命令工具 id。与 `ClineDefaultTool.BASH`（src/shared/tools.ts）同源，由元测试钉住；
 * 本模块刻意不 import `@shared/tools`（那边带 SDK 类型依赖），保持纯函数零依赖。
 */
export const MODEL_HEALTH_COMMAND_TOOL = "execute_command"

/**
 * 08 #240：按模型聚合的工具链健康度（**只可观测，⛔ 不改 failover / 候选链 / 池序**）。
 * 数据源就是诊断包内的 `tool` 与 `parse` 事件本身（ToolExecutor/Task 已把 `model` 写进每条事件），
 * 不新增采集字段、不新增事件类；口径与 `summarizeToolFailures` / `summarizeSilentSuspects` 同族。
 */
export interface ModelHealthRow {
	/** 上游真实模型 ID；缺失时回落到 provider / "(未标注模型)"，绝不丢事件 */
	model: string
	toolCalls: number
	toolErrors: number
	commandCalls: number
	/** 命令层失败：outcome=error 或 suspect=true 的 execute_command */
	commandFailures: number
	parseRepairs: number
	silentSuspects: number
}

/** 从审计行里取分组键；已落盘的 model/provider 仍过一次脱敏截断，避免把长串写进诊断头部。 */
function modelHealthKey(record: Record<string, unknown>): string {
	const model = typeof record.model === "string" && record.model ? record.model : undefined
	if (model) {
		return cleanAuditText(model, 64) ?? "(未标注模型)"
	}
	const provider = typeof record.provider === "string" && record.provider ? record.provider : undefined
	return provider ? `${cleanAuditText(provider, 64)}:(模型未标注)` : "(未标注模型)"
}

export function summarizeModelHealth(lines: readonly string[]): ModelHealthRow[] {
	const rows = new Map<string, ModelHealthRow>()
	for (const line of lines) {
		let parsed: unknown
		try {
			parsed = JSON.parse(line)
		} catch {
			continue
		}
		if (!parsed || typeof parsed !== "object") {
			continue
		}
		const record = parsed as Record<string, unknown>
		if (record.action === "folded") {
			continue // 折叠摘要不是一条真实事件，与另两个小计同口径
		}
		const isTool = record.event === "tool"
		const isRepair = record.event === "parse" && record.action === "repair"
		if (!isTool && !isRepair) {
			continue
		}
		const key = modelHealthKey(record)
		let row = rows.get(key)
		if (!row) {
			row = {
				model: key,
				toolCalls: 0,
				toolErrors: 0,
				commandCalls: 0,
				commandFailures: 0,
				parseRepairs: 0,
				silentSuspects: 0,
			}
			rows.set(key, row)
		}
		if (isRepair) {
			row.parseRepairs++
			continue
		}
		row.toolCalls++
		if (record.outcome === "error") {
			row.toolErrors++
		}
		if (record.suspect === true) {
			row.silentSuspects++
		}
		if (record.tool === MODEL_HEALTH_COMMAND_TOOL) {
			row.commandCalls++
			if (record.outcome === "error" || record.suspect === true) {
				row.commandFailures++
			}
		}
	}
	// 最不健康的排前面：失败数降序 → 疑似静默 → parse repair → 模型名字典序（同一份包每次行序一致）
	return [...rows.values()].sort(
		(a, b) =>
			b.toolErrors - a.toolErrors ||
			b.silentSuspects - a.silentSuspects ||
			b.parseRepairs - a.parseRepairs ||
			a.model.localeCompare(b.model),
	)
}

/** 08 #240：把健康度表渲染成诊断包里的几行（0 行时整段不出现，老调用方零改动）。 */
export function describeModelHealth(rows: readonly ModelHealthRow[]): string[] {
	if (rows.length === 0) {
		return []
	}
	const pct = (n: number, d: number): string => (d === 0 ? "0%" : `${((n / d) * 100).toFixed(1)}%`)
	return [
		"按模型健康度（仅可观测，不影响路由；口径 = 本包内 tool/parse 事件）:",
		...rows.map(
			(r) =>
				`  ${r.model}: 工具 ${r.toolCalls} 次 / 失败 ${r.toolErrors}（${pct(r.toolErrors, r.toolCalls)}）` +
				`；命令 ${r.commandCalls} 次 / 失败 ${r.commandFailures}（${pct(r.commandFailures, r.commandCalls)}）` +
				`；疑似静默 ${r.silentSuspects}；parse repair ${r.parseRepairs}`,
		),
	]
}

/**
 * #63：统计诊断包内 `event:"error"` 的行数与来源/种类小计。
 *
 * 为什么统计**包内**而不是磁盘全部：用户与开发者看的是同一个 txt，头部说 3 条、
 * 正文只找得到 2 条，比不给数字更糟。折叠摘要行（`action:"folded"`）自己就写了
 * 「另有 N 条已折叠」，不重复计入。
 *
 * 解析失败的行直接跳过：诊断包宁可少统计一行，也不能因为半行 JSON 而导不出来。
 */
export function summarizeErrorEvents(lines: readonly string[]): ErrorEventStats {
	const sourceCounts = new Map<string, number>()
	const kindCounts = new Map<string, number>()
	let total = 0

	for (const line of lines) {
		let parsed: unknown
		try {
			parsed = JSON.parse(line)
		} catch {
			continue
		}
		if (!parsed || typeof parsed !== "object") {
			continue
		}
		const record = parsed as Record<string, unknown>
		if (record.event !== "error" || record.action === "folded") {
			continue
		}
		total++
		const source = typeof record.source === "string" && record.source ? record.source : "unknown"
		const kind = typeof record.errorKind === "string" && record.errorKind ? record.errorKind : "unknown"
		sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)
		const key = `${source}\u0000${kind}`
		kindCounts.set(key, (kindCounts.get(key) ?? 0) + 1)
	}

	const bySource = [...sourceCounts.entries()]
		.map(([source, count]) => ({ source, count }))
		.sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
	const byKind = [...kindCounts.entries()]
		.map(([key, count]) => {
			const [source, kind] = key.split("\u0000")
			return { source, kind, count }
		})
		.sort((a, b) => b.count - a.count || a.source.localeCompare(b.source) || a.kind.localeCompare(b.kind))

	return { total, bySource, byKind }
}

/**
 * #63：把小计渲染成诊断包头部的几行。
 *
 * 0 条也**必须**写出来：这段存在的意义就是让用户能自己验证「错误有没有被记到」。
 * 省略 = 用户无法区分「没错误」和「功能没做」，正是 #63 抱怨的那个状态。
 */
export function describeErrorStats(stats: ErrorEventStats): string[] {
	// #203：工具失败不是「运行时错误」，但用户刚吃过工具红字时头部不能只说 0 条。
	const toolFailureSuffix = stats.toolFailures ? `；工具失败 ${stats.toolFailures} 次（见下方 tool 事件）` : ""
	// 08 #238：疑似静默失败与工具失败分列；0 条时按既有风格省略（老调用方零改动）。
	const silentSuspectSuffix = stats.silentSuspects ? `；疑似静默失败 ${stats.silentSuspects} 条` : ""
	const suffix = `${toolFailureSuffix}${silentSuspectSuffix}`
	if (stats.total === 0) {
		return [`运行时错误: 0 条（记录窗口内没有错误；若刚触发过失败操作仍为 0，说明该错误没被捕获链路覆盖）${suffix}`]
	}

	const sources = stats.bySource.map(({ source, count }) => `${ERROR_SOURCE_LABEL[source] ?? source} ${count}`).join(" / ")
	const lines = [`运行时错误: ${stats.total} 条（${sources}）${suffix}`]
	for (const { source, kind, count } of stats.byKind) {
		const sourceLabel = ERROR_SOURCE_LABEL[source] ?? source
		const kindLabel = ERROR_KIND_LABEL[kind] ?? kind
		lines.push(`  ${sourceLabel} · ${kindLabel}(${kind}): ${count}`)
	}
	return lines
}

/**
 * 生成诊断包正文（不含审计行）：版本、环境、脱敏设置、运行时错误小计。
 * 刻意不写任何绝对路径以外的环境细节（用户名可能出现在路径里，但用户自己发的文件）。
 */
export function buildDiagnosticsHeader(header: DiagnosticsHeader): string {
	const lines: string[] = []
	const generatedAt = header.generatedAt ?? new Date()

	lines.push("era harness 诊断包")
	lines.push(`生成时间: ${generatedAt.toISOString()}`)
	// #184：窗口明写进包里——拿到包的人要能判断「这份包覆盖了哪段时间」，
	// 否则「(暂无记录)」分不清是「窗口内没事件」还是「窗口算错了」。
	if (header.auditWindow) {
		const why = header.auditWindow.source === "last-export" ? "自上次导出" : "默认最近 24 小时，未找到上次导出记录"
		lines.push(`记录窗口: ${header.auditWindow.sinceIso} 起（${why}）`)
	}
	lines.push(`插件版本: ${cleanAuditText(header.extensionVersion) ?? "unknown"}`)
	lines.push(`平台: ${cleanAuditText(header.platform) ?? process.platform}`)
	if (header.vscodeVersion) {
		lines.push(`VS Code: ${cleanAuditText(header.vscodeVersion) ?? "unknown"}`)
	}
	// #63：错误统计紧跟在环境信息后面——这是拿到包的人第一眼要找的东西
	if (header.errorStats) {
		lines.push(...describeErrorStats(header.errorStats))
	}
	// KB 08 #247：连续同因失败紧跟错误小计——渠道持续异常时这是第一眼要看的数字。
	if (header.streamErrorStreak) {
		lines.push(...describeStreamErrorStreaks(header.streamErrorStreak))
	}
	// 08 #240：按模型健康度表紧随错误小计，给下一次池序重排提供本插件实弹数据。
	// 只展示、不判分、不回写路由；不传 modelHealth 时整段不出现。
	if (header.modelHealth?.length) {
		lines.push("")
		lines.push(...describeModelHealth(header.modelHealth))
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
 * D5（2026-10-25）：诊断包导出时的高频事件折叠（update / error 两类）。
 *
 * 实测一轮装机（多次 check/install/cancel）可产生 17 条 update 事件；error 事件
 * （3.92.0 起：grpc 失败 / 全局兜底 / webview 回传）在故障期也可能成串，都会在
 * 500 条窗口里挤占 tool/api/parse 等排障关键事件的额度。策略：每类各自保留最近
 * KEEP 条，更早的折叠成一行机器可读摘要（19 §19.8：机器字段独占、不含正文）。
 * 其余事件全保留；总行数不超过 limit（超出时丢最老的，与 collectRecentLines 同语义）。
 */
const EXPORT_UPDATE_KEEP = 10
const EXPORT_ERROR_KEEP = 50

const foldKeepFor = (event: string): number => (event === "update" ? EXPORT_UPDATE_KEEP : EXPORT_ERROR_KEEP)

export function foldEventsForExport(lines: string[], limit: number): string[] {
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

	const groups = new Map<string, typeof parsed>()
	const rest: typeof parsed = []
	for (const p of parsed) {
		const event = p.obj?.event
		if (event === "update" || event === "error") {
			const group = groups.get(event) ?? []
			group.push(p)
			groups.set(event, group)
		} else {
			rest.push(p)
		}
	}

	const kept = [...rest]
	const summaries: string[] = []
	for (const [event, group] of groups) {
		const keepRows = group.slice(-foldKeepFor(event))
		kept.push(...keepRows)
		const foldedCount = group.length - keepRows.length
		if (foldedCount > 0) {
			summaries.push(
				JSON.stringify({
					event,
					action: "folded",
					folded: foldedCount,
					note: `另有 ${foldedCount} 条更早的 ${event} 事件已折叠`,
				}),
			)
		}
	}

	// 恢复时间序：全部可解析时按 ts 排，否则按原顺序稳定兜底
	kept.sort((a, b) => {
		const ta = typeof a.obj?.ts === "number" ? a.obj.ts : undefined
		const tb = typeof b.obj?.ts === "number" ? b.obj.ts : undefined
		if (ta !== undefined && tb !== undefined && ta !== tb) return ta - tb
		return a.index - b.index
	})

	const result = kept.slice(-limit).map((p) => p.line)
	result.push(...summaries)
	return result
}

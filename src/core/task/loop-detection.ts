/**
 * Repeated tool call loop detection.
 *
 * Detects when the LLM calls the same tool with identical arguments
 * repeatedly, which wastes tokens without making progress.
 *
 * This is complementary to fileReadCache in ReadFileToolHandler, which
 * deduplicates file *content* on cache hits but still allows the tool
 * call to succeed and consume a turn. Loop detection catches the
 * repeated call pattern itself, regardless of which tool is involved.
 *
 * Shared between ToolExecutor (production) and tests so the
 * comparison algorithm cannot drift between the two.
 */

import { getToolUseNames } from "@shared/tools"
import type { TaskState } from "./TaskState"

// Soft threshold: inject a warning, giving the LLM one chance to self-correct.
// Hard threshold: escalate to user or fail task. Set higher to avoid false
// positives on tools that may legitimately repeat (e.g., browser_action screenshots).
export const LOOP_DETECTION_SOFT_THRESHOLD = 3
const LOOP_DETECTION_HARD_THRESHOLD = 5

// Windowed detection: the strict counter above resets on any different call, so a
// model can dodge it with "read A → read A → search → read A". Counting occurrences
// inside a sliding window closes that gap.
export const REPEAT_WINDOW_SIZE = 12
export const REPEAT_WINDOW_SOFT_COUNT = 3
export const REPEAT_WINDOW_HARD_COUNT = 5

// Tools whose repetition is normal conversational plumbing (no workspace side
// effects, arguments legitimately stable) and would otherwise trip the window.
const REPEAT_EXEMPT_TOOLS = new Set([
	"act_mode_respond",
	"plan_mode_respond",
	"attempt_completion",
	"new_task",
	"focus_chain",
	"condense",
	"summarize_task",
])

// Reads of the same file+range beyond this count return a short marker instead of
// the body: the model already has the content verbatim, so re-sending is pure cost.
export const REPEAT_READ_SUPPRESS_THRESHOLD = 3

/**
 * 降级读的固定前缀。判据与文案必须同源：文案改一个字而判据没跟，
 * 「已降级」就再也认不出来，第 5 次照样把任务判死。
 *
 * 首行必须**独占**成机器可读字段（`[SAME CONTENT] read=N`），散文从第二行开始：
 * 路径里可能有 `'`（`O'Brien.ts`），一旦首行要把路径也框进引号，这类路径就会解析
 * 失败 → 退回第 5 次判死，等于把修复悄悄撤销。
 */
export const REPEAT_READ_SUPPRESSED_MARKER = "[SAME CONTENT]"

/**
 * 已降级的读延后到这里才真正升级：**同一文件同一区间**的第 8 次读。
 *
 * 第 3 次起返回的是 `[SAME CONTENT]` 短标记，本回合几乎没有 token 成本，
 * 再按第 5 次判死等于「已经止损了还判死」（yolo 模式下任务直接失败）。
 * 但也不能永不升级：真正的死循环每轮仍要一次完整 API 请求。
 *
 * 判据取 `commitRangeRead` 的区间累计次数（单调、与窗口占空比无关），
 * **不能**用 `windowCount`：`读A/命令/读A/命令` 交替下同一签名最多只占 12 槽窗口的
 * 6 槽，`>= 8` 结构不可达，而且第一次 `hardEscalation` 为真的那一拍响应必然已降级，
 * 于是判死从此永不触发（实测：改之前第 5 次停，改之后永不停止）。
 */
export const REPEAT_SUPPRESSED_HARD_COUNT = REPEAT_WINDOW_HARD_COUNT + 3

// Params that are metadata/tracking, not tool-relevant input.
// These change between calls even when the user-facing arguments are identical
// (e.g., task_progress updates its checklist each turn).
const IGNORED_PARAMS = new Set(["task_progress"])

/**
 * read_file 的缺省区间与显式 `start_line=1` 读的是同一段内容：
 * 签名必须归一，否则模型换个写法就能把「同一调用」拆成两条不同记录。
 */
function normalizeReadParams(params: Partial<Record<string, string>>): Partial<Record<string, string>> {
	const normalized = { ...params }
	const start = Number.parseInt(normalized.start_line ?? "", 10)
	if (!Number.isFinite(start) || start <= 1) {
		delete normalized.start_line
	}
	if (!normalized.end_line || normalized.end_line.trim() === "") {
		delete normalized.end_line
	}
	return normalized
}

/**
 * Compute a canonical signature for a tool call's params.
 * Strips metadata fields and sorts keys via the JSON.stringify replacer
 * so key order doesn't affect comparison.
 *
 * block.params is Partial<Record<ToolParamName, string>> — always flat,
 * string-valued, no nesting — so the replacer array is sufficient.
 *
 * `toolName` 可选：传 `"read_file"` 时把缺省/等价的区间参数归一；不传保持旧行为。
 */
export function toolCallSignature(params: Partial<Record<string, string>> | undefined, toolName?: string): string {
	if (!params) return "{}"
	const effective = toolName === "read_file" ? normalizeReadParams(params) : params
	const keys = Object.keys(effective)
		.filter((k) => !IGNORED_PARAMS.has(k))
		.sort()
	return JSON.stringify(effective, keys)
}

export interface LoopDetectionResult {
	softWarning: boolean
	hardEscalation: boolean
	/** Occurrences of this exact call inside the current window (0 for exempt tools). */
	windowCount: number
}

/**
 * Core loop detection step. Must be called BEFORE updating
 * lastToolName / lastToolParams on TaskState.
 *
 * Two independent signals feed the result:
 * 1. strict-consecutive count (legacy behaviour, unchanged thresholds);
 * 2. sliding-window count over the last REPEAT_WINDOW_SIZE calls, which
 *    survives interleaved different calls.
 */
export function checkRepeatedToolCall(state: TaskState, toolName: string, currentSignature: string): LoopDetectionResult {
	if (toolName === state.lastToolName && currentSignature === state.lastToolParams) {
		state.consecutiveIdenticalToolCount++
	} else {
		state.consecutiveIdenticalToolCount = 1
	}

	const repeatKey = `${toolName}\u0000${currentSignature}`
	let windowCount = 0
	if (!REPEAT_EXEMPT_TOOLS.has(toolName)) {
		state.recentToolSignatures.push({ name: toolName, signature: currentSignature })
		const overflow = state.recentToolSignatures.length - REPEAT_WINDOW_SIZE
		if (overflow > 0) {
			state.recentToolSignatures.splice(0, overflow)
		}
		windowCount = state.recentToolSignatures.filter(
			(entry) => entry.name === toolName && entry.signature === currentSignature,
		).length
	}

	// Soft warning fires once per tool+signature so the model is nudged, not spammed.
	const windowSoft = windowCount >= REPEAT_WINDOW_SOFT_COUNT && !state.warnedRepeatSignatures.has(repeatKey)
	const softWarning = state.consecutiveIdenticalToolCount === LOOP_DETECTION_SOFT_THRESHOLD || windowSoft
	if (softWarning) {
		state.warnedRepeatSignatures.add(repeatKey)
	}

	return {
		softWarning,
		hardEscalation:
			state.consecutiveIdenticalToolCount === LOOP_DETECTION_HARD_THRESHOLD || windowCount >= REPEAT_WINDOW_HARD_COUNT,
		windowCount,
	}
}

/**
 * 路径归一化：统一分隔符、去掉 `./`、转小写。
 * 工具参数里是模型给的相对路径，`fileReadCounts` 的键用的是绝对路径，
 * 两边只能靠「归一化 + 按分隔符边界比较」对齐。
 */
function normalizeRepeatPath(value: string): string {
	return value.trim().replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase()
}

/** 从调用签名里取 `params.path`（取不到或解析失败返回 undefined）。 */
function signaturePath(signature: string): string | undefined {
	try {
		const parsed = JSON.parse(signature) as { path?: unknown }
		return typeof parsed?.path === "string" ? parsed.path : undefined
	} catch {
		return undefined
	}
}

/**
 * 从 `apply_patch` 的 patch 文本里取出受影响的路径。
 * apply_patch 没有 `path` 参数（全部信息在 `input` 里），不解析它就无法失效读历史。
 */
export function extractApplyPatchPaths(input: string | undefined): string[] {
	if (!input) {
		return []
	}
	const paths = new Set<string>()
	for (const rawLine of input.split(/\r?\n/)) {
		const line = rawLine.trim()
		const match = /^\*\*\*\s+(?:Update|Add|Delete) File:\s*(.+)$/.exec(line) ?? /^\*\*\*\s+Move to:\s*(.+)$/.exec(line)
		if (match?.[1]) {
			paths.add(match[1].trim())
		}
	}
	return Array.from(paths)
}

/**
 * 同区间读取计数：首读（或缓存因 mtime 失效后的重读）从 1 开始，缓存命中则 +1。
 *
 * 抽成函数是为了让「第 3 次降级」这个阀值边界可以被单测逐次推演，
 * 而不依赖携带真实文件系统的 handler。
 */
export function nextRepeatReadCount(previousCount: number | undefined, isFreshRead: boolean): number {
	if (isFreshRead) {
		return 1
	}
	return (previousCount ?? 0) + 1
}

/**
 * 区间计数键：缺省 start 归一为 1，缺省 end 用空串（不引入 MAX_SAFE_INTEGER：
 * 键要可读，且 `invalidateRepeatWindowForPath` 依赖 `split("|")[0]` 取路径）。
 *
 * 用函数而不是各处拼字符串，是为了让「缺省区间与 start_line=1 必须同键」能被单测锁住。
 */
export function readRangeKey(cacheKey: string, startLine?: number, endLine?: number): string {
	// 模型给的 `start_line="abc"` 会 parseInt 成 NaN：不挡住就会写出 `p|NaN|` 这种键，
	// 既和缺省读对不上，也会让审计里出现一条永远只有 1 次的「区间」。
	const start = Number.isFinite(startLine) ? Math.max(1, startLine as number) : 1
	const end = Number.isFinite(endLine) ? (endLine as number) : undefined
	return `${cacheKey}|${start}|${end ?? ""}`
}

/**
 * 审计里的 `dedupeKey`：**必须**和区间计数键同源，否则「缺省 start」与 `start_line=1`
 * 会被当成两组，对不上。
 *
 * 路径形态保持各自口径：审计用模型可见路径（`displayPath` / `params.path`），
 * 内存计数用绝对路径（`cacheKey`）。单根工作区下两者相同，多根带 hint 时才不同——
 * 别误以为两套键应该逐字相等。
 *
 * （修订 2026-10-25：同一次 read_file 曾由 ToolExecutor 与 handler 各写一条审计、靠
 * dedupeKey 对齐；D3 起改为 handler 经 taskState 传元数据、ToolExecutor 单点合并，
 * 一次调用只落一条，dedupeKey 的「对齐两条」职责随之消失，同源约束保留。）
 */
export function readDedupeKey(displayPath: string, startLine?: number, endLine?: number): string {
	return `read|${readRangeKey(displayPath, startLine, endLine)}`
}

/**
 * 记一次区间读取并返回本次次数：fresh 读先清掉该文件的其它区间计数再播种 1，
 * 缓存命中则 +1。handler 两个分支都走这一个函数，避免只改一半造成 off-by-one。
 */
export function commitRangeRead(counts: Map<string, number>, cacheKey: string, rangeKey: string, isFreshRead: boolean): number {
	if (isFreshRead) {
		for (const key of Array.from(counts.keys())) {
			if (key.startsWith(`${cacheKey}|`)) {
				counts.delete(key)
			}
		}
	}
	const nextCount = nextRepeatReadCount(isFreshRead ? undefined : counts.get(rangeKey), isFreshRead)
	counts.set(rangeKey, nextCount)
	return nextCount
}

/**
 * Forget repetition history that targeted a file the agent just modified.
 * Without this, an "edit → re-read" sequence looks like a read loop and the
 * third read would be suppressed even though the content really did change.
 */
export function invalidateRepeatWindowForPath(state: TaskState, filePath: string | undefined): void {
	if (!filePath) return
	const needle = normalizeRepeatPath(filePath)
	if (!needle) return

	// 精确比较签名里的 path：旧实现用「子串包含」，编辑 foo.ts 会误清 myfoo.ts 的历史，
	// 而 a\b.ts 与 a/b.ts 这种同文异形的路径又清不掉。
	state.recentToolSignatures = state.recentToolSignatures.filter((entry) => {
		const entryPath = signaturePath(entry.signature)
		return !entryPath || normalizeRepeatPath(entryPath) !== needle
	})

	// fileReadCounts 的键是「绝对路径|start|end」：按分隔符边界比较，
	// 既兼容相对路径，也避免 `a/x.erb` 命中 `b/x.erb`。
	for (const key of Array.from(state.fileReadCounts.keys())) {
		const keyPath = normalizeRepeatPath(key.split("|")[0] ?? "")
		if (keyPath === needle || keyPath.endsWith(`/${needle}`)) {
			state.fileReadCounts.delete(key)
		}
	}

	// 只丢掉与该文件相关的警告记录（旧实现全局清空，会让其它工具白白多警告一次）。
	for (const key of Array.from(state.warnedRepeatSignatures)) {
		const entryPath = signaturePath(key.split("\u0000").slice(1).join("\u0000"))
		if (entryPath && normalizeRepeatPath(entryPath) === needle) {
			state.warnedRepeatSignatures.delete(key)
		}
	}
}

/** Whether a same-range read has happened often enough to stop re-sending the body. */
export function shouldSuppressRepeatRead(readCount: number): boolean {
	return Number.isFinite(readCount) && readCount >= REPEAT_READ_SUPPRESS_THRESHOLD
}

/**
 * Short marker returned instead of the file body once a repeat read is suppressed.
 *
 * 首行是**给机器看**的（`shouldEscalateLoop` 靠它取「这是该区间第几次读」），
 * 第二、三行是给模型看的提示。两者必须分行：混在一行就得靠正则去抠路径，
 * 而路径里可能有引号。
 */
export function repeatReadSuppressedMessage(displayPath: string, readCount: number): string {
	return [
		`${REPEAT_READ_SUPPRESSED_MARKER} read=${readCount}`,
		`'${displayPath}' 该区间已读取 ${readCount} 次，内容与首次完全一致（mtime 未变）。`,
		"不要重复读取同一区间：需要其它部分请用 start_line/end_line，或直接基于已读内容继续。",
	].join("\n")
}

/** 把响应（字符串或内容块数组）压成纯文本，只用于判前缀。 */
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

/** 首行的机器可读头：`[SAME CONTENT] read=N`，整行匹配，不留可被散文污染的空间。 */
const SUPPRESSED_READ_HEADER_RE = /^\[SAME CONTENT\][ \t]+read=(\d+)$/

export interface SuppressedRepeatRead {
	/** 本次 read_file 的结果是否已被降级成短标记（正文没再发出去）。 */
	suppressed: boolean
	/** 该区间的第几次读（取自首行 `read=N`；取不到则为 undefined）。 */
	readCount?: number
}

/** 解析降级标记：只有首行**完整**匹配 `[SAME CONTENT] read=N` 才算已降级。 */
export function parseSuppressedRepeatReadResult(response: unknown): SuppressedRepeatRead {
	// trim 顺带吃掉 CRLF 的 `\r`
	const firstLine = (responseText(response).split("\n", 1)[0] ?? "").trim()
	const match = SUPPRESSED_READ_HEADER_RE.exec(firstLine)
	if (!match) {
		return { suppressed: false }
	}
	const readCount = Number.parseInt(match[1], 10)
	return { suppressed: true, readCount: Number.isFinite(readCount) ? readCount : undefined }
}

/** 本次 read_file 的结果是否已被降级成短标记（正文没再发出去）。 */
export function isSuppressedRepeatReadResult(response: unknown): boolean {
	return parseSuppressedRepeatReadResult(response).suppressed
}

/**
 * 是否真的要把这次重复调用升级成「任务级判死」。
 *
 * 已降级的读不参与第 5 次判死（本回合几乎没有 token 成本），
 * 但同一区间读到第 8 次仍然升级——放行不等于纵容。
 *
 * `toolName` 必填而不是可选：可选等于给未来的调用点留一个「忘传就静默失去防护」的口子。
 * 降级标记只由 `read_file` 的 handler 产出，别的工具（或模型回显）恰好以该标记开头
 * 不能因此拿到延后判死的豁免。
 */
export function shouldEscalateLoop(input: { hardEscalation: boolean; toolName: string; response: unknown }): boolean {
	if (!input.hardEscalation) {
		return false
	}
	if (input.toolName !== "read_file") {
		return true
	}
	const parsed = parseSuppressedRepeatReadResult(input.response)
	if (!parsed.suppressed || parsed.readCount === undefined) {
		// 认不出「第几次」就按老规则判死：宁可早停，也不留一个悄悄放宽的默认分支。
		return true
	}
	return parsed.readCount >= REPEAT_SUPPRESSED_HARD_COUNT
}

/**
 * 未知方言循环签名（2026-10-25，08 #46）。
 *
 * 背景：解析器修复覆盖已知方言形态后，未来仍可能冒出未知变体——整块工具标记落正文、
 * 零工具执行，模型对标准 noToolsUsed 反馈的响应是**原样重发**，无限循环烧钱（第三方
 * 用户实测：同一 search_files 调用块重复 6 次，任务卡死）。这条防线不给模型注入提示，
 * 只把「连续同文的结构化方言正文」计入既有 mistake 熔断，让 mistake_limit 弹窗打断。
 *
 * 判据是结构化的（19 §19.1）：正文含 `invoke name="已知工具名"` 或 DSML 分隔符才成签；
 * 纯正文哈希重复不触发——正常散文/思考重复重试是既有 mistake 路径的事，与此无关。
 */
export function dialectLoopSignature(text: string): string | undefined {
	if (!text) {
		return undefined
	}
	const knownTools = getToolUseNames()
	let hasKnownInvoke = false
	for (const m of text.matchAll(/invoke\s+name\s*=\s*"([a-zA-Z_][a-zA-Z0-9_]*)"/g)) {
		if (knownTools.includes(m[1] as never)) {
			hasKnownInvoke = true
			break
		}
	}
	const hasDsmlDelimiter = /[｜|]{1,3}\s*DSML\s*[｜|]{1,3}/.test(text)
	if (!hasKnownInvoke && !hasDsmlDelimiter) {
		return undefined
	}
	// 折叠空白后取滚动哈希 + 长度：同文重发哈希必同，空白抖动不误判为「已变化」。
	const compact = text.replace(/\s+/g, "")
	let hash = 0
	for (let i = 0; i < compact.length; i++) {
		hash = (hash * 31 + compact.charCodeAt(i)) | 0
	}
	return `${hash}:${compact.length}`
}

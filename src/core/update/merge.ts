/**
 * eratw 一键更新 —— 三方合并（base / local / theirs）。
 *
 * 设计判据＝下面三条硬结论（开发期编号设计稿已退役，本文件是现行正本），
 * 配套的合并闸门见内嵌知识条目 `update-merge-gates`（G1–G8）。三条硬结论：
 *
 * 1. **不让模型重写整份文件**。口上文件动辄 3000 行，逐字复现必然截断，
 *    一旦截断写回就是删掉玩家半个口上。改为「窗口化」：先用 diff 找出
 *    本地改动区间与上游改动区间，不相交就机械合并（**不调模型**），
 *    只有相交的区间才作为冲突窗口喂给模型，每次只有几十行。
 * 2. **校验必须相对**。实测上游原版就有 26 个 IF/ENDIF、12 个 SELECTCASE
 *    不配平（`;[SKIPSTART]` 注释块里的残留，Emuera 会跳过所以能跑）。
 *    拿绝对配平当闸门会误杀正常文件，因此只要求「合并结果的失衡量落在
 *    三方输入的失衡量集合内」。
 * 3. **BOM 与行尾必须原样保留**。实测 4282 个 ERB 里 3877 个带 UTF-8 BOM，
 *    丢掉 BOM 会让 Emuera 读首行标签失败。
 *
 * 本模块**纯 Node**（不 import vscode、不联网），模型调用通过 `ask` 注入，
 * 因此整条合并逻辑都能在单元测试里跑。
 */

import { diffArrays } from "diff"
import type { RelPath } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// 一、编码：BOM 与行尾
// ─────────────────────────────────────────────────────────────────────────────

/** 一个文本文件的可还原编码特征。合并只改内容，不改这两项。 */
export interface TextEncoding {
	/** 是否带 UTF-8 BOM（实测 3877/4282 个 ERB 带） */
	bom: boolean
	/** 主流行尾 */
	eol: "\n" | "\r\n"
}

export function sniffEncoding(buf: Buffer): TextEncoding {
	const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
	let crlf = 0
	let lf = 0
	for (let i = 0; i < buf.length; i++) {
		if (buf[i] !== 0x0a) {
			continue
		}
		if (i > 0 && buf[i - 1] === 0x0d) {
			crlf++
		} else {
			lf++
		}
	}
	return { bom, eol: crlf > lf ? "\r\n" : "\n" }
}

/**
 * 严格 UTF-8 解码。解不出来返回 `null` —— 调用方必须降级为「人工二选一」，
 * 不许做猜测性转码（实测非 UTF-8 的只有 62 个 `.txt`/`.bat` 旧文档，0 个 ERB/CSV）。
 */
export function decodeText(buf: Buffer): { text: string; encoding: TextEncoding } | null {
	const encoding = sniffEncoding(buf)
	const body = encoding.bom ? buf.subarray(3) : buf
	let text: string
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(body)
	} catch {
		return null
	}
	// 统一成 \n 交给后续逻辑与模型；编码时再按 encoding.eol 还原。
	// 孤立的 \r（老 Mac 行尾）原样留着，不猜。
	return { text: text.replace(/\r\n/g, "\n"), encoding }
}

export function encodeText(text: string, encoding: TextEncoding): Buffer {
	const lf = text.replace(/\r\n/g, "\n")
	const body = encoding.eol === "\r\n" ? lf.replace(/\n/g, "\r\n") : lf
	const buf = Buffer.from(body, "utf8")
	return encoding.bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buf]) : buf
}

// ─────────────────────────────────────────────────────────────────────────────
// 二、ERB 结构分析（校验用）
// ─────────────────────────────────────────────────────────────────────────────

export type BlockKind = "IF" | "FOR" | "WHILE" | "SELECTCASE" | "DO" | "REPEAT" | "CATCH"

const BLOCK_PAIRS: ReadonlyArray<readonly [BlockKind, string]> = [
	["IF", "ENDIF"],
	["FOR", "NEXT"],
	["WHILE", "WEND"],
	["SELECTCASE", "ENDSELECT"],
	["DO", "LOOP"],
	["REPEAT", "REND"],
	["CATCH", "ENDCATCH"],
]

/** `;[SKIPSTART]` 与 `[SKIPSTART]` 都算（上游 `COUNTER_PUNISHMENT.ERB` 用的是注释掉的形式） */
const SKIP_START = /^[ \t]*;?[ \t]*\[SKIPSTART\]/i
const SKIP_END = /^[ \t]*;?[ \t]*\[SKIPEND\]/i
const DATA_START = /^[ \t]*(PRINTDATAL|PRINTDATA|DATAFORM|STRDATAL|STRDATA)(?![A-Za-z_])/i
const DATA_END = /^[ \t]*(ENDDATAFORM|ENDSTRDATA|ENDDATA)(?![A-Za-z_])/i

const KEYWORD_RE = new Map<string, RegExp>()

/**
 * 行首关键字判定。
 *
 * **必须带「后面不能接标识符字符」的后瞻**：Emuera 的标识符允许日文字符，
 * 实测 `NEXTインデクス値 = ...` 这种变量名会被 `^NEXT\b` 误判成 NEXT 语句
 * （初版就是这么错的：FOR/NEXT 报 1 开 4 闭，实际完全配平）。
 * 用 `\p{L}\p{N}` 覆盖日文/汉字，`\w` 覆盖 ASCII。
 */
function lineStartsWith(line: string, keyword: string): boolean {
	let re = KEYWORD_RE.get(keyword)
	if (!re) {
		re = new RegExp(`^[ \\t]*${keyword}(?![\\w\\p{L}\\p{N}])`, "u")
		KEYWORD_RE.set(keyword, re)
	}
	return re.test(line)
}

/**
 * 去掉「不参与解析」的行，只留真正会被 Emuera 编译的代码行。
 *
 * - `[SKIPSTART] … [SKIPEND]`：整段跳过（含被 `;` 注释掉的形式）。
 * - `PRINTDATA/DATAFORM/STRDATA … END*`：块内是**数据**不是代码，
 *   里面的 `IF` 只是要打印的文字。
 * - `;` 开头的注释行天然不会命中行首关键字，无需额外处理（也因此不会
 *   误伤 `PRINTFORML "a;b"` 这种字符串里的分号）。
 */
export function stripNonCode(text: string): string[] {
	const out: string[] = []
	let skipping = false
	let inData = false
	for (const line of text.split("\n")) {
		if (skipping) {
			if (SKIP_END.test(line)) {
				skipping = false
			}
			continue
		}
		if (SKIP_START.test(line)) {
			skipping = true
			continue
		}
		if (inData) {
			if (DATA_END.test(line)) {
				inData = false
			}
			continue
		}
		if (DATA_START.test(line)) {
			inData = true
			continue
		}
		out.push(line)
	}
	return out
}

const LABEL_RE = /^[ \t]*@([^\s(（:"]+)/
const LOCAL_LABEL_RE = /^[ \t]*\$([^\s(（:"]+)/
/** CALL/JUMP/GOTO/CALLTRAIN 的目标名（第一个参数） */
const CALL_RE = /^[ \t]*(?:TRY)?(?:CALLTRAIN|CALLFORM|CALL|JUMPFORM|JUMP|GOTO)[ \t]+([^\s,()（）]+)/i

export interface ErbStructure {
	/** `@函数名`，去重保序 */
	labels: string[]
	/** `$局部标签`，去重保序 */
	localLabels: string[]
	/** CALL/JUMP/GOTO/CALLTRAIN 的目标名，去重保序 */
	callTargets: string[]
	/** 每类控制流块的「开 − 闭」。允许非 0（上游原版就有非 0 的文件）。 */
	blockDelta: Record<BlockKind, number>
	/** `(` 减 `)` 的数量差，同样只用于相对比较 */
	parenDelta: number
	lineCount: number
}

export function analyzeErb(text: string): ErbStructure {
	const code = stripNonCode(text)
	const labels: string[] = []
	const localLabels: string[] = []
	const callTargets: string[] = []
	const seenLabel = new Set<string>()
	const seenLocal = new Set<string>()
	const seenCall = new Set<string>()
	const blockDelta = {} as Record<BlockKind, number>
	for (const [kind] of BLOCK_PAIRS) {
		blockDelta[kind] = 0
	}
	let parenDelta = 0

	for (const line of code) {
		for (const [kind, close] of BLOCK_PAIRS) {
			if (lineStartsWith(line, kind)) {
				blockDelta[kind]++
			} else if (lineStartsWith(line, close)) {
				blockDelta[kind]--
			}
		}
		const label = LABEL_RE.exec(line)
		if (label && !seenLabel.has(label[1])) {
			seenLabel.add(label[1])
			labels.push(label[1])
		}
		const local = LOCAL_LABEL_RE.exec(line)
		if (local && !seenLocal.has(local[1])) {
			seenLocal.add(local[1])
			localLabels.push(local[1])
		}
		const call = CALL_RE.exec(line)
		if (call) {
			const target = call[1]
			// 变量 / 字符串形式的目标（CALLFORM %FN%, ... / CALLFORM "..."）不做静态判断
			const dynamic = target.startsWith("%") || target.startsWith("@") || target.startsWith('"') || target.includes(":")
			if (!dynamic && !seenCall.has(target)) {
				seenCall.add(target)
				callTargets.push(target)
			}
		}
		for (let i = 0; i < line.length; i++) {
			const ch = line.charCodeAt(i)
			if (ch === 0x28) {
				parenDelta++
			} else if (ch === 0x29) {
				parenDelta--
			}
		}
	}

	return { labels, localLabels, callTargets, blockDelta, parenDelta, lineCount: text.split("\n").length }
}

// ─────────────────────────────────────────────────────────────────────────────
// 三、模型输出的抽取
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 模型很爱把结果包进 ```erb … ```，或前后加一句"以下是合并结果"。
 * 这里只负责剥围栏；别的一概不动（正文一个字符都不能改）。
 */
export function extractMergeOutput(raw: string): { text: string; hadFence: boolean } {
	const lines = raw.replace(/\r\n/g, "\n").split("\n")
	let start = 0
	let end = lines.length
	while (start < end && lines[start].trim() === "") {
		start++
	}
	while (end > start && lines[end - 1].trim() === "") {
		end--
	}
	let hadFence = false
	if (start < end && /^```/.test(lines[start].trim())) {
		hadFence = true
		start++
		if (end > start && /^```$/.test(lines[end - 1].trim())) {
			end--
		}
	}
	return { text: lines.slice(start, end).join("\n"), hadFence }
}

// ─────────────────────────────────────────────────────────────────────────────
// 四、校验
// ─────────────────────────────────────────────────────────────────────────────

export type MergeIssueCode =
	| "empty"
	| "mojibake"
	| "missing-label"
	| "extra-call"
	| "block-imbalance"
	| "paren-imbalance"
	| "truncated"
	| "window-too-large"
	| "model-failed"

export interface MergeIssue {
	code: MergeIssueCode
	/** 给人看的一句话（中文，不含术语；UI 可直接展示） */
	detail: string
}

/** `file`：整份文件，查全部；`window`：冲突片段，跳过块/括号平衡（片段天然只含半个块） */
export type MergeScope = "file" | "window"

export interface MergeValidation {
	ok: boolean
	issues: MergeIssue[]
}

export interface ValidateMergeInput {
	path: RelPath
	base: string | null
	local: string
	theirs: string
	merged: string
	scope?: MergeScope
}

const MAX_LISTED = 5

function listSome(items: string[]): string {
	const head = items.slice(0, MAX_LISTED).join("、")
	return items.length > MAX_LISTED ? `${head} 等 ${items.length} 项` : head
}

/**
 * 合并结果的静态校验。
 *
 * 关键设计：**只做相对比较**。绝对配平不可用 —— 上游原版就有不配平的文件
 * （见文件头注释），绝对判定会误杀。
 */
export function validateMerge(input: ValidateMergeInput): MergeValidation {
	const { base, local, theirs, merged, scope = "file" } = input
	const issues: MergeIssue[] = []

	if (merged.trim() === "") {
		issues.push({ code: "empty", detail: "合并结果为空" })
		return { ok: false, issues }
	}

	if (merged.includes("\uFFFD") && !local.includes("\uFFFD") && !theirs.includes("\uFFFD")) {
		issues.push({ code: "mojibake", detail: "合并结果里出现了乱码字符（�），原文没有" })
	}

	const out = analyzeErb(merged)
	const a = analyzeErb(local)
	const t = analyzeErb(theirs)
	const b = base === null ? null : analyzeErb(base)

	// 必须出现的函数：上游有的全部 + 本地新增的（base 里没有的）
	const baseLabels = new Set(b?.labels ?? [])
	const mustKeep = [...new Set([...t.labels, ...a.labels.filter((l) => !baseLabels.has(l))])]
	const outLabels = new Set(out.labels)
	const missing = mustKeep.filter((l) => !outLabels.has(l))
	if (missing.length > 0) {
		issues.push({ code: "missing-label", detail: `合并结果缺少这些函数：${listSome(missing)}` })
	}

	// 不许凭空造出调用目标（多半是模型把函数名打错）
	const knownCalls = new Set([...a.callTargets, ...t.callTargets, ...(b?.callTargets ?? [])])
	const invented = out.callTargets.filter((c) => !knownCalls.has(c))
	if (invented.length > 0) {
		issues.push({ code: "extra-call", detail: `合并结果里出现了原文没有的调用：${listSome(invented)}` })
	}

	if (scope === "file") {
		for (const [kind, close] of BLOCK_PAIRS) {
			const allowed = new Set<number>([a.blockDelta[kind], t.blockDelta[kind]])
			if (b) {
				allowed.add(b.blockDelta[kind])
			}
			if (!allowed.has(out.blockDelta[kind])) {
				issues.push({
					code: "block-imbalance",
					detail: `${kind}/${close} 没配对上：你的版本 ${a.blockDelta[kind]}、社区版 ${t.blockDelta[kind]}、合并结果 ${out.blockDelta[kind]}`,
				})
			}
		}

		const allowedParen = new Set<number>([a.parenDelta, t.parenDelta])
		if (b) {
			allowedParen.add(b.parenDelta)
		}
		if (!allowedParen.has(out.parenDelta)) {
			issues.push({
				code: "paren-imbalance",
				detail: `括号没配对上：你的版本 ${a.parenDelta}、社区版 ${t.parenDelta}、合并结果 ${out.parenDelta}`,
			})
		}

		const floor = Math.floor(Math.min(a.lineCount, t.lineCount) * 0.5)
		if (out.lineCount < floor) {
			issues.push({
				code: "truncated",
				detail: `合并结果只有 ${out.lineCount} 行，你的版本 ${a.lineCount} 行、社区版 ${t.lineCount} 行，像是被截断了`,
			})
		}
	}

	return { ok: issues.length === 0, issues }
}

// ─────────────────────────────────────────────────────────────────────────────
// 五、窗口化：找冲突区间
// ─────────────────────────────────────────────────────────────────────────────

/** 一处改动在 base 坐标系里的位置，以及它在自己那一侧文本里的切片范围 */
interface Hunk {
	/** base 行区间 [start, end)，纯插入时 start === end */
	start: number
	end: number
	/** 本侧文本里对应的切片起点（含插入行） */
	sliceStart: number
	/** 本侧文本里对应的切片终点（含插入行） */
	sliceEnd: number
}

interface SideAnalysis {
	lines: string[]
	hunks: Hunk[]
}

function analyzeSide(base: string[], other: string[]): SideAnalysis {
	const parts = diffArrays(base, other) as Array<{ value: string[]; added?: boolean; removed?: boolean }>
	const hunks: Hunk[] = []
	let bi = 0
	let oi = 0
	let cur: Hunk | null = null

	for (const part of parts) {
		const len = part.value.length
		if (part.added) {
			if (!cur) {
				cur = { start: bi, end: bi, sliceStart: oi, sliceEnd: oi }
			}
			oi += len
			cur.sliceEnd = oi
			continue
		}
		if (part.removed) {
			if (!cur) {
				cur = { start: bi, end: bi, sliceStart: oi, sliceEnd: oi }
			}
			bi += len
			cur.end = bi
			continue
		}
		if (cur) {
			hunks.push(cur)
			cur = null
		}
		bi += len
		oi += len
	}
	if (cur) {
		hunks.push(cur)
	}
	return { lines: other, hunks }
}

export interface MergeWindow {
	/** base 行区间 [baseStart, baseEnd) */
	baseStart: number
	baseEnd: number
	/** 只有本地改了 / 只有上游改了 / 两边都改了（需模型） */
	kind: "local" | "theirs" | "conflict"
	/** BASE 侧这一段原文 */
	base: string[]
	/** LOCAL 侧这一段 */
	local: string[]
	/** THEIRS 侧这一段 */
	theirs: string[]
}

/**
 * 零长度区间（纯插入）与对方区间**边界重合**也算相交 —— 保守，宁可多问一次。
 * 不这样处理会出现「插入行被两个窗口同时认领」导致重复输出。
 */
function touches(winStart: number, winEnd: number, h: Hunk): boolean {
	const winZero = winStart === winEnd
	const hunkZero = h.start === h.end
	if (winZero && hunkZero) {
		return winStart === h.start
	}
	if (winZero) {
		return h.start <= winStart && winStart <= h.end
	}
	if (hunkZero) {
		return winStart <= h.start && h.start <= winEnd
	}
	return winStart < h.end && h.start < winEnd
}

/**
 * 把两侧改动按 base 坐标对齐，产出窗口序列。
 *
 * 组装规则：窗口内只有一侧改动 → 直接用那一侧；两侧都改 → `conflict`，
 * 需要模型给结果。
 */
export function planMergeWindows(base: string[], local: string[], theirs: string[]): MergeWindow[] {
	const left = analyzeSide(base, local)
	const right = analyzeSide(base, theirs)
	const all: Array<{ hunk: Hunk; side: "local" | "theirs" }> = [
		...left.hunks.map((hunk) => ({ hunk, side: "local" as const })),
		...right.hunks.map((hunk) => ({ hunk, side: "theirs" as const })),
	]
	all.sort((x, y) => x.hunk.start - y.hunk.start || x.hunk.end - y.hunk.end)

	const windows: MergeWindow[] = []
	let winStart = 0
	let winEnd = 0
	let open = false
	let localHunks: Hunk[] = []
	let theirsHunks: Hunk[] = []

	const pushHunk = (side: "local" | "theirs", hunk: Hunk) => {
		if (side === "local") {
			localHunks.push(hunk)
		} else {
			theirsHunks.push(hunk)
		}
	}

	const flush = () => {
		if (!open) {
			return
		}
		const baseText = base.slice(winStart, winEnd)
		// 一侧在窗口内没有改动时，它这一段就是 base 原文
		const localText =
			localHunks.length === 0
				? baseText
				: left.lines.slice(
						localHunks[0].sliceStart - (localHunks[0].start - winStart),
						localHunks[localHunks.length - 1].sliceEnd + (winEnd - localHunks[localHunks.length - 1].end),
					)
		const theirsText =
			theirsHunks.length === 0
				? baseText
				: right.lines.slice(
						theirsHunks[0].sliceStart - (theirsHunks[0].start - winStart),
						theirsHunks[theirsHunks.length - 1].sliceEnd + (winEnd - theirsHunks[theirsHunks.length - 1].end),
					)
		const kind = localHunks.length > 0 && theirsHunks.length > 0 ? "conflict" : localHunks.length > 0 ? "local" : "theirs"
		windows.push({
			baseStart: winStart,
			baseEnd: winEnd,
			kind,
			base: baseText,
			local: localText,
			theirs: theirsText,
		})
		localHunks = []
		theirsHunks = []
	}

	for (const item of all) {
		if (!open) {
			open = true
			winStart = item.hunk.start
			winEnd = item.hunk.end
			pushHunk(item.side, item.hunk)
			continue
		}
		if (touches(winStart, winEnd, item.hunk)) {
			winEnd = Math.max(winEnd, item.hunk.end)
			pushHunk(item.side, item.hunk)
			continue
		}
		flush()
		open = true
		winStart = item.hunk.start
		winEnd = item.hunk.end
		pushHunk(item.side, item.hunk)
	}
	flush()
	return windows
}

// ─────────────────────────────────────────────────────────────────────────────
// 六、提示词
// ─────────────────────────────────────────────────────────────────────────────

/** 冲突窗口超过这么多行就不交给模型（宁可让用户二选一，也不冒截断的风险） */
export const MAX_WINDOW_LINES = 1200

export const MERGE_SYSTEM_PROMPT = [
	"你是 Emuera（ERB 脚本）的三方合并器。你的唯一职责是把 BASE / LOCAL / THEIRS 三段代码合并成一段，供程序直接写回文件。",
	"",
	"三方含义：",
	"- BASE：上一次更新时保存的社区版。",
	"- LOCAL：玩家（或其安装的口上包）当前磁盘上的版本，含玩家的全部改动。",
	"- THEIRS：社区新版本。",
	"",
	"合并原则，按优先级：",
	"1. 冲突时以 THEIRS 的行为为准：社区修 bug、改数值、加分支必须生效。",
	"2. LOCAL 里的文本内容、口上风格、个性化台词必须尽量保留 —— 这是玩家最在意的东西。",
	"3. 双方改动不重叠时，两边的改动都要保留。",
	"4. 拿不准时，选择「保留更多 LOCAL 文本 + 采用 THEIRS 的结构」。",
	"",
	"硬性约束（会被程序静态校验，违反则整份作废重做）：",
	"- 不得删除、不得重命名任何 @函数名。",
	"- 不得引入 BASE / LOCAL / THEIRS 中都不存在的 CALL / CALLFORM / JUMP / GOTO / CALLTRAIN 目标名。",
	"- 控制流块必须成对：IF…ENDIF、FOR…NEXT、WHILE…WEND、SELECTCASE…ENDSELECT、DO…LOOP、REPEAT…REND、CATCH…ENDCATCH。",
	"- ERB 没有 #END。#FUNCTION / #FUNCTIONS 只是返回类型声明，函数体由 @标签 起头、到下一个 @标签 或文件末尾结束。",
	"- 缩进保持原样（Tab 就是 Tab，不要换成空格）。日文原文一字不改，不要把日文「翻译」成中文。",
	"- 不要顺手优化：不重排、不合并重复代码、不改数值、不加注释、不修社区版自己的 bug。",
	"- 不要输出 Markdown 代码围栏、不要输出解释、不要输出「以下是合并结果」之类的话。只输出代码本身。",
].join("\n")

export interface MergePromptInput {
	path: RelPath
	base: string[] | null
	local: string[]
	theirs: string[]
	/** 上一次失败的原因，用于让模型自我修正 */
	feedback?: MergeIssue[]
}

export interface MergePrompt {
	system: string
	user: string
}

const FENCE_BASE = "<<<BASE>>>"
const FENCE_LOCAL = "<<<LOCAL>>>"
const FENCE_THEIRS = "<<<THEIRS>>>"

export function buildMergePrompt(input: MergePromptInput): MergePrompt {
	const { path, base, local, theirs, feedback } = input
	const parts: string[] = [
		`文件：${path}`,
		"",
		"下面这一段是三方合并中的一个冲突片段（不是整个文件）。请只输出这一段合并后的代码。",
		"",
		FENCE_BASE,
		base === null ? "（社区版以前没有这个文件）" : base.join("\n"),
		FENCE_LOCAL,
		local.join("\n"),
		FENCE_THEIRS,
		theirs.join("\n"),
	]
	if (feedback && feedback.length > 0) {
		parts.push("", "上一次的输出没有通过程序校验，请修正后重新输出：", ...feedback.map((issue) => `- ${issue.detail}`))
	}
	return { system: MERGE_SYSTEM_PROMPT, user: parts.join("\n") }
}

// ─────────────────────────────────────────────────────────────────────────────
// 七、编排
// ─────────────────────────────────────────────────────────────────────────────

export interface MergeAskInput {
	path: RelPath
	attempt: number
	system: string
	user: string
}

/** 由上层注入的模型调用。抛错视为该次尝试失败。 */
export type MergeAsk = (input: MergeAskInput) => Promise<string>

/**
 * 三种一眼就能定论的情况。返回 `null` 表示必须走窗口化。
 *
 * 抽出来共享是因为**两条合并路径都要用它**：`runMerge`（静默调用）和
 * `resolveConflictsViaWorkbench`（对话工作台）。尤其第一种：本地与上游改成
 * 了完全一样的内容时，按窗口算法会算出一个两侧完全相同的「冲突」，
 * 白白多一次模型调用——工作台路径上就是白白多一个要人看的窗口。
 */
export function trivialMerge(base: string | null, local: string, theirs: string): { text: string } | null {
	if (local === theirs) {
		return { text: local }
	}
	if (base !== null && local === base) {
		return { text: theirs }
	}
	if (base !== null && theirs === base) {
		return { text: local }
	}
	return null
}

export interface RunMergeOptions {
	path: RelPath
	/** 上一次更新时的社区版；`null` 表示社区版以前没有这个文件 */
	base: string | null
	local: string
	theirs: string
	ask: MergeAsk
	/** 含首次在内最多尝试几次 */
	maxAttempts?: number
}

export interface RunMergeResult {
	ok: boolean
	/** 合并后的完整文本（`ok === false` 时不要写盘） */
	text: string
	/** 冲突窗口数 */
	conflicts: number
	/** 是否真的调用了模型 */
	usedModel: boolean
	issues: MergeIssue[]
}

/**
 * 把窗口序列拼回整份文本。
 *
 * 导出是因为对话工作台（`resolveConflictsViaWorkbench`）也要用它组装结果 ——
 * 两条路径必须共享同一套拼装规则，否则会出现「静默合并和工作台合并拼出来的
 * 东西不一样」这种最难查的分裂。
 */
export function assemble(base: string[], windows: MergeWindow[], resolved: Map<number, string[]>): string {
	const out: string[] = []
	let cursor = 0
	windows.forEach((win, index) => {
		out.push(...base.slice(cursor, win.baseStart))
		if (win.kind === "local") {
			out.push(...win.local)
		} else if (win.kind === "theirs") {
			out.push(...win.theirs)
		} else {
			out.push(...(resolved.get(index) ?? win.local))
		}
		cursor = win.baseEnd
	})
	out.push(...base.slice(cursor))
	return out.join("\n")
}

/**
 * 跑一次三方合并。
 *
 * - 无冲突 → 机械合并，`ask` 一次都不调。
 * - 有冲突 → 只把冲突窗口喂模型，逐窗口校验 + 重试。
 * - 任一窗口最终失败 → `ok: false`，调用方必须降级为「人工二选一」，
 *   **不许把 `text` 写盘**（Z4 零悬空）。
 */
export async function runMerge(options: RunMergeOptions): Promise<RunMergeResult> {
	const { path, base, local, theirs, ask } = options
	const maxAttempts = Math.max(1, options.maxAttempts ?? 2)

	// 三种一眼就能定论的情况，不必进 diff，更不必问模型。
	const trivial = trivialMerge(base, local, theirs)
	if (trivial) {
		const validation = validateMerge({ path, base, local, theirs, merged: trivial.text, scope: "file" })
		return { ok: validation.ok, text: trivial.text, conflicts: 0, usedModel: false, issues: validation.issues }
	}

	const baseLines = base === null ? [] : base.split("\n")
	const localLines = local.split("\n")
	const theirsLines = theirs.split("\n")
	const windows = planMergeWindows(baseLines, localLines, theirsLines)
	const conflicts = windows.filter((w) => w.kind === "conflict")

	if (conflicts.length === 0) {
		const text = assemble(baseLines, windows, new Map())
		const validation = validateMerge({ path, base, local, theirs, merged: text, scope: "file" })
		return { ok: validation.ok, text, conflicts: 0, usedModel: false, issues: validation.issues }
	}

	const resolved = new Map<number, string[]>()
	const issues: MergeIssue[] = []
	let usedModel = false

	for (let index = 0; index < windows.length; index++) {
		const win = windows[index]
		if (win.kind !== "conflict") {
			continue
		}
		if (Math.max(win.base.length, win.local.length, win.theirs.length) > MAX_WINDOW_LINES) {
			issues.push({
				code: "window-too-large",
				detail: `这段冲突有 ${Math.max(win.base.length, win.local.length, win.theirs.length)} 行，太长，不适合自动合并`,
			})
			continue
		}

		let accepted: string[] | null = null
		let feedback: MergeIssue[] = []
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const prompt = buildMergePrompt({
				path,
				base: win.base,
				local: win.local,
				theirs: win.theirs,
				feedback: feedback.length > 0 ? feedback : undefined,
			})
			let raw: string
			try {
				usedModel = true
				raw = await ask({ path, attempt, system: prompt.system, user: prompt.user })
			} catch (error) {
				feedback = [
					{ code: "model-failed", detail: `调用失败：${error instanceof Error ? error.message : String(error)}` },
				]
				continue
			}
			const extracted = extractMergeOutput(raw)
			const merged = extracted.text
			const validation = validateMerge({
				path,
				base: win.base.join("\n"),
				local: win.local.join("\n"),
				theirs: win.theirs.join("\n"),
				merged,
				scope: "window",
			})
			if (validation.ok) {
				accepted = merged.split("\n")
				break
			}
			feedback = validation.issues
		}

		if (accepted === null) {
			const reason = feedback[0]?.detail
			issues.push({
				code: "model-failed",
				detail: reason
					? `「${path}」有一段两边都改过的地方没能自动合并（${reason}）`
					: `「${path}」有一段两边都改过的地方没能自动合并`,
			})
			// 保守：该窗口保留本地版本，但整体结果已判定失败，调用方不会写盘
			resolved.set(index, win.local)
			continue
		}
		resolved.set(index, accepted)
	}

	const text = assemble(baseLines, windows, resolved)
	if (issues.length > 0) {
		return { ok: false, text, conflicts: conflicts.length, usedModel, issues }
	}
	const validation = validateMerge({ path, base, local, theirs, merged: text, scope: "file" })
	return {
		ok: validation.ok,
		text,
		conflicts: conflicts.length,
		usedModel,
		issues: validation.issues,
	}
}

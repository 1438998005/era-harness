/**
 * eratw 一键更新 —— G5（FSYN 键）与 G8（标识符键预检）。
 *
 * 正本：shared-trae `knowledge/eratw/import-merge-gates.md`（G1–G8）。
 * 产品内嵌副本：核心库 `src/knowledge/data/update-merge-gates.ts`。
 *
 * 设计约束（同 `gates.ts`）：**纯函数、无 IO、保守不误报**。
 * 判据里所有"键"都指**字面串键**——动态拼出来的键（含 `%…%` / `{…}`）运行时才知道，
 * 静态判不了，一律跳过（⛔ 不猜）。
 *
 * 取证（eratw-chs 实测，2026-10-21）：
 * - `FSYN_CN` 的键表在本仓独有文件里，127 个 CASE，**中文与英文原文并列**
 *   （形如 `CASE "融化","melt"`）⇒ 英文键本身合法，问题只在于"抄了一个表里没有的键"。
 * - 集群有简繁/日字形撞名的实证（如 `颜`/`顔`、`覚`/`觉`）：引擎对名字只做 ToUpper、
 *   **不做字形归一** ⇒ 两种字形并存时按键匹配静默失配。
 */

import type { GateFinding, RelPath } from "./types"

/** 单文件里字形撞名最多报几处（超出只报汇总，别刷屏） */
const MAX_GLYPH_HITS = 5
/** 单文件里未知键最多列几条 */
const MAX_UNKNOWN_KEYS = 5

/**
 * 已知会互相撞的简繁/日字形对。
 * 正本＝集群的字形体检口径（简繁日字形混淆对）；本表只收**已在集群实证过**的对，
 * ⛔ 不要凭感觉扩表——扩错就是误报。
 */
const GLYPH_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
	["颜", "顔", "颜/顔"],
	["覚", "觉", "覚/觉"],
	["輪", "轮", "輪/轮"],
	["気", "气", "気/气"],
	["変", "变", "変/变"],
]

export interface FsynCall {
	line: number
	/** 调用的函数名原文（FSYN / FSYN_CN） */
	fn: string
	/** 字面串键；动态键为 null */
	key: string | null
}

/**
 * 提取 FSYN 系列调用的字面串键。
 *
 * ⚠️ 正则必须写成 `FSYN(?:_CN)?` 而不是 `FSYN_CN?`——后者会把纯 `%FSYN(` 全漏掉
 * （集群实测踩过这次事故）。`%?` 前缀是因为 FORM 上下文里写 `%FSYN_CN("…")%`。
 */
const RE_FSYN = /%?(?<![A-Za-z0-9_])FSYN(_CN)?\s*\(\s*"([^"]*)"/g

export function extractFsynCalls(text: string): FsynCall[] {
	const out: FsynCall[] = []
	const lines = text.split(/\r\n|\r|\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (/^[ \t]*;/.test(line)) {
			continue
		}
		RE_FSYN.lastIndex = 0
		let m: RegExpExecArray | null
		while ((m = RE_FSYN.exec(line)) !== null) {
			const key = m[2]
			// 动态键（含 %…% / {…}）静态判不了 → 记 null，调用方跳过
			const dynamic = key.includes("%") || key.includes("{")
			out.push({ line: i + 1, fn: m[1] ? "FSYN_CN" : "FSYN", key: dynamic ? null : key })
		}
	}
	return out
}

export interface LiteralKeyHit {
	line: number
	key: string
}

/**
 * 提取字面串比较键：`CASE "…"`（可多值）与 `== "…"` / `!= "…"`。
 * 数值 CASE（`CASE 0, 1`）不参与——那不是字符串键。
 */
export function extractLiteralKeys(text: string): LiteralKeyHit[] {
	const out: LiteralKeyHit[] = []
	const lines = text.split(/\r\n|\r|\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (/^[ \t]*;/.test(line)) {
			continue
		}
		if (/^[ \t]*CASE[ \t]/.test(line)) {
			for (const m of line.matchAll(/"([^"]*)"/g)) {
				if (m[1]) {
					out.push({ line: i + 1, key: m[1] })
				}
			}
			continue
		}
		for (const m of line.matchAll(/[!=]==?[ \t]*"([^"]*)"/g)) {
			if (m[1]) {
				out.push({ line: i + 1, key: m[1] })
			}
		}
	}
	return out
}

/**
 * G5：FSYN 键必须落在键表里。
 *
 * ⛔ 判据不是"不许用英文键"——键表里中文与英文原文本来就并列（实测 `CASE "融化","melt"`）。
 * 真问题是"抄了一个表里没有的键"，那个键会打印错误串；正解是回英文原文找**已有的**原键，
 * **不是新增 CASE**（新增 CASE 在本地独有文件里不会被上游覆盖，但会与上游语义脱节）。
 *
 * 没有键表时（ledger 为 undefined）本闸门**不报任何东西**——拿不准就不报，
 * 由调用方用 `gatesSkipped`/说明告知用户"未配置键表"。
 */
export function fsynKeyFindings(path: RelPath, text: string, ledger?: ReadonlySet<string>): GateFinding[] {
	if (!ledger) {
		return []
	}
	const unknown: LiteralKeyHit[] = []
	for (const call of extractFsynCalls(text)) {
		if (call.key === null) {
			continue
		}
		// 键表里的键可能有大小写/多值形态；TOLOWER 口径与 FSYN 实现一致
		if (!ledger.has(call.key) && !ledger.has(call.key.toLowerCase())) {
			unknown.push({ line: call.line, key: call.key })
		}
	}
	if (unknown.length === 0) {
		return []
	}
	const shown = unknown.slice(0, MAX_UNKNOWN_KEYS)
	const rest = unknown.length - shown.length
	return [
		{
			gate: "G5",
			code: "fsyn-unknown-key",
			path,
			line: shown[0].line,
			detail:
				`FSYN 键不在键表里：${shown.map((h) => `L${h.line} "${h.key}"`).join("、")}` +
				`${rest > 0 ? ` 等 ${unknown.length} 处` : ""}` +
				`——回英文原文找已有原键，⛔ 不要新增 CASE`,
		},
	]
}

/**
 * G8（无需键表的高信号部分）：同一份文本里出现**互为简繁/日字形**的两种键。
 * 引擎对名字只做大写化、不做字形归一 ⇒ 两种字形并存时按键匹配静默失配（页面照出、行为错）。
 */
export function glyphCollisionFindings(path: RelPath, text: string): GateFinding[] {
	const keys = new Set(extractLiteralKeys(text).map((h) => h.key))
	if (keys.size === 0) {
		return []
	}
	const out: GateFinding[] = []
	for (const [a, b, label] of GLYPH_PAIRS) {
		const aKeys = [...keys].filter((k) => k.includes(a))
		const bKeys = [...keys].filter((k) => k.includes(b))
		if (aKeys.length === 0 || bKeys.length === 0) {
			continue
		}
		out.push({
			gate: "G8",
			code: "key-glyph-collision",
			path,
			detail: `键里同时出现 ${label} 两种字形（${aKeys[0]} ↔ ${bKeys[0]}）` + `——引擎不做字形归一，匹配会静默失配`,
		})
		if (out.length >= MAX_GLYPH_HITS) {
			break
		}
	}
	return out
}

/**
 * G8（需键表部分）：新内容里的字面串键不在既有键集 ⇒ 逐条列本地化待办。
 * 没有键表时不报（同 G5 的保守口径）。
 */
export function unknownKeyFindings(path: RelPath, text: string, ledger?: ReadonlySet<string>): GateFinding[] {
	if (!ledger) {
		return []
	}
	const unknown: LiteralKeyHit[] = []
	const seen = new Set<string>()
	for (const hit of extractLiteralKeys(text)) {
		if (ledger.has(hit.key) || seen.has(hit.key)) {
			continue
		}
		seen.add(hit.key)
		unknown.push(hit)
	}
	if (unknown.length === 0) {
		return []
	}
	const shown = unknown.slice(0, MAX_UNKNOWN_KEYS)
	const rest = unknown.length - shown.length
	return [
		{
			gate: "G8",
			code: "key-unknown",
			path,
			line: shown[0].line,
			detail:
				`新键不在既有键集：${shown.map((h) => `L${h.line} "${h.key}"`).join("、")}` +
				`${rest > 0 ? ` 等 ${unknown.length} 个` : ""}——逐条列本地化待办`,
		},
	]
}

/** 一次改动文件里 G5/G8 的全部 finding */
export function runKeyGates(
	path: RelPath,
	text: string,
	ledgers: { fsyn?: ReadonlySet<string>; literal?: ReadonlySet<string> } = {},
): GateFinding[] {
	return [
		...fsynKeyFindings(path, text, ledgers.fsyn),
		...glyphCollisionFindings(path, text),
		...unknownKeyFindings(path, text, ledgers.literal),
	]
}

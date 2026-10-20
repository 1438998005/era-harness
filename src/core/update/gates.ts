/**
 * eratw 一键更新 —— 导入合并闸门（G2 / G3 / G6 / G7）。
 *
 * 正本：shared-trae `knowledge/eratw/import-merge-gates.md`（G1–G8）。
 * 产品内嵌副本：核心库 `src/knowledge/data/update-merge-gates.ts`。
 *
 * 设计约束：
 * - **纯函数、无 IO**：只吃文本，产出 finding；由 plan.ts / service.ts 接线。
 * - **保守不误报**：拿不准的一律不报。闸门是更新计划里的**警告**，不是硬拦截——
 *   误报会让用户对真问题脱敏（集群实证：单次作者更新曾净引入 32 处 RAND 问题，
 *   但存量 125 处不能算本次回归，所以判据必须精确）。
 * - 本模块覆盖可用机器判据实现的五门（G2/G3/G4/G6/G7；G4 的全树索引在 `labels.ts` +
 *   `manifest.ts#scanLabels`）；G1（git log -S 回归扫描）/ G5（FSYN 键回英文原文）/
 *   G8（标识符键预检）需要仓库史或键账本，留待后续批次。
 *
 * ERB 语法口径（来自集群取证与文档仓）：
 * - `RAND:N` 只有**单独占一行**（语句位）时才是分发骰子；写成参数（`RAND:360`）的是表达式，不参与。
 * - `CASE <n>` 可写 `CASE 0, 1` 多值；`CASEELSE` 兜底其余。
 * - `RAND:N` 与 CASE 之间允许夹 `SELECTCASE RESULT`（同构造的结构行）。
 */

import type { GateFinding, RelPath } from "./types"

/** 一个 RAND 块的对账结果 */
export interface RandBlock {
	/** RAND:N 所在行（1 基） */
	line: number
	rand: number
	/** 去重升序的 CASE 值 */
	cases: number[]
	hasElse: boolean
	/** ≥ rand 的死分支值 */
	unreachable: number[]
	/** 无 CASEELSE 且 [0, rand) 有缺口 */
	hollow: boolean
}

const RE_RAND_STATEMENT = /^[ \t]*RAND:[ \t]*(\d+)[ \t]*(?:;.*)?$/
const RE_CASE = /^[ \t]*CASE[ \t]+([0-9,\s]+?)[ \t]*(?:;.*)?$/
const RE_CASE_ELSE = /^[ \t]*CASEELSE\b/
const RE_SELECTCASE = /^[ \t]*SELECTCASE\b/
const RE_ENDSELECT = /^[ \t]*ENDSELECT\b/
const RE_COMMENT = /^[ \t]*;/
const RE_BLANK = /^[ \t]*$/
/** RAND 与 CASE 之间允许出现的结构行（IF 家族不闭块——可能是分支内容） */
const RE_STRUCTURAL = /^[ \t]*(IF\b|ELSEIF\b|ELSE\b|ENDIF\b)/

function indentWidth(line: string): number {
	const m = /^[ \t]*/.exec(line)
	return m ? m[0].replace(/\t/g, "    ").length : 0
}

function parseCaseValues(raw: string): number[] {
	const out: number[] = []
	for (const part of raw.split(",")) {
		const n = Number.parseInt(part.trim(), 10)
		if (Number.isFinite(n)) {
			out.push(n)
		}
	}
	return out
}

interface OpenBlock {
	line: number
	rand: number
	indent: number
	cases: number[]
	hasElse: boolean
}

function finishBlock(block: OpenBlock): RandBlock {
	const unique = [...new Set(block.cases)].sort((a, b) => a - b)
	const unreachable = unique.filter((v) => v >= block.rand)
	const covered = new Set(unique.filter((v) => v >= 0 && v < block.rand))
	return {
		line: block.line,
		rand: block.rand,
		cases: unique,
		hasElse: block.hasElse,
		unreachable,
		// 保守护栏：一个 CASE 都没收到（IF 惯用法或解析不到）不报落空——拿不准就不报
		hollow: !block.hasElse && unique.length > 0 && covered.size < block.rand,
	}
}

/**
 * G2：双侧 RAND 校验的解析层。
 *
 * 口径（与集群 erb_check / check_rand_branches 对齐）：
 * - `unreachable`：CASE 值 ≥ N —— 该分支永远不被命中（死代码，常伴随复制粘贴错位）。
 * - `hollow`：无 CASEELSE 且 `[0, N)` 有未覆盖值 —— 骰子掷出时**没有任何分支接住**，
 *   表现为「这段对话有时不出」。
 *
 * 块归属规则（栈式，防嵌套互相吞并）：
 * - `RAND:N`（单独占一行＝语句位）开块；表达式位（`RAND:360` 作参数）不参与。
 * - `CASE` 归**缩深最深的、缩进 ≤ 本行**的未闭块——嵌套 RAND 的 CASE 不会被外层吞掉。
 * - 等深的 `SELECTCASE` 视为本块的（RAND 惯用法夹层）；更深的会先收嵌套块。
 * - `ENDSELECT` 与等深/更浅的真语句闭块；IF 家族不闭块（可能是分支内容）。
 */
export function auditRandBranches(text: string): RandBlock[] {
	const lines = text.split(/\r\n|\r|\n/)
	const done: RandBlock[] = []
	const stack: OpenBlock[] = []

	const closeTo = (minIndent: number) => {
		while (stack.length > 0 && stack[stack.length - 1].indent >= minIndent) {
			done.push(finishBlock(stack.pop() as OpenBlock))
		}
	}
	const assignTo = (indent: number, apply: (block: OpenBlock) => void) => {
		for (let k = stack.length - 1; k >= 0; k--) {
			if (stack[k].indent <= indent) {
				apply(stack[k])
				return
			}
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (RE_BLANK.test(line) || RE_COMMENT.test(line)) {
			continue
		}

		const randMatch = RE_RAND_STATEMENT.exec(line)
		if (randMatch) {
			const rand = Number.parseInt(randMatch[1], 10)
			if (!Number.isFinite(rand) || rand <= 0) {
				continue // RAND:0 引擎钳为 0，无从对账
			}
			const indent = indentWidth(line)
			closeTo(indent) // 等深/更浅处再来一个 RAND：旧块到此为止
			stack.push({ line: i + 1, rand, indent, cases: [], hasElse: false })
			continue
		}

		const indent = indentWidth(line)
		const caseMatch = RE_CASE.exec(line)
		if (caseMatch) {
			const values = parseCaseValues(caseMatch[1])
			assignTo(indent, (block) => block.cases.push(...values))
			continue
		}
		if (RE_CASE_ELSE.test(line)) {
			assignTo(indent, (block) => {
				block.hasElse = true
			})
			continue
		}
		if (RE_SELECTCASE.test(line)) {
			closeTo(indent + 1) // 更深的 SELECTCASE 收嵌套块；等深的视为本块的
			continue
		}
		if (RE_ENDSELECT.test(line)) {
			closeTo(indent)
			continue
		}
		if (RE_STRUCTURAL.test(line)) {
			continue // IF 家族：不闭块
		}
		closeTo(indent) // 真语句：等深/更浅处出现 ⇒ 块结束
	}
	while (stack.length > 0) {
		done.push(finishBlock(stack.pop() as OpenBlock))
	}
	return done.sort((a, b) => a.line - b.line)
}

/** G2 finding：只报有问题的块 */
export function randGateFindings(path: RelPath, text: string): GateFinding[] {
	const out: GateFinding[] = []
	for (const block of auditRandBranches(text)) {
		if (block.unreachable.length > 0) {
			out.push({
				gate: "G2",
				code: "rand-unreachable",
				path,
				line: block.line,
				detail: `RAND:${block.rand} 有个永远不会走到的死路 CASE ${block.unreachable.join("/")}（值 ≥ ${block.rand}）`,
			})
		}
		if (block.hollow) {
			const covered = block.cases.filter((v) => v >= 0 && v < block.rand)
			out.push({
				gate: "G2",
				code: "rand-hollow",
				path,
				line: block.line,
				detail: `RAND:${block.rand} 只有 ${covered.length} 种走法且无 CASEELSE（${block.rand - covered.length}/${block.rand} 概率落空）`,
			})
		}
	}
	return out
}

/** 提取文本里定义的函数标签（`@NAME`，1 基行号） */
export function extractDefinedLabels(text: string): Map<string, number> {
	const out = new Map<string, number>()
	const lines = text.split(/\r\n|\r|\n/)
	for (let i = 0; i < lines.length; i++) {
		const m = /^[ \t]*@([A-Za-z_][A-Za-z_0-9]*)/.exec(lines[i])
		if (m && !out.has(m[1])) {
			out.set(m[1], i + 1)
		}
	}
	return out
}

export interface DispatchCall {
	line: number
	/** 目标名原文（可能含 %VAR% / {表达式} 动态段） */
	target: string
	/** 含动态段 → 静态判不了 */
	dynamic: boolean
}

const RE_DISPATCH = /^[ \t]*(TRYCALLFORM|TRYCCALLFORM|CALLFORM)[ \t]+([^\s;]+)/

/** 提取 CALLFORM 家族的拼名派发点 */
export function extractDispatchCalls(text: string): DispatchCall[] {
	const out: DispatchCall[] = []
	const lines = text.split(/\r\n|\r|\n/)
	for (let i = 0; i < lines.length; i++) {
		const m = RE_DISPATCH.exec(lines[i])
		if (!m) {
			continue
		}
		const target = m[2]
		out.push({ line: i + 1, target, dynamic: target.includes("%") || target.includes("{") })
	}
	return out
}

/**
 * G3（纯原语）：静态派发目标 vs 给定标签集。
 * 动态目标（含 % / {）跳过——拼名结果运行时才知道，静态判不了。
 */
export function dispatchLabelFindings(path: RelPath, text: string, labels: Set<string>): GateFinding[] {
	const out: GateFinding[] = []
	for (const call of extractDispatchCalls(text)) {
		if (call.dynamic || labels.has(call.target)) {
			continue
		}
		out.push({
			gate: "G3",
			code: "dispatch-removed",
			path,
			line: call.line,
			detail: `派发到不存在的标签 ${call.target}（TRYCALLFORM 找不到会静默跳过）`,
		})
	}
	return out
}

/**
 * G3（更新场景版）：上游把标签删了/改名了，但改动集里仍有派发打向旧名。
 * 标签集 = 本地旧版定义的标签；缺失 = 上游新版里没有的同名标签。
 * 只在「改动集内部」对账——未改动文件里的定义不参与（拿不到内容），
 * 因此这是**高信号低覆盖**的判据：报出来的基本是真断裂，没报不代表全对。
 */
export function dispatchDriftFindings(
	path: RelPath,
	localText: string | null,
	theirsText: string | null,
	changedLabels: Set<string>,
): GateFinding[] {
	if (!localText || !theirsText) {
		return []
	}
	const localLabels = extractDefinedLabels(localText)
	const theirsLabels = extractDefinedLabels(theirsText)
	const removed = [...localLabels.keys()].filter((name) => !theirsLabels.has(name))
	if (removed.length === 0) {
		return []
	}
	const removedSet = new Set(removed)
	const out: GateFinding[] = []
	for (const call of extractDispatchCalls(theirsText)) {
		if (call.dynamic || !removedSet.has(call.target)) {
			continue
		}
		// 改动集里别的文件还定义着这个名字 → 不是断裂
		if (changedLabels.has(call.target)) {
			continue
		}
		out.push({
			gate: "G3",
			code: "dispatch-removed",
			path,
			line: call.line,
			detail: `派发到已被本次更新删除的标签 ${call.target}（原定义在本地版 L${localLabels.get(call.target)}；TRYCALLFORM 找不到会静默跳过）`,
		})
	}
	return out
}

/** G6：HPH_PRINT 去化判据——字符串仍含 HPH/BPB ⇒ 去化必回归 */
export function hphResidueFindings(path: RelPath, text: string): GateFinding[] {
	const out: GateFinding[] = []
	const lines = text.split(/\r\n|\r|\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (RE_COMMENT.test(line)) {
			continue
		}
		const m = /(?<![A-Za-z0-9_])(HPH|BPB)(?![A-Za-z0-9_])/.exec(line)
		if (m) {
			out.push({
				gate: "G6",
				code: "hph-residue",
				path,
				line: i + 1,
				detail: `字符串仍含 ${m[1]}（粉色 /// 陷阱，去化必回归）`,
			})
		}
	}
	return out
}

/** G7（编码分支）：混用 CRLF 与 LF（含孤立 CR） */
export function eolMixedFinding(path: RelPath, text: string): GateFinding[] {
	const crlfCount = (text.match(/\r\n/g) ?? []).length
	const totalLf = (text.match(/\n/g) ?? []).length
	const loneLf = totalLf - crlfCount
	const loneCr = (text.match(/\r(?!\n)/g) ?? []).length
	if (crlfCount > 0 && (loneLf > 0 || loneCr > 0)) {
		return [
			{
				gate: "G7",
				code: "eol-mixed",
				path,
				detail: `文件内混用行尾（CRLF ${crlfCount} / 孤立 LF ${loneLf} / 孤立 CR ${loneCr}；批量转换的典型痕迹）`,
			},
		]
	}
	return []
}

export interface GateTexts {
	/** 本地旧版；没有（新增文件）传 null */
	local: string | null
	/** 上游新版 / 合并结果；没有（删除文件）传 null */
	theirs: string | null
}

/**
 * 跑一个文件的全部已实现闸门。
 * `changedLabels` = 改动集内所有文件定义的标签并集（用于 G3 去误报）。
 */
export function runContentGates(path: RelPath, texts: GateTexts, changedLabels: Set<string>): GateFinding[] {
	const target = texts.theirs ?? texts.local
	if (target === null) {
		return []
	}
	return [
		...randGateFindings(path, target),
		...hphResidueFindings(path, target),
		...eolMixedFinding(path, target),
		...dispatchDriftFindings(path, texts.local, texts.theirs, changedLabels),
	]
}

/** 改动集内全部标签的并集（G3 去误报用） */
export function collectChangedLabels(files: Array<{ path: RelPath; text: string | null }>): Set<string> {
	const out = new Set<string>()
	for (const file of files) {
		if (!file.text) {
			continue
		}
		for (const name of extractDefinedLabels(file.text).keys()) {
			out.add(name)
		}
	}
	return out
}

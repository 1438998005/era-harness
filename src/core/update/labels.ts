/**
 * G4：调用方检索（全树）——上游删了函数，还有没有人调。
 *
 * 判据正本：shared-trae `knowledge/eratw/import-merge-gates.md` G4
 * （函数存在≠函数被调；照搬无人调用的新模板函数＝功能整体失效）。
 * 本模块负责**被删函数的调用方发现**：改动集之外的调用方 G3 看不见（它只看改动集内部），
 * 而「用户自己的 MOD 调用了上游刚删掉的函数」正是更新后一进游戏就报错的经典形态。
 *
 * 命名空间纪律（查文档仓 Reference 确认）：
 * - `CALL / TRYCALL / TRYCCALL / JUMP` + `CALLFORM` 家族 → **@NAME 全局标签**，参与本检查。
 * - `CALLF / TRYCALLF` → `#FUNCTION` 命名空间，⛔ 不参与（同名不同物，报了全是误报）。
 * - `GOTO $NAME` → 函数内局部标签，⛔ 不参与（跨文件无从谈起）。
 * - 目标含 `%` / `{}` 的动态拼名 → 运行时才知道，跳过。
 *
 * 纯函数、无 IO；树的遍历在 `manifest.ts#scanLabels`。
 */

import { extractDefinedLabels } from "./gates"
import type { GateFinding, RelPath } from "./types"

/** @NAME 的静态调用点 */
export interface CallRef {
	path: RelPath
	line: number
	target: string
}

/** 全树标签索引 */
export interface LabelIndex {
	/** 全局标签 → 定义所在文件（可能多处：重复定义本身也是引擎错误，这里只做有着落判断） */
	defs: Map<string, RelPath[]>
	/** 全局标签 → 静态调用点 */
	calls: Map<string, CallRef[]>
	/** 扫过的脚本文件数 */
	files: number
}

const RE_COMMENT = /^[ \t]*;/
const RE_CALL_GLOBAL = /^[ \t]*(?:CALL|TRYCALL|TRYCCALL|JUMP)[ \t]+(@?[A-Za-z_][A-Za-z_0-9]*)/
const RE_DISPATCH_LINE = /^[ \t]*(?:TRYCALLFORM|TRYCCALLFORM|CALLFORM)[ \t]+([^\s;]+)/

/** 提取文本里对全局函数标签的静态调用点（注释与动态拼名跳过） */
export function extractGlobalCallRefs(path: RelPath, text: string): CallRef[] {
	const out: CallRef[] = []
	const lines = text.split(/\r\n|\r|\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (RE_COMMENT.test(line)) {
			continue
		}
		const direct = RE_CALL_GLOBAL.exec(line)
		if (direct) {
			out.push({ path, line: i + 1, target: direct[1].replace(/^@/, "") })
			continue
		}
		const dispatch = RE_DISPATCH_LINE.exec(line)
		if (dispatch && !dispatch[1].includes("%") && !dispatch[1].includes("{")) {
			out.push({ path, line: i + 1, target: dispatch[1] })
		}
	}
	return out
}

export function buildLabelIndex(files: Array<{ path: RelPath; text: string }>): LabelIndex {
	const defs = new Map<string, RelPath[]>()
	const calls = new Map<string, CallRef[]>()
	for (const file of files) {
		for (const name of extractDefinedLabels(file.text).keys()) {
			const list = defs.get(name)
			if (list) {
				list.push(file.path)
			} else {
				defs.set(name, [file.path])
			}
		}
		for (const call of extractGlobalCallRefs(file.path, file.text)) {
			const list = calls.get(call.target)
			if (list) {
				list.push(call)
			} else {
				calls.set(call.target, [call])
			}
		}
	}
	return { defs, calls, files: files.length }
}

/** 每个标签最多列几个调用点（防弹窗被一个热门函数淹死） */
const MAX_CALLERS_PER_LABEL = 3

/**
 * G4 finding：被本次更新删掉的全局标签，是否还有**改动集之外**的调用方。
 *
 * 三重去误报：
 * 1. 只看改动集之外的调用方（集内的由 G3 报，不重复）；
 * 2. 改动集之外仍有定义（用户自留的副本/另一处定义）→ 调用有着落，不报；
 * 3. 每个标签最多列 3 个调用点 + 一条汇总。
 */
export function findOrphanedCallers(index: LabelIndex, removedLabels: Set<string>, changedPaths: Set<RelPath>): GateFinding[] {
	const out: GateFinding[] = []
	for (const label of [...removedLabels].sort()) {
		const remainingDefs = (index.defs.get(label) ?? []).filter((p) => !changedPaths.has(p))
		if (remainingDefs.length > 0) {
			continue // 改动集之外还有定义 → 调用有着落
		}
		const outside = (index.calls.get(label) ?? []).filter((call) => !changedPaths.has(call.path))
		if (outside.length === 0) {
			continue // 没有外部调用方（或只有改动集内的，归 G3）
		}
		for (const caller of outside.slice(0, MAX_CALLERS_PER_LABEL)) {
			out.push({
				gate: "G4",
				code: "caller-orphaned",
				path: caller.path,
				line: caller.line,
				detail: `调用了 ${label}，但本次更新把这个函数删掉了（调用点在这，函数没了，进游戏会报错）`,
			})
		}
		if (outside.length > MAX_CALLERS_PER_LABEL) {
			out.push({
				gate: "G4",
				code: "caller-orphaned",
				path: outside[0].path,
				detail: `还有 ${outside.length - MAX_CALLERS_PER_LABEL} 处也在调用 ${label}（同上）`,
			})
		}
	}
	return out
}

/**
 * eratw 一键更新 —— AI 合并工作台。
 *
 * **为什么要有这个模块**：`mergeProvider.ts` 把合并实现成「一次不带工具的
 * 一次性 completion」。好处是模型不会跑偏，坏处是**用户完全看不到 AI 改了
 * 什么**——没有对话、没有痕迹、不落 `api_conversation_history.json`，
 * 改坏了只能整份回滚，没法单独看某一个窗口它为什么这么改。
 *
 * **工作台的做法**：把每个冲突窗口落成一个小文件，交给一个**真正的 Cline
 * 对话**（ACT 模式）去处理。AI 用现成的 `read_file` / `write_to_file` 逐个
 * 窗口合并，每一步都留在对话里——用户可以随时打断、追问、自己上手改。
 * 对话结束后由程序回收 `out/` 里的结果，走**和以前完全一样**的静态校验
 * 与备份写盘。
 *
 * **一条安全性质都没变**：
 * - 仍然**窗口化**：不相交的改动机械合并、零模型调用；只有冲突窗口进工作台。
 * - 仍然**相对校验**：`validateMerge` 原样复用，不过就退回「保留本地」。
 * - 仍然**零悬空**：没交 / 校验不过的窗口一律保留本地，绝不写半成品。
 * - 工作台落在 `.era-harness/merge-work/` 下，本来就被扫描排除、被
 *   `PROTECTED_PREFIXES` 保护，更新流程永远不会去写它。
 *
 * 本模块**纯 Node**（不 import vscode、不联网）。「开一个对话」由调用方注入，
 * 因此整套落盘/回收逻辑都能在单元测试里跑。
 */

import fs from "node:fs/promises"
import path from "node:path"
import { extractMergeOutput, type MergeIssue, validateMerge } from "./merge"
import type { RelPath } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// 一、工作项
// ─────────────────────────────────────────────────────────────────────────────

/** 一个待合并的冲突窗口。id 同时用作输入/输出文件名（`0001`）。 */
export interface MergeWorkItem {
	/** 四位十进制序号，全局唯一 */
	id: string
	path: RelPath
	/** 本文件冲突窗口的序号 / 总数（从 1 开始） */
	windowIndex: number
	windowCount: number
	base: string[]
	local: string[]
	theirs: string[]
	/** 上一轮校验未过的问题；有值时工作台进入「返工」模式 */
	feedback?: MergeIssue[]
}

/** 工作台一次最多接多少个别窗口。超了就不走对话，退回静默合并。 */
export const MAX_WORKBENCH_ITEMS = 200

/** 对话意外改动到的文件（工作台目录本身被扫描排除，不会出现在这里） */
export interface UnexpectedChange {
	path: RelPath
	kind: "added" | "removed" | "modified"
}

/**
 * 对话跑完后的回报。
 *
 * **类型定义在 core 侧**：`runTask` 是 core 注入给 hosts 的接缝，契约必须由
 * core 说了算，否则 core 就要反向 import hosts（违反 §13.12 的分层约束）。
 * `hosts/vscode/mergeTask.ts` 直接复用这里的类型。
 */
export type WorkbenchRunOutcome =
	| { status: "completed"; unexpected: UnexpectedChange[] }
	| { status: "busy"; detail: string; unexpected?: UnexpectedChange[] }
	| { status: "unavailable"; detail: string; unexpected?: UnexpectedChange[] }
	| { status: "failed"; detail: string; unexpected?: UnexpectedChange[] }

export interface WorkbenchLayout {
	/** `<gameRoot>/.era-harness/merge-work/<stamp>/` */
	root: string
	itemsDir: string
	outDir: string
	/** 给用户看的问题清单（重试轮次才有） */
	taskFile: string
	fixFile: string
}

export function workbenchLayout(gameRoot: string, stamp: string): WorkbenchLayout {
	const root = path.join(gameRoot, ".era-harness", "merge-work", stamp)
	return {
		root,
		itemsDir: path.join(root, "items"),
		outDir: path.join(root, "out"),
		taskFile: path.join(root, "TASK.md"),
		fixFile: path.join(root, "FIX.md"),
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 二、落盘
// ─────────────────────────────────────────────────────────────────────────────

function fence(label: string, lines: string[]): string[] {
	return [`<<<${label}>>>`, lines.join("\n"), `<<<${label}>>>`]
}

function renderItem(item: MergeWorkItem, gameRoot: string, outDir: string): string {
	const lines: string[] = [
		`# ${item.id} · ${item.path}`,
		"",
		`冲突窗口：本文件第 ${item.windowIndex} 个，共 ${item.windowCount} 个。`,
		"",
		`请把下面 BASE / LOCAL / THEIRS 三段合并成一段，**只把合并结果写进** \`${path.join(outDir, `${item.id}.md`)}\`，`,
		"那个文件里除代码之外不要有任何别的内容（不要 Markdown 围栏、不要序号、不要解释）。",
		"",
		"下面给出的完整路径只是帮你理解上下文，**不要修改它**：",
		`\`${path.join(gameRoot, ...item.path.split("/"))}\``,
		"",
		"## BASE（上一次更新时保存的社区版）",
		...fence("BASE", item.base),
		"",
		"## LOCAL（玩家当前磁盘上的版本，含玩家的全部改动）",
		...fence("LOCAL", item.local),
		"",
		"## THEIRS（社区新版本）",
		...fence("THEIRS", item.theirs),
	]
	if (item.feedback && item.feedback.length > 0) {
		lines.push("", "## 上一轮这个窗口没过校验，请修正后重新输出", ...item.feedback.map((i) => `- ${i.detail}`))
	}
	return `${lines.join("\n")}\n`
}

/** 合并原则 + 硬性约束。和 `merge.ts` 的 `MERGE_SYSTEM_PROMPT` 同源，但改成对话口吻。 */
export const WORKBENCH_RULES = [
	"## 合并原则（按优先级）",
	"1. 冲突时以 THEIRS 的行为为准：社区修 bug、改数值、加分支必须生效。",
	"2. LOCAL 里的文本内容、口上风格、个性化台词尽量保留——这是玩家最在意的东西。",
	"3. 双方改动不重叠时，两边的改动都要保留。",
	"4. 拿不准时，选择「保留更多 LOCAL 文本 + 采用 THEIRS 的结构」。",
	"",
	"## 硬性约束（会被程序静态校验，违反则这个窗口作废、玩家的版本被原样保留）",
	"- 不得删除、不得重命名任何 @函数名。",
	"- 不得引入 BASE / LOCAL / THEIRS 中都不存在的 CALL / CALLFORM / JUMP / GOTO / CALLTRAIN 目标名。",
	"- 控制流块必须成对：IF…ENDIF、FOR…NEXT、WHILE…WEND、SELECTCASE…ENDSELECT、DO…LOOP、REPEAT…REND、CATCH…ENDCATCH。",
	"- ERB 没有 #END。#FUNCTION / #FUNCTIONS 只是返回类型声明，函数体由 @标签 起头。",
	"- 缩进保持原样（Tab 就是 Tab，不要换成空格）。日文原文一字不改，不要把日文「翻译」成中文。",
	"- 不要顺手优化：不重排、不合并重复代码、不改数值、不加注释、不修社区版自己的 bug。",
].join("\n")

/**
 * 生成开工提示词。
 *
 * 刻意把「边界」写得非常死：只读 items/、只写 out/、不要跑命令、不要读别的
 * 文件。`write_to_file` 在这套代码里**没有**工作区校验（实测只有
 * ApplyPatchHandler 有），所以约束只能靠提示词 + 事后比对两道防线。
 */
export function buildWorkbenchPrompt(layout: WorkbenchLayout, items: MergeWorkItem[], gameRoot: string): string {
	const count = items.length
	const first = items[0]?.id ?? "0001"
	const lines = [
		"# 任务：把社区新版合并进玩家版本",
		"",
		`游戏目录：\`${gameRoot}\``,
		`本轮要处理 **${count} 个冲突窗口**，材料在 \`${layout.itemsDir}/\`，从 \`${first}\` 开始按序号来。`,
		"",
		"## 怎么做",
		`1. 读 \`${layout.itemsDir}/${first}.md\`（然后 ${first} 之后按序号继续）。每个文件里有 BASE / LOCAL / THEIRS 三段。`,
		`2. 把三段合并成一段，写到 \`${layout.outDir}/<同样的序号>.md\`——文件名必须和输入一致。`,
		"3. 每处理完一个，在对话里用一两句话说明你改了什么、为什么。",
		"4. 全部处理完后，明确告诉我「做完了，N 个全部完成」。",
		"",
		WORKBENCH_RULES,
		"",
		"## 边界（重要，违反会被记录并报告给用户）",
		`- 只读 \`${layout.itemsDir}/\` 下的文件；只写 \`${layout.outDir}/\` 下的文件。`,
		"- **不要动游戏目录里的任何其他文件**，程序会在你结束后逐字节比对。",
		"- 不需要运行游戏、不需要执行命令、不需要读别的文件来「理解上下文」——每个窗口自带全部所需信息。",
		"- 这是 eratw（Emuera / ERB 脚本）的更新合并，不是普通软件项目，不要改构建配置、不要跑 lint。",
	]
	return lines.join("\n")
}

/** 只写 items/*.md 与 TASK.md，**不动 out/**。重试轮次也要用它刷新带 feedback 的工单。 */
export async function writeItemFiles(layout: WorkbenchLayout, items: MergeWorkItem[], gameRoot: string): Promise<void> {
	await fs.mkdir(layout.itemsDir, { recursive: true })
	for (const item of items) {
		await fs.writeFile(path.join(layout.itemsDir, `${item.id}.md`), renderItem(item, gameRoot, layout.outDir), "utf8")
	}
	await fs.writeFile(layout.taskFile, `${buildWorkbenchPrompt(layout, items, gameRoot)}\n`, "utf8")
}

/** 落盘全部工作项 + TASK.md，并清空 out/。只在第一轮调用。 */
export async function materializeWorkbench(layout: WorkbenchLayout, items: MergeWorkItem[], gameRoot: string): Promise<void> {
	await fs.mkdir(layout.outDir, { recursive: true })
	await fs.rm(layout.outDir, { recursive: true, force: true })
	await fs.mkdir(layout.outDir, { recursive: true })
	await writeItemFiles(layout, items, gameRoot)
}

/** 重试说明：列出上一轮没过的窗口和原因。 */
export async function writeFixNote(layout: WorkbenchLayout, failed: CollectedItem[]): Promise<void> {
	const lines = [
		"# 返工清单",
		"",
		"上一轮有下列窗口没有通过程序校验，玩家的版本被原样保留了。",
		"请**只重新处理这些**，把新结果覆盖写到 `out/<序号>.md`；已经通过的不要动。",
		"",
	]
	for (const c of failed) {
		lines.push(`## ${c.item.id} · ${c.item.path}（第 ${c.item.windowIndex}/${c.item.windowCount} 个冲突窗口）`)
		if (c.raw !== null) {
			lines.push("", "你上一轮写的是：", "<<<PREVIOUS>>>", c.raw, "<<<PREVIOUS>>>")
		} else {
			lines.push("", "你上一轮没有提交结果。")
		}
		lines.push("", "程序给出的问题：", ...c.issues.map((i) => `- ${i.detail}`))
		lines.push("", "原始三段在 " + path.join(layout.itemsDir, `${c.item.id}.md`) + "，可以重读。", "")
	}
	await fs.writeFile(layout.fixFile, lines.join("\n"), "utf8")
}

/** 第二轮及以后的提示词：只让 AI 返工上一轮没过的窗口。 */
export function buildWorkbenchFixPrompt(layout: WorkbenchLayout, failed: CollectedItem[]): string {
	return [
		"# 返工：上一轮有几个冲突窗口没过校验",
		"",
		`完整清单和程序给出的问题在 \`${layout.fixFile}\`，请先读它。`,
		"",
		"要求：",
		`- 只处理清单里列出的窗口，把新结果**覆盖写**到 \`${layout.outDir}/<序号>.md\`。`,
		"- 已经通过的窗口不要动，也不要重新输出。",
		"- 输出的文件里只放代码本身：不要 Markdown 围栏、不要序号、不要解释。",
		"- 改完后在对话里说清楚你改了什么、为什么。",
		"",
		WORKBENCH_RULES,
	].join("\n")
}

// ─────────────────────────────────────────────────────────────────────────────
// 三、回收
// ─────────────────────────────────────────────────────────────────────────────

export interface CollectedItem {
	item: MergeWorkItem
	/** AI 写的原文；`null` 表示没交 */
	raw: string | null
	/** 剥掉代码围栏后的正文；`raw === null` 时为 null */
	text: string | null
	issues: MergeIssue[]
	ok: boolean
}

/** 读 `out/`，逐窗口剥围栏 + 静态校验。读不到、空、不过校验都算失败。 */
export async function collectWorkbench(layout: WorkbenchLayout, items: MergeWorkItem[]): Promise<CollectedItem[]> {
	const out: CollectedItem[] = []
	for (const item of items) {
		const file = path.join(layout.outDir, `${item.id}.md`)
		let raw: string | null = null
		try {
			raw = await fs.readFile(file, "utf8")
		} catch {
			raw = null
		}
		if (raw === null) {
			out.push({
				item,
				raw: null,
				text: null,
				issues: [{ code: "model-failed", detail: "对话里没有提交这个窗口的合并结果" }],
				ok: false,
			})
			continue
		}
		const extracted = extractMergeOutput(raw)
		if (extracted.text.trim() === "") {
			out.push({
				item,
				raw,
				text: null,
				issues: [{ code: "empty", detail: "提交的内容是空的" }],
				ok: false,
			})
			continue
		}
		const validation = validateMerge({
			path: item.path,
			// 与 runMerge 对齐：纯插入窗口的 base 传 "" 而不是 null
			base: item.base.join("\n"),
			local: item.local.join("\n"),
			theirs: item.theirs.join("\n"),
			merged: extracted.text,
			scope: "window",
		})
		out.push({ item, raw, text: extracted.text, issues: validation.issues, ok: validation.ok })
	}
	return out
}

/** 对话跑完后，工作台里有多少个窗口真的通过了。 */
export function summarizeCollected(collected: CollectedItem[]): { ok: number; failed: number } {
	let ok = 0
	for (const c of collected) {
		if (c.ok) {
			ok++
		}
	}
	return { ok, failed: collected.length - ok }
}

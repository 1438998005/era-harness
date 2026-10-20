/**
 * eratw 一键更新 —— 冲突解决（把「待定」变成「可写」）。
 *
 * 计划里 `action: "conflict"` 的条目本来一律不动（本地文件原样保留，最安全）。
 * 这个模块给用户多一个选择：**让 AI 帮你合并**。它只做三件事：
 *
 * 1. 按 `plan.groups` 的粒度询问（口上按角色整包问、本体侧逐文件问，见 §13.4）；
 * 2. 对同意合并的文件跑 `runMerge`（不相交的改动机械合并，只有冲突窗口才问模型）；
 * 3. 把合并结果装成 `overrides`，交给 `apply.ts` 与归档内容一起写盘。
 *
 * 关键约束：
 * - **任何一个文件合并失败，该文件就退回"保留本地"**，绝不写半成品（Z4 零悬空）。
 * - 合并结果不是上游内容，所以 `theirsSha1` 不能用来自检；由调用方改用 `writes` 里的新指纹。
 * - 非 UTF-8 文件（实测只有 62 个 `.txt`/`.bat` 旧文档）直接判 `unsupported`，不做猜测性转码。
 */

import { gitBlobSha1 } from "./manifest"
import {
	assemble,
	decodeText,
	encodeText,
	MAX_WINDOW_LINES,
	type MergeAsk,
	type MergeIssue,
	type MergeWindow,
	planMergeWindows,
	runMerge,
	type TextEncoding,
	trivialMerge,
	validateMerge,
} from "./merge"
import {
	buildWorkbenchFixPrompt,
	buildWorkbenchPrompt,
	type CollectedItem,
	collectWorkbench,
	MAX_WORKBENCH_ITEMS,
	type MergeWorkItem,
	materializeWorkbench,
	summarizeCollected,
	type WorkbenchLayout,
	type WorkbenchRunOutcome,
	workbenchLayout,
	writeFixNote,
	writeItemFiles,
} from "./mergeWorkbench"
import type { ConflictGroup, PlanEntry, RelPath, UpdatePlan } from "./types"

export type ResolveDecision =
	| "merged" // AI 合并成功，写合并结果
	| "keep-local" // 不合并 / 合并失败 → 本地文件原样保留
	| "unsupported" // 非文本或非 UTF-8，无法合并
	| "no-content" // 计划里缺少上游内容（例如上游删除了这个文件）

export interface ResolveFileResult {
	path: RelPath
	decision: ResolveDecision
	/** 合并失败/跳过的原因（中文，可直接展示） */
	issues: MergeIssue[]
}

export interface ResolveGroupResult {
	kind: ConflictGroup["kind"]
	key: string
	label: string
	paths: RelPath[]
	merged: number
	kept: number
}

export interface ResolveConflictsOptions {
	plan: UpdatePlan
	/** 读本地磁盘上的当前内容 */
	readLocal: (rel: RelPath) => Promise<Buffer | null>
	/** 读本次上游版本的内容 */
	readTheirs: (rel: RelPath) => Promise<Buffer | null>
	/** 读上一次上游版本的内容；没有基线时返回 null */
	readBase: (rel: RelPath) => Promise<Buffer | null>
	/**
	 * 能否取到「上次社区版」的内容。false 表示当前更新源拿不到历史版本
	 * （例如用本地压缩包更新），这时有基线的文件就不能硬合并 —— 少一方内容
	 * 会让三方合并退化成"用社区版覆盖你的改动"，那是最坏的结果。
	 */
	baseAvailable?: boolean
	ask: MergeAsk
	/** 逐组询问；不传则一律「保留本地」 */
	shouldMerge?: (group: ConflictGroup) => Promise<boolean> | boolean
	maxAttempts?: number
	onProgress?: (done: number, total: number, path: RelPath) => void
}

export interface ResolveConflictsResult {
	/** 合并成功的内容，交给 `apply.ts` 的 `overrides` */
	overrides: Map<RelPath, Buffer>
	/** 合并后的指纹，用于自检（不能拿 theirsSha1 比） */
	writes: Map<RelPath, string>
	files: ResolveFileResult[]
	groups: ResolveGroupResult[]
	/**
	 * 给人看的备注（中文）。工作台路径用它回报「有几个窗口没交 / 对话没跑成」
	 * 之类**不影响正确性**的情况——真正决定成败的都在 `files` 里。
	 */
	notes?: string[]
}

function emptyResult(): ResolveConflictsResult {
	return { overrides: new Map(), writes: new Map(), files: [], groups: [] }
}

/**
 * 处理计划里的全部冲突。
 *
 * 只有 `write` 动作是"这次会写盘"的；合并成功的冲突条目会被调用方提升为 `write`，
 * 其余保持 `conflict`（= 磁盘上什么都不动）。
 */
export async function resolveConflicts(options: ResolveConflictsOptions): Promise<ResolveConflictsResult> {
	const { plan } = options
	if (plan.summary.conflict === 0 || plan.groups.length === 0) {
		return emptyResult()
	}

	const result = emptyResult()
	const byPath = new Map(plan.entries.map((entry) => [entry.path, entry]))
	const decided = new Map<RelPath, ResolveFileResult>()
	let done = 0
	const total = plan.groups.reduce((sum, group) => sum + group.paths.length, 0)

	for (const group of plan.groups) {
		const agree = options.shouldMerge ? await options.shouldMerge(group) : false
		const groupResult: ResolveGroupResult = {
			kind: group.kind,
			key: group.key,
			label: group.label,
			paths: group.paths,
			merged: 0,
			kept: 0,
		}

		for (const rel of group.paths) {
			done++
			options.onProgress?.(done, total, rel)
			if (!agree) {
				decided.set(rel, { path: rel, decision: "keep-local", issues: [] })
				groupResult.kept++
				continue
			}
			const outcome = await resolveOne(rel, byPath.get(rel), options)
			decided.set(rel, outcome.file)
			if (outcome.bytes) {
				result.overrides.set(rel, outcome.bytes)
				result.writes.set(rel, gitBlobSha1(outcome.bytes))
			}
			if (outcome.file.decision === "merged") {
				groupResult.merged++
			} else {
				groupResult.kept++
			}
		}
		result.groups.push(groupResult)
	}

	// 保持 plan 的条目顺序，输出稳定，便于 UI 与测试断言
	for (const entry of plan.entries) {
		const file = decided.get(entry.path)
		if (file) {
			result.files.push(file)
		}
	}
	return result
}

interface OneOutcome {
	file: ResolveFileResult
	/** 仅 `merged` 时有值 */
	bytes?: Buffer
}

interface LoadedVersions {
	local: { text: string; encoding: TextEncoding }
	theirs: { text: string; encoding: TextEncoding }
	base: { text: string; encoding: TextEncoding } | null
}

type LoadOutcome = { ok: true; value: LoadedVersions } | { ok: false; file: ResolveFileResult }

/**
 * 读本地 / 上游 / 基线三方内容并解码。
 *
 * 抽出来共享是因为**两条路径的前置检查必须逐字一致**：静默合并（`runMerge`）
 * 和对话工作台如果在「什么文件不能合并」上判断不同，会出现同一个文件在两条
 * 路径上一个能合一个不能合的分裂，那种 bug 极难查。
 */
async function loadThreeVersions(
	rel: RelPath,
	entry: PlanEntry | undefined,
	options: Pick<ResolveConflictsOptions, "readLocal" | "readTheirs" | "readBase" | "baseAvailable">,
): Promise<LoadOutcome> {
	const keep = (decision: ResolveDecision, issues: MergeIssue[] = []): LoadOutcome => ({
		ok: false,
		file: { path: rel, decision, issues },
	})

	if (!entry || entry.action !== "conflict") {
		return keep("keep-local")
	}
	if (!entry.theirsSha1) {
		// 上游删了这个文件（delete-vs-local-change）—— 没有"上游版本"可合并
		return keep("no-content", [{ code: "model-failed", detail: "社区版删掉了这个文件，没有可合并的内容" }])
	}
	if (!entry.localSha1) {
		return keep("no-content", [{ code: "model-failed", detail: "本地没有这个文件，没有可合并的内容" }])
	}
	if (entry.baseSha1 && options.baseAvailable === false) {
		return keep("no-content", [{ code: "model-failed", detail: "拿不到上次的社区版内容，这次没法自动合并，已保留你的版本" }])
	}

	const [localBuf, theirsBuf, baseBuf] = await Promise.all([
		options.readLocal(rel),
		options.readTheirs(rel),
		options.readBase(rel),
	])
	if (!localBuf || !theirsBuf) {
		return keep("no-content", [{ code: "model-failed", detail: "读不到文件内容，已保留你的版本" }])
	}

	const localText = decodeText(localBuf)
	const theirsText = decodeText(theirsBuf)
	if (!localText || !theirsText) {
		return keep("unsupported", [{ code: "mojibake", detail: "这个文件不是 UTF-8 文本，不能自动合并" }])
	}
	// 没有基线时 base 为 null：整份文件都会变成冲突窗口，交给 runMerge 的窗口上限兜底
	const baseText = baseBuf ? decodeText(baseBuf) : null

	return {
		ok: true,
		value: {
			local: localText,
			theirs: theirsText,
			base: baseText ? { text: baseText.text, encoding: baseText.encoding } : null,
		},
	}
}

async function resolveOne(rel: RelPath, entry: PlanEntry | undefined, options: ResolveConflictsOptions): Promise<OneOutcome> {
	const keep = (decision: ResolveDecision, issues: MergeIssue[] = []): OneOutcome => ({
		file: { path: rel, decision, issues },
	})

	const loaded = await loadThreeVersions(rel, entry, options)
	if (!loaded.ok) {
		return keep(loaded.file.decision, loaded.file.issues)
	}
	const { local, theirs, base } = loaded.value

	const merged = await runMerge({
		path: rel,
		base: base ? base.text : null,
		local: local.text,
		theirs: theirs.text,
		ask: options.ask,
		maxAttempts: options.maxAttempts,
	})
	if (!merged.ok) {
		return keep("keep-local", merged.issues)
	}

	return {
		file: { path: rel, decision: "merged", issues: merged.issues },
		bytes: encodeText(merged.text, local.encoding),
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 对话工作台路径：把合并交给一个真正的 Cline 对话（ACT 模式）
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkbenchProgress {
	phase: "materialize" | "conversation" | "collect"
	done?: number
	total?: number
	path?: RelPath
}

export interface WorkbenchMergeOptions {
	plan: UpdatePlan
	readLocal: (rel: RelPath) => Promise<Buffer | null>
	readTheirs: (rel: RelPath) => Promise<Buffer | null>
	readBase: (rel: RelPath) => Promise<Buffer | null>
	baseAvailable?: boolean
	shouldMerge?: (group: ConflictGroup) => Promise<boolean> | boolean
	/** 游戏根：工作台落在 `<root>/.era-harness/merge-work/<stamp>/` */
	root: string
	stamp: string
	/**
	 * 开一个对话把工作台跑完。返回时对话已结束（成功 / 失败 / 用户取消都算结束）。
	 * 契约类型在 core 侧定义，`hosts/vscode/mergeTask.ts` 复用，避免 core 反向依赖 hosts。
	 */
	runTask: (prompt: string, layout: WorkbenchLayout) => Promise<WorkbenchRunOutcome>
	/** 含首次在内最多跑几轮；每轮之间把没过的窗口写成 FIX.md 让 AI 返工 */
	maxAttempts?: number
	/** 一次对话最多接多少个冲突窗口，超过就全部保留本地 */
	maxItems?: number
	onProgress?: (event: WorkbenchProgress) => void
}

interface PendingFile {
	rel: RelPath
	/** 整份文本；`null` 表示社区版以前没有这个文件 */
	base: string | null
	local: string
	theirs: string
	encoding: TextEncoding
	baseLines: string[]
	windows: MergeWindow[]
	/** `windows` 里属于 conflict 的下标 */
	conflictIndices: number[]
}

/**
 * 用「对话工作台」处理计划里的全部冲突。
 *
 * 和 `resolveConflicts` 的关系：**同样的输入、同样的输出形状、同样的安全语义**，
 * 唯一区别是模型调用从「一次性 completion」换成了「一个可见的 Cline 对话」。
 * 两边的窗口化、静态校验、零悬空降级完全一致，因此可以来回切换而不改变结果。
 *
 * 流程：
 * 1. 逐组询问 → 读出三方版本 → 走 `trivialMerge` 捷径 → 算窗口；
 * 2. 只把 **conflict 窗口** 摊成工作项，落盘到 `.era-harness/merge-work/<stamp>/`；
 * 3. `runTask` 开一个对话让 AI 逐个合并（用户全程可见）；
 * 4. 回收 `out/`，逐窗口校验；不过的写进 FIX.md 再来一轮；
 * 5. 组装整份文件、做整份校验；任何一个窗口没成就退回「保留本地」（Z4 零悬空）。
 */
export async function resolveConflictsViaWorkbench(options: WorkbenchMergeOptions): Promise<ResolveConflictsResult> {
	const { plan } = options
	if (plan.summary.conflict === 0 || plan.groups.length === 0) {
		return emptyResult()
	}

	const result = emptyResult()
	const notes: string[] = []
	const byPath = new Map(plan.entries.map((entry) => [entry.path, entry]))
	const decided = new Map<RelPath, ResolveFileResult>()
	const pending: PendingFile[] = []
	const layout = workbenchLayout(options.root, options.stamp)

	const keepLocal = (rel: RelPath, issues: MergeIssue[]): void => {
		decided.set(rel, { path: rel, decision: "keep-local", issues })
	}
	const accept = (rel: RelPath, bytes: Buffer): void => {
		decided.set(rel, { path: rel, decision: "merged", issues: [] })
		result.overrides.set(rel, bytes)
		result.writes.set(rel, gitBlobSha1(bytes))
	}

	for (const group of plan.groups) {
		const agree = options.shouldMerge ? await options.shouldMerge(group) : false
		const groupResult: ResolveGroupResult = {
			kind: group.kind,
			key: group.key,
			label: group.label,
			paths: group.paths,
			merged: 0,
			kept: 0,
		}

		for (const rel of group.paths) {
			options.onProgress?.({ phase: "materialize", path: rel })
			if (!agree) {
				keepLocal(rel, [])
				groupResult.kept++
				continue
			}
			const loaded = await loadThreeVersions(rel, byPath.get(rel), options)
			if (!loaded.ok) {
				decided.set(rel, loaded.file)
				groupResult.kept++
				continue
			}
			const { local, theirs, base } = loaded.value
			const baseText = base ? base.text : null
			const wholeFile = { path: rel, base: baseText, local: local.text, theirs: theirs.text }

			const trivial = trivialMerge(baseText, local.text, theirs.text)
			if (trivial) {
				const v = validateMerge({ ...wholeFile, merged: trivial.text, scope: "file" })
				if (v.ok) {
					accept(rel, encodeText(trivial.text, local.encoding))
					groupResult.merged++
				} else {
					keepLocal(rel, v.issues)
					groupResult.kept++
				}
				continue
			}

			const baseLines = baseText === null ? [] : baseText.split("\n")
			const windows = planMergeWindows(baseLines, local.text.split("\n"), theirs.text.split("\n"))
			const conflictIndices = windows.map((win, index) => (win.kind === "conflict" ? index : -1)).filter((i) => i >= 0)

			if (conflictIndices.length === 0) {
				// 只有一侧改过：机械合并，零模型调用，不进工作台
				const text = assemble(baseLines, windows, new Map())
				const v = validateMerge({ ...wholeFile, merged: text, scope: "file" })
				if (v.ok) {
					accept(rel, encodeText(text, local.encoding))
					groupResult.merged++
				} else {
					keepLocal(rel, v.issues)
					groupResult.kept++
				}
				continue
			}

			// 窗口太长的文件不进工作台，和 runMerge 的上限保持一致
			const tooBig = conflictIndices.some((i) => {
				const win = windows[i]
				return Math.max(win.base.length, win.local.length, win.theirs.length) > MAX_WINDOW_LINES
			})
			if (tooBig) {
				keepLocal(rel, [
					{
						code: "window-too-large",
						detail: `「${rel}」有一段两边都改过的地方太长了，不适合自动合并`,
					},
				])
				groupResult.kept++
				continue
			}

			pending.push({
				rel,
				base: baseText,
				local: local.text,
				theirs: theirs.text,
				encoding: local.encoding,
				baseLines,
				windows,
				conflictIndices,
			})
		}
		result.groups.push(groupResult)
	}

	// ── 摊工作台 ──
	const items: MergeWorkItem[] = []
	const placements = new Map<string, { file: PendingFile; windowArrayIndex: number }>()
	for (const file of pending) {
		file.conflictIndices.forEach((windowArrayIndex, order) => {
			const id = String(items.length + 1).padStart(4, "0")
			const win = file.windows[windowArrayIndex]
			const item: MergeWorkItem = {
				id,
				path: file.rel,
				windowIndex: order + 1,
				windowCount: file.conflictIndices.length,
				base: win.base,
				local: win.local,
				theirs: win.theirs,
			}
			items.push(item)
			placements.set(id, { file, windowArrayIndex })
		})
	}

	const maxItems = options.maxItems ?? MAX_WORKBENCH_ITEMS
	if (items.length === 0) {
		// 一个冲突窗口都没有：用户全拒绝、全部一侧改动、或全部一眼定论。
		// **绝不能开工**——否则会给用户弹一个「本轮要处理 0 个冲突窗口」的空对话。
		result.notes = notes.length > 0 ? notes : undefined
		finalizeGroups(result, decided, plan)
		return result
	}
	if (items.length > maxItems) {
		notes.push(`这次有 ${items.length} 个冲突窗口，一次对话处理不了（上限 ${maxItems}），全部保留你的版本。`)
		for (const file of pending) {
			keepLocal(file.rel, [{ code: "model-failed", detail: "冲突窗口太多，这次没走 AI 合并" }])
		}
		result.notes = notes
		finalizeGroups(result, decided, plan)
		return result
	}

	await materializeWorkbench(layout, items, options.root)
	options.onProgress?.({ phase: "conversation", done: 0, total: items.length })

	// ── 跑对话（可多轮返工） ──
	const maxAttempts = Math.max(1, options.maxAttempts ?? 2)
	let collected: CollectedItem[] = []
	let lastOutcome: WorkbenchRunOutcome | null = null
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const prompt =
			attempt === 1
				? buildWorkbenchPrompt(layout, items, options.root)
				: buildWorkbenchFixPrompt(
						layout,
						collected.filter((c) => !c.ok),
					)
		const outcome = await options.runTask(prompt, layout)
		lastOutcome = outcome
		if (outcome.status !== "completed") {
			notes.push(`对话没能跑完：${outcome.detail}`)
			break
		}
		if (outcome.unexpected.length > 0) {
			notes.push(
				`注意：这次对话动了 ${outcome.unexpected.length} 个工作台之外的文件（${outcome.unexpected
					.slice(0, 3)
					.map((c) => c.path)
					.join("、")}${outcome.unexpected.length > 3 ? " 等" : ""}）。这些改动没有被采用。`,
			)
		}
		options.onProgress?.({ phase: "collect" })
		collected = await collectWorkbench(layout, items)
		if (collected.every((c) => c.ok)) {
			break
		}
		const failed = collected.filter((c) => !c.ok)
		notes.push(`第 ${attempt} 轮有 ${failed.length} 个冲突窗口没通过校验。`)
		if (attempt < maxAttempts) {
			// 把 feedback 挂到工单上并刷新 items/，下一轮 AI 重读时能看到上次错在哪
			for (const c of failed) {
				c.item.feedback = c.issues
			}
			await writeFixNote(layout, failed)
			await writeItemFiles(layout, items, options.root)
		}
	}
	void lastOutcome

	const collectedById = new Map(collected.map((c) => [c.item.id, c]))
	if (collected.length > 0) {
		const tally = summarizeCollected(collected)
		notes.push(`工作台共 ${collected.length} 个冲突窗口：${tally.ok} 个通过校验、${tally.failed} 个没通过。`)
	}

	// ── 组装 + 整份校验 ──
	for (const file of pending) {
		const resolved = new Map<number, string[]>()
		for (const [id, placement] of placements) {
			if (placement.file !== file) {
				continue
			}
			const c = collectedById.get(id)
			if (c?.ok && c.text !== null) {
				resolved.set(placement.windowArrayIndex, c.text.split("\n"))
			}
		}
		const missing = file.conflictIndices.filter((i) => !resolved.has(i)).length
		if (missing > 0) {
			// Z4 零悬空：有一个窗口没成，整份文件就保留本地，绝不写半成品
			keepLocal(file.rel, [
				{ code: "model-failed", detail: `这个文件有 ${missing} 个冲突窗口没能自动合并，已保留你的版本` },
			])
			continue
		}
		const text = assemble(file.baseLines, file.windows, resolved)
		const v = validateMerge({
			path: file.rel,
			base: file.base,
			local: file.local,
			theirs: file.theirs,
			merged: text,
			scope: "file",
		})
		if (!v.ok) {
			keepLocal(file.rel, v.issues)
			continue
		}
		accept(file.rel, encodeText(text, file.encoding))
	}

	result.notes = notes.length > 0 ? notes : undefined
	finalizeGroups(result, decided, plan)
	return result
}

/** 按 plan 条目顺序输出稳定的 files 列表，并回填每组合并/保留计数。 */
function finalizeGroups(result: ResolveConflictsResult, decided: Map<RelPath, ResolveFileResult>, plan: UpdatePlan): void {
	for (const entry of plan.entries) {
		const file = decided.get(entry.path)
		if (file) {
			result.files.push(file)
		}
	}
	for (const group of result.groups) {
		for (const rel of group.paths) {
			if (decided.get(rel)?.decision === "merged") {
				group.merged++
			} else {
				group.kept++
			}
		}
	}
}

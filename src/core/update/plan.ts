/**
 * eratw 一键更新 —— 判定表与冲突分组。
 *
 * 这是整个功能的唯一真值：**纯函数、无 IO、无 vscode**，可以脱离插件单测。
 *
 * 两种模式：
 * - incremental：有基线（state 里上次应用的上游快照），走标准三方比对（10 种组合）。
 * - first-sync：无基线，靠 `detectBatches` 的 mtime 批量识别代替 base（5 种组合）。
 *
 * 判定表与批量识别的设计记录见 shared-trae `workspaces/era-harness/documents/开发计划-2026-10-20.md`；
 * 闸门判据（G2/G3/G6/G7）正本在 `knowledge/eratw/import-merge-gates.md`。
 */

import { collectChangedLabels, extractDefinedLabels, type GateInputs, runContentGates } from "./gates"
import { findOrphanedCallers, type LabelIndex } from "./labels"
import { isProtectedPath } from "./manifest"
import type {
	BaselineCheck,
	ConflictGroup,
	GateFinding,
	LocalScan,
	PlanEntry,
	PlanReason,
	PlanWarning,
	RelPath,
	UpdatePlan,
	UpstreamSnapshot,
} from "./types"
import type { NowVersions } from "./version"
import { versionBumpNotice } from "./version"

/** 口上目录标记（与 `src/core/identity/scope.ts` 的 PERSONA_DIR_MARKER 保持一致） */
const PERSONA_ROOT = "口上・メッセージ関連/個人口上/"

/**
 * 取角色目录名。`ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/因幡帝海外版/x.ERB`
 * → `053 Tewi [てゐ]`。不在口上目录内返回 null（= 本体侧，逐文件询问）。
 */
export function personaKeyOf(rel: RelPath): string | null {
	const i = rel.indexOf(PERSONA_ROOT)
	if (i < 0) {
		return null
	}
	const rest = rel.slice(i + PERSONA_ROOT.length)
	const slash = rest.indexOf("/")
	if (slash <= 0) {
		return null
	}
	return rest.slice(0, slash)
}

/**
 * 首次同步策略：
 * - `bulk`（默认）：mtime 在批量内的判为上游来源，可覆盖；批量外的一律保留并询问。
 * - `add-only`：批量识别不可信、且用户选了"只加新文件别的都不动"时的保守策略。
 */
export type FirstSyncPolicy = "bulk" | "add-only"

/**
 * 比对不可信时的一次性策略（由用户在确认前选定，见 `service.ts#onBaselineUntrusted`）：
 * - `ask`（默认）：照常逐组询问
 * - `keep-all`：冲突一律保留本地（只做能确定的替换/新增/删除）
 * - `take-theirs`：冲突一律用社区版覆盖（上游删掉的跟着删）
 */
export type ConflictPolicy = "ask" | "keep-all" | "take-theirs"

/** 判定用的最小信息：raw blob id + 可选的规范形 blob id */
interface Side {
	sha1: string
	canonBlobSha1?: string
}

/**
 * 「内容相同」的唯一判据：**任何一侧的 blob id 与另一侧的任何 blob id 相等**。
 *
 * 两个 id 都是 git blob id（`sha1("blob " + 长度 + "\0" + 内容)`），只是内容口径不同
 * （原文 vs 规范形），所以可以交叉比——这正是老记录能继续用的原因：
 *
 * - 新记录 × 新记录：`canonBlobSha1` 对 `canonBlobSha1`，换行/BOM 差异不算改动；
 * - 新记录 × 3.92.1 的老记录：老记录只有 raw `sha1`（当时那份文件的字节）。
 *   拿本地的 `canonBlobSha1` 去比它，就能认出「只差换行/BOM 的同一份内容」；
 * - 老记录 × 老记录：还是纯字节，跟以前一样（无法更好，也没有更坏）。
 *
 * ⛔ 不要在这里加「按大小/按行数接近就认为相同」之类的模糊判据：那会把真的改动
 * 一起抹掉，比误报「你改过」危险得多（用户会以为自己的改动被保住了）。
 */
function same(a: Side | null | undefined, b: Side | null | undefined): boolean {
	if (!a || !b) {
		return false
	}
	if (a.sha1 === b.sha1) {
		return true
	}
	const aBlob = a.canonBlobSha1
	const bBlob = b.canonBlobSha1
	if (aBlob !== undefined && bBlob !== undefined && aBlob === bBlob) {
		return true
	}
	// 跨口径：一边只有 raw（老记录），另一边有规范形
	if (aBlob !== undefined && aBlob === b.sha1) {
		return true
	}
	return bBlob !== undefined && bBlob === a.sha1
}

/**
 * 基线可信度：上游没动过的文件里，本地与基线一致的比例。
 *
 * 真人手改不会超过全树 15%（13k 文件改 2000 个以上不成立，口上作者通常几十个），
 * 低于阈值只可能是基线指错了版本/来源，或 base 的路径前缀没剥净。
 * 样本不足 1000 时不下结论（`unknown`），避免小工程被误伤。
 */
export function checkBaseline(base: Map<RelPath, Side>, local: LocalScan, theirs: UpstreamSnapshot): BaselineCheck {
	const total = theirs.files.size
	let overlap = 0
	for (const path of theirs.files.keys()) {
		if (base.has(path)) {
			overlap++
		}
	}
	const coverage = total > 0 ? overlap / total : 0

	let sample = 0
	let agree = 0
	for (const [path, theirsFile] of theirs.files) {
		const baseFile = base.get(path)
		const localFile = local.files.get(path)
		if (!baseFile || !localFile) {
			continue
		}
		// 上游改过的文件不能用来判基线：本地与 base 不同是正常的
		if (!same(baseFile, theirsFile)) {
			continue
		}
		sample++
		if (same(localFile, baseFile)) {
			agree++
		}
	}
	const agreement = sample > 0 ? agree / sample : 0

	if (total >= 1000 && coverage < 0.5) {
		return { level: "suspect", sample, agreement, coverage }
	}
	if (sample < 1000) {
		return { level: "unknown", sample, agreement, coverage }
	}
	return { level: agreement < 0.85 ? "suspect" : "ok", sample, agreement, coverage }
}

export interface BuildPlanInput {
	/** 上次应用的上游快照；null = 首次同步 */
	base: Map<RelPath, { sha1: string; canonBlobSha1?: string }> | null
	local: LocalScan
	theirs: UpstreamSnapshot
	firstSyncPolicy?: FirstSyncPolicy
	/**
	 * 比对不可信时的一次性策略。默认 `ask`（逐组询问）；
	 * `keep-all` / `take-theirs` 把冲突批量改成保留/覆盖，不再产生任何询问。
	 */
	conflictPolicy?: ConflictPolicy
	/**
	 * 改动脚本文件的内容（过闸门用）。键 = 会改动的文件（write/conflict 的 .ERB/.ERH）。
	 * 不传则不跑内容闸门（plan.gateFindings 为 undefined）。
	 */
	gateContents?: Map<RelPath, { local: string | null; theirs: string | null }>
	/** 因超出扫描上限而未进 gateContents 的脚本文件数 */
	gateSkipped?: number
	/**
	 * 闸门的可选输入。没给的那一门**如实不跑**（⛔ 不拿通用串兜底＝制造误报）：
	 * - bugPatterns：G1 的既知 bug 串清单（工程自己的历史，模块内置不了）
	 * - fsynKeys：G5 的 FSYN 键表；literalKeys：G8 的既有键集（G8 的字形撞名不需要键表）
	 */
	gateInputs?: GateInputs
	/**
	 * G4 全树标签索引（`manifest.ts#scanLabels` 的产物）。与 gateContents 同时传
	 * 才会跑 G4（被删标签的改动集外调用方检索）。
	 */
	labelIndex?: LabelIndex
	/**
	 * 两边 `NOW_VERSION`（存档迁移时机判据用）。任一读不到 ⇒ 该判据如实不报，
	 * ⛔ 把「读不到」当成「没 bump」。
	 */
	versions?: NowVersions
}

function topSegment(rel: RelPath): string {
	const i = rel.indexOf("/")
	return i < 0 ? rel : rel.slice(0, i)
}

export function buildPlan(input: BuildPlanInput): UpdatePlan {
	const { base, local, theirs } = input
	const policy: FirstSyncPolicy = input.firstSyncPolicy ?? "bulk"
	const conflictPolicy: ConflictPolicy = input.conflictPolicy ?? "ask"
	const mode: UpdatePlan["mode"] = base ? "incremental" : "first-sync"

	const entries: PlanEntry[] = []
	const warnings: PlanWarning[] = []
	let unchanged = 0

	/**
	 * 冲突条目的唯一出口：按一次性策略改写。
	 * `take-theirs` 没有上游内容（上游删了）时跟着删；其余一律覆盖。
	 */
	const pushConflict = (entry: PlanEntry): void => {
		if (conflictPolicy === "keep-all") {
			entries.push({ ...entry, action: "keep", reason: "bulk-keep-local" })
			return
		}
		if (conflictPolicy === "take-theirs") {
			entries.push(
				entry.theirsSha1
					? { ...entry, action: "write", reason: "bulk-take-theirs" }
					: { ...entry, action: "delete", reason: "upstream-delete" },
			)
			return
		}
		entries.push(entry)
	}

	// 大小写不敏感兜底：git 区分大小写，Windows 不区分；上游改名大小写时不该被当成"新增+本地独有"
	const localByLower = new Map<string, RelPath>()
	for (const rel of local.files.keys()) {
		localByLower.set(rel.toLowerCase(), rel)
	}

	// 首次同步允许删除的范围：上游确实存在的顶层目录（防止把 sav/ 之类误删）
	const theirsRoots = new Set<string>()
	for (const rel of theirs.files.keys()) {
		theirsRoots.add(topSegment(rel))
	}
	const canDelete = (rel: RelPath): boolean => theirsRoots.size > 0 && theirsRoots.has(topSegment(rel))

	const consumed = new Set<RelPath>()

	for (const [tPath, tFile] of theirs.files) {
		const lPath = local.files.has(tPath) ? tPath : localByLower.get(tPath.toLowerCase())
		const lFile = lPath ? local.files.get(lPath) : undefined
		if (lPath) {
			consumed.add(lPath)
		}

		if (!lFile) {
			// 上游有、本地没有
			const b = base?.get(tPath)
			if (same(b, tFile)) {
				// 本地删了、上游没动 → 尊重本地删除
				entries.push({ path: tPath, action: "keep", reason: "local-deleted", theirsSha1: tFile.sha1 })
			} else {
				entries.push({ path: tPath, action: "write", reason: "upstream-add", theirsSha1: tFile.sha1 })
			}
			continue
		}

		// 内容相同（允许只差换行/BOM）→ 无事可做，一个字节都不写
		if (same(lFile, tFile)) {
			unchanged++
			continue
		}

		if (base) {
			const b = base.get(tPath) ?? (lPath ? base.get(lPath) : undefined)
			if (!b) {
				// 上游有、本地也有，但基线里没有 → 用户自建了同名文件
				pushConflict({
					path: tPath,
					action: "conflict",
					reason: "add-vs-local",
					localSha1: lFile.sha1,
					theirsSha1: tFile.sha1,
				})
			} else if (same(b, lFile)) {
				entries.push({
					path: tPath,
					action: "write",
					reason: "clean-update",
					localSha1: lFile.sha1,
					theirsSha1: tFile.sha1,
					baseSha1: b.sha1,
				})
			} else if (same(b, tFile)) {
				entries.push({
					path: tPath,
					action: "keep",
					reason: "local-change",
					localSha1: lFile.sha1,
					theirsSha1: tFile.sha1,
					baseSha1: b.sha1,
				})
			} else {
				pushConflict({
					path: tPath,
					action: "conflict",
					reason: "both-changed",
					localSha1: lFile.sha1,
					theirsSha1: tFile.sha1,
					baseSha1: b.sha1,
				})
			}
			continue
		}

		// 首次同步：没有基线，靠 mtime 批量识别
		if (policy === "add-only") {
			entries.push({
				path: tPath,
				action: "keep",
				reason: "first-sync-human",
				localSha1: lFile.sha1,
				theirsSha1: tFile.sha1,
			})
			continue
		}
		const bulkKey = lPath ?? tPath
		if (local.batches.bulkPaths.has(bulkKey)) {
			entries.push({
				path: tPath,
				action: "write",
				reason: "first-sync-bulk",
				localSha1: lFile.sha1,
				theirsSha1: tFile.sha1,
			})
		} else {
			pushConflict({
				path: tPath,
				action: "conflict",
				reason: "first-sync-human",
				localSha1: lFile.sha1,
				theirsSha1: tFile.sha1,
			})
		}
	}

	// 本地有、上游没有
	for (const [rel, fp] of local.files) {
		if (consumed.has(rel) || isProtectedPath(rel)) {
			continue
		}
		const b = base?.get(rel)
		if (b) {
			if (same(b, fp)) {
				entries.push({ path: rel, action: "delete", reason: "upstream-delete", localSha1: fp.sha1, baseSha1: b.sha1 })
			} else {
				pushConflict({
					path: rel,
					action: "conflict",
					reason: "delete-vs-local-change",
					localSha1: fp.sha1,
					baseSha1: b.sha1,
				})
			}
			continue
		}
		// 无基线：只有"批量内 + 上游确有该顶层目录"才敢删
		if (policy === "bulk" && local.batches.bulkPaths.has(rel) && canDelete(rel)) {
			entries.push({ path: rel, action: "delete", reason: "upstream-delete", localSha1: fp.sha1 })
		} else {
			entries.push({ path: rel, action: "keep", reason: "local-only", localSha1: fp.sha1 })
		}
	}

	entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

	if (mode === "first-sync") {
		warnings.push("first-sync")
		if (!local.batches.reliable) {
			warnings.push("first-sync-unreliable")
		}
	}
	if (theirsRoots.size === 0) {
		warnings.push("no-deletable-root")
	}

	// 基线可信度：只在增量模式（有 base）下判断；不可信时上层停止逐文件询问
	let baseline: BaselineCheck | undefined
	if (base) {
		baseline = checkBaseline(base, local, theirs)
	}

	const keepEntries = entries.filter((e) => e.action === "keep")
	const keepByReason: Partial<Record<PlanReason, number>> = {}
	for (const entry of keepEntries) {
		keepByReason[entry.reason] = (keepByReason[entry.reason] ?? 0) + 1
	}

	// 只有「真的产生了冲突」才值得为基线不可信打扰用户：
	// 重手改但上游没动的文件本来就静默保留，弹窗只会吓人（也做不了什么）。
	if (baseline?.level === "suspect" && entries.some((entry) => entry.action === "conflict")) {
		warnings.push("baseline-untrusted")
	}

	// 内容闸门（G2/G3/G6/G7）：只对调用方喂进来的改动脚本跑，纯函数、无 IO
	let gateFindings: GateFinding[] | undefined
	if (input.gateContents && input.gateContents.size > 0) {
		const changedLabels = collectChangedLabels(
			[...input.gateContents].map(([path, texts]) => ({ path, text: texts.theirs ?? texts.local })),
		)
		gateFindings = []
		for (const [rel, texts] of input.gateContents) {
			gateFindings.push(...runContentGates(rel, texts, changedLabels, input.gateInputs))
		}

		// G4：被本次更新删掉的全局标签，改动集之外还有没有调用方（需全树索引）
		if (input.labelIndex) {
			const removedLabels = new Set<string>()
			for (const [, texts] of input.gateContents) {
				if (!texts.local || !texts.theirs) {
					continue
				}
				const theirsDefs = extractDefinedLabels(texts.theirs)
				for (const name of extractDefinedLabels(texts.local).keys()) {
					if (!theirsDefs.has(name)) {
						removedLabels.add(name)
					}
				}
			}
			if (removedLabels.size > 0) {
				gateFindings.push(...findOrphanedCallers(input.labelIndex, removedLabels, new Set(input.gateContents.keys())))
			}
		}
	}

	// 存档迁移时机（第九问，G1–G8 之外）：版本号没变却动了剧本/数据 ⇒ 旧存档不会自动迁移
	const versionNotice = versionBumpNotice(entries, input.versions)

	return {
		mode,
		entries,
		groups: groupConflicts(entries),
		summary: {
			write: entries.filter((e) => e.action === "write").length,
			delete: entries.filter((e) => e.action === "delete").length,
			keep: keepEntries.length,
			conflict: entries.filter((e) => e.action === "conflict").length,
			unchanged,
			keepByReason,
		},
		warnings,
		...(baseline ? { baseline } : {}),
		...(gateFindings ? { gateFindings } : {}),
		...(input.gateSkipped ? { gatesSkipped: input.gateSkipped } : {}),
		...(versionNotice ? { versionNotice } : {}),
	}
}

/**
 * 冲突分组：口上按角色整包问，本体侧逐文件问。
 * 角色目录含子目录，必须用 `<角色目录>/**` 归并 —— 实测 `053 Tewi [てゐ]/因幡帝海外版/` 就是子目录。
 */
export function groupConflicts(entries: PlanEntry[]): ConflictGroup[] {
	const personaGroups = new Map<string, RelPath[]>()
	const fileGroups: ConflictGroup[] = []

	for (const entry of entries) {
		if (entry.action !== "conflict") {
			continue
		}
		const persona = personaKeyOf(entry.path)
		if (persona) {
			const list = personaGroups.get(persona)
			if (list) {
				list.push(entry.path)
			} else {
				personaGroups.set(persona, [entry.path])
			}
		} else {
			fileGroups.push({ kind: "file", key: entry.path, label: entry.path, paths: [entry.path] })
		}
	}

	const groups: ConflictGroup[] = []
	for (const [key, paths] of [...personaGroups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
		paths.sort()
		groups.push({ kind: "persona", key, label: key, paths })
	}
	fileGroups.sort((a, b) => (a.key < b.key ? -1 : 1))
	return [...groups, ...fileGroups]
}

/**
 * 计划指纹：判断「用户点过确认的计划」和「实际要执行的计划」是不是同一份（U3）。
 *
 * 二次 runUpdate 会重新联网、重新扫盘、重建计划；期间社区推了新版本或本地文件
 * 被动过，写盘的文件集合就可能和用户确认过的不同。只取**影响写盘内容**的字段：
 * 条目的路径/动作/原因/目标内容指纹。顺序不敏感（重建计划的条目顺序理论上稳定，
 * 但这里不赌）。闸门警告、迁移提醒等纯展示字段不参与。
 */
export function planFingerprint(plan: UpdatePlan): string {
	const entries = plan.entries.map((e) => `${e.action}:${e.path}:${e.reason}:${e.theirsSha1 ?? ""}`).sort()
	return JSON.stringify({ mode: plan.mode, summary: plan.summary, entries })
}

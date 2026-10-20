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

import { collectChangedLabels, runContentGates } from "./gates"
import { isProtectedPath } from "./manifest"
import type {
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

export interface BuildPlanInput {
	/** 上次应用的上游快照；null = 首次同步 */
	base: Map<RelPath, { sha1: string }> | null
	local: LocalScan
	theirs: UpstreamSnapshot
	firstSyncPolicy?: FirstSyncPolicy
	/**
	 * 改动脚本文件的内容（过闸门用）。键 = 会改动的文件（write/conflict 的 .ERB/.ERH）。
	 * 不传则不跑内容闸门（plan.gateFindings 为 undefined）。
	 */
	gateContents?: Map<RelPath, { local: string | null; theirs: string | null }>
	/** 因超出扫描上限而未进 gateContents 的脚本文件数 */
	gateSkipped?: number
}

function topSegment(rel: RelPath): string {
	const i = rel.indexOf("/")
	return i < 0 ? rel : rel.slice(0, i)
}

export function buildPlan(input: BuildPlanInput): UpdatePlan {
	const { base, local, theirs } = input
	const policy: FirstSyncPolicy = input.firstSyncPolicy ?? "bulk"
	const mode: UpdatePlan["mode"] = base ? "incremental" : "first-sync"

	const entries: PlanEntry[] = []
	const warnings: PlanWarning[] = []
	let unchanged = 0

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
			if (b && b.sha1 === tFile.sha1) {
				// 本地删了、上游没动 → 尊重本地删除
				entries.push({ path: tPath, action: "keep", reason: "local-deleted", theirsSha1: tFile.sha1 })
			} else {
				entries.push({ path: tPath, action: "write", reason: "upstream-add", theirsSha1: tFile.sha1 })
			}
			continue
		}

		if (lFile.sha1 === tFile.sha1) {
			unchanged++
			continue
		}

		if (base) {
			const b = base.get(tPath) ?? (lPath ? base.get(lPath) : undefined)
			if (!b) {
				// 上游有、本地也有，但基线里没有 → 用户自建了同名文件
				entries.push({
					path: tPath,
					action: "conflict",
					reason: "add-vs-local",
					localSha1: lFile.sha1,
					theirsSha1: tFile.sha1,
				})
			} else if (b.sha1 === lFile.sha1) {
				entries.push({
					path: tPath,
					action: "write",
					reason: "clean-update",
					localSha1: lFile.sha1,
					theirsSha1: tFile.sha1,
					baseSha1: b.sha1,
				})
			} else if (b.sha1 === tFile.sha1) {
				entries.push({
					path: tPath,
					action: "keep",
					reason: "local-change",
					localSha1: lFile.sha1,
					theirsSha1: tFile.sha1,
					baseSha1: b.sha1,
				})
			} else {
				entries.push({
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
			entries.push({
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
			if (b.sha1 === fp.sha1) {
				entries.push({ path: rel, action: "delete", reason: "upstream-delete", localSha1: fp.sha1, baseSha1: b.sha1 })
			} else {
				entries.push({
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

	const keepEntries = entries.filter((e) => e.action === "keep")
	const keepByReason: Partial<Record<PlanReason, number>> = {}
	for (const entry of keepEntries) {
		keepByReason[entry.reason] = (keepByReason[entry.reason] ?? 0) + 1
	}

	// 内容闸门（G2/G3/G6/G7）：只对调用方喂进来的改动脚本跑，纯函数、无 IO
	let gateFindings: GateFinding[] | undefined
	if (input.gateContents && input.gateContents.size > 0) {
		const changedLabels = collectChangedLabels(
			[...input.gateContents].map(([path, texts]) => ({ path, text: texts.theirs ?? texts.local })),
		)
		gateFindings = []
		for (const [rel, texts] of input.gateContents) {
			gateFindings.push(...runContentGates(rel, texts, changedLabels))
		}
	}

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
		...(gateFindings ? { gateFindings } : {}),
		...(input.gateSkipped ? { gatesSkipped: input.gateSkipped } : {}),
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

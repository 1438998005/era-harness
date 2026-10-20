/**
 * eratw 一键更新 —— 编排层：把 7 步串成一次可观测的流程。
 *
 * 这一层**不做判定、不碰文件细节**，只负责顺序、状态与事件：
 *   检查 → 取快照 → 扫本地 → 算计划 → 确认 → 执行 → 自检 → 落状态
 *
 * 所有危险动作都在 `apply.ts` 里，所有判定都在 `plan.ts` 里，这里只做粘合，
 * 所以它可以被 UI、斜杠命令、AI 工具三种入口共用。
 */

import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { createGunzip } from "node:zlib"
import { type ApplyReport, applyPlan, applyPlanFromTar } from "./apply"
import { readNowVersion } from "./discover"
import { decodeLikeEngine } from "./gates"
import {
	cachePath,
	gitBlobSha1,
	hashLocalFile,
	readState,
	scanLocal,
	stateToBase,
	toFsPath,
	winLongPath,
	writeState,
} from "./manifest"
import type { MergeAsk } from "./merge"
import { type ResolveConflictsResult, resolveConflicts } from "./mergeResolve"
import { buildPlan } from "./plan"
import {
	createGitLabSource,
	DEFAULT_BRANCH,
	DEFAULT_PROJECT_URL,
	type GitLabSource,
	parseProjectUrl,
	type RepoHead,
	snapshotFromArchiveFile,
	snapshotFromDir,
} from "./source"
import { extractTar } from "./tarball"
import type { ConflictGroup, RelPath, UpdatePlan, UpdateState, UpstreamSnapshot } from "./types"

export type UpdateSourceInput =
	| { kind: "gitlab"; projectUrl?: string; branch?: string; token?: string }
	| { kind: "archive"; path: string }
	| { kind: "dir"; path: string }

export type UpdateStage = "check" | "download" | "snapshot" | "scan" | "plan" | "merge" | "apply" | "verify"

export interface UpdateEvent {
	stage: UpdateStage
	message?: string
	progress?: { done: number; total: number }
	/** 仅 `apply` 阶段有意义：这一步是在写文件还是在删文件 */
	action?: "write" | "delete"
}

export interface VerifyResult {
	ok: boolean
	checked: number
	mismatches: Array<{ path: RelPath; expected: string; actual: string | null }>
	nowVersion: string | null
}

/** 传给自定义冲突解决的读取器。两条路径共用，确保读到完全相同的内容来源。 */
export interface MergeReaders {
	readLocal: (rel: RelPath) => Promise<Buffer | null>
	readTheirs: (rel: RelPath) => Promise<Buffer | null>
	readBase: (rel: RelPath) => Promise<Buffer | null>
	baseAvailable: boolean
}

export interface RunUpdateOptions {
	root: string
	source: UpdateSourceInput
	dryRun?: boolean
	/** 返回 false 表示用户取消。**没有这个回调时一律不执行**（安全闸门） */
	confirm?: (plan: UpdatePlan) => Promise<boolean> | boolean
	/**
	 * 「你改过，社区也改了」的处理方式。不传则冲突文件一律原样保留（最安全）。
	 * `shouldMerge` 逐组询问（口上整包问、本体逐文件问），返回 true 才尝试 AI 合并。
	 */
	merge?: {
		ask: MergeAsk
		shouldMerge?: (group: ConflictGroup) => Promise<boolean> | boolean
		maxAttempts?: number
	}
	/**
	 * 自定义冲突解决。传了就**不再**用内置的 `resolveConflicts`——对话工作台路径
	 * （`resolveConflictsViaWorkbench`）靠它把合并塞进一个用户可见的对话里。
	 *
	 * `readers` 由本模块构造后传入：两条路径必须读到**完全相同**的内容来源，
	 * 否则会出现「静默合并能合、工作台合不了」的分裂。`baseAvailable` 同理。
	 */
	resolveConflicts?: (plan: UpdatePlan, readers: MergeReaders) => Promise<ResolveConflictsResult>
	onEvent?: (event: UpdateEvent) => void
}

export interface RunUpdateResult {
	/**
	 * - `up-to-date`：真的没有要干的事
	 * - `planned`：只算了计划没执行（`dryRun`）。**有活要干时用它，不要用 `up-to-date`**
	 * - `cancelled`：用户取消 / 缺少确认回调
	 * - `nothing-to-do`：计划里的冲突全部选择保留本地，磁盘没动
	 * - `applied` / `failed`：执行过
	 */
	status: "up-to-date" | "planned" | "cancelled" | "nothing-to-do" | "applied" | "failed"
	plan: UpdatePlan
	head?: RepoHead
	report?: ApplyReport
	verify?: VerifyResult
	state?: UpdateState
	resolve?: ResolveConflictsResult
	error?: string
}

interface Prepared {
	snapshot: UpstreamSnapshot
	head?: RepoHead
	archivePath?: string
	dirPath?: string
	/** 只有 gitlab 源才有：用于按需取「上次社区版」的单个文件内容 */
	client?: GitLabSource
	label: string
	projectUrl: string
	branch: string
}

function emit(opts: RunUpdateOptions, event: UpdateEvent): void {
	opts.onEvent?.(event)
}

async function prepare(opts: RunUpdateOptions): Promise<Prepared> {
	const source = opts.source

	if (source.kind === "dir") {
		emit(opts, { stage: "snapshot", message: "读取本地文件夹清单" })
		const snapshot = await snapshotFromDir(source.path)
		return { snapshot, dirPath: source.path, label: "localdir", projectUrl: "", branch: "" }
	}

	if (source.kind === "archive") {
		emit(opts, { stage: "snapshot", message: "读取压缩包清单" })
		const snapshot = await snapshotFromArchiveFile(source.path, path.basename(source.path), (files, bytes) => {
			emit(opts, { stage: "snapshot", progress: { done: files, total: bytes } })
		})
		return { snapshot, archivePath: source.path, label: "localarchive", projectUrl: "", branch: "" }
	}

	const project = parseProjectUrl(source.projectUrl ?? DEFAULT_PROJECT_URL, source.branch ?? DEFAULT_BRANCH, source.token)
	const client = createGitLabSource(project)

	emit(opts, { stage: "check", message: "检查社区版本" })
	const head = await client.head()

	const cache = cachePath(opts.root, `${head.commit}.tar.gz`)
	const exists = await fs
		.stat(winLongPath(cache))
		.then(() => true)
		.catch(() => false)

	if (!exists) {
		emit(opts, { stage: "download", message: "下载社区版本" })
		await client.downloadArchive(cache, head.commit, (received, total) => {
			emit(opts, { stage: "download", progress: { done: received, total } })
		})
	}

	emit(opts, { stage: "snapshot", message: "读取压缩包清单" })
	const snapshot = await snapshotFromArchiveFile(cache, `${project.branch}@${head.commit.slice(0, 8)}`, (files, bytes) => {
		emit(opts, { stage: "snapshot", progress: { done: files, total: bytes } })
	})

	const label = `${project.branch}${head.nowVersion ?? ""}`
	return {
		snapshot,
		head,
		archivePath: cache,
		client,
		label,
		projectUrl: `${project.host}/${project.path}`,
		branch: project.branch,
	}
}

/**
 * 从归档里按需取出少量文件的字节（用于 AI 合并的「上游版本」）。
 * 归档是顺序流，取不到就取不到，所以一次性把需要的都捞出来。
 */
async function readArchiveEntries(archivePath: string, wanted: Set<RelPath>): Promise<Map<RelPath, Buffer>> {
	const out = new Map<RelPath, Buffer>()
	if (wanted.size === 0) {
		return out
	}
	const gunzip = createGunzip()
	createReadStream(winLongPath(archivePath)).pipe(gunzip)
	await extractTar(gunzip, {
		filter: (entry) => wanted.has(entry.path),
		onFile: (entry, chunk) => {
			const previous = out.get(entry.path)
			out.set(entry.path, previous ? Buffer.concat([previous, chunk]) : Buffer.from(chunk))
		},
	})
	return out
}

/** 闸门扫描上限：一次更新改动几千文件时，只对前 N 个脚本过内容闸门（防呆） */
const GATE_SCAN_CAP = 300
const GATE_FILE_RE = /\.(ERB|ERH)$/i

/**
 * 收集改动脚本文件的内容供闸门使用。
 * - 只取 write/conflict 的 .ERB/.ERH（删除文件没有"改后"内容，新增文件没有旧版）
 * - 上限 GATE_SCAN_CAP，超出记 skipped（finding 因此不完整，UI 须标注）
 * - 解码按引擎口径（BOM/UTF-8/CP932），闸门只需要对齐行号与标签
 */
async function collectGateContents(
	opts: RunUpdateOptions,
	prepared: Prepared,
	plan: UpdatePlan,
): Promise<{ contents: Map<RelPath, { local: string | null; theirs: string | null }> | undefined; skipped: number }> {
	const candidates = plan.entries.filter(
		(entry) => (entry.action === "write" || entry.action === "conflict") && GATE_FILE_RE.test(entry.path),
	)
	if (candidates.length === 0) {
		return { contents: undefined, skipped: 0 }
	}
	const skipped = Math.max(0, candidates.length - GATE_SCAN_CAP)
	const chosen = candidates.slice(0, GATE_SCAN_CAP)

	const wanted = new Set(chosen.map((entry) => entry.path))
	const theirsBuf = prepared.archivePath ? await readArchiveEntries(prepared.archivePath, wanted) : undefined

	const contents = new Map<RelPath, { local: string | null; theirs: string | null }>()
	for (const entry of chosen) {
		const local = await fs.readFile(toFsPath(opts.root, entry.path)).catch(() => null)
		let theirs: Buffer | null = null
		if (prepared.dirPath) {
			theirs = await fs.readFile(toFsPath(prepared.dirPath, entry.path)).catch(() => null)
		} else {
			theirs = theirsBuf?.get(entry.path) ?? null
		}
		contents.set(entry.path, {
			local: local ? decodeLikeEngine(local) : null,
			theirs: theirs ? decodeLikeEngine(theirs) : null,
		})
	}
	return { contents, skipped }
}

/** 合并成功的冲突条目提升为 write，其余保持 conflict（= 磁盘上什么都不动） */
function promoteMerged(plan: UpdatePlan, merged: Set<RelPath>): UpdatePlan {
	if (merged.size === 0) {
		return plan
	}
	const entries = plan.entries.map((entry) =>
		entry.action === "conflict" && merged.has(entry.path) ? { ...entry, action: "write" as const } : entry,
	)
	return {
		...plan,
		entries,
		summary: {
			...plan.summary,
			write: plan.summary.write + merged.size,
			conflict: plan.summary.conflict - merged.size,
		},
	}
}

/** 自检：把计划里写过的文件重新算一遍指纹，确认真的落对了 */
export async function verifyApplied(
	root: string,
	plan: UpdatePlan,
	/** AI 合并出来的内容不在上游，期望值要用它自己的指纹 */
	overrides?: Map<RelPath, Buffer>,
): Promise<VerifyResult> {
	const mismatches: VerifyResult["mismatches"] = []
	let checked = 0
	for (const entry of plan.entries) {
		if (entry.action !== "write") {
			continue
		}
		const override = overrides?.get(entry.path)
		const expected = override ? gitBlobSha1(override) : entry.theirsSha1
		if (!expected) {
			continue
		}
		checked++
		try {
			const actual = await hashLocalFile(toFsPath(root, entry.path))
			if (actual.sha1 !== expected) {
				mismatches.push({ path: entry.path, expected, actual: actual.sha1 })
			}
		} catch {
			mismatches.push({ path: entry.path, expected, actual: null })
		}
	}
	return { ok: mismatches.length === 0, checked, mismatches, nowVersion: await readNowVersion(root) }
}

export async function runUpdate(opts: RunUpdateOptions): Promise<RunUpdateResult> {
	const prepared = await prepare(opts)

	emit(opts, { stage: "scan", message: "扫描本地文件" })
	const scan = await scanLocal(opts.root, {
		onProgress: (done, total) => emit(opts, { stage: "scan", progress: { done, total } }),
	})

	const state = await readState(opts.root)
	// 先出草案计划拿改动集（纯 sha1 层，便宜）；再按改动脚本喂内容闸门重建
	const draft = buildPlan({
		base: stateToBase(state),
		local: scan,
		theirs: prepared.snapshot,
	})
	const gateInput = await collectGateContents(opts, prepared, draft)
	let plan = buildPlan({
		base: stateToBase(state),
		local: scan,
		theirs: prepared.snapshot,
		gateContents: gateInput.contents,
		gateSkipped: gateInput.skipped,
	})

	const gateNote = plan.gateFindings && plan.gateFindings.length > 0 ? `，闸门警告 ${plan.gateFindings.length} 条` : ""
	emit(opts, {
		stage: "plan",
		message: `${plan.summary.write} 改 / ${plan.summary.delete} 删 / ${plan.summary.conflict} 待定${gateNote}`,
	})

	if (plan.summary.write + plan.summary.delete + plan.summary.conflict === 0) {
		return { status: "up-to-date", plan, head: prepared.head }
	}

	if (opts.dryRun) {
		// 有活要干但不执行。**不能返回 up-to-date** —— 调用方会误判成"已是最新"，
		// 于是更新按钮点了等于没点（这个坑在 §13.13 记过一笔）。
		return { status: "planned", plan, head: prepared.head }
	}

	if (!opts.confirm) {
		return { status: "cancelled", plan, head: prepared.head, error: "缺少用户确认回调，按安全闸门拒绝执行" }
	}
	const approved = await opts.confirm(plan)
	if (!approved) {
		return { status: "cancelled", plan, head: prepared.head }
	}

	// ── 冲突解决（可选）：用户点了「AI 辅助合并」才走这一段 ──
	let overrides: Map<RelPath, Buffer> | undefined
	let resolve: ResolveConflictsResult | undefined
	if (plan.summary.conflict > 0 && (opts.merge || opts.resolveConflicts)) {
		const conflictPaths = new Set(
			plan.entries.filter((entry) => entry.action === "conflict" && entry.theirsSha1).map((entry) => entry.path),
		)
		const theirsContent = prepared.archivePath
			? await readArchiveEntries(prepared.archivePath, conflictPaths)
			: new Map<RelPath, Buffer>()
		const baseCommit = state?.applied.commit ?? ""
		const client = prepared.client
		// 两条路径共用同一套读取器：静默合并与对话工作台必须读到**完全相同**的内容来源
		const readers = {
			readLocal: (rel: RelPath) => fs.readFile(toFsPath(opts.root, rel)).catch(() => null),
			readTheirs: (rel: RelPath) =>
				prepared.dirPath
					? fs.readFile(toFsPath(prepared.dirPath, rel)).catch(() => null)
					: Promise.resolve(theirsContent.get(rel) ?? null),
			readBase: async (rel: RelPath) => {
				if (!client || !baseCommit) {
					return null
				}
				try {
					return await client.rawFile(rel, baseCommit)
				} catch {
					return null
				}
			},
			// 没有 gitlab 源或没有基线 commit 时，「上次社区版」的内容取不到
			baseAvailable: Boolean(client && baseCommit),
		}

		emit(opts, { stage: "merge", message: "合并你改过的文件" })
		if (opts.resolveConflicts) {
			// 对话工作台：合并在一个可见的对话里进行，这里只接结果
			resolve = await opts.resolveConflicts(plan, readers)
		} else if (opts.merge) {
			resolve = await resolveConflicts({
				plan,
				...readers,
				ask: opts.merge.ask,
				shouldMerge: opts.merge.shouldMerge,
				maxAttempts: opts.merge.maxAttempts,
				onProgress: (done, total, rel) => emit(opts, { stage: "merge", progress: { done, total }, message: rel }),
			})
		} else {
			// 外层条件保证了二者必有其一，走到这里说明判断写错了
			return { status: "failed", plan, head: prepared.head, error: "内部错误：没有可用的冲突解决方式" }
		}
		overrides = resolve.overrides
		plan = promoteMerged(plan, new Set(resolve.overrides.keys()))
	}

	if (plan.summary.write + plan.summary.delete === 0) {
		// 全部冲突都被保留（用户没同意合并，或合并不了）——磁盘上什么都没变
		return { status: "nothing-to-do", plan, head: prepared.head, resolve }
	}

	emit(opts, { stage: "apply", message: "备份并写入" })
	const applyOptions = {
		root: opts.root,
		plan,
		label: prepared.label,
		stateBefore: state,
		source: { commit: prepared.head?.commit, nowVersion: prepared.head?.nowVersion ?? undefined },
		overrides,
		onProgress: (done: number, total: number, current: string, action: "write" | "delete") =>
			emit(opts, { stage: "apply", progress: { done, total }, message: current, action }),
	}

	let report: ApplyReport
	if (prepared.dirPath) {
		const dirPath = prepared.dirPath
		report = await applyPlan({
			...applyOptions,
			provide: (rel) => fs.readFile(toFsPath(dirPath, rel)),
		})
	} else if (prepared.archivePath) {
		const input = createReadStream(winLongPath(prepared.archivePath))
		const gunzip = createGunzip()
		input.pipe(gunzip)
		report = await applyPlanFromTar({ ...applyOptions, stream: gunzip })
	} else {
		return { status: "failed", plan, head: prepared.head, error: "没有可用的内容来源" }
	}

	if (!report.ok) {
		return { status: "failed", plan, head: prepared.head, report, error: report.errors[0]?.message }
	}

	emit(opts, { stage: "verify", message: "校验写入结果" })
	const verify = await verifyApplied(opts.root, plan, overrides)

	// 合并过的文件：基线仍然记上游的 hash，但标记为「玩家定制过」——
	// 下次上游再改它时，默认走 AI 合并而不是再问一遍。
	const mergedPaths = [...(resolve?.overrides.keys() ?? [])]
	const localOverrides = [...new Set([...(state?.localOverrides ?? []), ...mergedPaths])]

	const nextState: UpdateState = {
		schemaVersion: 1,
		source: { projectUrl: prepared.projectUrl, branch: prepared.branch },
		applied: {
			commit: prepared.head?.commit ?? "",
			nowVersion: verify.nowVersion ?? prepared.head?.nowVersion ?? "",
			appliedAt: new Date().toISOString(),
		},
		files: Object.fromEntries(
			[...prepared.snapshot.files].map(([rel, file]) => [rel, { sha1: file.sha1, size: file.size, mtimeMs: 0 }]),
		),
		localOverrides,
		lastBackup: report.backupDir ?? undefined,
	}
	await writeState(opts.root, nextState)

	return { status: "applied", plan, head: prepared.head, report, verify, state: nextState, resolve }
}

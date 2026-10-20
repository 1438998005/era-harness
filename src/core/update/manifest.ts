/**
 * eratw 一键更新 —— 本地清单 / 指纹 / 批量识别 / 状态文件。
 *
 * 纯 Node，不依赖 vscode。核心是三件事：
 * 1. `gitBlobSha1`：与 GitLab blob id 同构的指纹，让"以后改成增量下载"零成本。
 * 2. `scanLocal`：扫本地树并算指纹（增量优化靠 state 里的 size+mtime）。
 * 3. `detectBatches`：靠 mtime 的"整分钟批量"特征，在没有基线的首次同步里
 *    把"上游解压来的"和"人手改过的"分开（实测 5036 vs 45，设计记录见
 *    shared-trae `workspaces/era-harness/documents/开发计划-2026-10-20.md`）。
 */

import { createHash } from "node:crypto"
import type { Dirent } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { decodeLikeEngine } from "./decode"
import { buildLabelIndex, type LabelIndex } from "./labels"
import {
	type BatchDetection,
	type BatchInfo,
	CACHE_DIR,
	type FileFingerprint,
	type LocalScan,
	type RelPath,
	STATE_DIR,
	STATE_FILE,
	type UpdateState,
} from "./types"

/**
 * 更新器永远不碰的目录（本地专属）：引擎/插件自己生成的产物 + 生态级通用噪音。
 *
 * 编辑器、AI 客户端、版本控制的目录不在这里逐个列举 —— 它们全是隐藏目录，
 * 已被 {@link isLocalOnlyDir} 的通则覆盖。列举具体产品名等于把某个人的机器布局
 * 当成全体用户的标准。
 */
const LOCAL_ONLY_DIR_NAMES = new Set([
	"sav",
	"debug",
	"_备份",
	"node_modules",
	"__pycache__",
	"system volume information",
	"$recycle.bin",
])

/** 对外导出的默认值：`scanLocal` 用它算出要跳过哪些目录 */
export const DEFAULT_EXCLUDED_DIRS = [...LOCAL_ONLY_DIR_NAMES]

/**
 * 更新时整棵跳过的目录：隐藏目录（`.git` / `.vscode` / 各种客户端）＋ 本地专属名。
 * 隐藏目录一律不参与更新，宁可少写也绝不覆盖用户自己的工具配置。
 */
function isLocalOnlyDir(name: string): boolean {
	return name.startsWith(".") || LOCAL_ONLY_DIR_NAMES.has(name.toLowerCase())
}

/** 即使扫描到了也绝不写/绝不删的路径前缀（双保险，防手滑） */
const PROTECTED_PREFIXES = [".era-harness/", "_备份/", "sav/", "debug/"]

export function isProtectedPath(rel: RelPath): boolean {
	const lower = rel.toLowerCase()
	return PROTECTED_PREFIXES.some((p) => lower.startsWith(p))
}

/** 统一成相对路径：反斜杠转正斜杠 + NFC 归一（防日文文件名在跨工具时编码不一致） */
export function toRel(p: string): RelPath {
	return p.replace(/\\/g, "/").normalize("NFC")
}

/** Windows 长路径前缀（游戏里有 `ERB/口上・メッセージ関連/個人口上/…` 这类日文长名） */
export function winLongPath(absPath: string): string {
	if (process.platform !== "win32" || absPath.startsWith("\\\\?\\")) {
		return absPath
	}
	const abs = path.resolve(absPath)
	if (abs.length < 240) {
		return abs
	}
	if (abs.startsWith("\\\\")) {
		return `\\\\?\\UNC\\${abs.slice(2)}`
	}
	return `\\\\?\\${abs}`
}

/** 相对路径 → 可直接 stat/read 的绝对路径 */
export function toFsPath(root: string, rel: RelPath): string {
	return winLongPath(path.join(root, ...rel.split("/")))
}

/**
 * git blob sha1：`sha1("blob " + byteLength + "\0" + content)`。
 * 与 `git hash-object` / GitLab blob id 完全一致，用于跨来源比对。
 */
export function gitBlobSha1(content: Buffer): string {
	const header = Buffer.from(`blob ${content.length}\0`, "utf8")
	return createHash("sha1").update(header).update(content).digest("hex")
}

/** 流式计算文件指纹：大文件（resources 里的图）不整块读进内存 */
export async function hashLocalFile(absPath: string): Promise<FileFingerprint> {
	const stat = await fs.stat(winLongPath(absPath))
	const hash = createHash("sha1")
	hash.update(Buffer.from(`blob ${stat.size}\0`, "utf8"))
	const stream = await fs.open(winLongPath(absPath), "r")
	try {
		const buf = Buffer.allocUnsafe(1024 * 256)
		let pos = 0
		for (;;) {
			const { bytesRead } = await stream.read(buf, 0, buf.length, pos)
			if (bytesRead === 0) {
				break
			}
			hash.update(buf.subarray(0, bytesRead))
			pos += bytesRead
		}
	} finally {
		await stream.close()
	}
	return { sha1: hash.digest("hex"), size: stat.size, mtimeMs: stat.mtimeMs }
}

export interface BatchOptions {
	/** 绝对文件数下限，默认 50 */
	minCount?: number
	/** 占候选总数的比例下限，默认 2% */
	minRatio?: number
	/** 批量覆盖率低于此值时判定"不可信"，默认 0.5 */
	minCoverage?: number
}

/**
 * 批量识别：把 mtime 精确到分钟分桶，某个分钟的文件数达到阈值就视为"一次解压/覆盖"。
 *
 * 为什么可行（实测）：一次解压会在同一分钟写入上千个文件，而人手动改最多十几个。
 * 本地实测 5081 个 ERB/CSV 中，2711 个卡在 07-27 13:56、2325 个卡在 10-14 04:35，
 * 其余 45 个分散在 22 个不同分钟 —— 分界极其干净。
 */
export function detectBatches(files: Map<RelPath, FileFingerprint>, opts: BatchOptions = {}): BatchDetection {
	const minCount = opts.minCount ?? 50
	const minRatio = opts.minRatio ?? 0.02
	const minCoverage = opts.minCoverage ?? 0.5

	const total = files.size
	const threshold = Math.max(minCount, Math.ceil(total * minRatio))

	const buckets = new Map<number, RelPath[]>()
	for (const [rel, fp] of files) {
		const minute = Math.floor(fp.mtimeMs / 60000) * 60000
		const bucket = buckets.get(minute)
		if (bucket) {
			bucket.push(rel)
		} else {
			buckets.set(minute, [rel])
		}
	}

	const batches: BatchInfo[] = []
	const bulkPaths = new Set<RelPath>()
	for (const [minuteMs, paths] of buckets) {
		if (paths.length < threshold) {
			continue
		}
		batches.push({ minuteMs, count: paths.length, ratio: total > 0 ? paths.length / total : 0 })
		for (const p of paths) {
			bulkPaths.add(p)
		}
	}
	batches.sort((a, b) => b.count - a.count)

	const coverage = total > 0 ? bulkPaths.size / total : 0
	return {
		batches,
		bulkPaths,
		reliable: batches.length > 0 && coverage >= minCoverage,
		threshold,
		total,
	}
}

export interface ScanOptions extends BatchOptions {
	excludeDirs?: string[]
	/** 并行 hash 的文件数，默认 8（机械盘别调太高） */
	concurrency?: number
	/** 只扫这些顶层目录（默认全扫） */
	onlyRoots?: string[]
	onProgress?: (done: number, total: number) => void
}

/** 递归收集文件相对路径 */
async function collectFiles(root: string, excluded: Set<string>, onlyRoots?: Set<string>): Promise<RelPath[]> {
	const out: RelPath[] = []
	const walk = async (dir: string, prefix: string): Promise<void> => {
		let entries: Dirent[]
		try {
			entries = await fs.readdir(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			const rel = prefix ? `${prefix}/${toRel(entry.name)}` : toRel(entry.name)
			if (entry.isSymbolicLink()) {
				continue
			}
			if (entry.isDirectory()) {
				if (isLocalOnlyDir(entry.name) || excluded.has(entry.name.toLowerCase())) {
					continue
				}
				await walk(path.join(dir, entry.name), rel)
				continue
			}
			if (!entry.isFile()) {
				continue
			}
			if (!prefix && onlyRoots && !onlyRoots.has(toRel(entry.name))) {
				continue
			}
			out.push(rel)
		}
	}
	await walk(root, "")
	return out
}

/**
 * 扫本地游戏树。返回每个文件的内容指纹 + 批量识别结果。
 * 只扫候选文件（已排除 `_备份/ sav/ debug/ .era-harness/` 等本地专属目录）。
 */
export async function scanLocal(root: string, opts: ScanOptions = {}): Promise<LocalScan> {
	const excludedDirs = opts.excludeDirs ?? DEFAULT_EXCLUDED_DIRS
	const excluded = new Set(excludedDirs.map((name) => name.toLowerCase()))
	const concurrency = Math.max(1, opts.concurrency ?? 8)
	const onlyRoots = opts.onlyRoots ? new Set(opts.onlyRoots) : undefined

	const rels = await collectFiles(root, excluded, onlyRoots)
	const files = new Map<RelPath, FileFingerprint>()

	let done = 0
	let cursor = 0
	const worker = async (): Promise<void> => {
		for (;;) {
			const i = cursor++
			if (i >= rels.length) {
				return
			}
			const rel = rels[i]
			if (rel === undefined) {
				return
			}
			try {
				files.set(rel, await hashLocalFile(toFsPath(root, rel)))
			} catch {
				// 单文件读失败（占用/权限）不应中断整次扫描；由上层报告"跳过 N 个"
			}
			done++
			opts.onProgress?.(done, rels.length)
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, rels.length || 1) }, worker))

	const batches = detectBatches(files, opts)
	return {
		root,
		files,
		batches,
		excludedDirs,
		scannedAt: new Date().toISOString(),
	}
}

/**
 * G4 用的全树标签索引：遍历本地 ERB/ERH，提取 @NAME 定义与静态调用点。
 *
 * 与 `scanLocal` 同一套遍历（排除目录、跳过符号链接、并发读），但**要读全文**
 * （hash 是流式的，不留内容）。代价≈多扫一遍脚本文本；调用方应传 onProgress
 * 让 UI 有话可说。单文件 > 32MB 不当脚本读（防呆；真实 ERB 没有这么大）。
 */
const MAX_LABEL_FILE_BYTES = 32 * 1024 * 1024

export interface ScanLabelsOptions {
	excludeDirs?: string[]
	/** 并行读的文件数，默认 8（机械盘别调太高） */
	concurrency?: number
	onProgress?: (done: number, total: number) => void
}

export async function scanLabels(root: string, opts: ScanLabelsOptions = {}): Promise<LabelIndex> {
	const excludedDirs = opts.excludeDirs ?? DEFAULT_EXCLUDED_DIRS
	const excluded = new Set(excludedDirs.map((name) => name.toLowerCase()))
	const concurrency = Math.max(1, opts.concurrency ?? 8)

	const rels = (await collectFiles(root, excluded, undefined)).filter((rel) => /\.(ERB|ERH)$/i.test(rel))
	const texts: Array<{ path: RelPath; text: string }> = []

	let done = 0
	let cursor = 0
	const worker = async (): Promise<void> => {
		for (;;) {
			const i = cursor++
			if (i >= rels.length) {
				return
			}
			const rel = rels[i]
			if (rel === undefined) {
				return
			}
			try {
				const buf = await fs.readFile(toFsPath(root, rel))
				if (buf.length <= MAX_LABEL_FILE_BYTES) {
					texts.push({ path: rel, text: decodeLikeEngine(buf) })
				}
			} catch {
				// 单文件读失败（占用/权限）不应中断整次扫描
			}
			done++
			opts.onProgress?.(done, rels.length)
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, rels.length || 1) }, worker))

	return buildLabelIndex(texts)
}

export function statePath(root: string): string {
	return path.join(root, STATE_DIR, STATE_FILE)
}

export function cachePath(root: string, key: string): string {
	return path.join(root, STATE_DIR, CACHE_DIR, key)
}

/** 读状态；不存在或损坏都返回 null（调用方据此走"首次同步"分支） */
export async function readState(root: string): Promise<UpdateState | null> {
	try {
		const raw = await fs.readFile(statePath(root), "utf8")
		const parsed = JSON.parse(raw) as UpdateState
		if (parsed?.schemaVersion !== 1 || typeof parsed.files !== "object" || parsed.files === null) {
			return null
		}
		return parsed
	} catch {
		return null
	}
}

export async function writeState(root: string, state: UpdateState): Promise<void> {
	const target = statePath(root)
	await fs.mkdir(path.dirname(target), { recursive: true })
	const tmp = `${target}.tmp`
	await fs.writeFile(tmp, JSON.stringify(state), "utf8")
	await fs.rename(tmp, target)
}

/** 状态里的 files 转成 plan 需要的 base 映射（只要 sha1） */
export function stateToBase(state: UpdateState | null): Map<RelPath, { sha1: string }> | null {
	if (!state) {
		return null
	}
	const map = new Map<RelPath, { sha1: string }>()
	for (const [rel, fp] of Object.entries(state.files)) {
		map.set(toRel(rel), { sha1: fp.sha1 })
	}
	return map
}

/** 从本地扫描结果构造一份"当作上游快照"的映射（用于把当前状态存成基线） */
export function scanToSnapshotFiles(scan: LocalScan): Map<RelPath, { sha1: string; size: number }> {
	const map = new Map<RelPath, { sha1: string; size: number }>()
	for (const [rel, fp] of scan.files) {
		map.set(rel, { sha1: fp.sha1, size: fp.size })
	}
	return map
}

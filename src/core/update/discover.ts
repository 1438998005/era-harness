/**
 * eratw 一键更新 —— 游戏目录发现。
 *
 * 为什么需要：**工作区是每个创作者自己设计的**，可能千奇百怪 ——
 * 有人直接开游戏目录，有人把游戏放在 `games/eratw/`，有人同一个工作区里
 * 躺着好几个版本（本体 + 魔改 + 别人的整合包）。所以不能假设"工作区根就是游戏根"。
 *
 * 策略：
 * - 按特征打分找出候选（ERB/ + CSV/ + emuera.config + Emuera*.exe），不靠目录名。
 * - 找到高置信候选就不再往里钻（避免扫进 4600 个 ERB 目录）。
 * - 嵌套候选标出来（解压成 `eratw/eratw/` 的常见事故）。
 * - **有多个候选时不替用户选**，交给 UI 多选（见 知识库/13 §13.0 Z3）。
 */

import { createHash } from "node:crypto"
import type { Dirent } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { gitBlobSha1 } from "./manifest"

export type Confidence = "high" | "medium" | "low"

export interface GameRootCandidate {
	/** 绝对路径 */
	path: string
	/** 相对工作区；工作区本身就是游戏时是 "." */
	relPath: string
	/** 从 `ERB/DIM.ERH` 读到的 NOW_VERSION，读不到为 null */
	nowVersion: string | null
	/** 命中的特征，给人看 */
	markers: string[]
	score: number
	confidence: Confidence
	/** 若本候选位于另一个候选内部，指向外层候选的绝对路径 */
	nestedUnder: string | null
	/**
	 * 内容指纹：几个稳定小文件（DIM.ERH / emuera.config / VariableSize.csv）的合并 hash。
	 * 用来识别"同一份安装的多个副本"，避免用户在 10 个候选里挑错。
	 */
	contentFingerprint: string | null
	/** 与前面某个候选内容完全一致时，指向那个候选的绝对路径 */
	duplicateOf: string | null
}

export interface DiscoverOptions {
	/** 相对工作区的最大深度，默认 3（0 = 只看工作区根） */
	maxDepth?: number
	excludeDirs?: string[]
}

export const DEFAULT_DISCOVER_EXCLUDED = [
	"node_modules",
	".git",
	".era-harness",
	"_备份",
	".workbuddy",
	".workbuddy-ai",
	".codebuddy",
	".zcode",
	".vscode",
	".trae",
	".dsh",
	"dist",
	"out",
	"__pycache__",
]

async function exists(target: string): Promise<boolean> {
	try {
		await fs.stat(target)
		return true
	} catch {
		return false
	}
}

/** 读 `ERB/DIM.ERH` 里的 NOW_VERSION（纯 ASCII 数字，编码不影响匹配） */
export async function readNowVersion(root: string): Promise<string | null> {
	try {
		const buf = await fs.readFile(path.join(root, "ERB", "DIM.ERH"))
		const match = /NOW_VERSION\s*=\s*(\d+)/.exec(buf.toString("utf8"))
		return match?.[1] ?? null
	} catch {
		return null
	}
}

interface Probe {
	markers: string[]
	score: number
}

/** 按特征打分；不依赖目录名，所以改名的整合包也能认出来 */
async function probeGameRoot(dir: string): Promise<Probe> {
	const markers: string[] = []
	let score = 0

	if (await exists(path.join(dir, "ERB"))) {
		markers.push("ERB/")
		score += 3
	}
	if (await exists(path.join(dir, "CSV"))) {
		markers.push("CSV/")
		score += 3
	}
	if (await exists(path.join(dir, "emuera.config"))) {
		markers.push("emuera.config")
		score += 2
	}

	let entries: Dirent[] = []
	try {
		entries = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return { markers, score }
	}
	const exe = entries.find((e) => e.isFile() && /^Emuera.*\.exe$/i.test(e.name))
	if (exe) {
		markers.push(exe.name)
		score += 2
	}
	if (entries.some((e) => e.isDirectory() && e.name === "sav")) {
		markers.push("sav/")
		score += 1
	}

	return { markers, score }
}

function toConfidence(score: number): Confidence {
	if (score >= 8) {
		return "high"
	}
	return score >= 6 ? "medium" : "low"
}

/**
 * 内容指纹：只读三个小文件，成本可忽略，但足以区分"同一份安装的副本"。
 * 读不到的跳过，一个都读不到则返回 null（不假装知道）。
 */
async function contentFingerprint(dir: string): Promise<string | null> {
	const parts: string[] = []
	for (const rel of ["ERB/DIM.ERH", "emuera.config", "CSV/VariableSize.csv"]) {
		try {
			const buf = await fs.readFile(path.join(dir, ...rel.split("/")))
			parts.push(`${rel}:${gitBlobSha1(buf)}`)
		} catch {
			// 缺文件就算了，能读到几个算几个
		}
	}
	if (parts.length === 0) {
		return null
	}
	return createHash("sha1").update(parts.join("|")).digest("hex")
}

/**
 * 发现工作区内的所有 eratw 目录。
 * 返回按置信度、路径排序；嵌套候选的 `nestedUnder` 会指向外层。
 */
export async function discoverGameRoots(workspaceRoot: string, opts: DiscoverOptions = {}): Promise<GameRootCandidate[]> {
	const maxDepth = opts.maxDepth ?? 3
	const excluded = new Set(opts.excludeDirs ?? DEFAULT_DISCOVER_EXCLUDED)
	const found: Array<{ abs: string; probe: Probe }> = []

	const walk = async (dir: string, depth: number): Promise<void> => {
		const probe = await probeGameRoot(dir)
		if (probe.score >= 4) {
			found.push({ abs: dir, probe })
			// 高置信候选内部不会再套一个游戏，别扫进去（4600 个 ERB 目录不值得走）
			if (probe.score >= 8) {
				return
			}
		}
		if (depth >= maxDepth) {
			return
		}
		let entries: Dirent[]
		try {
			entries = await fs.readdir(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.isSymbolicLink() || excluded.has(entry.name)) {
				continue
			}
			await walk(path.join(dir, entry.name), depth + 1)
		}
	}

	await walk(workspaceRoot, 0)

	const candidates: GameRootCandidate[] = []
	for (const item of found) {
		const relPath = path.relative(workspaceRoot, item.abs) || "."
		candidates.push({
			path: item.abs,
			relPath: relPath.split(path.sep).join("/"),
			nowVersion: await readNowVersion(item.abs),
			markers: item.probe.markers,
			score: item.probe.score,
			confidence: toConfidence(item.probe.score),
			nestedUnder: null,
			contentFingerprint: await contentFingerprint(item.abs),
			duplicateOf: null,
		})
	}

	// 嵌套标记：A 是 B 的前缀目录
	for (const inner of candidates) {
		let best: GameRootCandidate | null = null
		for (const outer of candidates) {
			if (outer === inner) {
				continue
			}
			const prefix = outer.path.endsWith(path.sep) ? outer.path : `${outer.path}${path.sep}`
			if (inner.path.startsWith(prefix)) {
				if (!best || outer.path.length > best.path.length) {
					best = outer
				}
			}
		}
		inner.nestedUnder = best?.path ?? null
	}

	const rank: Record<Confidence, number> = { high: 0, medium: 1, low: 2 }
	candidates.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.path.localeCompare(b.path))

	// 副本标记：按排序后的顺序，第一个出现的算"原件"，后面的指向它
	const seen = new Map<string, string>()
	for (const candidate of candidates) {
		if (!candidate.contentFingerprint) {
			continue
		}
		const first = seen.get(candidate.contentFingerprint)
		if (first) {
			candidate.duplicateOf = first
		} else {
			seen.set(candidate.contentFingerprint, candidate.path)
		}
	}

	return candidates
}

/**
 * 默认选中哪些：只有一个候选就是它；有多个就**一个都不选**，强制让用户挑。
 * 嵌套候选（解压成双层目录那种）默认不选，除非它是唯一一个。
 */
export function defaultSelection(candidates: GameRootCandidate[]): GameRootCandidate[] {
	const top = candidates.filter((c) => !c.nestedUnder)
	if (top.length === 1) {
		return top
	}
	return []
}

/** 人类可读标签，例如 `eratw 20261013 · games/eratw` */
export function describeCandidate(candidate: GameRootCandidate): string {
	const version = candidate.nowVersion ? `eratw ${candidate.nowVersion}` : "eratw（版本未知）"
	return `${version} · ${candidate.relPath}`
}

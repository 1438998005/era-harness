/**
 * eratw 一键更新 —— 游戏目录发现。
 *
 * 为什么需要：**工作区是每个创作者自己设计的**，可能千奇百怪 ——
 * 有人直接开游戏目录，有人把游戏放在 `games/eratw/`，有人同一个工作区里
 * 躺着好几个版本（本体 + 魔改 + 别人的整合包）。所以不能假设"工作区根就是游戏根"。
 *
 * 策略：
 * - 按特征打分找出候选（脚本扩展名 + CSV + 引擎配置 + 引擎可执行文件），不靠目录名。
 * - 找到高置信候选就不再往里钻（避免扫进 4600 个 ERB 目录）。
 * - 嵌套候选标出来（解压成 `eratw/eratw/` 的常见事故）。
 * - 备份目录照常参与探测、只降权，因为「唯一副本躺在备份里」的用户也必须能发现游戏。
 * - **有多个候选时不替用户选**，交给 UI 多选：工程根猜错会写坏玩家文件，宁可让用户点一下。
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
	/** 是否位于备份目录之下（照常可用，只是默认不勾选） */
	isBackupCopy: boolean
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

/**
 * 跨项目通用的噪音目录：一旦出现就必然是海量无关文件，且不可能含 EraBasic 脚本。
 *
 * 这里**只放生态级的通用约定**。不放任何单一产品/编辑器/AI 客户端的目录名
 * （`.workbuddy`、`.codebuddy`、`.trae`……），因为那是某个人的机器布局，不是全体用户的标准；
 * 这些目录全是隐藏目录，已经被 {@link isSkippedDirName} 的通则覆盖。
 *
 * 也**不放 `dist`/`out`/`build`/`target`**：游戏本体完全可能解压/构建在这些目录里，
 * 跳过它们等于让这部分用户永远发现不到游戏。
 */
const NOISE_DIR_NAMES = new Set(["node_modules", "__pycache__", "system volume information", "$recycle.bin"])

/** 备份目录的通用形态（不同创作者的叫法不一样，按形态认而不是按固定名字） */
const BACKUP_DIR_RE = /^_*(备份|备份档|backup|backups|bak|old)$/i

/**
 * 扫描时该跳过的目录：隐藏目录 + 通用噪音目录。
 *
 * 备份目录**故意不在这里跳过**：用户的唯一副本可能就在 `_备份/` 里，
 * 直接跳过等于让这部分用户永远找不到游戏。改由 `walk` 记录「位于备份路径下」并降权。
 */
function isSkippedDirName(name: string): boolean {
	return name.startsWith(".") || NOISE_DIR_NAMES.has(name.toLowerCase())
}

/** 备份副本依然可用，只是降低置信度：通常它是「更新前留的旧版本」 */
function demote(confidence: Confidence): Confidence {
	return confidence === "high" ? "medium" : "low"
}

/** 在 root 附近按「名字含 emuera 的 .config/.json」找引擎配置（不猜具体文件名） */
async function findEmueraConfigs(root: string, maxDepth = 2): Promise<string[]> {
	const result: string[] = []
	const walk = async (dir: string, depth: number): Promise<void> => {
		let entries: Dirent[]
		try {
			entries = await fs.readdir(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			if (entry.isFile()) {
				const lower = entry.name.toLowerCase()
				if (lower.includes("emuera") && (lower.endsWith(".config") || lower.endsWith(".json"))) {
					result.push(path.join(dir, entry.name))
				}
				continue
			}
			if (entry.isDirectory() && depth < maxDepth && !isSkippedDirName(entry.name)) {
				await walk(path.join(dir, entry.name), depth + 1)
			}
		}
	}
	await walk(root, 0)
	return result
}

/** 在 root 附近按文件名找文件（限深度，找不到就返回空数组） */
async function findFilesShallow(root: string, fileName: string, maxDepth = 2): Promise<string[]> {
	const target = fileName.toLowerCase()
	const result: string[] = []

	const walk = async (dir: string, depth: number): Promise<void> => {
		let entries: Dirent[]
		try {
			entries = await fs.readdir(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			if (entry.isFile() && entry.name.toLowerCase() === target) {
				result.push(path.join(dir, entry.name))
				continue
			}
			if (entry.isDirectory() && depth < maxDepth && !isSkippedDirName(entry.name)) {
				await walk(path.join(dir, entry.name), depth + 1)
			}
		}
	}

	await walk(root, 0)
	return result
}

/**
 * 读 `DIM.ERH` 里的 NOW_VERSION（纯 ASCII 数字，编码不影响匹配）。
 * 按文件名找，不假设脚本目录叫 ERB。
 */
export async function readNowVersion(root: string): Promise<string | null> {
	const candidates = await findFilesShallow(root, "DIM.ERH")
	for (const candidate of candidates) {
		try {
			const buf = await fs.readFile(candidate)
			const match = /NOW_VERSION\s*=\s*(\d+)/.exec(buf.toString("utf8"))
			if (match?.[1]) {
				return match[1]
			}
		} catch {
			// 下一个候选
		}
	}
	return null
}

interface ScriptCounts {
	/** 本层直接放的脚本 */
	own: number
	/** 一级子目录里的脚本（可能属于另一个工程，所以打分权重更低） */
	subdir: number
	dirNames: string[]
}

/**
 * 在 dir 这一层和它的一级子目录里数脚本文件，用来认出**被改名的**脚本目录。
 * 只看一层：工程根的脚本不会藏在更深的地方，再往下扫只是浪费 I/O。
 *
 * `own` 与 `subdir` 分开返回：只凭子目录里的脚本就判定「这一层是工程根」会把
 * 「装着好几个工程的工作区根」也当成候选。
 */
async function countScripts(dir: string, maxSubdirs = 48): Promise<ScriptCounts> {
	let own = 0
	let subdir = 0
	const dirNames: string[] = []
	const isScriptName = (name: string) => /\.(erb|erh)$/i.test(name)

	let entries: Dirent[]
	try {
		entries = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return { own, subdir, dirNames }
	}

	for (const entry of entries) {
		if (entry.isFile() && isScriptName(entry.name)) {
			own++
		}
	}

	let scanned = 0
	for (const entry of entries) {
		if (!entry.isDirectory() || scanned >= maxSubdirs || isSkippedDirName(entry.name)) {
			continue
		}
		scanned++
		let childEntries: Dirent[]
		try {
			childEntries = await fs.readdir(path.join(dir, entry.name), { withFileTypes: true })
		} catch {
			continue
		}
		let childCount = 0
		for (const child of childEntries) {
			if (child.isFile() && isScriptName(child.name)) {
				childCount++
			}
		}
		if (childCount > 0) {
			subdir += childCount
			dirNames.push(entry.name)
		}
	}

	return { own, subdir, dirNames }
}

interface Probe {
	markers: string[]
	score: number
	/** 这一层有没有引擎可执行文件：有就说明已经是游戏根，不用再往里钻 */
	hasEngine: boolean
}

/** 按特征打分；不依赖目录名，所以改名的整合包也能认出来 */
async function probeGameRoot(dir: string): Promise<Probe> {
	const markers: string[] = []
	let score = 0

	let entries: Dirent[]
	try {
		entries = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return { markers, score, hasEngine: false }
	}

	let ownCsv = 0
	let engineExe = ""
	let engineConfig = ""
	let hasSav = false
	for (const entry of entries) {
		if (entry.isDirectory()) {
			// `sav/` 也是引擎自己建的，目录名由引擎决定
			if (entry.name.toLowerCase() === "sav") {
				hasSav = true
			}
			continue
		}
		if (!entry.isFile()) {
			continue
		}
		const lower = entry.name.toLowerCase()
		if (lower.endsWith(".csv")) {
			ownCsv++
			continue
		}
		if (/^emuera.*\.exe$/i.test(entry.name)) {
			engineExe = entry.name
			continue
		}
		if (lower.includes("emuera") && (lower.endsWith(".config") || lower.endsWith(".json"))) {
			engineConfig = entry.name
		}
	}

	if (engineExe) {
		markers.push(engineExe)
		score += 3
	}
	if (engineConfig) {
		markers.push(engineConfig)
		score += 3
	}
	if (hasSav) {
		markers.push("sav/")
		score += 1
	}
	if (ownCsv > 0) {
		markers.push(`${ownCsv} 个 CSV`)
		score += 1
	}

	// 脚本：本层 + 一级子目录，不依赖目录名，改名/嵌套都能认出来。
	// 本层脚本才说明「这一层就是工程根」；只有子目录有脚本时降权，避免把容器根当成工程根。
	const scripts = await countScripts(dir)
	if (scripts.own >= 20) {
		markers.push(`${scripts.own}+ 个脚本文件`)
		score += 4
	} else if (scripts.own >= 3) {
		markers.push(`${scripts.own} 个脚本文件`)
		score += 3
	} else if (scripts.own > 0) {
		markers.push(`${scripts.own} 个脚本文件`)
		score += 2
	}
	if (scripts.subdir >= 20) {
		markers.push(`子目录里有 ${scripts.subdir}+ 个脚本`)
		score += 3
	} else if (scripts.subdir > 0) {
		score += 1
	}

	return { markers, score, hasEngine: engineExe !== "" }
}

function toConfidence(score: number): Confidence {
	if (score >= 8) {
		return "high"
	}
	return score >= 6 ? "medium" : "low"
}

/**
 * 内容指纹：只读几个小文件（按文件名找，不拼约定路径），成本可忽略，但足以区分"同一份安装的副本"。
 * 读不到的跳过，一个都读不到则返回 null（不假装知道）。
 */
async function contentFingerprint(dir: string): Promise<string | null> {
	const parts: string[] = []

	// 按文件名找，不拼 `ERB/`、`CSV/` 这类约定路径
	for (const name of ["DIM.ERH", "VariableSize.csv"]) {
		const [found] = await findFilesShallow(dir, name)
		if (!found) {
			continue
		}
		try {
			parts.push(`${name}:${gitBlobSha1(await fs.readFile(found))}`)
		} catch {
			// 读不到就跳过
		}
	}

	// 引擎配置：名字由引擎决定，只要求「含 emuera 关键字的 .config/.json」
	for (const candidate of await findEmueraConfigs(dir)) {
		try {
			parts.push(`${path.basename(candidate)}:${gitBlobSha1(await fs.readFile(candidate))}`)
		} catch {
			// 读不到就跳过
		}
		break
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
	// 调用方给的名字统一小写比较：Windows 上 `Node_Modules` 和 `node_modules` 是同一个目录
	const excluded = new Set((opts.excludeDirs ?? []).map((name) => name.toLowerCase()))
	const found: Array<{ abs: string; probe: Probe; inBackup: boolean }> = []

	const walk = async (dir: string, depth: number, inBackup: boolean): Promise<void> => {
		const probe = await probeGameRoot(dir)
		if (probe.score >= 4) {
			found.push({ abs: dir, probe, inBackup })
			// 已经到游戏根了（有引擎本体或分数够高），再往里扫只会扫出 ERB/ 这种子目录
			if (probe.hasEngine || probe.score >= 8) {
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
			if (!entry.isDirectory() || entry.isSymbolicLink()) {
				continue
			}
			if (excluded.has(entry.name.toLowerCase()) || isSkippedDirName(entry.name)) {
				continue
			}
			await walk(path.join(dir, entry.name), depth + 1, inBackup || BACKUP_DIR_RE.test(entry.name))
		}
	}

	// 工作区自己就开在备份目录里（`.../_备份/eratw`）时也算备份副本
	await walk(workspaceRoot, 0, BACKUP_DIR_RE.test(path.basename(workspaceRoot)))

	const candidates: GameRootCandidate[] = []
	for (const item of found) {
		const relPath = path.relative(workspaceRoot, item.abs) || "."
		const baseConfidence = toConfidence(item.probe.score)
		candidates.push({
			path: item.abs,
			relPath: relPath.split(path.sep).join("/"),
			nowVersion: await readNowVersion(item.abs),
			markers: item.inBackup ? [...item.probe.markers, "位于备份目录"] : item.probe.markers,
			score: item.probe.score,
			confidence: item.inBackup ? demote(baseConfidence) : baseConfidence,
			nestedUnder: null,
			isBackupCopy: item.inBackup,
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
 * 嵌套候选（解压成双层目录那种）与备份副本默认不选，除非它是唯一一个。
 */
export function defaultSelection(candidates: GameRootCandidate[]): GameRootCandidate[] {
	const top = candidates.filter((c) => !c.nestedUnder && !c.isBackupCopy)
	if (top.length === 1) {
		return top
	}
	if (top.length > 0) {
		return []
	}
	// 整个工作区只有备份副本：仍然选中它，否则用户没有任何默认项
	const backups = candidates.filter((c) => !c.nestedUnder)
	return backups.length === 1 ? backups : []
}

/** 人类可读标签，例如 `eratw 20261013 · games/eratw` */
export function describeCandidate(candidate: GameRootCandidate): string {
	const version = candidate.nowVersion ? `eratw ${candidate.nowVersion}` : "eratw（版本未知）"
	const backup = candidate.isBackupCopy ? " · 备份副本" : ""
	return `${version} · ${candidate.relPath}${backup}`
}

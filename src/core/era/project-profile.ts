/**
 * Emuera（EraBasic）工程能力探测 —— 完全路径无关。
 *
 * 为什么不写死目录名：工作区是每个创作者自己搭的，可能
 *   - 直接打开游戏根目录
 *   - 游戏藏在 `games/xxx/` 里，或者解压成 `eratw/eratw/` 两层
 *   - 同一个工作区里有本体 + 魔改 + 别人的整合包
 *   - 脚本目录被改名（`ERB/` → `Script/`、`Erb/`、日文名），口上目录同理
 * 所以这里只回答「这个工作区里有没有 EraBasic 工程、在哪、长什么样」，
 * 绝不预设任何目录名或绝对路径。
 *
 * 只用两类信号：
 *   1. 文件扩展名（`.erb/.erh/.csv`）—— 由引擎决定，创作者改不了
 *   2. 引擎产物（`Emuera*.exe`、引擎配置文件、`sav/`）—— 由引擎生成
 * 目录名只用来「认出口上/备份目录长什么样」，不作为识别工程的必要条件。
 *
 * 性能：同步 API（系统提示词构建是同步的），单次探测最多 400 次 readdir，
 * 结果按「工作区 + 额外根」缓存 60 秒。
 */

import type { Dirent } from "node:fs"
import fs from "node:fs"
import path from "node:path"

export type EraConfidence = "high" | "medium" | "low" | "none"

export interface EraProjectProfile {
	/** 是否探测到 EraBasic 工程 */
	isEra: boolean
	confidence: EraConfidence
	/** 探测到的工程根（绝对路径，按置信度降序） */
	roots: string[]
	/** 与 roots 一一对应的、相对工作区的展示路径（工作区根本身是 "."） */
	relativeRoots: string[]
	/** 命中的特征，给人看也用来自证 */
	markers: string[]
	/** 实际出现的脚本扩展名（小写，带点），例如 [".erb", ".erh"] */
	scriptExtensions: string[]
	/** 探测到的脚本次数（有上限，别当精确统计用） */
	scriptFileCount: number
	/** 计数是否因预算/上限被截断（展示时为「至少 N」） */
	scriptFileCountTruncated: boolean
	/** 实际包含脚本的目录名（相对工程根），例如 ["ERB"] —— 由探测得出，不是常量 */
	scriptDirNames: string[]
	/** 实际包含 CSV 的目录名（相对工程根） */
	csvDirNames: string[]
	/** 实际存在的备份目录名 */
	backupDirNames: string[]
	/** 实际存在的口上（剧本）目录名 */
	personaDirNames: string[]
	/** 是否存在引擎配置文件 */
	hasEngineConfig: boolean
}

const EMPTY_PROFILE: EraProjectProfile = {
	isEra: false,
	confidence: "none",
	roots: [],
	relativeRoots: [],
	markers: [],
	scriptExtensions: [],
	scriptFileCount: 0,
	scriptFileCountTruncated: false,
	scriptDirNames: [],
	csvDirNames: [],
	backupDirNames: [],
	personaDirNames: [],
	hasEngineConfig: false,
}

/** 缓存有效期：工作区结构可能在对话中途变化（新建 ERB/、解压新版本） */
const PROFILE_TTL_MS = 60_000
/** 从每个起点往下找几层（工作区/游戏/游戏/脚本 这种两层套娃很常见） */
const MAX_SCAN_DEPTH = 3
/** 单次探测的 readdir 预算，防止在巨型工作区上卡住提示词构建 */
const MAX_READDIR_CALLS = 800
/** 单层最多看多少个子目录 */
const MAX_SUBDIRS_PER_DIR = 64
/** 单层 readdir 结果超过这个数量就当作「不是工程目录」直接跳过 */
const MAX_ENTRIES_PER_DIR = 20_000
/** 精确计数：最多走多少个目录、数多少个文件 */
const MAX_COUNT_DIRS = 600
const MAX_COUNT_FILES = 50_000

/**
 * 跨项目通用的噪音目录：一旦出现就必然是海量无关文件，且不可能含 EraBasic 脚本。
 *
 * 只放生态级约定。**不放**任何单一产品/编辑器/AI 客户端的目录名 —— 那是某个人的机器布局，
 * 不是全体用户的标准，而且它们都是隐藏目录，已被 `isExcludedDir` 的通则覆盖。
 * **也不放** `dist`/`out`/`build`/`target`：游戏本体完全可能解压或构建在这些目录里。
 */
const SCAN_EXCLUDED = new Set(["node_modules", "__pycache__", "system volume information", "$recycle.bin"])

/** 隐藏目录 + 通用噪音目录。备份目录故意不在此列：它要被识别出来，只是不当作工程根。 */
function isExcludedDir(name: string): boolean {
	return name.startsWith(".") || SCAN_EXCLUDED.has(name.toLowerCase())
}

const SCRIPT_EXTENSIONS = [".erb", ".erh"]
const DATA_EXTENSIONS = [".csv"]
const ENGINE_EXE_RE = /^emuera.*\.exe$/i
/** 口上（剧本）目录的通用关键字；只用来「认出来」，不是必需条件 */
const PERSONA_DIR_RE = /口上|kojo|koujou/i
/** 备份目录的通用形态；只用来「认出来」，不是必需条件 */
const BACKUP_DIR_RE = /^_*(备份|备份档|backup|backups|bak|old)$/i

const HIGH_SCORE = 7
const MEDIUM_SCORE = 5
const CANDIDATE_SCORE = 3

interface DirProbe {
	dir: string
	score: number
	markers: string[]
	scriptCount: number
	/** 本层直接包含的脚本数（用来区分「工程根」和「装着多个工程的容器」） */
	ownScripts: number
	/** 本层直接包含的 CSV 数 */
	ownCsv: number
	scriptExtensions: Set<string>
	scriptDirNames: string[]
	/** 子目录名 -> 该目录直属的 CSV 数，最后按数量取前几个展示 */
	csvDirCounts: Map<string, number>
	csvDirNames: string[]
	backupDirNames: string[]
	personaDirNames: string[]
	hasEngineExe: boolean
	hasEngineConfig: boolean
}

interface ScanBudget {
	readdirCalls: number
	/** 同一次探测里每个目录只读一次：打分要读，往下走还要读 */
	cache: Map<string, Dirent[]>
}

function readDirCached(dir: string, budget: ScanBudget): Dirent[] | null {
	const key = normalizeSlashes(dir).toLowerCase()
	const hit = budget.cache.get(key)
	if (hit) {
		return hit
	}
	if (budget.readdirCalls >= MAX_READDIR_CALLS) {
		return null
	}
	budget.readdirCalls++
	let entries: Dirent[]
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true })
	} catch {
		return null
	}
	if (entries.length > MAX_ENTRIES_PER_DIR) {
		return null
	}
	budget.cache.set(key, entries)
	return entries
}

interface CacheEntry {
	profile: EraProjectProfile
	at: number
}

const profileCache = new Map<string, CacheEntry>()

function normalizeSlashes(value: string): string {
	return value.replace(/\\/g, "/")
}

function dedupeCaseInsensitive(values: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const value of values) {
		const key = value.toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		result.push(value)
	}
	return result
}

function isBackupDir(name: string): boolean {
	return BACKUP_DIR_RE.test(name)
}

function isPersonaDir(name: string): boolean {
	return PERSONA_DIR_RE.test(name)
}

function isScriptFile(name: string): boolean {
	return SCRIPT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

function isDataFile(name: string): boolean {
	return DATA_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

function scriptExtensionOf(name: string): string | undefined {
	const lower = name.toLowerCase()
	return SCRIPT_EXTENSIONS.find((ext) => lower.endsWith(ext))
}

/**
 * 探测单个目录。只看「这一层」和「下一层」——工程根通常把脚本放在一个子目录里，
 * 再往下钻对识别没有帮助，只会把 4600 个脚本目录全扫一遍。
 */
function probeDirectory(dir: string, budget: ScanBudget): DirProbe | null {
	const probe: DirProbe = {
		dir,
		score: 0,
		markers: [],
		scriptCount: 0,
		ownScripts: 0,
		ownCsv: 0,
		scriptExtensions: new Set<string>(),
		scriptDirNames: [],
		csvDirCounts: new Map(),
		csvDirNames: [],
		backupDirNames: [],
		personaDirNames: [],
		hasEngineExe: false,
		hasEngineConfig: false,
	}

	const entries: Dirent[] | null = readDirCached(dir, budget)
	if (!entries) {
		return null
	}

	let topLevelScripts = 0
	let topLevelCsv = 0
	let hasEngineExe = false
	const subdirs: string[] = []

	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (isExcludedDir(entry.name)) {
				continue
			}
			if (isBackupDir(entry.name)) {
				probe.backupDirNames.push(entry.name)
				continue
			}
			if (isPersonaDir(entry.name)) {
				probe.personaDirNames.push(entry.name)
				continue
			}
			if (subdirs.length < MAX_SUBDIRS_PER_DIR) {
				subdirs.push(entry.name)
			}
			continue
		}
		if (!entry.isFile()) {
			continue
		}
		const ext = scriptExtensionOf(entry.name)
		if (ext) {
			topLevelScripts++
			probe.scriptExtensions.add(ext)
			continue
		}
		if (isDataFile(entry.name)) {
			topLevelCsv++
			continue
		}
		if (ENGINE_EXE_RE.test(entry.name)) {
			hasEngineExe = true
			continue
		}
		// 引擎配置文件名由引擎决定，不猜具体名字：带 emuera 关键字的 .config/.json 都算
		const lower = entry.name.toLowerCase()
		if (lower.includes("emuera") && (lower.endsWith(".config") || lower.endsWith(".json"))) {
			probe.hasEngineConfig = true
		}
	}

	let nestedScripts = 0
	let nestedCsv = 0

	// 下一层：统计脚本/CSV，并顺手认出更深一层的口上目录名（不用额外 readdir）
	for (const subdir of subdirs) {
		const childEntries = readDirCached(path.join(dir, subdir), budget)
		if (!childEntries) {
			continue
		}
		let childScripts = 0
		let childCsv = 0
		for (const child of childEntries) {
			if (child.isDirectory()) {
				// 脚本目录下面那一层往往才是口上目录（如 `ERB/口上xxx/`）
				if (isPersonaDir(child.name)) {
					probe.personaDirNames.push(child.name)
				}
				continue
			}
			if (!child.isFile()) {
				continue
			}
			const ext = scriptExtensionOf(child.name)
			if (ext) {
				childScripts++
				probe.scriptExtensions.add(ext)
				continue
			}
			if (isDataFile(child.name)) {
				childCsv++
			}
		}
		if (childScripts > 0) {
			nestedScripts += childScripts
			probe.scriptDirNames.push(subdir)
		}
		if (childCsv > 0) {
			nestedCsv += childCsv
			probe.csvDirCounts.set(subdir, childCsv)
		}
	}

	probe.scriptCount = topLevelScripts + nestedScripts
	probe.ownScripts = topLevelScripts
	probe.ownCsv = topLevelCsv
	probe.hasEngineExe = hasEngineExe
	const totalCsv = topLevelCsv + nestedCsv

	// 打分：脚本数量是最强信号，引擎产物次之，目录名几乎不参与
	if (probe.scriptCount >= 50) {
		probe.score += 4
		probe.markers.push("大量脚本文件")
	} else if (probe.scriptCount >= 5) {
		probe.score += 3
		probe.markers.push("脚本文件")
	} else if (probe.scriptCount >= 1) {
		probe.score += 2
		probe.markers.push("零星脚本文件")
	}
	if (totalCsv > 0) {
		probe.score += 1
		probe.markers.push("CSV 数据文件")
	}
	if (hasEngineExe) {
		probe.score += 2
		probe.markers.push("Emuera 可执行文件")
	}
	if (probe.hasEngineConfig) {
		probe.score += 2
		probe.markers.push("引擎配置文件")
	}
	if (topLevelScripts === 0 && nestedScripts === 0 && probe.scriptDirNames.length === 0) {
		probe.score = Math.min(probe.score, 2)
	}

	return probe
}

/** child 是否严格位于 parent 之下（段级比较，`D:/proj-evil` 不算在 `D:/proj` 里） */
function isStrictlyInside(parent: string, child: string): boolean {
	const rel = path.relative(path.resolve(parent), path.resolve(child))
	if (!rel || path.isAbsolute(rel)) {
		return false
	}
	return !rel.split(path.sep).includes("..")
}

/**
 * 判断一个候选是不是「只装了别的工程的容器」：自己没有脚本/CSV，也不是引擎本体所在处。
 * 工作区根自己往往会因为子目录里的脚本被算成候选，它不该被当成工程根展示。
 */
function isContainerOnly(item: DirProbe): boolean {
	return item.ownScripts === 0 && item.ownCsv === 0 && !item.hasEngineExe && !item.hasEngineConfig
}

/**
 * 去掉「被分数不低于自己的候选包住」的目录。
 * 典型场景：游戏根里的 `ERB/` 本身也会被当成候选，留着会造成重复扫描和重复计数。
 * 另一个场景：工作区根只是装着多个游戏的容器。
 */
function pruneContained(found: DirProbe[]): DirProbe[] {
	return found.filter((candidate) => {
		const hasDescendantCandidate = found.some((other) => other !== candidate && isStrictlyInside(candidate.dir, other.dir))
		if (isContainerOnly(candidate) && hasDescendantCandidate) {
			return false
		}
		return !found.some(
			(other) => other !== candidate && other.score >= candidate.score && isStrictlyInside(other.dir, candidate.dir),
		)
	})
}

interface TreeStats {
	scriptCount: number
	extensions: Set<string>
	truncated: boolean
}

/**
 * 在「已确认是脚本目录」的目录里做精确计数。
 * 真实工程常把脚本再分一层（`ERB/口上xxx/*.erb`），只看一层会严重低估规模。
 * 有目录数与文件数双上限，超了就标 truncated。
 */
function countScriptsDeep(root: string, budget: ScanBudget): TreeStats {
	const stats: TreeStats = { scriptCount: 0, extensions: new Set<string>(), truncated: false }
	const queue: string[] = [root]
	const seen = new Set<string>()
	let visitedDirs = 0

	while (queue.length > 0) {
		const dir = queue.shift()!
		const key = normalizeSlashes(dir).toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		if (++visitedDirs > MAX_COUNT_DIRS) {
			stats.truncated = true
			break
		}

		const entries = readDirCached(dir, budget)
		if (!entries) {
			stats.truncated = true
			continue
		}
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (entry.isSymbolicLink() || isExcludedDir(entry.name)) {
					continue
				}
				queue.push(path.join(dir, entry.name))
				continue
			}
			const ext = scriptExtensionOf(entry.name)
			if (!ext) {
				continue
			}
			stats.scriptCount++
			stats.extensions.add(ext)
			if (stats.scriptCount >= MAX_COUNT_FILES) {
				stats.truncated = true
				return stats
			}
		}
	}

	return stats
}

function confidenceOf(score: number): EraConfidence {
	if (score >= HIGH_SCORE) {
		return "high"
	}
	if (score >= MEDIUM_SCORE) {
		return "medium"
	}
	return score >= CANDIDATE_SCORE ? "low" : "none"
}

function collectStartRoots(cwd: string | undefined, extraRoots?: readonly string[]): string[] {
	const roots: string[] = []
	if (cwd) {
		roots.push(cwd)
	}
	for (const root of extraRoots ?? []) {
		if (root) {
			roots.push(root)
		}
	}
	return dedupeCaseInsensitive(roots)
}

function buildProfile(startRoots: string[], cwd: string | undefined): EraProjectProfile {
	if (startRoots.length === 0) {
		return EMPTY_PROFILE
	}

	const budget: ScanBudget = { readdirCalls: 0, cache: new Map() }
	const found: DirProbe[] = []
	const visited = new Set<string>()

	// 广度优先：先把浅层的候选找完再往下钻，宽而深的工作区不会因为先走错分支就错过工程
	const queue: Array<{ dir: string; depth: number }> = startRoots.map((dir) => ({ dir, depth: 0 }))
	while (queue.length > 0) {
		const next = queue.shift()!
		const key = normalizeSlashes(next.dir).toLowerCase()
		if (visited.has(key)) {
			continue
		}
		visited.add(key)

		const probe = probeDirectory(next.dir, budget)
		if (!probe) {
			continue
		}
		if (probe.score >= CANDIDATE_SCORE) {
			found.push(probe)
			// 高置信候选内部不会再套一个工程，别往下扫
			if (probe.score >= HIGH_SCORE) {
				continue
			}
		}
		if (next.depth >= MAX_SCAN_DEPTH) {
			continue
		}

		const entries = readDirCached(next.dir, budget)
		if (!entries) {
			continue
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.isSymbolicLink()) {
				continue
			}
			if (isExcludedDir(entry.name) || isBackupDir(entry.name)) {
				continue
			}
			queue.push({ dir: path.join(next.dir, entry.name), depth: next.depth + 1 })
		}
	}

	if (found.length === 0) {
		return EMPTY_PROFILE
	}

	found.sort((a, b) => b.score - a.score || a.dir.localeCompare(b.dir))
	const usable = pruneContained(found)
	const best = usable[0]!

	const baseForRelative = cwd || startRoots[0] || ""
	const roots = usable.map((item) => item.dir)
	const relativeRoots = roots.map((root) => {
		const rel = path.relative(baseForRelative, root)
		return rel ? normalizeSlashes(rel) : "."
	})

	const markers: string[] = []
	for (const item of usable) {
		for (const marker of item.markers) {
			if (!markers.includes(marker)) {
				markers.push(marker)
			}
		}
	}

	// 精确计数：只走已确认的脚本目录，不会把备份/他人整合包里的副本算进来
	let scriptFileCount = 0
	const extensions = new Set<string>()
	let countTruncated = false
	for (const item of usable) {
		scriptFileCount += item.ownScripts
		if (item.ownScripts > 0) {
			for (const ext of item.scriptExtensions) {
				extensions.add(ext)
			}
		}
		for (const name of item.scriptDirNames) {
			const stats = countScriptsDeep(path.join(item.dir, name), budget)
			scriptFileCount += stats.scriptCount
			countTruncated = countTruncated || stats.truncated
			for (const ext of stats.extensions) {
				extensions.add(ext)
			}
		}
	}

	// CSV 目录只留最像数据目录的几个（按数量降序），避免把只放了一张表的杂项目录也列出来
	const csvCounts = new Map<string, number>()
	for (const item of usable) {
		for (const [name, count] of item.csvDirCounts) {
			csvCounts.set(name, (csvCounts.get(name) ?? 0) + count)
		}
	}
	const csvDirNames = [...csvCounts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, 3)
		.map(([name]) => name)

	return {
		isEra: true,
		confidence: confidenceOf(best.score),
		roots,
		relativeRoots,
		markers,
		scriptExtensions: [...extensions].sort(),
		scriptFileCount,
		scriptFileCountTruncated: countTruncated,
		scriptDirNames: dedupeCaseInsensitive(usable.flatMap((item) => item.scriptDirNames)),
		csvDirNames,
		backupDirNames: dedupeCaseInsensitive(usable.flatMap((item) => item.backupDirNames)),
		personaDirNames: dedupeCaseInsensitive(usable.flatMap((item) => item.personaDirNames)),
		hasEngineConfig: usable.some((item) => item.hasEngineConfig),
	}
}

function cacheKeyOf(startRoots: string[]): string {
	return startRoots.map((root) => normalizeSlashes(root).toLowerCase()).join("|")
}

/**
 * 取当前工作区的工程画像。同步、带 60 秒缓存。
 * 探测不到任何工程时返回 `isEra: false`，调用方据此决定是否注入领域规则。
 */
export function getEraProjectProfile(cwd: string | undefined, extraRoots?: readonly string[]): EraProjectProfile {
	const startRoots = collectStartRoots(cwd, extraRoots)
	if (startRoots.length === 0) {
		return EMPTY_PROFILE
	}

	const key = cacheKeyOf(startRoots)
	const cached = profileCache.get(key)
	const now = Date.now()
	if (cached && now - cached.at < PROFILE_TTL_MS) {
		return cached.profile
	}

	const profile = buildProfile(startRoots, cwd)
	profileCache.set(key, { profile, at: now })

	// 简单上限：超过 32 个键就丢掉最旧的，避免长会话里无限增长
	if (profileCache.size > 32) {
		let oldestKey: string | undefined
		let oldestAt = Number.POSITIVE_INFINITY
		for (const [cacheKey, entry] of profileCache) {
			if (entry.at < oldestAt) {
				oldestAt = entry.at
				oldestKey = cacheKey
			}
		}
		if (oldestKey !== undefined) {
			profileCache.delete(oldestKey)
		}
	}

	return profile
}

/** 清空探测缓存（工作区结构变化、用户切目录时调用） */
export function resetEraProjectProfileCache(): void {
	profileCache.clear()
}

/** 扫描起点：优先用探测到的工程根，探测不到就退回工作区根 */
export function getEraScanRoots(cwd: string | undefined, extraRoots?: readonly string[]): string[] {
	const profile = getEraProjectProfile(cwd, extraRoots)
	if (profile.roots.length > 0) {
		return profile.roots
	}
	return collectStartRoots(cwd, extraRoots)
}

/**
 * 把目标路径变成「相对工程根」的段列表。
 *
 * 为什么不能直接切绝对路径：用户完全可能把工作区放在 `D:/口上工程/`、`D:/备份/mygame/` 里，
 * 拿整串路径去匹配关键字，会把**所有**文件都判成口上/备份文件，从而把范围权限弄反。
 * 找不到所属工程根时退回全部段（保守，宁可多问一次）。
 */
function scopeSegments(targetPath: string, roots: readonly string[], fallbackRoot?: string): string[] {
	const raw = normalizeSlashes(targetPath).split("/").filter(Boolean)
	if (!path.isAbsolute(targetPath)) {
		return raw
	}
	const abs = path.resolve(targetPath)
	const root = roots.find((candidate) => isStrictlyInside(candidate, abs) || path.resolve(candidate) === abs) ?? fallbackRoot
	if (!root) {
		return raw
	}
	return normalizeSlashes(path.relative(path.resolve(root), abs))
		.split("/")
		.filter(Boolean)
}

/**
 * 判断某个绝对路径是否落在「口上（剧本）」目录里。
 *
 * 依次尝试：探测到的真实目录名 → 通用关键字 → 文件名约定。
 * 一个都没命中就当它不是口上文件，而不是假设某个固定路径。
 * 判定只看「相对工程根」的段，不看工作区本身的目录名。
 */
export function isPersonaScopePath(targetPath: string, cwd?: string, profile?: EraProjectProfile): boolean {
	const current = profile ?? getEraProjectProfile(cwd)
	const segments = scopeSegments(targetPath, current.roots, cwd)
	if (segments.length === 0) {
		return false
	}

	if (current.personaDirNames.length > 0) {
		const known = new Set(current.personaDirNames.map((name) => name.toLowerCase()))
		if (segments.some((segment) => known.has(segment.toLowerCase()))) {
			return true
		}
	}

	if (segments.some((segment) => PERSONA_DIR_RE.test(segment))) {
		return true
	}

	const base = segments[segments.length - 1] ?? ""
	return /^(KOJO|EVENT_MESSAGE|CHARA_KOJO)/i.test(base)
}

/** 路径里是否含探测到的（或符合通用形态的）备份目录；同样只看相对工程根的段 */
export function isBackupScopePath(targetPath: string, profile?: EraProjectProfile): boolean {
	const segments = scopeSegments(targetPath, profile?.roots ?? [])
	if (segments.length === 0) {
		return false
	}
	const known = new Set((profile?.backupDirNames ?? []).map((name) => name.toLowerCase()))
	return segments.some((segment) => known.has(segment.toLowerCase()) || isBackupDir(segment))
}

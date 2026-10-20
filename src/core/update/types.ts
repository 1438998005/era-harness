/**
 * eratw 一键更新 —— 类型定义。
 *
 * 约定：
 * - 本目录下 `tarball / manifest / plan` 三个模块必须保持**纯 Node**，不得 import vscode，
 *   以便将来整体抽到 era harness 核心包供 CLI / MCP 复用（见 知识库/13 §13.12）。
 * - 所有路径一律是**相对游戏根**、以 "/" 分隔的 POSIX 形式；对外不暴露 Windows 反斜杠。
 */

/** 相对游戏根、"/" 分隔的路径 */
export type RelPath = string

/**
 * 文件指纹。
 * sha1 是 **git blob sha1**（`sha1("blob " + size + "\0" + content)`），
 * 与 GitLab `tree` / `compare` 接口返回的 blob id 同构 —— 将来改增量下载时零成本。
 */
export interface FileFingerprint {
	sha1: string
	size: number
	mtimeMs: number
}

/** 上游快照中的一项。上游的 mtime 无意义，故不记录。 */
export interface UpstreamFile {
	sha1: string
	size: number
}

/** 一次上游快照（来自 GitLab archive、本地 zip 或已解压目录） */
export interface UpstreamSnapshot {
	/** 仅用于报告，例如 "develop@fa0e525a" / "eratw-develop.zip" / "D:/downloads/整合包" */
	label: string
	files: Map<RelPath, UpstreamFile>
}

/** 一次"批量解压/覆盖"的识别结果 */
export interface BatchInfo {
	/** 向下取整到分钟的时间戳 */
	minuteMs: number
	count: number
	/** 占候选文件总数的比例 */
	ratio: number
}

export interface BatchDetection {
	batches: BatchInfo[]
	/** 落在批量分钟内的路径 —— 判定为「上游来源」 */
	bulkPaths: Set<RelPath>
	/** 识别是否可信（至少一个批次，且批量覆盖率 ≥ minCoverage） */
	reliable: boolean
	/** 本次使用的文件数阈值 */
	threshold: number
	/** 候选文件总数（已排除本地专属目录） */
	total: number
}

export interface LocalScan {
	root: string
	files: Map<RelPath, FileFingerprint>
	batches: BatchDetection
	/** 被排除、永不参与更新的目录名 */
	excludedDirs: string[]
	scannedAt: string
}

export type PlanAction = "write" | "delete" | "keep" | "conflict"

/**
 * 判定原因。UI 文案由 知识库/13 §13.11 的映射表负责，这里只给稳定的机器码。
 */
export type PlanReason =
	| "clean-update" // 本地没动、上游改了 → 覆盖
	| "local-change" // 本地改了、上游没动 → 保留
	| "both-changed" // 双方都改 → 冲突
	| "upstream-delete" // 上游删了、本地没动 → 删除
	| "delete-vs-local-change" // 上游删了、本地改过 → 冲突
	| "upstream-add" // 上游新增 → 写入
	| "add-vs-local" // 上游新增了同名文件、本地也有 → 冲突
	| "local-only" // 本地独有 → 保留
	| "local-deleted" // 本地删了、上游没动 → 尊重本地删除
	| "first-sync-bulk" // 首次同步：mtime 在批量内 → 判为上游旧版，覆盖
	| "first-sync-human" // 首次同步：mtime 在批量外 → 判为人手改过，冲突

export interface PlanEntry {
	path: RelPath
	action: PlanAction
	reason: PlanReason
	localSha1?: string
	theirsSha1?: string
	baseSha1?: string
}

/** 冲突分组：口上按角色整包问，本体侧逐文件问 */
export interface ConflictGroup {
	kind: "persona" | "file"
	/** persona: 角色目录名；file: 文件路径 */
	key: string
	/** 展示用标签 */
	label: string
	paths: RelPath[]
}

export interface PlanSummary {
	write: number
	delete: number
	keep: number
	conflict: number
	unchanged: number
	/**
	 * 保留项按原因细分。UI 靠它区分三件不同的事：
	 * - `local-change`：上游文件被你改过 → 要提示"你的改动都留着"
	 * - `local-only`：社区版里根本没有的文件（你的私货/第三方口上）→ 不必打扰
	 * - `local-deleted`：你主动删掉的上游文件 → 不必打扰
	 */
	keepByReason: Partial<Record<PlanReason, number>>
}

/** 需要 UI 特别处理的告警码 */
export type PlanWarning =
	| "first-sync-unreliable" // 首次同步但批量识别不可信 → 必须让用户二选一
	| "first-sync" // 本次是首次同步（无基线）
	| "no-deletable-root" // 上游顶层目录为空，禁止任何删除

export interface UpdatePlan {
	mode: "first-sync" | "incremental"
	entries: PlanEntry[]
	groups: ConflictGroup[]
	summary: PlanSummary
	warnings: PlanWarning[]
}

/** 落盘状态：`.era-harness/update-state.json` */
export interface UpdateState {
	schemaVersion: 1
	source: {
		projectUrl: string
		/** 仅内部使用，绝不出现在 UI */
		branch: string
	}
	applied: {
		commit: string
		nowVersion: string
		appliedAt: string
	}
	files: Record<RelPath, { sha1: string; size: number; mtimeMs: number }>
	localOverrides: RelPath[]
	lastBackup?: string
}

export const STATE_DIR = ".era-harness"
export const STATE_FILE = "update-state.json"
export const CACHE_DIR = "cache"

/**
 * 专属知识库：宿主 ↔ webview 的数据契约。
 *
 * 走 `String` 传 JSON 而不是自定义 proto message：与既有的 `getGlobalMemory` /
 * `updateGlobalMemory` 同一套做法（那边也是把整份 JSON 文档塞进 String），
 * 少两个 message、少一次生成，两端只需要认这一份 TS 类型。
 *
 * ⚠️ 本文件同时被扩展宿主与 webview 引用，所以**不能** import 核心库
 * （`@eraharness/gamekb` 依赖 node:fs，进 webview 包会直接炸）。
 */

/** 条目统计（函数/常量/表/其他） */
export type KnowledgeBaseCounts = Partial<Record<string, number>>

/**
 * 构建状态（与 `@eraharness/gamekb` 的 GameKbBuildStatus 同形）。
 * 本文件不能 import 核心库（会把 node:fs 带进 webview），两边手动保持同步。
 */
export type KnowledgeBaseBuildStatus = "draft" | "building" | "ready" | "failed"
/** 建库形态：full = 构建完整知识库；blank = 构建空白知识库（只建骨架） */
export type KnowledgeBaseBuildMode = "full" | "blank"
/** 任务形态：与建库形态正交（两种库都能续写） */
export type KnowledgeBaseTaskKind = "full" | "update" | "incremental"

/** 设置页一张卡片需要的全部信息 */
export interface KnowledgeBaseListItem {
	slug: string
	name: string
	/** 目录绝对路径（「打开目录」按钮用） */
	dir: string
	enabled: boolean
	/** kb.json 读不出来（损坏/被手删）→ 只允许删除 */
	broken: boolean
	/** 磁盘上实际的分片文件数 */
	fileCount: number
	hasIndex: boolean
	createdAt: string
	updatedAt: string
	/** 建库时记录的游戏版本 */
	gameVersion?: string
	/** 本次运行时探测到的游戏版本 */
	currentGameVersion?: string
	/** 版本对不上 → 卡片标「可能过期」 */
	stale: boolean
	counts?: KnowledgeBaseCounts
	/** 构建状态：只有 ready 会注入对话 */
	buildStatus: KnowledgeBaseBuildStatus
	/** 建库形态（完整 / 空白）——建库后不再变化 */
	buildMode?: KnowledgeBaseBuildMode
	/** 最近一次任务的形态 */
	buildTaskKind?: KnowledgeBaseTaskKind
	buildStartedAt?: string
	/** 上次构建失败/中断的原因（人话） */
	buildError?: string
}

/** 设置页发出的动作（`knowledgeBaseAction` 的请求体） */
export type KnowledgeBaseAction =
	| { action: "create"; name: string; mode?: KnowledgeBaseBuildMode }
	| { action: "update"; slug: string }
	/** 续写：按范围补库（完整库与空白库都适用，产物与完整建库相同） */
	| {
			action: "increment"
			slug: string
			scope: { kind: "recent" } | { kind: "topic"; topic: string } | { kind: "paths"; paths: string[] }
	  }
	| { action: "enable"; slug: string; enabled: boolean }
	| { action: "delete"; slug: string }
	/** 在系统文件管理器里打开库目录（不改内容，只是省得用户自己去翻路径） */
	| { action: "reveal"; slug: string }
	/**
	 * 手动把「构建中」标成失败（#97 的自救出口）。
	 *
	 * `building` 只在任务真正收尾时才会被改写；窗口重载、任务被替换、扩展崩溃都会让它
	 * 永久卡住，而「更新 / 续写 / 删除」三个出口全被它禁用。这里给用户一个「我知道它死了」的按钮。
	 */
	| { action: "markFailed"; slug: string }

/** `knowledgeBaseAction` 的响应体 */
export interface KnowledgeBaseActionResult {
	ok: boolean
	/** 失败原因（人话，直接展示给用户） */
	message?: string
	/** create 成功时回传新库的 slug，便于前端立刻高亮 */
	slug?: string
}

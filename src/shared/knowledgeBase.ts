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
}

/** 设置页发出的动作（`knowledgeBaseAction` 的请求体） */
export type KnowledgeBaseAction =
	| { action: "create"; name: string }
	| { action: "update"; slug: string }
	| { action: "enable"; slug: string; enabled: boolean }
	| { action: "delete"; slug: string }
	/** 在系统文件管理器里打开库目录（不改内容，只是省得用户自己去翻路径） */
	| { action: "reveal"; slug: string }

/** `knowledgeBaseAction` 的响应体 */
export interface KnowledgeBaseActionResult {
	ok: boolean
	/** 失败原因（人话，直接展示给用户） */
	message?: string
	/** create 成功时回传新库的 slug，便于前端立刻高亮 */
	slug?: string
}

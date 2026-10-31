/**
 * 专属知识库（game knowledge base）的运行时结构。
 *
 * 设计前提：**扩展不内置任何游戏知识**。知识库由 AI 在对话里读当前工作区生成，
 * 扩展只负责「列出 / 开关 / 新建 / 更新 / 删除」，以及把**索引**注入提示词。
 *
 * 这样做的三个理由：
 * 1. 分发边界：vsix 里不能出现游戏文本/资源（成人向内容一律不落盘）；
 * 2. 版本跟随：游戏本体一更新，库就该重建——内置快照必然过期；
 * 3. 可扩展：换一个游戏只是换一次扫描对象，扩展侧零改动。
 *
 * 存放位置：`<工作区根>/.era-harness/knowledge/<slug>/`。
 * `.era-harness/` 已被更新器的 `PROTECTED_PREFIXES` 排除，游戏更新不会冲掉知识库。
 */

/** 条目类别（只用于统计与索引分组，不约束 AI 怎么写） */
export type GameKbKind = "function" | "constant" | "table" | "other"

/** 分片文件引用（由 AI 在收尾时写进 manifest） */
export interface GameKbFileRef {
  /** 相对知识库目录的路径，如 `functions/combat.md` */
  path: string
  /** 分片标题，如「战斗相关函数」 */
  title?: string
  /** 该片条目数（AI 自报，读不到就不显示） */
  count?: number
}

/** `kb.json` —— 唯一元数据文件。扩展写初版，AI 在收尾时补 counts/files/updatedAt。 */
export interface GameKbManifest {
  schemaVersion: 1
  /** 目录名，同时是唯一标识；生成后不再变 */
  slug: string
  /** 用户起的名字，可含中文 */
  name: string
  /** 目标工程根（绝对路径），用于「这个库是给哪个游戏建的」 */
  gameRoot?: string
  /** 建库时的游戏版本串（如 4.981），用于过期提示 */
  gameVersion?: string
  createdAt: string
  updatedAt: string
  /** 是否把索引注入对话（默认 true） */
  enabled: boolean
  /** 索引文件名，默认 index.md */
  index?: string
  counts?: Partial<Record<GameKbKind, number>>
  files?: GameKbFileRef[]
}

/** 设置页展示用：manifest + 磁盘上的实际情况 */
export interface GameKbEntry {
  slug: string
  /** 目录绝对路径 */
  dir: string
  manifest: GameKbManifest | null
  /** manifest 读不出来（损坏/被删）时为 true，只允许删除 */
  broken: boolean
  /** 磁盘上实际存在的分片数（manifest.files 不可信时的兜底） */
  fileCount: number
  /** 索引文件是否存在 */
  hasIndex: boolean
}

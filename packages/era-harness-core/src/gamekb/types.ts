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

/**
 * 构建状态：`draft` = 只有骨架、还没有内容（空白建库刚建库时的状态）；
 * `building` = 有任务正在写；`ready` = 至少完成过一次构建/续写；`failed` = 中断/失败。
 *
 * 注入提示词只认 `ready`——骨架/半成品不能当成可用库（#93）。
 */
export type GameKbBuildStatus = "draft" | "building" | "ready" | "failed"

/**
 * 建库形态（用户在「新建」时选的那个选项）：
 * - `full` = 完整知识库：开一场对话通读全工程；
 * - `blank` = 空白知识库：只建空索引骨架，不开对话。
 *
 * ⛔ 只由 `createKnowledgeBase` 写。任务不会、也不应该改它——
 * 否则“这个库当初是完整建还是空白建”就不可知（见 3.95.1 的修正）。
 */
export type GameKbBuildMode = "full" | "blank"

/**
 * 任务形态（开对话时记录）：整库建库 / 全量更新 / 按范围续写。
 *
 * 与建库形态**正交**：完整库和空白库都能被任意任务续写，
 * 所以续写不存在“专属于某种库”的说法（用户 2026-10-31 澄清）。
 */
export type GameKbTaskKind = "full" | "update" | "incremental"

export interface GameKbBuildState {
  status: GameKbBuildStatus
  /** 建库时的形态（不会被后续任务覆盖） */
  mode?: GameKbBuildMode
  /** 最近一次任务的形态 */
  taskKind?: GameKbTaskKind
  /** 构建任务号（扩展开对话后回填），失配时可用于判断「任务已被替换」 */
  taskId?: string
  startedAt?: string
  finishedAt?: string
  /** 失败/中断原因（人话） */
  error?: string
}

/**
 * 纯 UI 状态（`ui.json`，宿主独占）。
 *
 * 为什么不留在 `kb.json`：模型会在收尾时整篇重写 `kb.json`，而用户点「载入到对话」开关
 * 走的是「读 kb.json → 合并 → 写回」——两边并发就会互相覆盖（#115，与 #106 同源）。
 * 把开关搬进独立 sidecar 后，宿主写盘不再碰模型正在写的那个文件。
 */
export interface GameKbUiState {
  /** 是否把索引注入对话 */
  enabled: boolean
}

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
  /**
   * 是否把索引注入对话（默认 true）。
   *
   * ⚠️ 这是**只读镜像**，事实源在 `ui.json`（见 `GameKbUiState`）。保留它只为兼容旧版本读取，
   * 判断开关一律走 `readManifest()` 合并后的值，不要直接读这里。
   */
  enabled: boolean
  /** 索引文件名，默认 index.md */
  index?: string
  counts?: Partial<Record<GameKbKind, number>>
  files?: GameKbFileRef[]
  /** 构建状态（旧库没有该字段，读时按「有内容即 ready」兼容） */
  build?: GameKbBuildState
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
  /** 构建状态（由 resolveBuildStatus 按 manifest + 磁盘实际内容判定） */
  buildStatus: GameKbBuildStatus
}

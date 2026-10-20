/**
 * 产品内嵌知识库的运行时结构。
 *
 * 与 `reference/`（指令手册，CC BY-NC 数据）平行：这里是**纪律与机制知识**的结构化快照，
 * 正本在 shared-trae 集群知识库（见 NOTICE-knowledge-sources.md）。内嵌副本随 vsix 分发，
 * 因此只收「跨整合包版本稳定」的机制与纪律，⛔ 不收任何工程的路径/行号/魔改状态。
 *
 * 三层消费：
 * 1. `rules` —— 铁律级短句，供系统提示层（era_domain）注入；
 * 2. `query` —— 按需检索（MCP lookup_knowledge / search_knowledge）；
 * 3. `body`  —— 命中后给模型读的完整说明（markdown）。
 */

/** 知识域（与 shared-trae knowledge/<domain>/ 对应，产品侧只收稳定子集） */
export type KnowledgeDomain = 'encoding' | 'update' | 'kojo' | 'project' | 'gameflow';

/** 一条铁律（提示层注入的最小单位） */
export interface KnowledgeRule {
  /** 稳定编号，如 `enc-01`；提示层与测试按 id 引用 */
  id: string;
  /** 一句话纪律，可直接进系统提示 */
  text: string;
}

/** 一个反模式三元组（症状 → 根因 → 修法） */
export interface KnowledgePitfall {
  symptom: string;
  cause: string;
  fix: string;
}

/** 溯源：正本在 shared-trae，本副本是快照 */
export interface KnowledgeSource {
  /** 正本位置（shared-trae 仓内相对路径，或外部 URL） */
  upstream: string;
  /** 抓取时正本所在仓的 commit（短 sha 即可）；无法确定时省略 */
  sha?: string;
  /** 快照日期 YYYY-MM-DD */
  snapshotAt: string;
}

/** 一个知识条目 */
export interface KnowledgeEntry {
  /** 唯一 id，kebab-case */
  id: string;
  domain: KnowledgeDomain;
  title: string;
  /** 一句话摘要（检索预览） */
  summary: string;
  /** 检索键（中英混合，含常见误称） */
  tags: string[];
  /** 铁律级短句 */
  rules: KnowledgeRule[];
  /** 反模式三元组 */
  pitfalls: KnowledgePitfall[];
  /** 完整说明（markdown，检索命中时给模型读） */
  body: string;
  source: KnowledgeSource;
}

/** 检索命中 */
export interface KnowledgeHit {
  entry: KnowledgeEntry;
  /** 命中位置：id > title > tags > summary > body */
  field: 'id' | 'title' | 'tags' | 'summary' | 'body';
  score: number;
  snippet?: string;
}

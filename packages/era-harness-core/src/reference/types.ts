/**
 * 指令知识库（emuera.sk.doc）的运行时结构。
 *
 * 数据来源：https://github.com/qirchen421/emuera.sk.doc 的
 * `docs/Reference/*.zh.md`（API 指令）、`docs/Emuera/*.zh.md`（语法/规格）、
 * `docs/tutorial/*.zh.md`（教程），由 `scripts/build-reference.ts` 离线抓取并生成
 * `src/reference/data/*.ts`。该数据沿用上游 **CC BY-NC 4.0**，
 * 与本仓库代码的 Apache-2.0 **分开管理**（见 NOTICE）。
 *
 * ⚠ 不变量：`id` **永不**拼进 URL 或文件名（规格页切段后会含 `#` 与 `/`）。
 * 需要取上游页面时一律用 `sourcePath`，见 `online.ts` 的 `referencePageUrl`。
 */

/**
 * 引擎来源标记。
 *
 * 上游文档用图标区分「这条指令由哪个引擎引入或改写」：
 * eramaker 原生 / Emuera 追加 / EvilMask 版 / Enter's Edition / Emuera.NET / SkiaSharp 版 / 其他贡献者。
 * 保留它是因为**只用哪一版引擎能跑**直接决定改完脚本会不会在别人的环境里报错。
 */
export type EngineOrigin = 'eramaker' | 'emuera' | 'em' | 'ee' | 'net' | 'skia' | 'etc';

/** 签名表的一行 */
export interface ReferenceSignature {
  /** 命令 / 函数名，统一大写 */
  name: string;
  /** 参数签名原文（可能是 `int`, `int`, `int` 或 `无`） */
  params: string;
  /** 返回值原文（`无` 表示 void） */
  returns: string;
  /** 引入或改写该条目的引擎 */
  engines: EngineOrigin[];
  /** 同一名字的后续重载行（上游表格用空名字单元格续写） */
  overloads: string[];
}

/** 一个条目（Reference 一页一条；Emuera 规格页按 `###` 切段，一页可能多条） */
export interface ReferenceEntry {
  /**
   * 条目唯一 id。
   * - Reference 页：页面文件名主干，如 `SELECTCASE` / `DT_ROW`（历史形态，保持不变）
   * - Emuera 规格页切段：`<页面 slug>#<指令名>`，如 `Emuera/function#LOCALSIZE`
   * - tutorial 页：`<页面 slug>`，如 `tutorial/erb-format-extension`
   */
  id: string;
  /** 页面标题（H1），如「PRINT 系」「SETCOLOR, RESETCOLOR」「函数·预处理器」 */
  title: string;
  /** 本页覆盖的全部名字，去重保序 */
  names: string[];
  /** 签名表；规格页与教程页没有签名表，为空数组 */
  signatures: ReferenceSignature[];
  /** 首段摘要，用于搜索结果预览 */
  summary: string;
  /** 正文：已去掉 frontmatter / 标题 / 签名表，图标与内部链接已归一 */
  body: string;
  /**
   * 页面 slug —— **仅切段条目**有，用于指回被切开的同一页，如 `Emuera/function`。
   * 页面级条目（Reference / tutorial）不设此字段，此时页面 slug 就等于 `id`。
   */
  pageId?: string;
  /**
   * 上游仓库内相对路径，如 `docs/Emuera/function.zh.md`。
   * 在线取数与溯源都用它；缺省时按历史形态回退 `docs/Reference/<id>.zh.md`。
   */
  sourcePath?: string;
  /**
   * 只读内置快照，不随线上刷新。
   * 规格页切段条目置 true：整页替换会把切开的段并回一页，再被正文上限截断。
   */
  localOnly?: boolean;
}

/** 检索命中 */
export interface ReferenceHit {
  entry: ReferenceEntry;
  /** 命中位置：名字 > 标题 > 正文 */
  field: 'name' | 'title' | 'body';
  /** 分数越高越相关 */
  score: number;
  /** 正文命中时的上下文片段 */
  snippet?: string;
}

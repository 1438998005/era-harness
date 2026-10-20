/**
 * 指令知识库（emuera.sk.doc Reference）的运行时结构。
 *
 * 数据来源：https://github.com/qirchen421/emuera.sk.doc 的 `docs/Reference/*.zh.md`，
 * 由 `scripts/build-reference.ts` 离线抓取并生成为 `src/reference/data/*.ts`。
 * 该数据沿用上游 **CC BY-NC 4.0**，与本仓库代码的 Apache-2.0 **分开管理**（见 NOTICE）。
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

/** 一个 Reference 页面 = 一个条目（同页可能覆盖多个名字，如 SETCOLOR / RESETCOLOR） */
export interface ReferenceEntry {
  /** 页面文件名主干，唯一，如 `SELECTCASE` / `DT_ROW` */
  id: string;
  /** 页面标题（H1），如「PRINT 系」「SETCOLOR, RESETCOLOR」 */
  title: string;
  /** 本页覆盖的全部名字，去重保序 */
  names: string[];
  /** 签名表；个别页面没有表格时为空数组 */
  signatures: ReferenceSignature[];
  /** 首段摘要，用于搜索结果预览 */
  summary: string;
  /** 正文：已去掉 frontmatter / 标题 / 签名表，图标与内部链接已归一 */
  body: string;
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

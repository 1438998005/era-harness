import type { EncodingKind } from '../profile/types.js';

/** BOM 种类（比 EncodingKind 更细的字节序事实）。 */
export type BomKind = 'none' | 'utf8' | 'utf16le' | 'utf16be';

/** decodeToUtf8 的返回：统一 UTF-8 文本 + 来源事实。 */
export interface DecodedText {
  /** 解码后的文本；若源带 BOM 已剥离；换行符保持原样（CRLF 不改写，行号保真） */
  text: string;
  /** detectEncoding 的探测分类（utf8Bom / utf8 / cp932 / unknown） */
  encoding: EncodingKind;
  /** BOM 探测结果（detectEncoding 归入 unknown 的 UTF-16 在此区分 LE/BE） */
  bom: BomKind;
  /** 源字节总长度（含 BOM） */
  byteLength: number;
  /** 是否有不可解码字节被 U+FFFD 替换（UTF-8 BOM 主体损坏、CP932 fatal 失败、兜底路径） */
  lossy: boolean;
}

/** readTextFile 的返回。 */
export interface ReadTextResult extends DecodedText {
  /** 读取的文件路径 */
  path: string;
  /** 磁盘上的真实字节数（未限流时等于 byteLength） */
  totalBytes: number;
  /** 是否因 maxBytes 只读了开头一段（引用的是磁盘真实大小，不是 byteLength） */
  truncated: boolean;
}

/** readTextFile 的可选参数。 */
export interface ReadTextOptions {
  /**
   * 最多读取的字节数（从文件开头算）。
   *
   * 存在的理由：日志动辄上百 MB，整份读进来再解析会把扩展宿主卡死，
   * 而调用方拿到的结果最终还要被 truncateContent 截断到几 KB —— 先读后截毫无意义。
   * 超出时只读前 maxBytes 字节，并在返回里标记 truncated。
   */
  maxBytes?: number;
}

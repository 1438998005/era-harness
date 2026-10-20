import { open, readFile } from 'node:fs/promises';
import { detectEncoding } from '../profile/scan.js';
import type { BomKind, DecodedText, ReadTextOptions, ReadTextResult } from './types.js';

/**
 * CP932 解码标签：WHATWG Encoding Standard 没有 'cp932' 标签（Node 下会直接抛
 * RangeError），full-ICU 构建的 Node 用 'windows-31j' 即 CP932（Windows-31J）。
 * 本项目目标游戏与 ERB/CSV 均由 Windows 编辑器落盘，CP932 语义以此标签覆盖。
 */
const CP932_LABEL = 'windows-31j';

/**
 * BOM 探测：只看前几个字节，不校验主体。
 * 与 detectEncoding 的分工：detectEncoding 给粗分类（UTF-16 一律 unknown），
 * 本函数给细粒度字节序事实（utf16le / utf16be 可分）。
 */
export function detectBom(buffer: Buffer): BomKind {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf8';
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return 'utf16le';
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return 'utf16be';
  }
  return 'none';
}

/** fatal 优先解码；失败分两种：标签不被支持（small-icu 极端构建）→ latin1 兜底；字节非法 → 非 fatal 重解（坏字节变 U+FFFD）。 */
function decodeWith(label: string, body: Buffer): { text: string; lossy: boolean } {
  try {
    return { text: new TextDecoder(label, { fatal: true }).decode(body), lossy: false };
  } catch (e) {
    if (e instanceof RangeError) {
      return { text: body.toString('latin1'), lossy: true };
    }
    return { text: new TextDecoder(label).decode(body), lossy: true };
  }
}

/**
 * 把任意来源字节解码为统一 UTF-8 文本：剥离 BOM、CP932→UTF-8。
 * **不抛异常**——任何字节序列都有输出，质量信号看 `lossy`。
 * 复用 profile/scan.ts 的 detectEncoding 做编码粗分类。
 */
export function decodeToUtf8(buffer: Buffer): DecodedText {
  const bom = detectBom(buffer);
  const base = { encoding: detectEncoding(buffer), bom, byteLength: buffer.length };

  if (bom === 'utf16le') {
    const r = decodeWith('utf-16le', buffer.subarray(2));
    return { ...base, text: r.text, lossy: r.lossy };
  }
  if (bom === 'utf16be') {
    const body = buffer.subarray(2);
    if (body.length % 2 !== 0) {
      // 奇数字节：解掉完整的前半段，尾字节补替换符
      return { ...base, text: body.subarray(0, body.length - 1).toString('utf16le') + '\uFFFD', lossy: true };
    }
    const swapped = Buffer.from(body);
    swapped.swap16();
    const r = decodeWith('utf-16le', swapped);
    return { ...base, text: r.text, lossy: r.lossy };
  }
  if (bom === 'utf8') {
    const r = decodeWith('utf-8', buffer.subarray(3));
    return { ...base, text: r.text, lossy: r.lossy };
  }
  if (base.encoding === 'cp932') {
    const r = decodeWith(CP932_LABEL, buffer);
    return { ...base, text: r.text, lossy: r.lossy };
  }
  // 剩余只有 'utf8'：detectEncoding 已用 fatal 严格校验过，必然合法
  const r = decodeWith('utf-8', buffer);
  return { ...base, text: r.text, lossy: r.lossy };
}

/**
 * 编码安全读文件：探测 → 解码 → 统一 UTF-8。
 * IO 错误（文件不存在等）照常抛错，不吞。
 * 注意：只解决**读**；harness 写文件必须按原编码还原（判据见内嵌知识条目
 * `interpreter-encoding-discipline`，正本＝shared-trae `knowledge/lazyloading/encoding-discipline.md`），
 * 本模块不含写路径。
 *
 * 传 `maxBytes` 时只读文件开头那一段（日志上百 MB 时整份读进来会卡死宿主），
 * 返回的 `truncated` / `totalBytes` 让调用方把「我只看了开头」如实告诉模型。
 */
export async function readTextFile(filePath: string, options: ReadTextOptions = {}): Promise<ReadTextResult> {
  const limit = options.maxBytes;
  if (limit === undefined || limit <= 0) {
    const buffer = await readFile(filePath);
    return { path: filePath, ...decodeToUtf8(buffer), totalBytes: buffer.length, truncated: false };
  }

  const handle = await open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    if (size <= limit) {
      const buffer = await handle.readFile();
      return { path: filePath, ...decodeToUtf8(buffer), totalBytes: size, truncated: false };
    }
    const buffer = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(buffer, 0, limit, 0);
    // 截断点必须落在整行边界上：切在多字节字符中间会让 detectEncoding 误判整个文件
    // （UTF-8 尾部残字节校验失败 → 分到 cp932 → 整个开头变成乱码）。
    // 0x0A 在 UTF-8 与 CP932 里都不会出现在多字节字符内部，退到最后一个换行是安全的。
    const chunk = buffer.subarray(0, bytesRead);
    const lastBreak = chunk.lastIndexOf(0x0a);
    const body = lastBreak > 0 ? chunk.subarray(0, lastBreak + 1) : chunk;
    const decoded = decodeToUtf8(body);
    return {
      path: filePath,
      ...decoded,
      text: `${decoded.text}\n[已截断：只读取了前 ${body.length} 字节（文件共 ${size} 字节）]`,
      totalBytes: size,
      truncated: true,
    };
  } finally {
    await handle.close();
  }
}

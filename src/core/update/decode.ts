/**
 * 按引擎口径解码 ERB/CSV 字节。
 *
 * 与引擎 `EncodingHandler.DetectEncoding` 同策略的简化版（正本：
 * shared-trae `knowledge/lazyloading/encoding-discipline.md`）：
 * 1. 首 3 字节 `EF BB BF` → UTF-8（剥 BOM）；
 * 2. 否则严格 UTF-8 全文件校验，失败 → CP932（shift_jis）。
 *
 * 闸门与标签索引只需要「能对齐行号与标签」的文本，lossy 解码对判据足够；
 * 真正的读写安全在核心库 `src/encoding/`（BOM 探测 + 无损路径）。
 */

/** 解码失败不抛：坏字节按替换符进文本（判据容错优先于严格） */
export function decodeLikeEngine(buf: Buffer): string {
	if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
		return new TextDecoder("utf-8").decode(buf.subarray(3))
	}
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(buf)
	} catch {
		return new TextDecoder("shift-jis").decode(buf)
	}
}

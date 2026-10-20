/**
 * 编码写回结论的拼接。
 *
 * 判据与复检都在核心库 `@eraharness/encoding/write`，落盘形态由
 * `DiffViewProvider.enforceWriteEncoding()` 负责还原；这里只负责把结论接到工具结果尾部，
 * 让模型看见「这次是按什么规格写的 / 哪里没对上」。
 */

/** 把编码写回结论拼到工具结果后面；没有结论时原样返回。 */
export function appendEncodingNote(toolResult: string, note: string | undefined): string {
	if (!note) {
		return toolResult
	}

	return `${toolResult}\n\n${note}`
}

import { readGlobalMemoryDocument } from "@core/storage/globalMemory"
import type { EmptyRequest, String as StringMessage } from "@shared/proto/cline/common"
import { String as StringValue } from "@shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * 读取全局记忆整份文档（JSON 字符串）。
 *
 * 设置页在挂载时取一次；结构简单，不单独定义 proto 消息——避免生成物扩散。
 */
export async function getGlobalMemory(_controller: Controller, _request: EmptyRequest): Promise<StringMessage> {
	const document = await readGlobalMemoryDocument()
	return StringValue.create({ value: JSON.stringify(document) })
}

import { readGlobalMemoryDocument, writeGlobalMemoryDocument } from "@core/storage/globalMemory"
import { normalizeGlobalMemoryDocument } from "@shared/global-memory"
import type { Empty, StringRequest } from "@shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * 写入/清空全局记忆（设置页的唯一写入口）。
 *
 * 入参是整份 JSON 文档：设置页的「开关 / 逐条删除 / 清空」都只是改这份文档再回写，
 * 不需要为每种操作单独加 RPC。文档以字符串过 RPC，编译期没有形状约束，所以这里
 * 必须自己卡住下限：
 * - 缺 `entries` 数组一律拒写（疑似 webview / 扩展版本不同步），否则一次回写就清空全部偏好；
 * - payload 没带 `enabled` 时跟随磁盘现值，不能把用户刚关掉的记忆默认打开。
 */
export async function updateGlobalMemory(_controller: Controller, request: StringRequest): Promise<Empty> {
	let parsed: unknown
	try {
		parsed = request.value ? JSON.parse(request.value) : undefined
	} catch {
		throw new Error("全局记忆文档不是合法的 JSON，已拒绝写入")
	}

	if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { entries?: unknown }).entries)) {
		throw new Error("全局记忆写入被拒绝：缺少 entries 数组（疑似版本不匹配），请重载窗口后重试")
	}

	const current = await readGlobalMemoryDocument()
	const payload = parsed as { enabled?: unknown }
	const next = normalizeGlobalMemoryDocument({
		...parsed,
		enabled: typeof payload.enabled === "boolean" ? payload.enabled : current.enabled,
	})

	await writeGlobalMemoryDocument(next)
	return {}
}

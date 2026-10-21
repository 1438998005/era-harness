import {
	applyGlobalMemorySeeds,
	applyGlobalMemoryUpsert,
	createEmptyGlobalMemory,
	type GlobalMemoryDocument,
	type GlobalMemoryUpsertInput,
	type GlobalMemoryUpsertResult,
	normalizeGlobalMemoryDocument,
} from "@shared/global-memory"
import fs from "fs/promises"
import * as path from "path"
import { HostProvider } from "@/hosts/host-provider"
import { Logger } from "@/shared/services/Logger"

/**
 * 全局记忆的磁盘读写（本机 globalStorage，跨工作区共享）。
 *
 * - 单一 JSON 文件：`<globalStorage>/global-memory.json`。
 * - 原子写（tmp + rename）：多窗口同时写最多丢一条新增，不会写坏文件。
 * - **不可读 ≠ 空文档**：自动写入口（种子 / 工具 upsert / remove）碰到读失败时必须停下，
 *   否则一次瞬时占用或半截 JSON 就会把“只剩两条种子”的空文档盖上去，静默抹掉用户全部记忆。
 *   只有用户显式提交的整份文档（设置页 updateGlobalMemory）可以跨过读失败，用于损坏时自救。
 */

const GLOBAL_MEMORY_FILE = "global-memory.json"

export function getGlobalMemoryFilePath(): string {
	return path.join(HostProvider.get().globalStorageFsPath, GLOBAL_MEMORY_FILE)
}

async function writeDocumentAtomic(document: GlobalMemoryDocument): Promise<void> {
	const filePath = getGlobalMemoryFilePath()
	const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`

	try {
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(tmpPath, JSON.stringify(document, null, 2), "utf8")
		await fs.rename(tmpPath, filePath)
	} catch (error) {
		fs.unlink(tmpPath).catch(() => {})
		throw error
	}
}

/**
 * 读盘。`null` = 文件存在但读不出合法内容（权限 / 被占用 / 半截 JSON）。
 * 任何“先读后写”的自动路径都必须先判 null，不要把 null 当成空文档。
 */
export async function tryReadGlobalMemoryDocument(): Promise<GlobalMemoryDocument | null> {
	try {
		const raw = await fs.readFile(getGlobalMemoryFilePath(), "utf8")
		return normalizeGlobalMemoryDocument(JSON.parse(raw))
	} catch (error) {
		const code = (error as NodeJS.ErrnoException)?.code
		if (code === "ENOENT") {
			return createEmptyGlobalMemory()
		}

		Logger.error("[global-memory] 读取失败，本轮不读写：", error)
		return null
	}
}

/**
 * 只读场景（提示注入、设置页展示）：读不出来就当没有记忆，不能阻塞任务。
 * 需要写盘的调用请用 `tryReadGlobalMemoryDocument`。
 */
export async function readGlobalMemoryDocument(): Promise<GlobalMemoryDocument> {
	return (await tryReadGlobalMemoryDocument()) ?? createEmptyGlobalMemory()
}

export async function writeGlobalMemoryDocument(document: GlobalMemoryDocument): Promise<GlobalMemoryDocument> {
	const normalized = normalizeGlobalMemoryDocument({
		...document,
		updatedAt: Date.now(),
	})
	await writeDocumentAtomic(normalized)
	return normalized
}

export type UpsertGlobalMemoryEntryInput = GlobalMemoryUpsertInput
export type GlobalMemoryMutationResult = GlobalMemoryUpsertResult

/**
 * 新增或更新一条记忆（磁盘层）。
 *
 * 去重 / 限量 / 报错口径全在 `applyGlobalMemoryUpsert`（纯函数，已单测），
 * 这里只负责读盘 → 应用 → 原子写回。
 */
export async function upsertGlobalMemoryEntry(input: UpsertGlobalMemoryEntryInput): Promise<GlobalMemoryMutationResult> {
	const document = await tryReadGlobalMemoryDocument()
	if (!document) {
		throw new Error("全局记忆文件暂时读不出来（可能被其它窗口占用），本次没有写入；请稍后重试。")
	}
	const result = applyGlobalMemoryUpsert(document, input)
	const next = await writeGlobalMemoryDocument(result.document)
	const saved = next.entries.find((candidate) => candidate.id === result.entry.id)
	if (!saved) {
		// 归一化后目标 id 消失，说明本次写入没有真的落盘；不能把未落盘的结果回给模型
		throw new Error("记忆写入后未能定位到条目，请重试")
	}
	return { document: next, entry: saved, created: result.created }
}

export async function removeGlobalMemoryEntry(id: string): Promise<GlobalMemoryDocument> {
	const document = await tryReadGlobalMemoryDocument()
	if (!document) {
		throw new Error("全局记忆文件暂时读不出来（可能被其它窗口占用），本次没有删除；请稍后重试。")
	}
	const entries = document.entries.filter((entry) => entry.id !== id)
	if (entries.length === document.entries.length) {
		throw new Error(`没有 id 为 ${id} 的记忆条目`)
	}
	return writeGlobalMemoryDocument({ ...document, entries })
}

export interface GlobalMemorySeeds {
	preferredLanguage?: string
	displayName?: string
}

/**
 * 插件侧确定性种子：只写「回答语言」与「称呼」两个能从设置里直接读出的事实。
 *
 * ⛔ 不写 OS 用户名、邮箱、机器名；也不根据对话内容擅自总结——那正是把一次性
 * 结论固化成长期记忆的主要来源。功能关闭时完全不写。
 * 判断与写入口径在 `applyGlobalMemorySeeds`（纯函数，已单测）；这里只负责读盘 → 写回。
 */
export async function ensureGlobalMemorySeeds(seeds: GlobalMemorySeeds): Promise<GlobalMemoryDocument> {
	const document = await tryReadGlobalMemoryDocument()
	if (!document) {
		// 读不出来就原样返回空文档：不注入、也绝不写盘，避免用种子覆盖真实记忆
		return createEmptyGlobalMemory()
	}

	const next = applyGlobalMemorySeeds(document, seeds)
	if (next === document) {
		return document
	}

	return writeGlobalMemoryDocument(next)
}

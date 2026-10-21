/**
 * 全局记忆：跨工作区、跨项目的用户偏好（任务 C）。
 *
 * 设计取舍（写死在代码里，避免后来者“顺手扩展”）：
 * - 只做全局层，不做项目层——项目规则仍归 AGENTS.md / .clinerules。
 * - 文件可清空、功能可关闭；关闭后既不注入提示词，也不向模型暴露写入工具。
 * - 只存结构化条目（文本 + tags + 来源），不存原始对话；不做“夜间自动总结”。
 * - 注入必须带警示头：这是偏好，不是本工程实测事实，冲突时以代码为准。
 *
 * 本文件不依赖 vscode / node 内置模块：扩展宿主与 webview（设置页）共用。
 */

export const GLOBAL_MEMORY_VERSION = 1

export const GLOBAL_MEMORY_LIMITS = {
	/** 最多条目数；到顶后拒绝新增（不静默丢旧条目） */
	maxEntries: 50,
	/** 单条最大字符数（超出截断） */
	maxEntryChars: 200,
	/** 注入提示词的最大字节数 */
	maxPromptBytes: 4 * 1024,
	/** 每条标签数 / 单标签字符数 */
	maxTags: 8,
	maxTagChars: 24,
} as const

export type GlobalMemorySource = "plugin" | "model" | "user"

/** 插件确定性种子只做两类，且用 seeded 记录“种过”，用户删了不会再写回 */
export type GlobalMemorySeedKey = "language" | "name"

export interface GlobalMemoryEntry {
	id: string
	text: string
	tags: string[]
	source: GlobalMemorySource
	createdAt: number
	updatedAt: number
}

export interface GlobalMemoryDocument {
	version: number
	enabled: boolean
	updatedAt: number
	entries: GlobalMemoryEntry[]
	seeded: GlobalMemorySeedKey[]
}

const VALID_SOURCES: GlobalMemorySource[] = ["plugin", "model", "user"]

/** 归一化用于查重：trim + 压缩空白 + 小写 */
export function normalizeMemoryText(text: string): string {
	return text.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * 定位一条已有记忆：给了 id 按 id，否则按归一化文本查重。
 *
 * 抽成纯函数的原因：磁盘层的 upsert 与测试必须用同一套判重口径，
 * 否则「模型以为新增、实际新增了重复条」这类问题只能在运行时才暴露。
 */
export function findGlobalMemoryEntryIndex(
	entries: readonly GlobalMemoryEntry[],
	selector: { id?: string; text?: string },
): number {
	const id = selector.id?.trim()
	if (id) {
		return entries.findIndex((entry) => entry.id === id)
	}

	const text = selector.text?.trim()
	if (!text) {
		return -1
	}

	const key = normalizeMemoryText(text)
	return entries.findIndex((entry) => normalizeMemoryText(entry.text) === key)
}

export function createEmptyGlobalMemory(now = Date.now()): GlobalMemoryDocument {
	return {
		version: GLOBAL_MEMORY_VERSION,
		enabled: true,
		updatedAt: now,
		entries: [],
		seeded: [],
	}
}

function clampText(text: string, maxChars: number): string {
	if (text.length <= maxChars) {
		return text
	}
	return `${text.slice(0, Math.max(0, maxChars - 1))}…`
}

function normalizeTags(input: unknown): string[] {
	if (!Array.isArray(input)) {
		return []
	}

	const tags: string[] = []
	for (const item of input) {
		if (typeof item !== "string") {
			continue
		}
		const tag = clampText(item.trim(), GLOBAL_MEMORY_LIMITS.maxTagChars)
		if (tag && !tags.includes(tag)) {
			tags.push(tag)
		}
		if (tags.length >= GLOBAL_MEMORY_LIMITS.maxTags) {
			break
		}
	}
	return tags
}

function normalizeSource(input: unknown): GlobalMemorySource {
	return VALID_SOURCES.includes(input as GlobalMemorySource) ? (input as GlobalMemorySource) : "user"
}

function normalizeTimestamp(input: unknown, fallback: number): number {
	return typeof input === "number" && Number.isFinite(input) && input > 0 ? input : fallback
}

function normalizeEntry(input: unknown, index: number, now: number): GlobalMemoryEntry | undefined {
	if (!input || typeof input !== "object") {
		return undefined
	}

	const record = input as Record<string, unknown>
	if (typeof record.text !== "string") {
		return undefined
	}

	const text = clampText(record.text.trim(), GLOBAL_MEMORY_LIMITS.maxEntryChars)
	if (!text) {
		return undefined
	}

	const rawId = typeof record.id === "string" ? record.id.trim() : ""
	const createdAt = normalizeTimestamp(record.createdAt, now)

	return {
		id: rawId || `entry-${index + 1}`,
		text,
		tags: normalizeTags(record.tags),
		source: normalizeSource(record.source),
		createdAt,
		updatedAt: normalizeTimestamp(record.updatedAt, createdAt),
	}
}

/**
 * 清洗任意输入（来自磁盘、RPC 或模型）为合法文档。
 *
 * - 脏数据丢弃而不是报错：设置页/工具拿到的永远是可用文档。
 * - 按归一化文本去重（保留最新一条），再按 maxEntries 截断。
 * - 不抛异常：调用方无需 try/catch。
 */
export function normalizeGlobalMemoryDocument(input: unknown, now = Date.now()): GlobalMemoryDocument {
	if (!input || typeof input !== "object") {
		return createEmptyGlobalMemory(now)
	}

	const record = input as Record<string, unknown>
	const enabled = typeof record.enabled === "boolean" ? record.enabled : true
	const rawEntries = Array.isArray(record.entries) ? record.entries : []

	const byText = new Map<string, GlobalMemoryEntry>()
	const usedIds = new Set<string>()

	rawEntries.slice(0, GLOBAL_MEMORY_LIMITS.maxEntries * 2).forEach((raw, index) => {
		const entry = normalizeEntry(raw, index, now)
		if (!entry) {
			return
		}

		// 同文本视为同一条：后出现的（通常更新）覆盖前一条
		const key = normalizeMemoryText(entry.text)
		const previous = byText.get(key)
		if (previous) {
			usedIds.delete(previous.id)
			entry.createdAt = Math.min(previous.createdAt, entry.createdAt)
			entry.updatedAt = Math.max(previous.updatedAt, entry.updatedAt)
		}

		// id 冲突：加后缀，保证 remove/update 能唯一定位
		let id = entry.id
		let suffix = 2
		while (usedIds.has(id)) {
			id = `${entry.id}-${suffix++}`
		}
		entry.id = id
		usedIds.add(id)
		byText.set(key, entry)
	})

	const entries = Array.from(byText.values()).slice(0, GLOBAL_MEMORY_LIMITS.maxEntries)
	const seeded = Array.isArray(record.seeded)
		? record.seeded.filter((key): key is GlobalMemorySeedKey => key === "language" || key === "name")
		: []

	return {
		version: GLOBAL_MEMORY_VERSION,
		enabled,
		updatedAt: normalizeTimestamp(record.updatedAt, now),
		entries,
		seeded,
	}
}

function utf8ByteLength(text: string): number {
	return new TextEncoder().encode(text).length
}

function formatEntryLine(entry: GlobalMemoryEntry, index: number): string {
	const tagText = entry.tags.length > 0 ? `［${entry.tags.join("・")}］` : ""
	return `${index + 1}. ${tagText}${entry.text}`
}

/** 生成条目 id（同一毫秒内多次写入也不会撞） */
export function createGlobalMemoryEntryId(now = Date.now()): string {
	return `mem-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface GlobalMemoryUpsertInput {
	id?: string
	text: string
	tags?: string[]
	source: GlobalMemorySource
}

export interface GlobalMemoryUpsertResult {
	document: GlobalMemoryDocument
	entry: GlobalMemoryEntry
	created: boolean
}

/**
 * 新增或更新一条记忆（纯函数，不碰磁盘）。
 *
 * - 指定 id：更新该条；不存在则报错（避免模型以为改成功了）。
 * - 未指定 id：按归一化文本查重，命中则更新，否则新增。
 * - 条目数到上限时拒绝新增（不静默丢弃旧条目）。
 */
export function applyGlobalMemoryUpsert(
	document: GlobalMemoryDocument,
	input: GlobalMemoryUpsertInput,
	now = Date.now(),
): GlobalMemoryUpsertResult {
	const text = input.text.trim()
	if (!text) {
		throw new Error("记忆内容不能为空")
	}

	const targetId = input.id?.trim()
	const index = findGlobalMemoryEntryIndex(document.entries, { id: targetId, text })

	if (targetId && index === -1) {
		throw new Error(`没有 id 为 ${targetId} 的记忆条目；先用 mode=list 查看当前条目`)
	}

	if (index === -1) {
		if (document.entries.length >= GLOBAL_MEMORY_LIMITS.maxEntries) {
			throw new Error(
				`全局记忆已达上限 ${GLOBAL_MEMORY_LIMITS.maxEntries} 条：请先在「设置 → 记忆」删除不需要的条目，或改用 update 修正已有条目`,
			)
		}

		const entry: GlobalMemoryEntry = {
			id: createGlobalMemoryEntryId(now),
			text,
			tags: input.tags ?? [],
			source: input.source,
			createdAt: now,
			updatedAt: now,
		}

		return {
			document: { ...document, entries: [...document.entries, entry] },
			entry,
			created: true,
		}
	}

	const previous = document.entries[index]

	// 指定 id 改文本时，若新文本已属于另一条：直接报错。
	// 否则写盘层的“按文本去重”会把另一条静默删掉，而工具还会回报一个已不存在的 id。
	if (targetId) {
		const nextKey = normalizeMemoryText(text)
		const conflict = document.entries.findIndex(
			(entry, entryIndex) => entryIndex !== index && normalizeMemoryText(entry.text) === nextKey,
		)
		if (conflict !== -1) {
			throw new Error(`该内容已存在于条目 ${document.entries[conflict].id}：请更新那条，或先删除它`)
		}
	}
	const updated: GlobalMemoryEntry = {
		...previous,
		text,
		tags: input.tags && input.tags.length > 0 ? input.tags : previous.tags,
		source: input.source,
		updatedAt: now,
	}
	const entries = [...document.entries]
	entries[index] = updated

	return { document: { ...document, entries }, entry: updated, created: false }
}

export interface GlobalMemorySeedInput {
	preferredLanguage?: string
	displayName?: string
}

const LANGUAGE_SEED_PREFIX = "回答语言："
const NAME_SEED_PREFIX = "称呼："

/**
 * 插件确定性种子（纯函数）：只写「回答语言」与「称呼」。
 *
 * - 关闭时不写；
 * - 已种过（seeded）就不再写：用户在设置页删掉后不会被下一条请求写回；
 * - 条目已满时整轮不写，避免“写一遍又被截断”的空转写盘。
 */
export function applyGlobalMemorySeeds(
	document: GlobalMemoryDocument,
	input: GlobalMemorySeedInput,
	now = Date.now(),
): GlobalMemoryDocument {
	if (!document.enabled) {
		return document
	}

	const seeded = new Set(document.seeded)
	const hasPrefix = (prefix: string) => document.entries.some((entry) => entry.text.trim().startsWith(prefix))
	const language = input.preferredLanguage?.trim()
	const displayName = input.displayName?.trim()

	const additions: GlobalMemoryEntry[] = []
	let seededChanged = false
	const add = (key: GlobalMemorySeedKey, text: string, tags: string[]) => {
		const prefix = key === "language" ? LANGUAGE_SEED_PREFIX : NAME_SEED_PREFIX
		if (seeded.has(key)) {
			return
		}
		// 旧版已写过种子但没有 seeded 字段：补记标记但不新增条目，
		// 否则用户删掉这条旧种子后仍会被下一条请求写回。
		if (hasPrefix(prefix)) {
			seeded.add(key)
			seededChanged = true
			return
		}
		seeded.add(key)
		additions.push({
			id: createGlobalMemoryEntryId(now),
			text: clampText(text, GLOBAL_MEMORY_LIMITS.maxEntryChars),
			tags,
			source: "plugin",
			createdAt: now,
			updatedAt: now,
		})
	}

	if (language) {
		add("language", `${LANGUAGE_SEED_PREFIX}${language}`, ["偏好"])
	}
	if (displayName) {
		add("name", `${NAME_SEED_PREFIX}${displayName}`, ["身份"])
	}

	if (additions.length === 0) {
		return seededChanged ? { ...document, seeded: [...seeded] } : document
	}

	// 放不下就整轮不写：否则写盘层会截断新种子，却仍重写一次文件
	if (document.entries.length + additions.length > GLOBAL_MEMORY_LIMITS.maxEntries) {
		return document
	}

	return { ...document, entries: [...document.entries, ...additions], seeded: [...seeded] }
}

/**
 * 生成注入系统提示词的段落；关闭或没有条目时返回 undefined。
 *
 * 段落头必须保留四句话（删掉任何一句都会让记忆从「偏好提示」变成「事实断言」）：
 * 不是本工程实测事实 / 冲突时以代码为准 / 涉及具体值先验证 / 用户可管理。
 */
export function formatGlobalMemoryForPrompt(
	doc: GlobalMemoryDocument,
	maxBytes = GLOBAL_MEMORY_LIMITS.maxPromptBytes,
): string | undefined {
	if (!doc.enabled || doc.entries.length === 0) {
		return undefined
	}

	const header = [
		"## 全局记忆（跨项目用户偏好）",
		"",
		"> 以下是用户长期偏好与约定，**不是本工程的实测事实**。与代码、日志、配置冲突时，一律以代码/日志/配置为准；涉及具体路径、版本、数值时先验证再使用。",
		"> 用户可在「设置 → 记忆」里修改、删除、清空或关闭这些内容。",
		"",
	].join("\n")

	const lines: string[] = []
	let usedBytes = utf8ByteLength(header)
	let injected = 0

	for (const [index, entry] of doc.entries.entries()) {
		const line = formatEntryLine(entry, index)
		const lineBytes = utf8ByteLength(`${line}\n`)
		if (usedBytes + lineBytes > maxBytes) {
			break
		}
		lines.push(line)
		usedBytes += lineBytes
		injected++
	}

	if (lines.length === 0) {
		return undefined
	}

	const omitted = doc.entries.length - injected
	const footer = omitted > 0 ? `\n（还有 ${omitted} 条未注入，请在设置 → 记忆 中精简）` : ""

	return `${header}${lines.join("\n")}${footer}`
}

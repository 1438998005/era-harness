/**
 * 全局记忆的纯函数层（任务 C1/C6）。
 *
 * 这里只测不依赖 vscode 的部分：清洗、限量、去重、注入格式。
 * 磁盘读写（globalStorage）在手动验证里覆盖，不把 vscode 拖进单测。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	applyGlobalMemorySeeds,
	applyGlobalMemoryUpsert,
	createEmptyGlobalMemory,
	findGlobalMemoryEntryIndex,
	formatGlobalMemoryForPrompt,
	GLOBAL_MEMORY_LIMITS,
	type GlobalMemoryDocument,
	type GlobalMemoryEntry,
	normalizeGlobalMemoryDocument,
	normalizeMemoryText,
} from "../../src/shared/global-memory"

function entry(overrides: Partial<GlobalMemoryEntry> = {}): GlobalMemoryEntry {
	return {
		id: "mem-1",
		text: "回答语言：简体中文",
		tags: [],
		source: "model",
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	}
}

// ————————————————————————————————————————————————
// normalize
// ————————————————————————————————————————————————

test("无效输入回退为空文档，且默认启用", () => {
	const document = normalizeGlobalMemoryDocument(undefined)

	assert.equal(document.enabled, true)
	assert.deepEqual(document.entries, [])
	assert.equal(document.version, 1)
})

test("关闭状态被保留（用户关掉记忆后不能被读回成开启）", () => {
	const document = normalizeGlobalMemoryDocument({ enabled: false, entries: [] })
	assert.equal(document.enabled, false)
})

test("脏条目被丢弃而不是报错", () => {
	const document = normalizeGlobalMemoryDocument({
		entries: [
			null,
			"not-an-object",
			{ text: "   " },
			{ text: 42 },
			{ text: "有效条目", tags: "not-array", source: "hacker" },
			{ text: "有效条目 2", tags: ["偏好", 42, "  "] },
		],
	})

	assert.equal(document.entries.length, 2)
	assert.deepEqual(document.entries[0].tags, [])
	assert.equal(document.entries[0].source, "user", "非法来源按用户处理")
	assert.deepEqual(document.entries[1].tags, ["偏好"])
})

test("单条超长被截断", () => {
	const long = "长".repeat(GLOBAL_MEMORY_LIMITS.maxEntryChars + 50)
	const document = normalizeGlobalMemoryDocument({ entries: [{ text: long }] })

	assert.equal(document.entries[0].text.length, GLOBAL_MEMORY_LIMITS.maxEntryChars)
	assert.ok(document.entries[0].text.endsWith("…"))
})

test("同文本去重：保留后出现的（更新的）内容，显示顺序不变", () => {
	const document = normalizeGlobalMemoryDocument({
		entries: [
			entry({ id: "a", text: "Answer  Language: 简体中文", updatedAt: 10, createdAt: 5 }),
			entry({ id: "b", text: "别的条目", updatedAt: 20 }),
			entry({ id: "c", text: "answer language: 简体中文", updatedAt: 30, createdAt: 15 }),
		],
	})

	assert.equal(document.entries.length, 2)
	const merged = document.entries.find((candidate) => normalizeMemoryText(candidate.text) === "answer language: 简体中文")
	assert.ok(merged, "应命中去重后的条目")
	assert.equal(merged.updatedAt, 30)
	assert.equal(merged.createdAt, 5, "createdAt 取最早")
})

test("条数超限被截断到上限", () => {
	const entries = Array.from({ length: GLOBAL_MEMORY_LIMITS.maxEntries + 20 }, (_, index) =>
		entry({ id: `mem-${index}`, text: `条目 ${index}` }),
	)
	const document = normalizeGlobalMemoryDocument({ entries })

	assert.equal(document.entries.length, GLOBAL_MEMORY_LIMITS.maxEntries)
})

test("重复 id 会被改写，保证 remove/update 能唯一定位", () => {
	const document = normalizeGlobalMemoryDocument({
		entries: [entry({ id: "dup", text: "第一条" }), entry({ id: "dup", text: "第二条" })],
	})

	assert.equal(document.entries.length, 2)
	assert.notEqual(document.entries[0].id, document.entries[1].id)
})

// ————————————————————————————————————————————————
// 注入格式
// ————————————————————————————————————————————————

test("关闭时返回 undefined（提示层不出现记忆段）", () => {
	const document: GlobalMemoryDocument = { ...createEmptyGlobalMemory(), enabled: false, entries: [entry()] }
	assert.equal(formatGlobalMemoryForPrompt(document), undefined)
})

test("没有条目时返回 undefined", () => {
	assert.equal(formatGlobalMemoryForPrompt(createEmptyGlobalMemory()), undefined)
})

test("注入段落必须带「不是本工程实测事实」的警示头", () => {
	const prompt = formatGlobalMemoryForPrompt({ ...createEmptyGlobalMemory(), entries: [entry()] })

	assert.ok(prompt)
	assert.ok(prompt.includes("全局记忆"))
	assert.ok(prompt.includes("不是本工程的实测事实"))
	assert.ok(prompt.includes("以代码/日志/配置为准"))
	assert.ok(prompt.includes("回答语言：简体中文"))
})

test("超过 4KB 时截断并提示剩余条数", () => {
	const entries = Array.from({ length: GLOBAL_MEMORY_LIMITS.maxEntries }, (_, index) =>
		entry({ id: `mem-${index}`, text: `${index} ${"长".repeat(GLOBAL_MEMORY_LIMITS.maxEntryChars - 4)}` }),
	)

	const prompt = formatGlobalMemoryForPrompt({ ...createEmptyGlobalMemory(), entries })

	assert.ok(prompt)
	assert.ok(new TextEncoder().encode(prompt).length <= GLOBAL_MEMORY_LIMITS.maxPromptBytes + 200, "正文应受 4KB 预算约束")
	assert.ok(prompt.includes("条未注入"), "超限时必须告诉用户还有条目没注入")
	assert.ok(!prompt.includes("49 "), "最后一条不应注入")
})

// ————————————————————————————————————————————————
// 查重定位（upsert 与设置页共用）
// ————————————————————————————————————————————————

test("按 id 定位优先于按文本", () => {
	const entries = [entry({ id: "a", text: "甲" }), entry({ id: "b", text: "乙" })]
	assert.equal(findGlobalMemoryEntryIndex(entries, { id: "b", text: "甲" }), 1)
})

test("没有 id 时按归一化文本定位（trim/压缩空白/大小写）", () => {
	const entries = [entry({ id: "a", text: "Answer Language: 简体中文" })]
	assert.equal(findGlobalMemoryEntryIndex(entries, { text: "  answer   language: 简体中文 " }), 0)
})

test("都没命中返回 -1", () => {
	assert.equal(findGlobalMemoryEntryIndex([entry()], { text: "不存在" }), -1)
	assert.equal(findGlobalMemoryEntryIndex([entry()], {}), -1)
})

// ————————————————————————————————————————————————
// upsert（磁盘层与设置页共用的纯函数）
// ————————————————————————————————————————————————

test("upsert：新文本新增一条，并标记 created", () => {
	const result = applyGlobalMemoryUpsert(createEmptyGlobalMemory(), { text: "回答语言：简体中文", source: "model" }, 100)

	assert.equal(result.created, true)
	assert.equal(result.document.entries.length, 1)
	assert.equal(result.entry.text, "回答语言：简体中文")
	assert.equal(result.entry.createdAt, 100)
})

test("upsert：同一文本重复写入只更新，不新增", () => {
	const first = applyGlobalMemoryUpsert(createEmptyGlobalMemory(), { text: "回答语言：简体中文", source: "model" }, 100)
	const second = applyGlobalMemoryUpsert(first.document, { text: "  回答语言：简体中文 ", tags: ["偏好"], source: "user" }, 200)

	assert.equal(second.created, false)
	assert.equal(second.document.entries.length, 1)
	assert.equal(second.entry.id, first.entry.id)
	assert.equal(second.entry.updatedAt, 200)
	assert.equal(second.entry.createdAt, 100)
	assert.deepEqual(second.entry.tags, ["偏好"])
})

test("upsert：按 id 更新指定条目", () => {
	const first = applyGlobalMemoryUpsert(createEmptyGlobalMemory(), { text: "甲", source: "model" }, 100)
	const second = applyGlobalMemoryUpsert(first.document, { id: first.entry.id, text: "乙", source: "user" }, 200)

	assert.equal(second.created, false)
	assert.equal(second.entry.text, "乙")
	assert.equal(second.document.entries.length, 1)
})

test("upsert：id 不存在时报错（而不是静默新增）", () => {
	assert.throws(
		() => applyGlobalMemoryUpsert(createEmptyGlobalMemory(), { id: "nope", text: "甲", source: "model" }),
		/没有 id/,
	)
})

test("upsert：空文本报错", () => {
	assert.throws(() => applyGlobalMemoryUpsert(createEmptyGlobalMemory(), { text: "   ", source: "model" }), /不能为空/)
})

test("upsert：达到条数上限时报错，不丢旧条目", () => {
	const entries = Array.from({ length: GLOBAL_MEMORY_LIMITS.maxEntries }, (_, index) =>
		entry({ id: `mem-${index}`, text: `条目 ${index}` }),
	)
	const document = { ...createEmptyGlobalMemory(), entries }

	assert.throws(() => applyGlobalMemoryUpsert(document, { text: "新条目", source: "model" }), /已达上限/)
	assert.equal(document.entries.length, GLOBAL_MEMORY_LIMITS.maxEntries)
})

test("upsert：按 id 把文本改成另一条的内容时报错，不静默删掉另一条", () => {
	const first = applyGlobalMemoryUpsert(createEmptyGlobalMemory(), { text: "AAA", source: "user" }, 100)
	const second = applyGlobalMemoryUpsert(first.document, { text: "BBB", source: "user" }, 200)

	assert.throws(
		() => applyGlobalMemoryUpsert(second.document, { id: second.entry.id, text: "aaa", source: "user" }, 300),
		/已存在/,
	)
})

// ————————————————————————————————————————————————
// 确定性种子
// ————————————————————————————————————————————————

test("种子：写入可读文本，且只种一次", () => {
	const first = applyGlobalMemorySeeds(createEmptyGlobalMemory(1), { preferredLanguage: "简体中文" }, 10)
	assert.equal(first.entries.length, 1)
	assert.equal(first.entries[0].text, "回答语言：简体中文")
	assert.deepEqual(first.seeded, ["language"])

	// 已经存在就不重复写
	assert.equal(applyGlobalMemorySeeds(first, { preferredLanguage: "简体中文" }, 20), first)
})

test("种子：用户删掉后不会被下一条请求写回", () => {
	const seeded = applyGlobalMemorySeeds(createEmptyGlobalMemory(1), { preferredLanguage: "简体中文" }, 10)
	const afterUserDelete = { ...seeded, entries: [] }

	assert.equal(applyGlobalMemorySeeds(afterUserDelete, { preferredLanguage: "简体中文" }, 20), afterUserDelete)
})

test("种子：旧版已有条目但缺 seeded 标记时，只补标记不新增", () => {
	const legacy = {
		...createEmptyGlobalMemory(1),
		entries: [entry({ id: "legacy", text: "回答语言：简体中文" })],
	}
	const migrated = applyGlobalMemorySeeds(legacy, { preferredLanguage: "简体中文" }, 10)

	assert.equal(migrated.entries.length, 1)
	assert.deepEqual(migrated.seeded, ["language"])
	// 迁移后再删掉，不会写回
	const afterDelete = { ...migrated, entries: [] }
	assert.equal(applyGlobalMemorySeeds(afterDelete, { preferredLanguage: "简体中文" }, 20), afterDelete)
})

test("种子：关闭时或条目已满时都不写（不空转写盘）", () => {
	const disabled = { ...createEmptyGlobalMemory(1), enabled: false }
	assert.equal(applyGlobalMemorySeeds(disabled, { preferredLanguage: "简体中文" }), disabled)

	const full = {
		...createEmptyGlobalMemory(1),
		entries: Array.from({ length: GLOBAL_MEMORY_LIMITS.maxEntries }, (_, index) =>
			entry({ id: `mem-${index}`, text: `条目 ${index}` }),
		),
	}
	assert.equal(applyGlobalMemorySeeds(full, { preferredLanguage: "简体中文" }), full)
})

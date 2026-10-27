/**
 * 内置指令手册与「双线并轨」取数的回归测试（插件视角）。
 *
 * 核心库那边已有一份更细的解析测试；这里只钉住插件实际依赖的几条不变式：
 * 1. 内置快照是完整可用的 —— 条目数与元数据自洽，离线也能查到。
 * 2. 名字查得到、别名查得到、中文关键词检索得到。
 * 3. mode=off 时必须只走本地，绝不偷偷出网（用户关掉在线就不能再发请求）。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	findReference,
	formatReferenceEntry,
	listReferenceNames,
	REFERENCE_ENTRIES,
	REFERENCE_ENTRY_COUNT,
	REFERENCE_FETCHED_AT,
	REFERENCE_NAME_COUNT,
	REFERENCE_SOURCE_SHA,
	referencePageUrl,
	resolveReferenceOnline,
	searchReference,
} from "@eraharness/reference/index"

test("内置快照: 条目数与元数据自洽", () => {
	assert.equal(REFERENCE_ENTRIES.length, REFERENCE_ENTRY_COUNT)
	assert.equal(listReferenceNames(REFERENCE_ENTRIES).length, REFERENCE_NAME_COUNT)
	assert.match(REFERENCE_SOURCE_SHA, /^[0-9a-f]{40}$/)
	assert.ok(REFERENCE_FETCHED_AT.length > 0)
	assert.ok(REFERENCE_ENTRY_COUNT > 300)
})

test("内置快照: id 不重复，Reference 页必须有签名表", () => {
	const ids = new Set<string>()
	const broken: string[] = []
	for (const entry of REFERENCE_ENTRIES) {
		if (ids.has(entry.id)) {
			broken.push(`${entry.id}(id 重复)`)
		}
		ids.add(entry.id)
		if (!entry.sourcePath) {
			broken.push(`${entry.id}(缺 sourcePath)`)
		}
		// Reference 是 API 页，签名表是它的结构化产物；
		// Emuera 规格页（语法/预处理器）与 tutorial 页本来就没有签名表
		if (entry.sourcePath?.startsWith("docs/Reference/") && entry.signatures.length === 0) {
			broken.push(`${entry.id}(Reference 页无签名表)`)
		}
	}
	assert.deepEqual(broken, [])
})

test("内置快照: 函数头指令已入库（#LOCALSIZE 曾被当重复定义删掉）", () => {
	const localsize = findReference(REFERENCE_ENTRIES, "#LOCALSIZE")
	assert.ok(localsize, "#LOCALSIZE 必须能查到")
	assert.equal(localsize!.entry.id, "Emuera/function#LOCALSIZE")
	assert.equal(localsize!.entry.localOnly, true, "切段条目不能被在线整页替换")
	assert.match(localsize!.entry.body, /大于0的整数/)
	assert.match(localsize!.entry.body, /VariableSize\.csv/)
	// 模型通常不带 `#` 写
	assert.equal(findReference(REFERENCE_ENTRIES, "LOCALSIZE")?.entry.id, "Emuera/function#LOCALSIZE")
	assert.ok(findReference(REFERENCE_ENTRIES, "#DIM"))
	assert.ok(findReference(REFERENCE_ENTRIES, "@EVENTLOAD"))
})

test("内置快照: 旧 Reference id 保持扁平，零回归", () => {
	const referenceEntries = REFERENCE_ENTRIES.filter((entry) => entry.sourcePath?.startsWith("docs/Reference/"))
	assert.equal(referenceEntries.length, 312)
	for (const entry of referenceEntries) {
		assert.ok(!entry.id.includes("/"), `${entry.id} 不该带目录前缀`)
		assert.equal(entry.pageId, undefined)
	}
})

test("findReference: 主名与别名都能落到同一页", () => {
	assert.equal(findReference(REFERENCE_ENTRIES, "SETCOLOR")?.entry.id, "SETCOLOR")
	// 别名（同页变体）不要求页名一致
	assert.equal(findReference(REFERENCE_ENTRIES, "printv")?.entry.id, "PRINT")
	// 分组页的页名本身也要能查
	assert.equal(findReference(REFERENCE_ENTRIES, "DT_ROW")?.entry.id, "DT_ROW")
	assert.equal(findReference(REFERENCE_ENTRIES, "ZZZ_NOT_A_COMMAND"), undefined)
})

test("searchReference: 中文关键词命中正文", () => {
	const hits = searchReference(REFERENCE_ENTRIES, "颜色", 8)
	assert.ok(hits.length > 0)
	assert.ok(hits.some((hit) => hit.entry.id === "SETCOLOR"))
})

test("formatReferenceEntry: 含签名与引擎标注", () => {
	const found = findReference(REFERENCE_ENTRIES, "SETCOLOR")
	assert.ok(found)
	const text = formatReferenceEntry(found!.entry)
	assert.ok(text.includes("## 签名"))
	assert.ok(text.includes("SETCOLOR("))
	assert.ok(text.includes("## 说明"))
})

test("referencePageUrl: 只拼安全 id，挡住路径穿越", () => {
	assert.ok(referencePageUrl("SETCOLOR")?.endsWith("/docs/Reference/SETCOLOR.zh.md"))
	assert.equal(referencePageUrl("../etc/passwd"), undefined)
	assert.equal(referencePageUrl("A/B"), undefined)
	assert.equal(referencePageUrl(""), undefined)
})

test("referencePageUrl: 条目形态按 sourcePath 拼目录，`#` 不进 URL", () => {
	const url = referencePageUrl({
		id: "Emuera/function#LOCALSIZE",
		sourcePath: "docs/Emuera/function.zh.md",
	})
	assert.ok(url?.endsWith("/docs/Emuera/function.zh.md"))
	assert.ok(!url!.includes("#"), "id 里的 # 会截断 URL")
	assert.equal(referencePageUrl({ id: "x", sourcePath: "docs/../../etc/passwd.zh.md" }), undefined)
})

test("resolveReferenceOnline: mode=off 只走本地快照", async () => {
	const entry = REFERENCE_ENTRIES[0]!
	const resolved = await resolveReferenceOnline(entry, REFERENCE_SOURCE_SHA, { mode: "off" })
	assert.equal(resolved.origin, "local")
	assert.equal(resolved.entry.id, entry.id)
	assert.equal(resolved.fallbackReason, undefined)
	assert.ok(resolved.sourceNote.includes("内置快照"))
})

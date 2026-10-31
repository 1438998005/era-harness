/**
 * 专属知识库的磁盘布局（`packages/era-harness-core/src/gamekb/store.ts`）。
 *
 * 这层是整个功能里**唯一会写用户磁盘**的地方，所以测试重点全在"越界"与"丢数据"上：
 * - slug 只认自己生成的形态（外部传入的 slug 必须过校验，否则 `../` 能写到工作区外）；
 * - 删除只挪进 `.trash/`，永不 rm；
 * - manifest 坏掉不能让设置页崩，只能标「损坏」；
 * - 写盘用临时文件 + rename，中途崩掉不留半个 JSON。
 *
 * 目录约定也一并锁住：库落在 `<工作区根>/.era-harness/knowledge/`，
 * 这个位置同时被更新器的 `PROTECTED_PREFIXES` 与身份判定豁免，改位置等于同时破两处保证。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
	createKnowledgeBase,
	DEFAULT_INDEX_FILE,
	generateSlug,
	isValidSlug,
	KB_DIR_PARTS,
	KB_TRASH_DIR,
	knowledgeBaseDir,
	knowledgeRoot,
	listKnowledgeBases,
	readIndexText,
	readManifest,
	sanitizeName,
	setKnowledgeBaseEnabled,
	slugTimestamp,
	trashKnowledgeBase,
	writeManifest,
} from "@eraharness/gamekb/index"

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-gamekb-"))
	try {
		await run(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

const NOW = new Date(2026, 9, 31, 12, 0, 0) // 本地时间 2026-10-31 12:00

test("目录约定：落在 <工作区根>/.era-harness/knowledge 下", () => {
	assert.deepEqual([...KB_DIR_PARTS], [".era-harness", "knowledge"])
	assert.equal(knowledgeRoot("/w"), path.join("/w", ".era-harness", "knowledge"))
	assert.equal(
		knowledgeBaseDir("/w", "kb-202610311200-abcd"),
		path.join("/w", ".era-harness", "knowledge", "kb-202610311200-abcd"),
	)
	assert.equal(KB_TRASH_DIR, ".trash")
	assert.equal(DEFAULT_INDEX_FILE, "index.md")
})

test("slug：格式固定、只认自己生成的样子", () => {
	assert.equal(slugTimestamp(NOW), "202610311200", "用本地时间拼，不用 toISOString（那是 UTC，会差一天）")
	assert.equal(generateSlug(NOW, "a1b2"), "kb-202610311200-a1b2")

	// 随机串里的非字母数字要清掉；不足 4 位补 0，保证 slug 长度恒定
	assert.equal(generateSlug(NOW, "A-9!"), "kb-202610311200-a900")
	assert.equal(generateSlug(NOW, ""), "kb-202610311200-0000")

	assert.equal(isValidSlug(generateSlug(NOW, "abcd")), true)
	assert.equal(isValidSlug("kb-202610311200-abcd"), true)
	// 防目录穿越：这些都必须被拒
	assert.equal(isValidSlug("../../../etc"), false)
	assert.equal(isValidSlug("kb-202610311200-abcd/../.."), false)
	assert.equal(isValidSlug("kb-202610311200-ABCD"), false, "大写不接受（避免大小写不敏感文件系统上两个 slug 撞成一个）")
	assert.equal(isValidSlug("kb-202610311200-abcd "), false, "前后空格不放过")
	assert.equal(isValidSlug("notakb-202610311200-abcd"), false)
	assert.equal(isValidSlug(""), false)
})

test("库名清洗：去控制字符、压空白、限长、空名有兜底", () => {
	assert.equal(sanitizeName("  eratw\n画蛇添足版  "), "eratw 画蛇添足版")
	assert.equal(sanitizeName("a\u0000b\u001fc"), "a b c")
	assert.equal(sanitizeName(""), "未命名知识库")
	assert.equal(sanitizeName("   "), "未命名知识库")
	assert.equal(sanitizeName("x".repeat(200)).length, 60)
})

test("建库：目录 + kb.json + index.md 一次到位", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, {
			name: "eratw 画蛇添足版",
			now: NOW,
			suffix: "abcd",
			gameRoot: path.join(root, "game"),
			gameVersion: "1.2.3",
		})

		assert.equal(manifest.slug, "kb-202610311200-abcd")
		assert.equal(manifest.enabled, true, "新建的库默认载入")
		assert.equal(manifest.index, "index.md")
		assert.equal(manifest.gameVersion, "1.2.3")
		assert.deepEqual(manifest.files, [])

		const dir = knowledgeBaseDir(root, manifest.slug)
		assert.equal(manifest.createdAt, manifest.updatedAt)

		const index = await fs.readFile(path.join(dir, "index.md"), "utf8")
		assert.ok(index.startsWith("# eratw 画蛇添足版"))
		assert.ok(index.includes("## 函数"), "索引骨架要先把分类立起来，AI 才不会把所有内容塞一个文件")
		assert.ok(index.includes("仅供参考"))

		// kb.json 必须能被原样读回
		const readBack = await readManifest(dir)
		assert.ok(readBack)
		// 逐字段比而不是 deepEqual：读回来的对象会显式带上 `counts: undefined`，
		// 与新建时"根本没这个键"在 strict deepEqual 下不等，但那不是行为差异。
		assert.equal(readBack.slug, manifest.slug)
		assert.equal(readBack.name, manifest.name)
		assert.equal(readBack.gameRoot, manifest.gameRoot)
		assert.equal(readBack.gameVersion, manifest.gameVersion)
		assert.equal(readBack.createdAt, manifest.createdAt)
		assert.equal(readBack.updatedAt, manifest.updatedAt)
		assert.equal(readBack.enabled, manifest.enabled)
		assert.equal(readBack.index, manifest.index)
		assert.deepEqual(readBack.files, manifest.files)
	})
})

test("manifest 读不出来时返回 null（设置页据此显示「损坏」，不许抛错）", async () => {
	await withTempDir(async (root) => {
		const dir = path.join(root, "kb")
		await fs.mkdir(dir, { recursive: true })

		assert.equal(await readManifest(dir), null, "文件不存在")

		await fs.writeFile(path.join(dir, "kb.json"), "{ not json", "utf8")
		assert.equal(await readManifest(dir), null, "JSON 坏掉")

		await fs.writeFile(path.join(dir, "kb.json"), JSON.stringify({ name: "没有 slug" }), "utf8")
		assert.equal(await readManifest(dir), null, "缺 slug 视为损坏")

		// 只坏了一部分字段时：能救的救，救不了的给安全默认值
		await fs.writeFile(path.join(dir, "kb.json"), JSON.stringify({ slug: "kb-202610311200-abcd", name: "  " }), "utf8")
		const salvaged = await readManifest(dir)
		assert.ok(salvaged)
		assert.equal(salvaged?.name, "kb-202610311200-abcd", "空名字回落到 slug")
		assert.equal(salvaged?.enabled, true, "enabled 缺失视为开启")
		assert.equal(salvaged?.index, "index.md")
	})
})

test("写盘不留临时文件", async () => {
	await withTempDir(async (root) => {
		const dir = path.join(root, "kb")
		const manifest = await createKnowledgeBase(root, { name: "x", now: NOW, suffix: "aaaa" })
		await writeManifest(knowledgeBaseDir(root, manifest.slug), { ...manifest, enabled: false })

		const names = await fs.readdir(knowledgeBaseDir(root, manifest.slug))
		assert.deepEqual(names.sort(), ["index.md", "kb.json"], "kb.json.tmp 必须已经 rename 掉")
	})
})

test("列库：按创建时间倒序、统计分片、标出损坏、跳过 .trash", async () => {
	await withTempDir(async (root) => {
		const older = await createKnowledgeBase(root, { name: "旧库", now: new Date(2026, 9, 1, 8, 0, 0), suffix: "aaaa" })
		const newer = await createKnowledgeBase(root, { name: "新库", now: new Date(2026, 9, 20, 8, 0, 0), suffix: "bbbb" })

		// 分片只在子目录里数（index.md / kb.json 不算分片）
		const newerDir = knowledgeBaseDir(root, newer.slug)
		await fs.mkdir(path.join(newerDir, "functions"), { recursive: true })
		await fs.mkdir(path.join(newerDir, "constants"), { recursive: true })
		await fs.writeFile(path.join(newerDir, "functions", "combat.md"), "# 战斗\n", "utf8")
		await fs.writeFile(path.join(newerDir, "functions", "move.md"), "# 移动\n", "utf8")
		await fs.writeFile(path.join(newerDir, "constants", "flags.md"), "# 标志\n", "utf8")
		await fs.writeFile(path.join(newerDir, "functions", "ignore.txt"), "x", "utf8")

		// 一个坏库：目录在、kb.json 没了
		await fs.mkdir(path.join(knowledgeRoot(root), "kb-202609010000-cccc"), { recursive: true })

		const list = await listKnowledgeBases(root)
		assert.deepEqual(
			list.map((entry) => entry.slug),
			[newer.slug, older.slug, "kb-202609010000-cccc"],
			"新库排前面，坏库排在最后（没有 createdAt）",
		)

		const newerEntry = list.find((entry) => entry.slug === newer.slug)
		assert.equal(newerEntry?.broken, false)
		assert.equal(newerEntry?.hasIndex, true)
		assert.equal(newerEntry?.fileCount, 3, "只数 .md 分片")

		const broken = list.find((entry) => entry.slug === "kb-202609010000-cccc")
		assert.equal(broken?.broken, true)
		assert.equal(broken?.manifest, null)
		assert.equal(broken?.hasIndex, false)
	})
})

test("工作区里还没有 knowledge 目录时，列库返回空数组而不是抛错", async () => {
	await withTempDir(async (root) => {
		assert.deepEqual(await listKnowledgeBases(root), [])
	})
})

test("开关载入：写进 kb.json，非法 slug 直接拒", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "x", now: NOW, suffix: "aaaa" })

		assert.equal(await setKnowledgeBaseEnabled(root, manifest.slug, false), true)
		const after = await readManifest(knowledgeBaseDir(root, manifest.slug))
		assert.equal(after?.enabled, false)
		assert.equal(after?.createdAt, manifest.createdAt, "只改开关，别动时间戳")

		assert.equal(await setKnowledgeBaseEnabled(root, "../../etc", false), false)
		assert.equal(await setKnowledgeBaseEnabled(root, "kb-202610311200-zzzz", false), false, "库不存在时返回 false")
	})
})

test("删除 = 挪进 .trash，可找回；.trash 本身不会被当成库列出来", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "x", now: NOW, suffix: "aaaa" })
		const dir = knowledgeBaseDir(root, manifest.slug)

		assert.equal(await trashKnowledgeBase(root, manifest.slug, NOW), true)
		await assert.rejects(() => fs.access(dir), "原目录必须已经不在了")

		const trashed = await fs.readdir(path.join(knowledgeRoot(root), KB_TRASH_DIR))
		assert.equal(trashed.length, 1)
		assert.ok(trashed[0]?.startsWith(manifest.slug), "挪走的目录名带原 slug，方便手动找回")
		assert.ok((await readManifest(path.join(knowledgeRoot(root), KB_TRASH_DIR, trashed[0] as string))) !== null)

		assert.deepEqual(await listKnowledgeBases(root), [], ".trash 不能被当成一个知识库")
		assert.equal(await trashKnowledgeBase(root, manifest.slug, NOW), false, "重复删返回 false")
		assert.equal(await trashKnowledgeBase(root, "../../etc", NOW), false)
	})
})

test("读索引：manifest 指定的文件名优先，读不到返回 null", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "x", now: NOW, suffix: "aaaa" })
		const dir = knowledgeBaseDir(root, manifest.slug)
		await writeManifest(dir, { ...manifest, index: "overview.md" })
		await fs.writeFile(path.join(dir, "overview.md"), "# 自定义索引\n", "utf8")

		const [entry] = await listKnowledgeBases(root)
		assert.ok(entry)
		assert.equal(await readIndexText(entry), "# 自定义索引\n")

		await fs.rm(path.join(dir, "overview.md"))
		assert.equal(await readIndexText(entry), null)
	})
})

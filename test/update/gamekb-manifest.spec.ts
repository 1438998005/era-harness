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
	isIndexSkeleton,
	isValidSlug,
	KB_DIR_PARTS,
	KB_TRASH_DIR,
	knowledgeBaseDir,
	knowledgeRoot,
	listKnowledgeBases,
	readIndexText,
	readManifest,
	resolveBuildStatus,
	sanitizeName,
	setKnowledgeBaseEnabled,
	slugTimestamp,
	trashKnowledgeBase,
	updateKnowledgeBaseBuild,
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
		// #96：构建状态另落 build.json（事实源）；#115：开关另落 ui.json。三者都不能留下 .tmp
		assert.deepEqual(
			names.sort(),
			["build.json", "index.md", "kb.json", "ui.json"],
			"kb.json.tmp / build.json.tmp / ui.json.tmp 必须已经 rename 掉",
		)
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

test("开关载入：只写 ui.json（kb.json 一个字节都不动），非法 slug 直接拒", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "x", now: NOW, suffix: "aaaa" })
		const dir = knowledgeBaseDir(root, manifest.slug)
		const before = await fs.readFile(path.join(dir, "kb.json"), "utf8")

		assert.equal(await setKnowledgeBaseEnabled(root, manifest.slug, false), true)
		const after = await readManifest(dir)
		assert.equal(after?.enabled, false)
		assert.equal(after?.createdAt, manifest.createdAt, "只改开关，别动时间戳")

		// #115：模型可能正在整篇重写 kb.json，宿主这边不能碰它
		const rawAfter = await fs.readFile(path.join(dir, "kb.json"), "utf8")
		assert.equal(rawAfter, before, "关开关不能重写 kb.json")
		const ui = JSON.parse(await fs.readFile(path.join(dir, "ui.json"), "utf8"))
		assert.equal(ui.enabled, false, "开关事实源在 ui.json")

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

// —— #93（2026-10-31）：构建状态机与注入门禁 ——
// 用户现场：建库跑了几小时没结果，设置页只有一份骨架索引，后续对话却照样把它当「知识库」
// 注入（模型拿着空索引瞎猜）。根因是磁盘上没有任何「这次构建成不成」的事实。
// 解法：`kb.json.build` 是唯一事实源，注入只认 `ready`。

test("#93 建库写入初始构建状态：完整建库 → building，空白建库 → draft", async () => {
	await withTempDir(async (root) => {
		const full = await createKnowledgeBase(root, { name: "x", now: NOW, suffix: "aaaa", mode: "full" })
		assert.equal(full.build?.status, "building", "完整建库一开对话就该是「构建中」")
		assert.equal(full.build?.mode, "full")
		assert.ok(full.build?.startedAt, "必须有 startedAt，否则窗口重载后无法判定「超时残留」")

		const blank = await createKnowledgeBase(root, {
			name: "y",
			now: new Date(2026, 9, 31, 13, 0, 0),
			suffix: "bbbb",
			mode: "blank",
		})
		assert.equal(blank.build?.status, "draft", "空白建库只建骨架，状态是「draft」")
		assert.equal(blank.build?.mode, "blank")

		// 不传 mode 时按完整建库处理（向后兼容旧调用方）
		const legacy = await createKnowledgeBase(root, { name: "z", now: new Date(2026, 9, 31, 14, 0, 0), suffix: "cccc" })
		assert.equal(legacy.build?.status, "building")
		assert.equal(legacy.build?.mode, "full")
	})
})

test("#93 updateKnowledgeBaseBuild：读 → 合并 → 原子写回；读不出返回 false", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "x", now: NOW, suffix: "aaaa", mode: "full" })
		const dir = knowledgeBaseDir(root, manifest.slug)

		assert.equal(await updateKnowledgeBaseBuild(dir, { status: "ready", finishedAt: "2026-10-31T12:30:00.000Z" }), true)
		const afterReady = await readManifest(dir)
		assert.equal(afterReady?.build?.status, "ready")
		assert.equal(afterReady?.build?.finishedAt, "2026-10-31T12:30:00.000Z")
		assert.equal(afterReady?.build?.mode, "full", "合并而不是替换：原有字段要留着")
		assert.equal(afterReady?.build?.startedAt, manifest.build?.startedAt)

		// 失败态带原因
		assert.equal(await updateKnowledgeBaseBuild(dir, { status: "failed", error: "已中断（可继续构建）" }), true)
		const afterFailed = await readManifest(dir)
		assert.equal(afterFailed?.build?.status, "failed")
		assert.equal(afterFailed?.build?.error, "已中断（可继续构建）")

		// 目录里没有 kb.json / JSON 坏掉 → false，不抛
		assert.equal(await updateKnowledgeBaseBuild(path.join(root, "nope"), { status: "failed" }), false)
		const broken = path.join(root, "broken")
		await fs.mkdir(broken, { recursive: true })
		await fs.writeFile(path.join(broken, "kb.json"), "{ not json", "utf8")
		assert.equal(await updateKnowledgeBaseBuild(broken, { status: "failed" }), false)
	})
})

test("#93 readManifest 归一化 build：非法枚举丢弃，其余字段保留", async () => {
	await withTempDir(async (root) => {
		const dir = path.join(root, "kb")
		await fs.mkdir(dir, { recursive: true })

		// 合法（3.95.1 起 mode 只放建库形态；旧 update 会降级为 full + taskKind:update）
		await fs.writeFile(
			path.join(dir, "kb.json"),
			JSON.stringify({
				slug: "kb-202610311200-abcd",
				name: "x",
				build: { status: "failed", mode: "blank", taskKind: "update", taskId: "179", startedAt: "t0", error: "boom" },
			}),
			"utf8",
		)
		const ok = await readManifest(dir)
		assert.equal(ok?.build?.status, "failed")
		assert.equal(ok?.build?.mode, "blank")
		assert.equal(ok?.build?.taskKind, "update")
		assert.equal(ok?.build?.taskId, "179")
		assert.equal(ok?.build?.error, "boom")

		// 非法 status → 整个 build 丢弃（旧库兼容靠 resolveBuildStatus）
		await fs.writeFile(
			path.join(dir, "kb.json"),
			JSON.stringify({ slug: "kb-202610311200-abcd", name: "x", build: { status: "half-done" } }),
			"utf8",
		)
		assert.equal((await readManifest(dir))?.build, undefined, "未知状态不能当成事实")

		// 非法 mode 丢掉 mode，但 status 保留
		await fs.writeFile(
			path.join(dir, "kb.json"),
			JSON.stringify({ slug: "kb-202610311200-abcd", name: "x", build: { status: "draft", mode: "magic" } }),
			"utf8",
		)
		const partial = await readManifest(dir)
		assert.equal(partial?.build?.status, "draft")
		assert.equal(partial?.build?.mode, undefined)
	})
})

test("#93 resolveBuildStatus：有 build 字段就用它，旧库按「有分片/索引有条目」兼容", async () => {
	// 旧库（无 build）：有分片即 ready
	assert.equal(resolveBuildStatus({ slug: "s", name: "n" } as never, 1, ""), "ready")
	// 旧库：没有分片但索引里有条目 → 也算 ready（AI 可能只写了索引）
	assert.equal(
		resolveBuildStatus({ slug: "s", name: "n" } as never, 0, "# t\n\n## 函数\n\n- @foo — 做什么 — a.ERB:1\n"),
		"ready",
	)
	// 旧库：骨架索引（一行条目都没有）→ draft
	assert.equal(resolveBuildStatus({ slug: "s", name: "n" } as never, 0, "# t\n\n## 函数\n\n## 常量与变量槽位\n"), "draft")
	assert.equal(resolveBuildStatus(null, 0, null), "draft", "坏库不能算 ready")

	// 有 build 字段：以它为准（哪怕磁盘上已经有分片）
	assert.equal(resolveBuildStatus({ build: { status: "failed" } } as never, 5, "- x"), "failed")
	assert.equal(resolveBuildStatus({ build: { status: "building" } } as never, 0, null), "building")
	assert.equal(resolveBuildStatus({ build: { status: "draft" } } as never, 3, "- x"), "draft", "半成品不能被磁盘文件数“救活”")
})

test("#105 isIndexSkeleton：任何正文都算内容，不只是 `- ` / `* `", () => {
	assert.equal(isIndexSkeleton("# t\n\n## 函数\n\n## 机制与坑\n"), true)
	assert.equal(isIndexSkeleton(""), true)
	assert.equal(isIndexSkeleton("# t\n\n- @foo — 做什么 — a.ERB:1\n"), false)
	assert.equal(isIndexSkeleton("# t\n\n* @bar — 做什么 — b.ERB:2\n"), false)
	// 表格 / 有序列表 / 粗体行都是正文：只认 `- ` 会把这类索引误判成骨架（#105）
	assert.equal(isIndexSkeleton("# t\n\n**粗体**也是正文\n"), false, "除标题/空行/引用/分隔线外都算内容")
	assert.equal(isIndexSkeleton("# t\n\n| 条目 | 出处 |\n|---|---|\n"), false, "表格索引也是正文")
})

test("#93 listKnowledgeBases 带 buildStatus，设置页据此决定徽标与禁用", async () => {
	await withTempDir(async (root) => {
		const building = await createKnowledgeBase(root, {
			name: "在建",
			now: new Date(2026, 9, 31, 10, 0, 0),
			suffix: "aaaa",
			mode: "full",
		})
		const draft = await createKnowledgeBase(root, {
			name: "骨架",
			now: new Date(2026, 9, 31, 11, 0, 0),
			suffix: "bbbb",
			mode: "blank",
		})

		// 旧库：没有 build 字段，但已经有分片 → ready
		const legacyDir = path.join(knowledgeRoot(root), "kb-202609010000-cccc")
		await fs.mkdir(path.join(legacyDir, "functions"), { recursive: true })
		await fs.writeFile(path.join(legacyDir, "functions", "a.md"), "# a\n", "utf8")
		await fs.writeFile(
			path.join(legacyDir, "kb.json"),
			JSON.stringify({ slug: "kb-202609010000-cccc", name: "旧库", createdAt: "2026-09-01T00:00:00.000Z" }),
			"utf8",
		)

		const list = await listKnowledgeBases(root)
		const bySlug = new Map(list.map((entry) => [entry.slug, entry]))
		assert.equal(bySlug.get(building.slug)?.buildStatus, "building")
		assert.equal(bySlug.get(draft.slug)?.buildStatus, "draft")
		assert.equal(bySlug.get("kb-202609010000-cccc")?.buildStatus, "ready", "旧库不能被升级判成不可用")

		// 完成构建 → list 立刻反映 ready（#96：ready 要过内容校验，先给它一个真实分片）
		const buildingDir = knowledgeBaseDir(root, building.slug)
		await fs.mkdir(path.join(buildingDir, "functions"), { recursive: true })
		await fs.writeFile(path.join(buildingDir, "functions", "b.md"), "# b\n", "utf8")
		await updateKnowledgeBaseBuild(buildingDir, { status: "ready" })
		const relisted = await listKnowledgeBases(root)
		assert.equal(relisted.find((entry) => entry.slug === building.slug)?.buildStatus, "ready")
	})
})

// —— 3.95.1：两种建库形态 + 续写不分形态 ——
// 用户 2026-10-31 澄清：新建只有「构建完整知识库」与「构建空白知识库」两个选项，
// 而**两种库之后都能续写**。所以 build 拆成两个正交字段：
// mode（只由 create 写）/ taskKind（开对话时写）。

test("3.95.1 空白建库 → 续写完成 → ready（两种建库形态都能续写）", async () => {
	await withTempDir(async (root) => {
		const blank = await createKnowledgeBase(root, { name: "空白", now: NOW, suffix: "aaaa", mode: "blank" })
		const dir = knowledgeBaseDir(root, blank.slug)

		// 刚建的空骨架：不能注入
		assert.equal((await listKnowledgeBases(root))[0]?.buildStatus, "draft")

		// 模拟续写任务开对话：只写 taskKind
		await updateKnowledgeBaseBuild(dir, { status: "building", taskKind: "incremental" })
		assert.equal((await readManifest(dir))?.build?.mode, "blank", "任务不得覆盖建库形态")

		// 续写完成 → 可注入（续写真的写了分片；#96 之后「零产出」不会再被判 ready）
		await fs.mkdir(path.join(dir, "functions"), { recursive: true })
		await fs.writeFile(path.join(dir, "functions", "x.md"), "# x\n", "utf8")
		await updateKnowledgeBaseBuild(dir, { status: "ready" })
		const after = await readManifest(dir)
		assert.equal(after?.build?.status, "ready")
		assert.equal(after?.build?.mode, "blank", "建库形态在整个生命周期内不变")
		assert.equal(after?.build?.taskKind, "incremental")
		assert.equal((await listKnowledgeBases(root))[0]?.buildStatus, "ready")
	})
})

test("3.95.1 旧 build 降级：incremental+draft → blank + taskKind:incremental", async () => {
	await withTempDir(async (root) => {
		const dir = path.join(root, "kb")
		await fs.mkdir(dir, { recursive: true })
		const write = (build: unknown) =>
			fs.writeFile(path.join(dir, "kb.json"), JSON.stringify({ slug: "kb-202610311200-abcd", name: "x", build }), "utf8")

		// 3.95.0 的空白建库（mode 被当成“建库形态”）
		await write({ status: "draft", mode: "incremental" })
		const blank = await readManifest(dir)
		assert.equal(blank?.build?.mode, "blank", "旧 incremental 建库归一为 blank")
		assert.equal(blank?.build?.taskKind, "incremental")

		// 3.95.0 的更新任务（mode 被写成任务形态）
		await write({ status: "ready", mode: "update" })
		const updated = await readManifest(dir)
		assert.equal(updated?.build?.mode, "full", "旧 update 写法没有建库形态信息，按完整建库兼容")
		assert.equal(updated?.build?.taskKind, "update")

		// 新旧共存：显式 taskKind 优先于旧 mode 推断（status 不是 draft → 按完整建库兼容）
		await write({ status: "ready", mode: "incremental", taskKind: "update" })
		const mixed = await readManifest(dir)
		assert.equal(mixed?.build?.mode, "full")
		assert.equal(mixed?.build?.taskKind, "update", "显式字段优先，不能被旧值覆盖")

		// 两个字段都合法时原样保留
		await write({ status: "ready", mode: "full", taskKind: "incremental" })
		const explicit = await readManifest(dir)
		assert.equal(explicit?.build?.mode, "full")
		assert.equal(explicit?.build?.taskKind, "incremental")
	})
})

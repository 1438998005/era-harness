/**
 * 专属知识库注入提示词的那一小节。
 *
 * 这一节的措辞是**功能安全边界**，不是文案：
 * - 写成「参考」而不是「铁律」—— 库是 AI 生成的、会过期，写成铁律等于把模型的
 *   错误固化成规则（这正是 `era_domain` 里明确要避免的）；
 * - 必须写明「与代码冲突以代码为准」「不要自行改写库文件」—— 否则模型会拿一份
 *   过期索引去覆盖实际代码，或者顺手"帮忙"改库；
 * - 必须限量 —— 索引全量注入会直接吃掉上下文，进而让任务跑不动。
 *
 * 最后一个用例是端到端：真的在工作区里建一个库，再让 Task 侧那个入口去读，
 * 确认「开关关闭 / 目录损坏 / 没有工作区」都安静地返回空串（增强项不该弄挂主流程）。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
	buildKnowledgeBaseSection,
	createKnowledgeBase,
	knowledgeBaseDir,
	MAX_INDEX_CHARS_PER_KB,
	MAX_TOTAL_CHARS,
	updateKnowledgeBaseBuild,
	writeManifest,
} from "@eraharness/gamekb/index"
import { loadKnowledgeBaseSection } from "../../src/core/knowledge/knowledgeBaseSection"

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-gamekb-section-"))
	try {
		await run(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

const NOW = new Date(2026, 9, 31, 12, 0, 0)

test("没有库时返回空串（普通项目零影响）", () => {
	assert.equal(buildKnowledgeBaseSection([]), "")
})

test("小节必须写明「参考，不是铁律」与三条行为约束", () => {
	const section = buildKnowledgeBaseSection([
		{ name: "eratw 画蛇添足版", slug: "kb-202610311200-abcd", index: "- @COMBAT — 战斗结算 — ERB/COMBAT.ERB:12" },
	])

	assert.ok(section.startsWith("===="), "小节要用 ==== 包起来，避免和相邻段落混在一起")
	assert.ok(section.includes("## 专属知识库（参考，不是铁律）"))
	assert.ok(section.includes("**它不是权威结论**"))
	assert.ok(section.includes("以代码为准"), "冲突时以代码为准")
	assert.ok(section.includes("点「更新」"), "发现不符要让用户去点更新")
	assert.ok(section.includes("⛔ 不要自行改写库文件"), "模型不许自己改库")
	assert.ok(section.includes("read_file"), "要指路到分片，而不是让模型猜")
	assert.ok(section.trimEnd().endsWith("===="))
})

test("每个库都带 slug 与索引路径，模型据此能读全文", () => {
	const section = buildKnowledgeBaseSection([
		{
			name: "eratw 画蛇添足版",
			slug: "kb-202610311200-abcd",
			index: "- 一行条目",
			updatedAt: "2026-10-31T12:00:00.000Z",
			counts: { function: 12, constant: 8 },
		},
	])

	assert.ok(section.includes("### eratw 画蛇添足版（`kb-202610311200-abcd`）"))
	assert.ok(section.includes("`.era-harness/knowledge/kb-202610311200-abcd/index.md`"))
	assert.ok(section.includes("更新时间：2026-10-31T12:00:00.000Z"))
	assert.ok(section.includes("条目：函数 12 / 常量 8"))
	assert.ok(section.includes("- 一行条目"), "索引正文要原样包进 markdown 代码块")
	assert.ok(section.includes("```markdown"))
})

test("版本对不上时标「可能已过期」，对得上时不制造焦虑", () => {
	const stale = buildKnowledgeBaseSection([
		{ name: "x", slug: "kb-202610311200-abcd", index: "i", gameVersion: "1.0.0", currentGameVersion: "1.2.0" },
	])
	assert.ok(stale.includes("建库时的游戏版本：1.0.0（当前探测到 1.2.0，⚠️ 库可能已过期）"))

	const fresh = buildKnowledgeBaseSection([
		{ name: "x", slug: "kb-202610311200-abcd", index: "i", gameVersion: "1.2.0", currentGameVersion: "1.2.0" },
	])
	assert.ok(fresh.includes("建库时的游戏版本：1.2.0"))
	assert.ok(!fresh.includes("可能已过期"))

	const unknown = buildKnowledgeBaseSection([{ name: "x", slug: "kb-202610311200-abcd", index: "i" }])
	assert.ok(!unknown.includes("游戏版本"), "两边都读不到版本就一个字都不提")
})

test("单库索引超长要截断，并明确让模型去读全文", () => {
	const long = `- ${"条".repeat(MAX_INDEX_CHARS_PER_KB * 2)}`
	const section = buildKnowledgeBaseSection([{ name: "x", slug: "kb-202610311200-abcd", index: long }])

	assert.ok(section.includes("（索引过长已截断，用 read_file 读 `index.md` 全文。）"))
	assert.ok(section.length < MAX_INDEX_CHARS_PER_KB + 2000, "截断必须真的截断，不能只加一句提示")
})

test("总量超限后不再展开后续库，并说明原因", () => {
	const filler = "x".repeat(MAX_INDEX_CHARS_PER_KB)
	const items = Array.from({ length: 4 }, (_, i) => ({
		name: `库${i}`,
		slug: `kb-202610311200-000${i}`,
		index: filler,
	}))

	const section = buildKnowledgeBaseSection(items)
	assert.ok(section.includes("（还有知识库因长度上限未展开，用 read_file 直接读对应 index.md。）"))
	assert.ok(section.includes("### 库0"))
	assert.ok(!section.includes("### 库3"), "第 4 个库不该再展开")
	assert.ok(section.length < MAX_TOTAL_CHARS + 3000, "总量要有硬上限")
})

test("端到端：只有「已启用 + 未损坏 + 有索引 + 构建完成」的库会被注入", async () => {
	await withTempDir(async (root) => {
		assert.equal(await loadKnowledgeBaseSection(root), "", "没有库时返回空串")
		assert.equal(await loadKnowledgeBaseSection(undefined), "", "没有工作区时返回空串")

		const manifest = await createKnowledgeBase(root, { name: "eratw 画蛇添足版", now: NOW, suffix: "abcd", mode: "full" })
		const dir = knowledgeBaseDir(root, manifest.slug)
		await fs.writeFile(path.join(dir, "index.md"), "- @COMBAT — 战斗结算 — ERB/COMBAT.ERB:12\n", "utf8")

		// #93：刚开的完整建库是 building → 半成品不能当知识库注入（否则模型拿着空索引瞎猜）
		assert.equal(await loadKnowledgeBaseSection(root), "", "构建中的库不注入")

		await updateKnowledgeBaseBuild(dir, { status: "ready" })
		const enabled = await loadKnowledgeBaseSection(root)
		assert.ok(enabled.includes("## 专属知识库（参考，不是铁律）"))
		assert.ok(enabled.includes("@COMBAT"))
		assert.ok(enabled.includes(manifest.slug))

		// 失败态（中断/报错）同样不注入
		await updateKnowledgeBaseBuild(dir, { status: "failed", error: "已中断（可继续构建）" })
		assert.equal(await loadKnowledgeBaseSection(root), "", "上次未完成的库不注入")

		await updateKnowledgeBaseBuild(dir, { status: "ready" })

		// 关掉开关 → 立刻不注入（用户要的就是「载入/不载入」这一个动作）
		await writeManifest(dir, { ...manifest, enabled: false, build: { status: "ready" } })
		assert.equal(await loadKnowledgeBaseSection(root), "")

		// 索引文件被删 → 不算可用
		await writeManifest(dir, { ...manifest, enabled: true, build: { status: "ready" } })
		await fs.rm(path.join(dir, "index.md"))
		assert.equal(await loadKnowledgeBaseSection(root), "")
	})
})

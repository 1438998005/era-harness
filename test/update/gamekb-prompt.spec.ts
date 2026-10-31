/**
 * 「建库 / 更新库」两段提示词。
 *
 * 这两段提示词是专属知识库唯一的「质量来源」：库长什么样、会不会污染工程，
 * 全靠这几句约束。所以这里锁的不是措辞好不好听，而是**缺了就会出事的那几条**：
 *
 * 1. 只写库目录 —— 否则 AI 会顺手"整理"游戏源码；
 * 2. 不抄正文 —— 否则知识库变成一份过期的代码副本；
 * 3. 必须带出处 —— 否则错了没法查；
 * 4. 分片上限 —— 否则又退回"一个大文件"，索引失去意义；
 * 5. 更新时只改变化 —— 否则每次更新都在重写，越更越错。
 *
 * 另外锁一个格式细节：小节之间必须保留空行。早先的 `filter(line => line !== '')`
 * 会把所有空行一起吃掉，`##` 标题直接贴着正文，可读性明显变差。
 */

import assert from "node:assert/strict"
import test from "node:test"
import type { GameKbManifest } from "@eraharness/gamekb/index"
import { buildCreatePrompt, buildUpdatePrompt } from "@eraharness/gamekb/index"
import { UNRESTRICTED_IDENTITY_BLOCK } from "../../src/shared/identity"

const BASE = {
	dir: "/w/.era-harness/knowledge/kb-202610311200-abcd",
	workspaceRoot: "/w",
	gameRoot: "/w/game",
	gameVersion: "1.2.3",
	identityBlock: UNRESTRICTED_IDENTITY_BLOCK,
}

function manifest(overrides: Partial<GameKbManifest> = {}): GameKbManifest {
	return {
		schemaVersion: 1,
		slug: "kb-202610311200-abcd",
		name: "eratw 画蛇添足版",
		gameRoot: "/w/game",
		gameVersion: "1.2.3",
		createdAt: "2026-10-31T12:00:00.000Z",
		updatedAt: "2026-10-31T12:00:00.000Z",
		enabled: true,
		index: "index.md",
		files: [],
		...overrides,
	}
}

test("建库提示词：身份块在最前，路径信息齐全", () => {
	const prompt = buildCreatePrompt({ ...BASE, name: "eratw 画蛇添足版" })

	assert.ok(prompt.startsWith(UNRESTRICTED_IDENTITY_BLOCK), "身份块必须在最前面（initTask 只解析首条消息的前缀）")
	assert.ok(prompt.includes(BASE.dir), "库目录必须写进提示词，否则 AI 不知道自己该往哪写")
	assert.ok(prompt.includes(BASE.workspaceRoot))
	assert.ok(prompt.includes(BASE.gameRoot))
	assert.ok(prompt.includes(BASE.gameVersion))
	assert.ok(prompt.includes("库名：eratw 画蛇添足版"))
	assert.ok(prompt.includes("# 任务：为这个游戏建立「专属知识库」"))
})

test("建库提示词：没有库名/版本时不留下空行残渣", () => {
	const prompt = buildCreatePrompt({ ...BASE, gameRoot: undefined, gameVersion: undefined, identityBlock: "" })

	assert.ok(!prompt.includes("库名："), "未给库名就不该出现这一行")
	assert.ok(!prompt.includes("游戏版本："))
	assert.ok(prompt.includes("游戏工程根：请按工作区探测结果自行确认"), "拿不到工程根要明确让 AI 自己确认，而不是留空")
	assert.ok(!/\n\n\n/.test(prompt), "不允许出现连续空行")
})

test("两段提示词都必须写死的五条硬约束", () => {
	const cases: Array<[string, string]> = [
		["建库", buildCreatePrompt({ ...BASE, name: "x" })],
		["更新", buildUpdatePrompt({ ...BASE, name: "x", manifest: manifest() })],
	]

	for (const [label, prompt] of cases) {
		assert.ok(prompt.includes("只写知识库目录下的文件"), `${label}：必须禁止改游戏源码`)
		assert.ok(prompt.includes(".ERB / .ERH / .CSV"), `${label}：点名文件类型比"不要动源码"更有效`)
		assert.ok(prompt.includes("不复制函数正文"), `${label}：不抄正文，避免库变成过期副本`)
		assert.ok(prompt.includes("相对路径:行号"), `${label}：每条都要有出处`)
		assert.ok(prompt.includes("单个分片 ≤ 300 行"), `${label}：分片上限`)
		assert.ok(prompt.includes("`index.md` ≤ 200 行"), `${label}：索引上限`)
		assert.ok(prompt.includes("不要停下来反复向用户确认"), `${label}：不许把建库变成一问一答`)
	}
})

test("两段提示词都必须要求「索引 + 分片」而不是单文件", () => {
	const cases = [buildCreatePrompt({ ...BASE, name: "x" }), buildUpdatePrompt({ ...BASE, manifest: manifest() })]

	for (const prompt of cases) {
		assert.ok(prompt.includes("总索引 + 分片"))
		assert.ok(prompt.includes("`functions/<主题>.md`"))
		assert.ok(prompt.includes("`constants/<主题>.md`"))
		assert.ok(prompt.includes("`tables/<主题>.md`"))
		assert.ok(prompt.includes("⛔ 不要把所有内容写进一个文件"))
		assert.ok(prompt.includes("## 函数"))
		assert.ok(prompt.includes("## 常量与变量槽位"))
		assert.ok(prompt.includes("## CSV 表结构"))
		assert.ok(prompt.includes("## 机制与坑"))
	}
})

test("提示词保留小节之间的空行（曾经被 filter 全吃掉）", () => {
	const prompt = buildCreatePrompt({ ...BASE, name: "x" })
	// 标题前面有空行 = 上一节结束、新一节开始；没有空行时模型更容易把列表读串
	assert.ok(prompt.includes("\n\n## 目标\n"))
	assert.ok(prompt.includes("\n\n## 硬性约束"))
	assert.ok(prompt.includes("\n\n## 工作顺序\n"))
	assert.ok(prompt.includes("\n\n## 完成标准\n"))
})

test("建库提示词给出 kb.json 的字段契约，并标出哪些不许改", () => {
	const prompt = buildCreatePrompt({ ...BASE, name: "x" })

	assert.ok(prompt.includes('"schemaVersion": 1'))
	assert.ok(prompt.includes('"slug": "<目录名，⛔ 不要改>"'))
	assert.ok(prompt.includes('"name": "<库名，⛔ 不要改>"'))
	assert.ok(prompt.includes('"files": [{ "path": "functions/xxx.md"'))
	assert.ok(prompt.includes('"counts": { "function": 0, "constant": 0, "table": 0 }'))
})

test("更新提示词：带上库名、上次更新时间与已登记分片清单", () => {
	const prompt = buildUpdatePrompt({
		...BASE,
		manifest: manifest({
			updatedAt: "2026-10-30T08:00:00.000Z",
			files: [
				{ path: "functions/combat.md", title: "战斗", count: 12 },
				{ path: "constants/flags.md", count: 8 },
			],
		}),
	})

	assert.ok(prompt.includes("# 任务：按当前工作区更新知识库「eratw 画蛇添足版」"))
	assert.ok(prompt.includes("库上次更新：2026-10-30T08:00:00.000Z"))
	assert.ok(prompt.includes("`functions/combat.md`（战斗）"))
	assert.ok(prompt.includes("`constants/flags.md`"))
	assert.ok(!prompt.includes("请先自己 `ls` 一遍目录"), "已登记分片时不该再让 AI 自己去 ls")
})

test("更新提示词：没有登记分片时给出兜底，且强调「只改变化的部分」", () => {
	const prompt = buildUpdatePrompt({ ...BASE, manifest: manifest({ files: [] }) })

	assert.ok(prompt.includes("请先自己 `ls` 一遍目录"))
	assert.ok(prompt.includes("⛔ 不要重新组织目录、不要重命名分片"))
	assert.ok(prompt.includes("没变化的条目**一个字都不要动**"))
	assert.ok(prompt.includes("只更新 `updatedAt` / `counts` / `files` / `gameVersion`"))
	assert.ok(prompt.includes("`slug` / `name` / `createdAt` / `enabled` 保持原样"))
})

test("更新提示词：带上本次探测到的版本，便于判断哪一层变了", () => {
	const prompt = buildUpdatePrompt({ ...BASE, manifest: manifest() })
	assert.ok(prompt.includes(`本次探测到的游戏版本：${BASE.gameVersion}`))

	const noVersion = buildUpdatePrompt({ ...BASE, gameVersion: undefined, manifest: manifest() })
	assert.ok(!noVersion.includes("本次探测到的游戏版本"), "拿不到版本就不写这一行")
})

test("更新提示词：没有工程根时让 AI 自己确认，不硬编一个错路径", () => {
	const prompt = buildUpdatePrompt({ ...BASE, gameRoot: undefined, manifest: manifest() })
	assert.ok(prompt.includes("游戏工程根：请按工作区探测结果自行确认"))
	assert.ok(!prompt.includes("/w/game"), "调用方没给工程根时不许把 manifest 里的路径悄悄当成当前工程")
})

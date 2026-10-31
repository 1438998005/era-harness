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
import { buildCreatePrompt, buildIncrementPrompt, buildUpdatePrompt } from "@eraharness/gamekb/index"
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

// —— #95（2026-10-31）：102 元建库事故 ——
// 事故现场：5 个子代理并行，其中一个循环 1936 次工具调用、单条 ¥96.86，
// 整批 ¥102.43，卡 93 分钟且零分片产出。根因之一是模型在写盘任务里调了 use_subagents。
// 提示词必须**三种任务形态都禁止**它；预算硬上限是第二道防线，不能只靠这一句。

test("#95 建库 / 更新 / 续写三种提示词都禁止 use_subagents", () => {
	const cases: Array<[string, string]> = [
		["建库", buildCreatePrompt({ ...BASE, name: "x" })] as [string, string],
		["更新", buildUpdatePrompt({ ...BASE, manifest: manifest() })],
		[
			"续写",
			buildIncrementPrompt({
				...BASE,
				manifest: manifest(),
				scope: { label: "本次对话涉及的文件", paths: ["ERB/A.ERB"] },
			}),
		],
	]

	for (const [label, prompt] of cases) {
		assert.ok(
			prompt.includes("不要调用 use_subagents") || prompt.includes("不要使用 use_subagents"),
			`${label}：必须禁子代理`,
		)
	}
	// 建库提示词里要把事故量级说出来（模型靠这句话判断“值得不值得”）
	assert.ok(buildCreatePrompt({ ...BASE, name: "x" }).includes("102"))
})

// —— #92：预期管理同源 ——
// 设置页的确认面板与提示词里的四句警示必须同源，否则用户在界面看到的和模型看到的不一致。

test("#92 建库/更新提示词第一屏含四条预期（时长、费用、模型、可续写）", () => {
	for (const prompt of [buildCreatePrompt({ ...BASE, name: "x" }), buildUpdatePrompt({ ...BASE, manifest: manifest() })]) {
		assert.ok(prompt.includes("这是一次长任务"), "先读段必须存在")
		assert.ok(prompt.includes("30–120 分钟"))
		assert.ok(prompt.includes("不要切换模型"))
		assert.ok(prompt.includes("102 元"), "必须用实测数字，不能写模糊的“可能较贵”")
		assert.ok(prompt.includes("智能程度高的模型"))
		// 两种库（完整/空白）都能续写，所以建库提示词里也要告诉模型可以续写
		assert.ok(prompt.includes("续写"), "要告诉模型/用户：没跑完可以续写")
	}
})

// —— 续写是动作，不是某种库的专属能力（3.95.1） ——
// 用户 2026-10-31 澄清：新建只有「构建完整知识库」与「构建空白知识库」两个选项，
// 而无论建哪一种，之后都能续写添砖加瓦。
// 所以这里锁的是“同构 + 不分形态”：同一套分片规则/硬约束/kb.json 契约，
// 且 `buildIncrementPrompt` 根本不接收建库形态参数。

test("续写：与完整建库共用同一套产物规则（不是另一种格式）", () => {
	const create = buildCreatePrompt({ ...BASE, name: "x" })
	const increment = buildIncrementPrompt({
		...BASE,
		manifest: manifest({ files: [{ path: "functions/combat.md", title: "战斗", count: 12 }] }),
		scope: { label: "本次对话涉及的文件", paths: ["ERB/A.ERB", "ERB/B.ERB"] },
	})

	// ① 分片结构相同（一字不差地复用 SHARD_RULES）
	for (const marker of ["总索引 + 分片", "`functions/<主题>.md`", "`constants/<主题>.md`", "`tables/<主题>.md`"]) {
		assert.ok(increment.includes(marker), `续写缺少分片规则：${marker}`)
		assert.ok(create.includes(marker))
	}
	assert.ok(increment.includes("## 函数") && increment.includes("## 机制与坑"))

	// ② 硬约束相同（只写库目录、不抄正文、必带出处、行数上限）
	for (const marker of [
		"只写知识库目录下的文件",
		"不复制函数正文",
		"相对路径:行号",
		"单个分片 ≤ 300 行",
		"`index.md` ≤ 200 行",
	]) {
		assert.ok(increment.includes(marker), `续写缺少硬约束：${marker}`)
	}

	// ③ kb.json 契约相同
	assert.ok(increment.includes('"schemaVersion": 1'))
	assert.ok(increment.includes('"files": [{ "path": "functions/xxx.md"'))

	// ④ 不另起格式
	assert.equal(increment.includes("notes.md"), false, "不许另立轻量记忆格式")
})

test("续写：只处理给定范围，并明确不重读全工程", () => {
	const prompt = buildIncrementPrompt({
		...BASE,
		manifest: manifest({ files: [{ path: "functions/combat.md", title: "战斗", count: 12 }] }),
		scope: { label: "本次对话涉及的文件", paths: ["ERB/A.ERB", "ERB/B.ERB"] },
	})

	assert.ok(prompt.includes("# 任务：给知识库「eratw 画蛇添足版」续写本次范围的内容"))
	assert.ok(prompt.includes("**完整建库的库同样可以续写**"), "要明说续写不分建库形态")
	assert.ok(prompt.includes("`ERB/A.ERB`") && prompt.includes("`ERB/B.ERB`"), "范围文件要逐条列出")
	assert.ok(prompt.includes("不要重读整个工程") || prompt.includes("重读整个工程"), "必须禁止重读全工程")
	assert.ok(prompt.includes("不要重写/重排范围外的分片"))
	assert.ok(prompt.includes("不要重命名分片"))
	// 已有分片清单直接给出来，避免模型自己 ls 一遍
	assert.ok(prompt.includes("`functions/combat.md`（战斗）"))
	// 完成汇报要能对账
	assert.ok(prompt.includes("新增 N / 修改 M"))
})

test("续写：按主题指定范围时不列 paths，也不要求读文件清单", () => {
	const prompt = buildIncrementPrompt({
		...BASE,
		manifest: manifest({ files: [] }),
		scope: { label: "主题：战斗系统", topic: "战斗系统" },
	})

	assert.ok(prompt.includes("本次只处理主题：**战斗系统**"))
	assert.ok(prompt.includes("没有登记分片，请先自己 `ls` 一遍目录"), "没分片时给兜底而不是留空")
	// 身份块自带尾换行（与建库/更新同形），所以这里用空身份块验「模板本身不留连续空行」
	assert.ok(
		!/\n\n\n/.test(
			buildIncrementPrompt({ ...BASE, identityBlock: "", manifest: manifest(), scope: { label: "x", topic: "y" } }),
		),
	)
})

test("续写：范围文件最多列 60 条（防止一次续写又退回完整建库规模）", () => {
	const paths = Array.from({ length: 80 }, (_, i) => `ERB/dir${i}/file.ERB`)
	const prompt = buildIncrementPrompt({ ...BASE, manifest: manifest(), scope: { label: "x", paths } })

	assert.ok(prompt.includes("`ERB/dir59/file.ERB`"), "第 60 条要保留")
	assert.ok(!prompt.includes("`ERB/dir60/file.ERB`"), "第 61 条开始必须丢弃")
})

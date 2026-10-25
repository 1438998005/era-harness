// era harness：分块流式回放测试。fixtures.json 的单发用例捕不到**流式态** bug——
// 真实 API 流按 chunk 累积，每个累积步都会重跑一次解析器，partial 值/展示净化在每个
// 中间态都可能出问题（2026-10-25 任务取证：EINVAL 的脏 path 只存在于流尾截断态；
// MiMo 方言残片只在截断点被渲染成正文）。这里按危险 chunk 边界切片，对每个累积步
// 同时断言「解析结果」与「展示净化结果」。
// 运行：npm run test:toolcall（run.mjs 会把本文件与 parse.spec.ts 一起打包跑）
import assert from "node:assert/strict"
import { test } from "node:test"
import { cleanAssistantTextForDisplay, parseAssistantMessageV2 } from "@core/assistant-message"

type AnyBlock = { type: string; name?: string; params?: Record<string, string>; content?: string; partial?: boolean }
type ExpectTool = { name: string; params?: Record<string, string>; partial?: boolean }
type Check = {
	afterChunks: number
	expectDisplayText?: string
	expectTools?: ExpectTool[]
	expectTextNotContains?: string[]
}
type StreamCase = { name: string; chunks: string[]; checks: Check[] }

const cases: StreamCase[] = [
	{
		// 2026-10-25 任务 1792887990433 msg61：EINVAL `mkdir '..._tmp_search6.py<'` 的根因态。
		// 修复前 partial 终值化会把半截 `</path` 吞进 path 值，流式预览拿脏路径去 mkdir 直接炸。
		name: "A2：content 在前 path 在后，流尾截断在 </path 中间",
		chunks: [
			'<write_to_file>\n<content># -*- coding: utf-8 -*-\nprint("ok")\n',
			"</content>\n<path>tmp_search6.py</path",
			">\n</write_to_file>",
		],
		checks: [
			{
				afterChunks: 2,
				expectTools: [
					{
						name: "write_to_file",
						partial: true,
						params: {
							path: "tmp_search6.py",
							content: '# -*- coding: utf-8 -*-\nprint("ok")',
						},
					},
				],
				expectTextNotContains: ["</path"],
			},
			{
				afterChunks: 3,
				expectTools: [
					{
						name: "write_to_file",
						partial: false,
						params: {
							path: "tmp_search6.py",
							content: '# -*- coding: utf-8 -*-\nprint("ok")',
						},
					},
				],
			},
		],
	},
	{
		// partial 终值化只剥「当前参数闭标签的严格前缀」，内容里合法的 < 不得误伤。
		name: "A2 反例：content 值含 < 截断时不被误剥",
		chunks: ['<write_to_file>\n<path>a.html</path>\n<content><div class="x">', "</content>\n</write_to_file>"],
		checks: [
			{
				afterChunks: 1,
				expectTools: [
					{
						name: "write_to_file",
						partial: true,
						params: { path: "a.html", content: `<div class="x">` },
					},
				],
			},
			{
				afterChunks: 2,
				expectTools: [
					{
						name: "write_to_file",
						partial: false,
						params: { path: "a.html", content: `<div class="x">` },
					},
				],
			},
		],
	},
	{
		// 2026-10-25 任务 1792888515757（MiMo）：泄漏根因态。修复前截断点整段被 say 成正文，
		// 且文本块随后变成工具块时已渲染的 partial say:text 无人回收。
		name: "MiMo：流式截断在方言标记中间，显示层不落残片",
		chunks: [
			"<tool_call><function=search",
			"_files>\n<path>ERB</parameter><parameter=regex>中文词Ｄ</parameter></function></tool_call>",
		],
		checks: [
			{
				afterChunks: 1,
				expectDisplayText: "",
				expectTextNotContains: ["tool_call", "function="],
			},
			{
				afterChunks: 2,
				expectDisplayText: "",
				expectTools: [
					{
						name: "search_files",
						partial: false,
						params: { path: "ERB", regex: "中文词Ｄ" },
					},
				],
			},
		],
	},
	{
		name: "MiMo：截断前有正文，正文保留、残片不落",
		chunks: [
			"我先搜索一下。\n<tool_call><function=search",
			"_files>\n<path>CSV</parameter><parameter=regex>中文词Ｄ</parameter></function></tool_call>",
		],
		checks: [
			{
				afterChunks: 1,
				expectDisplayText: "我先搜索一下。",
				expectTextNotContains: ["tool_call", "function="],
			},
			{
				afterChunks: 2,
				expectDisplayText: "我先搜索一下。",
				expectTools: [
					{
						name: "search_files",
						partial: false,
						params: { path: "CSV", regex: "中文词Ｄ" },
					},
				],
			},
		],
	},
	{
		// 2026-10-25 任务 1792900662485 msg7（A 族链式闭标签）：截断点落在链式标签中间，
		// 中间态的脏参数值不得执行（partial 不执行），最终态必须完整还原。
		name: "DS A族：流式截断在链式闭标签中间，最终态完整还原",
		chunks: [
			'<｜｜DSML｜｜ calls>\n<｜｜DSML｜｜ invoke name="search_files">\n<｜｜DSML｜｜ parameter name="path" string="true">ERB</｜｜DSML｜｜ par',
			'ameter name="regex" string="true">中文词Ａ</｜｜DSML｜｜ parameter name="task_progress>\n- [ ] 待办\n</task_progress>\n</｜｜DSML｜｜>\n</｜｜DSML｜｜ calls>',
		],
		checks: [
			{
				afterChunks: 1,
				expectDisplayText: "",
				expectTextNotContains: ["DSML"],
			},
			{
				afterChunks: 2,
				expectDisplayText: "",
				expectTools: [
					{
						name: "search_files",
						partial: false,
						params: { path: "ERB", regex: "中文词Ａ" },
					},
				],
			},
		],
	},
	{
		// 2026-10-25 第三方单竖线变体（08 #46）：分隔符 token 被切成两半时，
		// 中间态不得把 `<｜DS` 残片渲染成正文，最终态还原为工具。
		name: "DS 单竖线：流式截断在分隔符 token 中间，残片不落展示",
		chunks: ["<｜DS", 'ML｜ invoke name="read_file">\n<path>a.ERB</path>\n</read_file>'],
		checks: [
			{
				afterChunks: 1,
				expectDisplayText: "",
			},
			{
				afterChunks: 2,
				expectDisplayText: "",
				expectTools: [
					{
						name: "read_file",
						partial: false,
						params: { path: "a.ERB" },
					},
				],
			},
		],
	},
]

for (const c of cases) {
	test(c.name, () => {
		for (const chk of c.checks) {
			const accumulated = c.chunks.slice(0, chk.afterChunks).join("")
			const blocks = parseAssistantMessageV2(accumulated) as AnyBlock[]

			const textBlocks = blocks.filter((b) => b.type === "text")
			const displayText = textBlocks.map((b) => cleanAssistantTextForDisplay(b.content ?? "", !!b.partial)).join("")

			if (chk.expectDisplayText !== undefined) {
				assert.equal(
					displayText,
					chk.expectDisplayText,
					`第 ${chk.afterChunks} 个 chunk 后的展示正文不符（原始正文: ${JSON.stringify(textBlocks.map((b) => b.content))}）`,
				)
			}

			if (chk.expectTextNotContains) {
				for (const needle of chk.expectTextNotContains) {
					assert.ok(
						!displayText.includes(needle),
						`第 ${chk.afterChunks} 个 chunk 后展示正文不应包含 "${needle}"，实际: ${JSON.stringify(displayText)}`,
					)
				}
			}

			if (chk.expectTools) {
				const tools = blocks.filter((b) => b.type === "tool_use")
				assert.equal(
					tools.length,
					chk.expectTools.length,
					`第 ${chk.afterChunks} 个 chunk 后工具数量不符：实际 ${JSON.stringify(tools.map((t) => ({ name: t.name, partial: t.partial })))}`,
				)
				chk.expectTools.forEach((exp, i) => {
					const got = tools[i]
					assert.equal(got.name, exp.name, `第 ${i} 个工具名不符`)
					if (exp.partial !== undefined) {
						assert.equal(got.partial, exp.partial, `工具 ${exp.name} 的 partial 标记不符`)
					}
					if (exp.params) {
						for (const [k, v] of Object.entries(exp.params)) {
							assert.equal(got.params?.[k], v, `工具 ${exp.name} 的参数 ${k} 不符`)
						}
					}
				})
			}
		}
	})
}

// display-clean 单元测试（纯函数）
test("display-clean：完整方言包裹残片被清除", () => {
	assert.equal(cleanAssistantTextForDisplay("abc <tool_call> def", true), "abc  def")
	assert.equal(cleanAssistantTextForDisplay("正文。<function=search_files>", true), "正文。")
	assert.equal(cleanAssistantTextForDisplay("收尾。</tool_call>", false), "收尾。")
})

test("display-clean：尾部不完整标签（含 = 形态）被裁剪", () => {
	assert.equal(cleanAssistantTextForDisplay("<tool_call><function=search", true), "")
	assert.equal(cleanAssistantTextForDisplay("代码 <div", true), "代码")
	assert.equal(cleanAssistantTextForDisplay("文本 </pat", true), "文本")
	assert.equal(cleanAssistantTextForDisplay("就一个 <", true), "就一个")
})

test("display-clean：合法正文不受影响", () => {
	assert.equal(cleanAssistantTextForDisplay("普通正文，含 a<b 比较。", true), "普通正文，含 a<b 比较。")
	// 非 partial 时结尾 ``` 语言标记清理（保留尾部换行，与上游行为一致）
	assert.equal(cleanAssistantTextForDisplay("代码\n```ts", false), "代码\n")
	// partial 时不清理 ``` 结尾（还在流式，可能是代码块开头）
	assert.equal(cleanAssistantTextForDisplay("代码\n```ts", true), "代码\n```ts")
})

test("display-clean：孤儿工具闭标签整块清掉（2026-10-25 任务 1792900662485 turn27 取证）", () => {
	assert.equal(cleanAssistantTextForDisplay("</era_symbols>", false), "")
	assert.equal(cleanAssistantTextForDisplay("</era_symbols>\n", false), "")
	// 带前文的块不动（只有整块恰为闭标签才清）
	assert.equal(cleanAssistantTextForDisplay("读完了 </era_symbols>", false), "读完了 </era_symbols>")
	// 非已知工具名的闭标签按普通文本保留
	assert.equal(cleanAssistantTextForDisplay("</unknown_thing>", false), "</unknown_thing>")
})

test("display-clean：DSML 标签形态清理与半截标签裁剪（08 #46）", () => {
	assert.equal(cleanAssistantTextForDisplay('前文 <｜DSML｜ invoke name="search_files"> 后文', false), "前文  后文")
	// 截断在分隔符中间的 partial 尾巴（<｜DS 不是 ASCII 标签名）
	assert.equal(cleanAssistantTextForDisplay("<｜DS", true), "")
	assert.equal(cleanAssistantTextForDisplay("正文 </｜", true), "正文")
	// 孤立讨论 DSML 字样（无尖括号包裹）的正文不动
	assert.equal(cleanAssistantTextForDisplay("这个模型输出 ｜｜DSML｜｜ 分隔符", true), "这个模型输出 ｜｜DSML｜｜ 分隔符")
})

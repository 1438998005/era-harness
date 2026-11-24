import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseAssistantMessageV2 } from "../../src/core/assistant-message"

/**
 * KB 08 #269：Qwen `arg_key`/`arg_value` 工具方言归一。
 *
 * 2026-11-23 免费池探针实测，两个新入池模型都用 Qwen 训练方言吐工具调用：
 * - Flint：`<tool_call>glob<arg_key>pattern</arg_key><arg_value>（glob 深度模式）/ERB/DIM.ERH</arg_value></tool_call>`
 * - Laguna XS 2.1：中文导语后跟 `<tool_call>read_file<arg_key>path</arg_key><arg_value>ERB/DIM.ERH</arg_value></tool_call>`
 * 插件此前只拆外层包裹（normalizeLeakedToolMarkup 的既有两趟），`arg_key` 对原样漏进
 * 正文 → 工具参数全空。归一器把键值对还原成 `<k>v</k>`，约束：①在开包裹归一**之前**做
 * （包裹先归一成 `<read_file>` 块边界就没了）；②只在包裹块内做（块外正文的 arg_key
 * 字样可能是模型在举例讲解协议，绝不能动）。
 */

type AnyBlock = { type: string; name?: string; params?: Record<string, string>; content?: string; partial?: boolean }

function toolsOf(raw: string): AnyBlock[] {
	return parseAssistantMessageV2(raw).filter((b): b is AnyBlock => b.type === "tool_use" && !b.partial) as AnyBlock[]
}

describe("Qwen arg_key 方言归一（KB 08 #269）", () => {
	it("Flint 探针原文：喊了协议外工具名 glob → 白名单拦下，不产出工具、原文保留", () => {
		const raw = "<tool_call>glob<arg_key>pattern</arg_key><arg_value>（glob 深度模式）/ERB/DIM.ERH</arg_value></tool_call>"
		// glob 不在本插件工具集里（探针里模型自选的搜索习惯），整块不得归一成工具调用
		assert.equal(toolsOf(raw).length, 0, "协议外工具名不得产出工具调用")
		const blocks = parseAssistantMessageV2(raw) as AnyBlock[]
		const text = blocks
			.filter((b) => b.type === "text")
			.map((b) => b.content ?? "")
			.join("")
		assert.ok(text.includes("<tool_call>glob"), "未知工具名的原文应保留（交给上层按无工具处理）")
		// 同方言 + 真实工具名：归一成工具调用（正文零残留的对照面）
		const known = "<tool_call>read_file<arg_key>path</arg_key><arg_value>ERB/DIM.ERH</arg_value></tool_call>"
		const knownTools = toolsOf(known)
		assert.equal(knownTools.length, 1)
		assert.equal(knownTools[0]?.params?.path, "ERB/DIM.ERH")
	})

	it("Laguna 探针原文（带中文导语）：正文与工具分开，read_file + path", () => {
		const raw =
			"我需要先找到并读取这个 ERB/DIM.ERH 文件的开头部分，然后告诉你第 2 行写的是什么内容。\n\n我将首先查找这个文件。<tool_call>read_file<arg_key>path</arg_key><arg_value>ERB/DIM.ERH</arg_value></tool_call>"
		const blocks = parseAssistantMessageV2(raw) as AnyBlock[]
		const text = blocks
			.filter((b) => b.type === "text")
			.map((b) => b.content ?? "")
			.join("")
		assert.ok(text.includes("我需要先找到"), "中文导语应保留为正文")
		const tools = blocks.filter((b): b is AnyBlock => b.type === "tool_use" && !b.partial)
		assert.equal(tools.length, 1)
		assert.equal(tools[0]?.name, "read_file")
		assert.equal(tools[0]?.params?.path, "ERB/DIM.ERH")
	})

	it("多参数按序还原成多个子标签", () => {
		const raw =
			"<tool_call>search_files<arg_key>regex</arg_key><arg_value>DIM</arg_value><arg_key>file_pattern</arg_key><arg_value>\\.ERB</arg_value></tool_call>"
		const tools = toolsOf(raw)
		assert.equal(tools.length, 1)
		assert.equal(tools[0]?.name, "search_files")
		assert.equal(tools[0]?.params?.regex, "DIM")
		assert.equal(tools[0]?.params?.file_pattern, "\\.ERB")
	})

	it("闭包裹残留单独出现（流式截断）不产出工具、不污染正文", () => {
		const raw = "前文</tool_call>"
		const blocks = parseAssistantMessageV2(raw) as AnyBlock[]
		assert.equal(blocks.filter((b) => b.type === "tool_use").length, 0)
		const text = blocks
			.filter((b) => b.type === "text")
			.map((b) => b.content ?? "")
			.join("")
		assert.ok(!text.includes("</tool_call>"), `闭包裹残留应被清掉：${text}`)
		assert.ok(text.includes("前文"))
	})

	it("块外正文的 arg_key 字样不动（防误伤模型讲解协议的例子）", () => {
		const raw = "参数写法是 <arg_key>path</arg_key><arg_value>x</arg_value>，请按此输出。"
		const blocks = parseAssistantMessageV2(raw) as AnyBlock[]
		const text = blocks
			.filter((b) => b.type === "text")
			.map((b) => b.content ?? "")
			.join("")
		assert.ok(text.includes("<arg_key>path</arg_key>"), "没有 tool_call 包裹时键值对必须原样保留")
		assert.equal(blocks.filter((b) => b.type === "tool_use").length, 0)
	})

	it("未知工具名不归一（沿用既有白名单），MiMo `<function=` 变体不受影响", () => {
		const unknown = "<tool_call>not_a_real_tool<arg_key>path</arg_key><arg_value>x</arg_value></tool_call>"
		assert.equal(toolsOf(unknown).length, 0, "未知工具名不得产出工具调用")

		const mimo = "<tool_call><function=read_file>\n<path>ERB/DIM.ERH</path>\n</function></tool_call>"
		const tools = toolsOf(mimo)
		assert.equal(tools.length, 1)
		assert.equal(tools[0]?.name, "read_file")
		assert.equal(tools[0]?.params?.path, "ERB/DIM.ERH")
	})
})

/**
 * `<reasoning>` 段展示清理（08 #83，3.94.0）。
 *
 * 取证：GLM-4.6V-Flash 走 GLM 变体（提示词要求 `<reasoning>` 思考），但不返回
 * `reasoning_content`，思考连同标签一起落进正文；`display-clean` 原先只清
 * `<thinking>/<think>/<function_calls>`，于是整段思考与 `</reasoning>` 直接渲染给用户。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { cleanAssistantTextForDisplay, stripReasoningSegments } from "../../src/core/assistant-message/display-clean"

test("行首的完整 <reasoning> 段：内容与标签一起删除，前后正文保留", () => {
	const raw = "先说结论。\n<reasoning>\n我在想 replace_in_file 已经成功了\n</reasoning>\n然后给出步骤。"
	const cleaned = stripReasoningSegments(raw)

	assert.equal(cleaned, "先说结论。\n然后给出步骤。")
	assert.ok(!cleaned.includes("replace_in_file"))
})

test("半截未闭合（流式中）：删到正文末尾，不吞掉前面的正文", () => {
	const raw = "正在分析这个函数。\n<reasoning>模型还在思考，没闭合"
	const cleaned = stripReasoningSegments(raw)

	assert.equal(cleaned, "正在分析这个函数。")
})

test("单独成行的孤立闭标签：删除", () => {
	const raw = "正文第一段。\n</reasoning>\n正文第二段。"
	assert.equal(stripReasoningSegments(raw), "正文第一段。\n正文第二段。")
})

test("行内提及 <reasoning> 字样：不误删（反例守门）", () => {
	const raw = "说明：代码里写 <reasoning> 标签；字面量里的 </reasoning> 也不该被动。"
	assert.equal(stripReasoningSegments(raw), raw)
})

test("展示入口：思考内容不会渲染到聊天区", () => {
	const raw = "<reasoning>我编造了一段成功汇报</reasoning>\n实际的失败原因是 SEARCH block does not match。"
	const cleaned = cleanAssistantTextForDisplay(raw, false)

	assert.ok(!cleaned.includes("<reasoning"))
	assert.ok(!cleaned.includes("我编造"))
	assert.ok(cleaned.includes("SEARCH block does not match"))
})

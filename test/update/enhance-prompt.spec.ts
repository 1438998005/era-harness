/**
 * 08 #207：发送按钮旁的「增强提示词」。
 *
 * 竞品共性（Qoder 官方文档 / Trae「优化输入内容」/ WorkBuddy / CodeBuddy Boost Prompt）：
 * 就地替换、可编辑、可撤销、不自动发送、不另起对话、空输入禁用、失败保留原文。
 *
 * 本 spec 只测两端共用的 JSON 契约与纯函数；宿主 handler 带 vscode 依赖，用源码接线断言。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	buildEnhancePromptSystemPrompt,
	ENHANCE_PROMPT_MAX_INPUT_CHARS,
	parseEnhancePromptRequest,
	parseEnhancePromptResponse,
	sanitizeEnhancedText,
} from "../../src/shared/enhancePrompt"
import { readCode, readRaw } from "./source-probe"

test("请求契约：只收 JSON 里的 text，空文本/超长/非法 JSON 都拒绝", () => {
	assert.deepEqual(parseEnhancePromptRequest(JSON.stringify({ text: "  改一下口上  " })), {
		ok: true,
		request: { text: "改一下口上", context: undefined },
	})
	assert.equal(parseEnhancePromptRequest("not json").ok, false)
	assert.equal(parseEnhancePromptRequest("").ok, false)
	assert.equal(parseEnhancePromptRequest(JSON.stringify({ text: "" })).ok, false)
	assert.equal(parseEnhancePromptRequest(JSON.stringify({ text: "x".repeat(ENHANCE_PROMPT_MAX_INPUT_CHARS + 1) })).ok, false)
	assert.deepEqual(parseEnhancePromptRequest(JSON.stringify({ text: "需求", context: "x".repeat(3000) })), {
		ok: true,
		request: { text: "需求", context: "x".repeat(2000) },
	})
})

test("输出清洗：去代码围栏与 thinking 残留，空结果不可用", () => {
	assert.equal(sanitizeEnhancedText("```markdown\n目标：修口上\n```"), "目标：修口上")
	assert.equal(sanitizeEnhancedText("<thinking>内部推理</thinking>\n目标：修口上"), "目标：修口上")
	assert.equal(sanitizeEnhancedText("   \n  "), "")
	assert.equal(sanitizeEnhancedText("```\n\n```"), "")
	assert.ok(sanitizeEnhancedText("x".repeat(20_000)).length <= 8000)
})

test("system prompt：补目标/边界/验收标准，且禁止解释、工具与进度清单", () => {
	const prompt = buildEnhancePromptSystemPrompt()
	assert.match(prompt, /目标/)
	assert.match(prompt, /边界/)
	assert.match(prompt, /验收标准/)
	assert.match(prompt, /只输出/)
	assert.match(prompt, /不要调用任何工具/)
	assert.match(prompt, /eraTW/)
})

test("响应契约：坏 JSON 与失败结果都按失败处理，不覆盖用户原文", () => {
	assert.deepEqual(parseEnhancePromptResponse(JSON.stringify({ ok: true, enhancedText: "  目标：修口上  " })), {
		ok: true,
		enhancedText: "目标：修口上",
	})
	assert.equal(parseEnhancePromptResponse(undefined).ok, false)
	assert.equal(parseEnhancePromptResponse("not json").ok, false)
	assert.equal(parseEnhancePromptResponse(JSON.stringify({ ok: false, message: "模型没有返回可用的提示词" })).ok, false)
	assert.equal(parseEnhancePromptResponse(JSON.stringify({ ok: true, enhancedText: "" })).ok, false)
})

test("源码接线：proto 一元 RPC、handler 落点、单次改写不进任务历史", () => {
	const proto = readRaw("proto/cline/ui.proto")
	assert.match(proto, /rpc enhancePrompt\(StringRequest\) returns \(String\);/)

	const handler = readCode("src/core/controller/ui/enhancePrompt.ts")
	assert.match(handler, /export async function enhancePrompt\(controller: Controller, request: StringRequest\)/)
	assert.match(handler, /buildApiHandler\(/)
	assert.match(handler, /createMessage\(/)
	assert.match(handler, /parseEnhancePromptResponse|JSON\.stringify\(result\)/)
	assert.ok(!handler.includes("clineMessages"), "增强请求不得写入任务历史")
	assert.ok(!handler.includes("userMessageContent"), "增强请求不得拼进上下文窗口")

	const client = readRaw("webview-ui/src/services/grpc-client.ts")
	assert.match(client, /static async enhancePrompt\(/, "生成物应含新 RPC，禁止手改")
})

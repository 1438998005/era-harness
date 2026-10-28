import type OpenAI from "openai"

/**
 * 智谱 BigModel 请求侧纯函数（零依赖，扩展与 webview 共用）。
 *
 * 事实来源（官方文档，2026-10-28 逐页核对）：
 * - OpenAI 兼容入口 `https://open.bigmodel.cn/api/paas/v4/`，标准 `Authorization: Bearer`
 *   （/docs/zh-CN/guide/develop/openai/introduction）
 * - 思考开关与 MiMo 同构：`thinking: { type: "enabled" | "disabled" }`（extra_body），
 *   思考内容在 `delta.reasoning_content`；GLM-5.2 官方示例即此形态
 * - 输出上限字段名：官方参数表写 `max_tokens`（上游 Cline zai handler 实测发
 *   `max_completion_tokens` 亦被端点接受）——二选一，这里跟官方参数表走 `max_tokens`，
 *   两个字段绝不同发（若实测 `max_tokens` 被忽略，改这里一处即可）
 */
export const BIGMODEL_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

/** 控制台（API Key 管理）。 */
export const BIGMODEL_CONSOLE_URL = "https://bigmodel.cn/usercenter/proj-mgmt/apikeys"
/** 文档站（OpenAI 兼容接入页）。 */
export const BIGMODEL_DOCS_URL = "https://docs.bigmodel.cn/cn/guide/develop/openai/introduction"

export type BigmodelThinkingFields = { thinking?: { type: "enabled" | "disabled" } }

export type BigmodelChatParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & BigmodelThinkingFields

export interface BigmodelRequestInput {
	model: string
	messages: OpenAI.Chat.ChatCompletionMessageParam[]
	maxTokens?: number
	/** 已算好的思考参数；`{}` 表示不发送（交给官方默认，默认态待验证）。 */
	thinkingParam?: BigmodelThinkingFields
	toolParams?: Pick<OpenAI.Chat.ChatCompletionCreateParamsStreaming, "tools" | "tool_choice" | "parallel_tool_calls">
}

/**
 * 界面开关 → GLM 思考参数（与 MiMo 的 mimoThinkingParam 同构）：
 * `"none"` → 显式关闭（disabled）；其它值或未设置 → **不发该参数**，交给官方默认。
 */
export function bigmodelThinkingParam(effort?: string): { thinking: { type: "disabled" } } | Record<string, never> {
	return effort === "none" ? { thinking: { type: "disabled" } } : {}
}

/**
 * 构造 BigModel 请求体（纯函数，单测直接调用）。
 * 守住两个「猜错就静默失效」的点：思考开关只能走 `thinking.type`；
 * 输出上限字段名只发一个（见文件头注）。
 */
export function buildBigmodelParams(input: BigmodelRequestInput): BigmodelChatParams {
	const params: BigmodelChatParams = {
		model: input.model,
		messages: input.messages,
		stream: true,
		stream_options: { include_usage: true },
		...input.toolParams,
	}
	if (input.maxTokens && input.maxTokens > 0) {
		params.max_tokens = input.maxTokens
	}
	if (input.thinkingParam?.thinking) {
		params.thinking = input.thinkingParam.thinking
	}
	return params
}

/**
 * 小米 MiMo 请求侧的纯判定（零依赖，扩展与 webview 共用）。
 *
 * 之所以单独成文件：
 * - 基址/入口在扩展侧（发请求）与设置页（在线同步模型）都要用，写死两处迟早漂移；
 * - 思考参数映射与降级判据是「猜错就静默失效」的地方，必须能被单测锁住。
 *
 * 事实来源（官方文档，2026-10 逐页核对，不是从 SDK 形状推测）：
 * - /docs/zh-CN/quick-start/summary/first-api-call：三种入口与各自密钥前缀
 * - /docs/zh-CN/quick-start/usage-guide/text-generation/deep-thinking：thinking.type 开关
 */

import type OpenAI from "openai"

/** 按量付费的实时 API（OpenAI 兼容协议）。 */
export const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1"
/** Token Plan 订阅的专属入口（个人版密钥 tp-、团队版 ttp-）。 */
export const MIMO_TOKEN_PLAN_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"
/** Anthropic 兼容协议入口（当前插件走 OpenAI 兼容，此处仅登记，便于后续接入）。 */
export const MIMO_ANTHROPIC_BASE_URL = "https://api.xiaomimimo.com/anthropic"
/** 控制台（API Key / 余额 / 用量）。 */
export const MIMO_CONSOLE_URL = "https://platform.xiaomimimo.com/console/balance"
/** 文档站。 */
export const MIMO_DOCS_URL = "https://mimo.mi.com/docs/zh-CN/quick-start/summary/welcome"

const TOKEN_PLAN_KEY = /^(tp|ttp)-/

/**
 * 官方把入口分成实时 API / Token Plan / 批量推理三种，**密钥前缀决定能用哪个**：
 * 拿 `tp-` 的密钥去调 `api.xiaomimimo.com` 会被直接拒。这里按前缀选，省得用户手改基址。
 */
export function mimoBaseUrlForKey(key: string | undefined): string {
	return TOKEN_PLAN_KEY.test((key ?? "").trim()) ? MIMO_TOKEN_PLAN_BASE_URL : MIMO_BASE_URL
}

/**
 * 界面开关 → MiMo 的思考参数。
 *
 * 官方只有开关、没有档位（`thinking: { type: "enabled" | "disabled" }`），
 * 且三款 v2.6 默认开启，所以复用共用的 `reasoningEffort` 存储位：
 * - `"none"` → 显式关闭（disabled）
 * - 其它值或未设置 → **不发该参数**，交给官方默认（enabled）
 */
export function mimoThinkingParam(effort?: string): { thinking: { type: "disabled" } } | Record<string, never> {
	return effort === "none" ? { thinking: { type: "disabled" } } : {}
}

/**
 * 关闭思考时**不回传**历史 `reasoning_content`：否则「开关 = disabled」与「请求体里带思考」
 * 自相矛盾（官方对该组合的行为未定义）。
 *
 * 判据必须是用户选择，而不是「这次有没有发 thinking 参数」：官方默认开启时我们不发送
 * `thinking`，但思考实际是开的，此时仍应回传历史思考。
 */
export function shouldAttachMimoReasoning(effort?: string): boolean {
	return effort !== "none"
}

/** MiMo 在 OpenAI 协议上扩展的字段（SDK 类型里没有，必须显式声明，不能整体断言绕过检查）。 */
export interface MimoThinkingFields {
	thinking?: { type: "enabled" | "disabled" }
}

export type MimoChatParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & MimoThinkingFields

export interface MimoRequestInput {
	model: string
	messages: OpenAI.Chat.ChatCompletionMessageParam[]
	maxCompletionTokens?: number
	/** 已算好的思考参数；`{}` 表示不发送（交给官方默认）。 */
	thinkingParam?: MimoThinkingFields
	toolParams?: Pick<OpenAI.Chat.ChatCompletionCreateParamsStreaming, "tools" | "tool_choice" | "parallel_tool_calls">
}

/**
 * 构造 MiMo 的请求体（纯函数，单测直接调用）。
 *
 * 守的是几个「猜错就静默失效」的点：
 * - 输出上限必须叫 `max_completion_tokens`（少个 s 会被端点忽略或 400）；
 * - 思考开关只能走 `thinking.type`，不能发 `reasoning_effort`；
 * - 思考开启时 `temperature`/`top_p` 无效，干脆不发；
 * - SDK 合法字段与扩展字段分开声明，合并处不再整体 `as`（否则键名拼错也能编译通过）。
 */
export function buildMimoParams(input: MimoRequestInput): MimoChatParams {
	const params: MimoChatParams = {
		model: input.model,
		messages: input.messages,
		stream: true,
		stream_options: { include_usage: true },
		...input.toolParams,
	}
	if (input.maxCompletionTokens && input.maxCompletionTokens > 0) {
		params.max_completion_tokens = input.maxCompletionTokens
	}
	if (input.thinkingParam?.thinking) {
		params.thinking = input.thinkingParam.thinking
	}
	return params
}

/**
 * 端点是否明确拒绝了我们发的 `thinking` 字段（用于私有网关的降级重试）。
 *
 * 不能复用 `isUnsupportedReasoningParameterError`：它的判据只认
 * `reasoning_effort` / `thinking_budget` / `enable_thinking`，不认单独的 `thinking`。
 */
export function isThinkingParamRejected(error: unknown): boolean {
	const candidate = error as { status?: unknown; message?: unknown } | undefined
	if (candidate?.status !== 400 && candidate?.status !== 422) {
		return false
	}
	// 只取 string 形式的 message：直接 String(error) 会得到 "[object Object]"，
	// 真错误反而认不出来。
	const message = typeof candidate?.message === "string" ? candidate.message : ""
	// 必须同时提到 `thinking` 与「不支持」语义，否则会把真正的 4xx 错误当成参数问题闷掉。
	return (
		/\bthinking\b/i.test(message) &&
		/unsupported|not\s+support|doesn'?t\s+support|unrecognized|unknown\s+(argument|parameter)/i.test(message)
	)
}

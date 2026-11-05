import type OpenAI from "openai"
import { resolveMoonshotModelId } from "./api"

/**
 * Kimi (Moonshot) 请求侧的纯判定（零依赖，扩展与 webview 共用）。
 *
 * 之所以单独成文件（与 mimo-request.ts / bigmodel-request.ts 同一理由）：
 * - 双入口基址在扩展侧（发请求）与设置页（在线同步模型 + 控制台链接切换）都要用，
 *   写死两处迟早漂移（知识库 18 §18.11：同一判据写两份必然漂移）；
 * - 思考参数映射与「固定参数不发送」是「猜错就静默失效 / 直接 400」的地方，必须能被单测锁住。
 *
 * 事实来源（官方文档，2026-11-04 逐页核对 platform.kimi.com）：
 * - get-api-key.md：国内入口 `https://api.moonshot.cn/v1`；国际站为 `api.moonshot.ai`，
 *   两站密钥不互通（上游 Cline 双入口下拉同此口径）
 * - kimi-k3-1-pro-quickstart：始终开启思考，顶层 `reasoning_effort` low|high|max（默认 max）；
 *   `max_completion_tokens` 默认 131072、最大 1048576；temperature=1.0 / top_p=0.95 /
 *   n=1 / presence_penalty=0 / frequency_penalty=0 为固定值，**不要显式传入**；
 *   多轮与工具调用必须原样回传完整 assistant message（含 reasoning_content）
 */

/** 国内站（platform.kimi.com 的密钥用这个）。 */
export const MOONSHOT_CHINA_BASE_URL = "https://api.moonshot.cn/v1"
/** 国际站（platform.moonshot.ai / platform.kimi.ai 的密钥用这个）。 */
export const MOONSHOT_INTERNATIONAL_BASE_URL = "https://api.moonshot.ai/v1"

/** 控制台：国内站（用户提供的域名族，官方 get-api-key.md 链接即此）。 */
export const MOONSHOT_CHINA_CONSOLE_URL = "https://platform.kimi.com/console/api-keys"
/** 控制台：国际站（与上游 Cline 的 international 分支一致）。 */
export const MOONSHOT_INTERNATIONAL_CONSOLE_URL = "https://platform.moonshot.ai/console/api-keys"
/** 文档站：K3.1 Pro 快速开始（含 base_url、reasoning_effort、流式与工具调用）。 */
export const MOONSHOT_DOCS_URL = "https://platform.kimi.com/docs/guide/kimi-k3-1-pro-quickstart"

/** 用户裁定（2026-11-04）：默认国内站。 */
export const MOONSHOT_DEFAULT_API_LINE: MoonshotApiLine = "china"

export type MoonshotApiLine = "china" | "international"

/** 入口 → 基址；undefined / 非法值回落默认（china）。设置页下拉与请求侧共用。 */
export function moonshotBaseUrlForLine(line: string | undefined): string {
	return line === "international" ? MOONSHOT_INTERNATIONAL_BASE_URL : MOONSHOT_CHINA_BASE_URL
}

/** 入口 → 控制台链接（随入口切换，密钥不互通的提示在设置页文案里）。 */
export function moonshotConsoleUrlForLine(line: string | undefined): string {
	return line === "international" ? MOONSHOT_INTERNATIONAL_CONSOLE_URL : MOONSHOT_CHINA_CONSOLE_URL
}

/**
 * 界面档位 → Kimi 的思考参数。
 *
 * 官方档位是 `low | high | max`（默认 max），而共用存储位是 OpenAI 风格的
 * `none | low | medium | high | xhigh`（见 ReasoningEffortSelector 的取值域）：
 * - `xhigh` → 官方 `max`（与 DeepSeek 的 xhigh→max 同一款先例）；
 * - `none` / `medium` / 未设置 / 非法值 → **不发该参数**——K3.1 Pro 始终开启思考且官方默认
 *   就是 max，显式发非法值反而可能 400；「关闭」对在售三款不存在（官方 FAQ：关不了）。
 *
 * @param modelId 传了才按内置清单门控：在线同步回来的未知 id（含已下线的 moonshot-v1 系）
 *                一律不发该参数，避免老模型收到不认识的 reasoning_effort 直接 400。
 *                不传 = 调用方已自行确认模型（单测与历史调用保持原行为）。
 */
export function moonshotThinkingParam(effort?: string, modelId?: string): MoonshotThinkingFields {
	// 与「历史 reasoning_content 是否回传」共用同一份内置清单判据，两处不许各写一份。
	if (modelId !== undefined && !shouldAttachMoonshotReasoning(modelId)) {
		return {}
	}
	const normalized = (effort ?? "").trim().toLowerCase()
	if (normalized === "low" || normalized === "high") {
		return { reasoning_effort: normalized }
	}
	if (normalized === "xhigh") {
		return { reasoning_effort: "max" }
	}
	return {}
}

/** Kimi 在 OpenAI 协议上扩展的字段（SDK 类型里没有 max 档，值域放开为 string）。 */
export interface MoonshotThinkingFields {
	reasoning_effort?: string
}

/**
 * 请求体类型沿用 SDK 原型（reasoning_effort 保持 SDK 联合，create() 直接过类型检查）；
 * "max" 的放宽只发生在 buildMoonshotParams 的赋值处单点 cast（bigmodel 同款范式）。
 */
export type MoonshotChatParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming

export interface MoonshotRequestInput {
	model: string
	messages: OpenAI.Chat.ChatCompletionMessageParam[]
	maxCompletionTokens?: number
	/** 已算好的思考参数；`{}` 表示不发送（交给官方默认 max）。 */
	thinkingParam?: MoonshotThinkingFields
	toolParams?: Pick<OpenAI.Chat.ChatCompletionCreateParamsStreaming, "tools" | "tool_choice" | "parallel_tool_calls">
}

/**
 * 构造 Kimi 的请求体（纯函数，单测直接调用）。
 *
 * 守的是几个「猜错就静默失效 / 直接 400」的点：
 * - 输出上限用官方参数名 `max_completion_tokens`；
 * - `temperature` / `top_p` / `n` / `presence_penalty` / `frequency_penalty` 是官方固定值，
 *   **绝不发送**（官方明确「建议不要显式传入」，插件全局 temperature 设置对 Kimi 不生效）；
 * - 思考参数只走顶层 `reasoning_effort`（low/high/max），不存在 thinking.type 开关；
 * - SDK 合法字段与扩展字段分开声明，合并处不做整体断言。
 */
export function buildMoonshotParams(input: MoonshotRequestInput): MoonshotChatParams {
	const params: MoonshotChatParams = {
		model: input.model,
		messages: input.messages,
		stream: true,
		stream_options: { include_usage: true },
		...input.toolParams,
	}
	if (input.maxCompletionTokens && input.maxCompletionTokens > 0) {
		params.max_completion_tokens = input.maxCompletionTokens
	}
	if (input.thinkingParam?.reasoning_effort) {
		// "max" 不在 SDK 联合类型里（官方接受，与 DeepSeek 的 xhigh→max 同款先例）；
		// 放宽只发生在这一处赋值（bigmodel 同款范式），其余字段仍受 SDK 检查。
		params.reasoning_effort = input.thinkingParam.reasoning_effort as MoonshotChatParams["reasoning_effort"]
	}
	return params
}

/**
 * 该模型是否按「思考模型」处理（决定历史 reasoning_content 是否回传）。
 *
 * 官方硬性要求：多轮与工具调用必须回传完整 assistant message（含 reasoning_content），
 * 与 MiMo 的 400 坑同族。判据是**内置清单**（在售三款全部始终思考），不是
 * `ModelInfo.supportsReasoning` 布尔位——未知 id（在线同步回来的新模型）保守不附加，
 * 避免非思考模型收到 reasoning_content 直接 400。
 */
export function shouldAttachMoonshotReasoning(modelId: string): boolean {
	return resolveMoonshotModelId(modelId) !== undefined
}

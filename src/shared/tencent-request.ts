import type OpenAI from "openai"
import { resolveTencentTokenhubModelId } from "./tencent-models"

/**
 * 腾讯云（TokenHub 按量 + Coding Plan 套餐）请求侧的纯判定（零依赖，扩展与 webview 共用）。
 *
 * 单独成文件的理由与 moonshot-request.ts 相同：双入口基址 / 思考参数映射 / 峰谷计价是
 * 「猜错就静默失效 / 直接 400 / 算错账」的地方，设置页显示、在线同步与请求侧共用同一份。
 *
 * 事实来源（官方文档，2026-11-24 逐页核对 cloud.tencent.com/document/product/1823）：
 * - 快速入门 /130058：基址 `https://tokenhub.tencentmaas.com/v1`（广州），
 *   鉴权 `Authorization: Bearer <API Key>`；控制台建钥页
 *   `https://console.cloud.tencent.com/tokenhub/apikey`；
 *   新用户在模型广场领取免费体验包（每款语言模型 100 万 tokens，活动至 2026-12-31）
 * - TokenHub 国际站 /1823：新加坡基址 `https://tokenhub-intl.tencentmaas.com/v1`，
 *   「不支持跨地域、跨站点调用」（两地密钥不通用）
 * - API 协议说明：输出上限参数 `max_completion_tokens`；混元系思考档 `reasoning_effort`
 *   low|medium|high、开关 `thinking: {type: enabled|disabled|adaptive}`；保留式思考
 *   `preserved_thinking`（工具定义不在 tools 数组内时须手动开启——本插件 XML 协议正是此形态）；
 *   `tool_choice: "required"` 在思考模式下部分模型直接 400（绝不发送）；
 *   多轮须原样回传 assistant 的 `reasoning_content`；usage 带
 *   `prompt_tokens_details.cached_tokens`
 * - Coding Plan 概述 /130092：OpenAI 兼容基址 `https://api.lkeap.cloud.tencent.com/coding/v3`；
 *   专属 Key `sk-sp-xxxx`（与按量 `sk-xxxx` 不互通、不可混用）；model 用 `tc-code-latest`
 *   （Auto，动态模型库，可通过 Model Name 切换）；按请求次数计费；暂不支持多模态
 */

/** 广州站（默认）。 */
export const TENCENT_CHINA_BASE_URL = "https://tokenhub.tencentmaas.com/v1"
/** 新加坡站（国际）。两地密钥不通用、不跨地域调用。 */
export const TENCENT_INTL_BASE_URL = "https://tokenhub-intl.tencentmaas.com/v1"
/** Coding Plan（订阅套餐）OpenAI 兼容基址；Key 为 sk-sp- 前缀，与按量 Key 不互通。 */
export const TENCENT_CODING_PLAN_BASE_URL = "https://api.lkeap.cloud.tencent.com/coding/v3"

/** TokenHub 控制台建钥页（按量 Key）。 */
export const TENCENT_TOKENHUB_CONSOLE_URL = "https://console.cloud.tencent.com/tokenhub/apikey"
/** Coding Plan 控制台页（套餐购买 + sk-sp- 专属 Key）。 */
export const TENCENT_CODING_PLAN_CONSOLE_URL = "https://console.cloud.tencent.com/tokenhub/codingplan"
/** TokenHub 文档入口（模型列表 / 价格 / API 协议说明的父页）。 */
export const TENCENT_DOCS_URL = "https://cloud.tencent.com/document/product/1823"

/** 用户裁定（2026-11-24）：默认广州站。 */
export const TENCENT_DEFAULT_API_LINE: TencentApiLine = "china"

export type TencentApiLine = "china" | "intl"

/** 入口 → 基址；undefined / 非法值回落默认（广州）。设置页下拉与请求侧共用。 */
export function tencentBaseUrlForLine(line: string | undefined): string {
	return line === "intl" ? TENCENT_INTL_BASE_URL : TENCENT_CHINA_BASE_URL
}

/** 入口 → 建钥页（两地密钥不通用；国际站密钥在对应站点控制台获取）。 */
export function tencentConsoleUrlForLine(_line: string | undefined): string {
	return TENCENT_TOKENHUB_CONSOLE_URL
}

/** 混元系（思考参数的适用面）：hy3 / hy4 / hy4-flash；翻译与角色款（hy- 前缀）不在内。 */
export function isHunyuanModelId(modelId: string): boolean {
	return /^hy\d/.test(modelId.trim().toLowerCase())
}

/** DeepSeek 峰谷双价模型（官方价格页：工作日峰时 ×2，其余单价）。 */
export function isPeakValleyModelId(modelId: string): boolean {
	return modelId.trim().toLowerCase().startsWith("deepseek")
}

/**
 * 界面档位 → 混元系的思考参数。
 *
 * 官方档位 `reasoning_effort` low|medium|high，另有 `thinking.type` 开关；共用存储位是
 * OpenAI 风格的 `none | low | medium | high | xhigh`（ReasoningEffortSelector 取值域）：
 * - `none` → `thinking: {type: "disabled"}`（官方给的最接近「关闭」的开关）；
 * - `low` / `medium` / `high` → 原样发 `reasoning_effort`；
 * - `xhigh` / 未知名 / 未设置 → **不发该参数**：官方混元默认档为 high
 *   （混元调用指南 /1823/132252「hy4-flash、hy4、hy4-preview、hy3 默认为 high」；
 *   hy3 正式版起在工具调用场景模型已具备自适应推理深度能力——不发即交给官方默认）；
 * - 混元系一律带 `preserved_thinking: true`：官方说明保留式思考只在请求带 tools 数组时
 *   默认开启，工具定义写在系统提示里（本插件 XML 协议）时必须手动开启
 *   （保留式思考 /1823/133534）。
 *
 * @param modelId 传了才按内置清单门控：未知 / 非混元 id 一律不发（第三方模型各有自己的
 *                思考约定，发明知参数可能直接 400；交给官方默认）。不传 = 调用方已自行确认。
 */
export function tencentThinkingParam(effort?: string, modelId?: string): TencentThinkingFields {
	if (modelId !== undefined && !isHunyuanModelId(modelId)) {
		return {}
	}
	const normalized = (effort ?? "").trim().toLowerCase()
	if (normalized === "none") {
		return { preserved_thinking: true, thinking: { type: "disabled" } }
	}
	if (normalized === "low" || normalized === "medium" || normalized === "high") {
		return { preserved_thinking: true, reasoning_effort: normalized }
	}
	return { preserved_thinking: true }
}

/** TokenHub 在 OpenAI 协议上扩展的字段（SDK 类型里没有）。 */
export interface TencentThinkingFields {
	reasoning_effort?: string
	thinking?: { type: "enabled" | "disabled" | "adaptive" }
	preserved_thinking?: boolean
}

/**
 * 请求体类型沿用 SDK 原型；扩展字段（reasoning_effort 放宽 / thinking / preserved_thinking）
 * 只在 buildTencentParams 的赋值处单点 cast（moonshot/bigmodel 同款范式）。
 */
export type TencentChatParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming

export interface TencentRequestInput {
	model: string
	messages: OpenAI.Chat.ChatCompletionMessageParam[]
	maxCompletionTokens?: number
	/** 已算好的思考参数；`{}` 表示不发送。 */
	thinkingParam?: TencentThinkingFields
	toolParams?: Pick<OpenAI.Chat.ChatCompletionCreateParamsStreaming, "tools" | "tool_choice" | "parallel_tool_calls">
}

/**
 * 构造腾讯云请求体（纯函数，单测直接调用）。
 *
 * 守的点：
 * - 输出上限用官方参数名 `max_completion_tokens`；
 * - 思考参数只作用于混元系（tencentThinkingParam 已门控），未知模型不发明知参数；
 * - ⛔ 绝不发 `tool_choice: "required"`：官方 API 协议说明明确思考模式下部分模型直接 400。
 *   getOpenAIToolParams 产出的是 "auto"，这里再兜一层，防止上游改动后静默回归。
 */
export function buildTencentParams(input: TencentRequestInput): TencentChatParams {
	const params: TencentChatParams = {
		model: input.model,
		messages: input.messages,
		stream: true,
		stream_options: { include_usage: true },
		...input.toolParams,
	}
	if (params.tool_choice === "required") {
		delete params.tool_choice
	}
	if (input.maxCompletionTokens && input.maxCompletionTokens > 0) {
		params.max_completion_tokens = input.maxCompletionTokens
	}
	if (input.thinkingParam?.reasoning_effort) {
		// low/medium/high 在 SDK 联合类型里，但官方扩展档保持单点 cast 范式
		params.reasoning_effort = input.thinkingParam.reasoning_effort as TencentChatParams["reasoning_effort"]
	}
	if (input.thinkingParam?.thinking) {
		;(params as unknown as Record<string, unknown>).thinking = input.thinkingParam.thinking
	}
	if (input.thinkingParam?.preserved_thinking) {
		;(params as unknown as Record<string, unknown>).preserved_thinking = true
	}
	return params
}

/**
 * 该模型是否按「思考模型」处理（决定历史 reasoning_content 是否回传）。
 *
 * 判据是内置清单（在售 16 款全部深度思考）：未知 id（在线同步回来的新模型 / Coding Plan
 * 动态模型库）保守不附加——非思考模型收到 reasoning_content 可能直接 400（MiMo 同款坑）。
 */
export function shouldAttachTencentReasoning(modelId: string): boolean {
	return resolveTencentTokenhubModelId(modelId) !== undefined
}

/**
 * 北京时间峰段判定（纯函数，DeepSeek 系峰谷计价用）。
 *
 * 官方价格页口径：峰时 = 工作日 9:00–12:00、14:00–18:00（北京时间），其余（含周末与节假日）
 * 按闲时价。官方未提供节假日表 → 按周一至周五处理（保守：节假日峰时多算钱不算少算）。
 * 边界取 [start, end)：12:00 与 18:00 整点归闲时。
 */
export function isBeijingPeakHour(date: Date): boolean {
	// 用 UTC 时间戳 + 8h 平移取「北京时间」的钟点，避免受开发机/用户机器时区影响
	const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
	const day = shifted.getUTCDay() // 0=周日 … 6=周六
	const weekday = day >= 1 && day <= 5
	if (!weekday) {
		return false
	}
	const hour = shifted.getUTCHours()
	return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** 峰时倍率：DeepSeek 系峰段 ×2，其余恒 ×1（单价模型不参与峰谷）。 */
export function tencentPeakMultiplier(modelId: string, date: Date): number {
	return isPeakValleyModelId(modelId) && isBeijingPeakHour(date) ? 2 : 1
}

/**
 * TokenHub 单次请求费用（人民币元）。
 *
 * 口径与 Moonshot/Bigmodel 相同：hit×命中价 + miss×未命中价 + out×输出价，元/百万 tokens。
 * DeepSeek 系在峰段整单 ×2（输入命中/未命中、输出三档全部翻倍——官方价格页峰谷列即为
 * 整行双价）。
 */
export function calculateTencentCost(
	modelId: string,
	modelInfo: { cacheReadsPrice?: number; cacheWritesPrice?: number; outputPrice?: number } | undefined,
	cacheHitTokens: number,
	cacheMissTokens: number,
	outputTokens: number,
	now: Date = new Date(),
): number {
	// usage 来自第三方兼容端点时可能出现负值/NaN，钳到非负再算（bigmodel 同款防御）
	const hit = Math.max(0, cacheHitTokens || 0)
	const miss = Math.max(0, cacheMissTokens || 0)
	const out = Math.max(0, outputTokens || 0)
	const hitPrice = modelInfo?.cacheReadsPrice ?? 0
	const missPrice = modelInfo?.cacheWritesPrice ?? 0
	const outPrice = modelInfo?.outputPrice ?? 0
	const multiplier = tencentPeakMultiplier(modelId, now)
	return (multiplier * (hit * hitPrice + miss * missPrice + out * outPrice)) / 1_000_000
}

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
 * BigModel 的窗口**含输出**（官方文档明说输入+回复+思考都算在窗口内）。#57 实测：
 * glm-4.5-flash 带 96K 满额 max_tokens 时实际输入预算只剩 128K−96K=32K，对话涨过即
 * 400 code=1261「Prompt exceeds max length」。这里把输出上限夹到
 * `min(目录值, 窗口 − 预估输入 − 余量)`；下限取 `min(4K, 目录值)`——
 * 再小就注定失败，交给错误层（#60 的人话）说清楚，不在这里静默扭曲。
 */
export const BIGMODEL_PROMPT_ESTIMATE_HEADROOM = 4096
const BIGMODEL_MIN_OUTPUT_TOKENS = 4096

export function clampBigmodelOutputTokens(input: {
	maxTokens?: number
	contextWindow?: number
	estimatedPromptTokens?: number
}): number | undefined {
	const { maxTokens, contextWindow, estimatedPromptTokens } = input
	if (!maxTokens || maxTokens <= 0) {
		return undefined // 保持「不发送」语义
	}
	if (!contextWindow || contextWindow <= 0 || estimatedPromptTokens === undefined) {
		return maxTokens // 拿不到窗口或预估：按目录值发（旧行为）
	}
	const budget = contextWindow - estimatedPromptTokens - BIGMODEL_PROMPT_ESTIMATE_HEADROOM
	return Math.max(Math.min(BIGMODEL_MIN_OUTPUT_TOKENS, maxTokens), Math.min(maxTokens, budget))
}

/**
 * 粗估输入 token：把消息序列化后按 ~2 字符/token 计。宁可高估——高估只是少给输出，
 * 低估会再次撞 1261。handler 的调用点会用「上一轮真实 usage」与它取 max 兜底。
 */
export function estimateBigmodelPromptTokens(messages: unknown[]): number {
	let chars = 0
	for (const message of messages) {
		try {
			chars += JSON.stringify(message ?? "").length
		} catch {
			// 循环引用等异常：跳过该条（粗估不要求完整）
		}
	}
	return Math.ceil(chars / 2)
}

export interface BigmodelErrorInfo {
	status?: number
	code?: string
	/** 已翻成人话的完整说明（含建议动作） */
	humanMessage: string
}

/**
 * BigModel 错误响应 → 人话（#60，仿 model-list-error 的「只读结构化字段、不做文案匹配」原则）。
 *
 * 兼容三种输入形状（宿主与 webview 共用）：
 * - openai SDK APIError：`{ status, message, error: { code, message } }`
 * - axios 形：`{ response: { status, data: { error: { code, message } } } }`
 * - ClineError._error：`{ status, code, message, details: { code, message } }`
 *
 * 1261（Prompt exceeds max length）是「窗口含输出」的直接后果（#57），必须指出路：
 * 压缩对话或换长窗口/低输出占用的模型；429/401 也一并翻成人话。
 */
export function extractBigmodelError(raw: unknown): BigmodelErrorInfo | undefined {
	if (!raw || typeof raw !== "object") {
		return undefined
	}
	const candidate = raw as {
		status?: number
		code?: string | number
		message?: string
		error?: { code?: string | number; message?: string }
		details?: { code?: string | number; message?: string }
		response?: { status?: number; data?: { error?: { code?: string | number; message?: string }; message?: string } }
	}
	const status =
		typeof candidate.status === "number"
			? candidate.status
			: typeof candidate.response?.status === "number"
				? candidate.response.status
				: undefined
	const rawCode = candidate.code ?? candidate.error?.code ?? candidate.details?.code ?? candidate.response?.data?.error?.code
	const code = rawCode !== undefined ? String(rawCode) : undefined
	const serverMessage =
		candidate.error?.message ??
		candidate.details?.message ??
		candidate.response?.data?.error?.message ??
		candidate.response?.data?.message ??
		candidate.message
	// 判据收紧：必须有 status 或 code 才认领——普通 Error 只有 message，不能接管
	//（否则宿主侧会把任何普通错误都当成 BigModel 响应来翻）
	if (status === undefined && !code) {
		return undefined
	}

	let humanMessage: string
	if (code === "1261") {
		humanMessage =
			"输入+输出合计超出模型窗口（BigModel 的窗口包含输出与思考占用）。建议压缩对话后重试，或换长窗口 / 输出占用更低的模型。"
	} else if (status === 401) {
		humanMessage = "API Key 无效或未授权（401）。请到设置 → API 配置里检查 BigModel 密钥。"
	} else if (status === 429) {
		humanMessage = serverMessage ? `请求过于频繁（429）：${serverMessage}` : "请求过于频繁（429），稍等片刻再试。"
	} else if (serverMessage && status !== undefined) {
		humanMessage = `HTTP ${status}：${serverMessage}`
	} else if (serverMessage) {
		humanMessage = serverMessage
	} else {
		humanMessage = `HTTP ${status}`
	}
	return { status, code, humanMessage }
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

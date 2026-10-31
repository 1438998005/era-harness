import type OpenAI from "openai"
import type { OpenaiReasoningEffort } from "./storage/types"

/**
 * 智谱 BigModel 请求侧纯函数（零依赖，扩展与 webview 共用）。
 *
 * 事实来源（官方文档，2026-10-28 逐页核对）：
 * - OpenAI 兼容入口 `https://open.bigmodel.cn/api/paas/v4/`，标准 `Authorization: Bearer`
 *   （/docs/zh-CN/guide/develop/openai/introduction）
 * - 思考（2026-10-30 官方文档核实）：
 *   · `glm-5.3` / `5.3-flash` / `5.3-flashx` **强制思考**，`thinking.type` 只接受 `enabled`
 *     （传 `disabled` 会**请求失败**），档位走 `reasoning_effort: low | high | max`，默认 `max`；
 *   · `glm-5.2` 可用 `thinking.type` 开关（enabled/disabled），`reasoning_effort` 支持
 *     `max`/`xhigh`、`high`/`medium`/`low`、`minimal`/`none`（none 等同关闭）；
 *   · 思考内容在 `delta.reasoning_content`。
 * - 输出上限字段名：官方参数表写 `max_tokens`（上游 Cline zai handler 实测发
 *   `max_completion_tokens` 亦被端点接受）——二选一，这里跟官方参数表走 `max_tokens`，
 *   两个字段绝不同发（若实测 `max_tokens` 被忽略，改这里一处即可）
 */
export const BIGMODEL_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

/**
 * GLM 套餐（Coding Plan）专属端点。
 *
 * 官方原文：「使用 GLM Coding Plan 时，需要配置专属的 Coding API 端点 … 而不是通用 API 端点」。
 * 套餐 Key 与按量 Key **互不通用**（个人套餐 / 团队套餐 / 标准 API 三种 Key 分开管理），
 * 所以不能靠端点自动分流，必须由用户在提供商下拉里显式选择。
 */
export const BIGMODEL_PLAN_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4"

/**
 * 套餐 Key 落地页（#91，2026-10-31 实测）：
 *
 * 官方文档当前仍写 `/apikey/coding-plan-per`，但实测点进去会落到**标准 API Key 页**，
 * 出来的 Key 不能用于套餐端点（鉴权失败）。改为直接指向套餐概览页：
 * - 个人编程套餐 → 「套餐概览」（个人套餐 Key 在这里新建）
 * - 团队编程套餐 → 「我的套餐」（团队套餐 Key 在这里新建）
 *
 * 个人 / 团队 / 按量三种 Key **互不通用**，所以必须分开两个入口，不能只给一个。
 * 若将来官方又改版而这两个 URL 失效，退回「套餐文档」按钮并在知识库 23 记录实测日期。
 */
export const BIGMODEL_PLAN_PERSONAL_URL = "https://bigmodel.cn/coding-plan/personal/overview"
export const BIGMODEL_PLAN_TEAM_URL = "https://bigmodel.cn/coding-plan/team/overview"
/** 套餐快速开始（含端点表与工具清单）。 */
export const BIGMODEL_PLAN_DOCS_URL = "https://docs.bigmodel.cn/cn/coding-plan/quick-start"

/**
 * @deprecated #91：实测会落到标准 API Key 页（不是套餐页），已拆成
 * `BIGMODEL_PLAN_PERSONAL_URL` / `BIGMODEL_PLAN_TEAM_URL`。保留导出仅为兼容外部引用，新代码不要再用。
 */
export const BIGMODEL_PLAN_CONSOLE_URL = BIGMODEL_PLAN_PERSONAL_URL

/** 控制台（API Key 管理）。 */
export const BIGMODEL_CONSOLE_URL = "https://bigmodel.cn/usercenter/proj-mgmt/apikeys"
/** 文档站（OpenAI 兼容接入页）。 */
export const BIGMODEL_DOCS_URL = "https://docs.bigmodel.cn/cn/guide/develop/openai/introduction"

export type BigmodelThinkingFields = {
	thinking?: { type: "enabled" | "disabled" }
	/**
	 * 官方档位：5.3 系 `low`/`high`/`max`，5.2 另支持 `medium`/`xhigh`/`minimal`/`none`。
	 * 这里放开成 string：OpenAI SDK 的联合类型里没有 `max`，但官方接受
	 * （同 DeepSeek 的 `xhigh → max` 先例）。落进请求体时在 `buildBigmodelParams` 单点放宽。
	 */
	reasoning_effort?: string
}

/**
 * 请求体 = SDK 类型 + 官方扩展字段。`reasoning_effort` 沿用 SDK 的联合类型，
 * 否则整个 params 无法传给 `client.chat.completions.create`；`"max"` 的放宽只发生在
 * `buildBigmodelParams` 的赋值处（一处 cast，其余字段仍受 SDK 检查）。
 */
export type BigmodelChatParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
	thinking?: { type: "enabled" | "disabled" }
}

export interface BigmodelRequestInput {
	model: string
	messages: OpenAI.Chat.ChatCompletionMessageParam[]
	maxTokens?: number
	/** 已算好的思考参数；`{}` 表示不发送（交给官方默认，默认态待验证）。 */
	thinkingParam?: BigmodelThinkingFields
	toolParams?: Pick<OpenAI.Chat.ChatCompletionCreateParamsStreaming, "tools" | "tool_choice" | "parallel_tool_calls">
}

/** 思考能力的三种形态：强制开启（5.3 系）/ 可开关（5.2）/ 不支持（其余 GLM 与未知 id）。 */
export type BigmodelThinkingKind = "forced" | "toggle" | "unsupported"

export interface BigmodelThinkingCapability {
	kind: BigmodelThinkingKind
	/** 界面可选档位（复用共用的 reasoningEffort 存储位） */
	efforts: readonly OpenaiReasoningEffort[]
	defaultEffort: OpenaiReasoningEffort
}

const GLM53_THINKING: BigmodelThinkingCapability = {
	kind: "forced",
	efforts: ["low", "high", "xhigh"],
	defaultEffort: "xhigh",
}
const GLM52_THINKING: BigmodelThinkingCapability = {
	kind: "toggle",
	efforts: ["low", "medium", "high", "xhigh", "none"],
	defaultEffort: "xhigh",
}
const NO_THINKING: BigmodelThinkingCapability = { kind: "unsupported", efforts: [], defaultEffort: "high" }

/**
 * 按 modelId 判定思考能力（大小写不敏感）。
 *
 * 为什么不用 `ModelInfo.supportsReasoning` 布尔位：5.3 系**不能关闭**、5.2 能关闭，
 * 「支不支持思考」这一维表达不了两者差异；且布尔位要过 proto 往返（未知模型会丢）。
 * 未知 id 一律 unsupported（不发参数），避免新模型收到 `thinking: disabled` 直接失败。
 */
export function bigmodelThinkingCapability(modelId: string): BigmodelThinkingCapability {
	const id = (modelId ?? "").trim().toLowerCase()
	if (id === "glm-5.3" || id.startsWith("glm-5.3-")) return GLM53_THINKING
	if (id === "glm-5.2") return GLM52_THINKING
	return NO_THINKING
}

/**
 * 界面档位 → GLM 请求参数。
 *
 * - `forced`（5.3 系）：`low`/`high` 原样发，`xhigh` 映射官方 `max`；`none`/未设置/非法值
 *   **一律不发**——5.3 传 `disabled` 会请求失败，不发即官方默认 `max`。
 * - `toggle`（5.2）：`none` → `thinking: disabled`；其余合法档位 → `reasoning_effort`。
 * - `unsupported`：什么都不发。
 */
export function bigmodelThinkingParam(effort: string | undefined, modelId?: string): BigmodelThinkingFields {
	const capability = bigmodelThinkingCapability(modelId ?? "")
	if (capability.kind === "unsupported") return {}
	if (capability.kind === "toggle" && effort === "none") {
		return { thinking: { type: "disabled" } }
	}
	const normalized = (effort ?? "").trim().toLowerCase()
	const matched = capability.efforts.find((option) => option === normalized)
	if (!matched || matched === "none") return {}
	return { reasoning_effort: matched === "xhigh" ? "max" : matched }
}

/**
 * 请求侧输出夹紧——**只在实测证明「窗口含输出」的模型上生效**（能力位
 * `contextWindowIncludesOutput`，口径见 D47 / `context-budget.ts`）。
 *
 * 唯一实证款是 `glm-4.5-flash`：128K 窗含输入+回复+思考，带 96K 满额 max_tokens 时实际输入
 * 预算只剩 128K−96K=32K，28.6k prompt 即 400 code=1261「Prompt exceeds max length」。
 * 对这类模型把输出夹到 `min(目录值, 窗口 − 预估输入 − 余量)`，下限 `min(4K, 目录值)`——
 * 再小就注定失败，交给错误层（#60 的人话）说清楚，不在这里静默扭曲。
 *
 * 缺省 false 的模型**不夹**（08 #82 裁定，2026-10-30）：官方标注的上下文按纯输入理解，
 * 输出额度另计，夹了等于凭空砍输出。代价是「未核实但实际共享窗口」的款会撞 1261——这是
 * 刻意的试错策略：先按标注跑，撞了再把能力位补上（1261 文案已提示反馈模型名）。
 */
export const BIGMODEL_PROMPT_ESTIMATE_HEADROOM = 4096
const BIGMODEL_MIN_OUTPUT_TOKENS = 4096

export function clampBigmodelOutputTokens(input: {
	maxTokens?: number
	contextWindow?: number
	estimatedPromptTokens?: number
	/** 与 `ModelInfo` 同名字段，可直接透传：只有 true（实测共享窗口）才夹 */
	contextWindowIncludesOutput?: boolean
}): number | undefined {
	const { maxTokens, contextWindow, estimatedPromptTokens } = input
	if (!maxTokens || maxTokens <= 0) {
		return undefined // 保持「不发送」语义
	}
	if (input.contextWindowIncludesOutput !== true) {
		return maxTokens // 输入输出独立：不夹，按目录值发
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
 * 压缩对话或换长窗口/低输出占用的模型；若输入远未到标注的上下文却报 1261，说明该模型其实
 * 共享窗口（能力位未标），提示用户把模型名反馈回来补标（#82 的试错闭环）。429/401 也一并翻成人话。
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
			"输入+输出合计超出模型窗口。请先压缩对话再试，或换长窗口 / 输出占用更低的模型；若输入远未达到标注的上下文，说明这个模型的窗口实际包含输出，请把模型名反馈给开发者补标口径。"
	} else if (code === "1210") {
		// 08 #84：4v-flash 实测原文 `inputs tokens + max_new_tokens must be <= 16384`。
		// 它不只是「超出」，而是「系统提示词本身就装不下」——压缩历史救不了，只能换模型。
		humanMessage =
			"输入与输出合计超出该模型窗口（1210）。这一款窗口只有 16K，装不下系统提示词与工具本身，压缩对话也救不了——请换窗口更大的模型。"
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
	if (input.thinkingParam?.reasoning_effort) {
		// 官方接受 "max"，SDK 联合类型只到 xhigh：只放宽这一个字段的赋值，不做整体断言
		params.reasoning_effort = input.thinkingParam
			.reasoning_effort as OpenAI.Chat.ChatCompletionCreateParamsStreaming["reasoning_effort"]
	}
	return params
}

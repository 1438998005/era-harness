import { ApiFormat } from "./proto/cline/models"
import type { ApiHandlerSettings } from "./storage/state-keys"

export type ApiProvider =
	| "free"
	| "anthropic"
	| "claude-code"
	| "openrouter"
	| "bedrock"
	| "vertex"
	| "openai"
	| "ollama"
	| "lmstudio"
	| "gemini"
	| "openai-native"
	| "openai-codex"
	| "requesty"
	| "together"
	| "deepseek"
	| "mimo"
	| "qwen"
	| "qwen-code"
	| "doubao"
	| "mistral"
	| "vscode-lm"
	| "cline"
	| "litellm"
	| "moonshot"
	| "nebius"
	| "fireworks"
	| "asksage"
	| "xai"
	| "sambanova"
	| "cerebras"
	| "sapaicore"
	| "groq"
	| "huggingface"
	| "huawei-cloud-maas"
	| "dify"
	| "baseten"
	| "vercel-ai-gateway"
	| "zai"
	| "oca"
	| "aihubmix"
	| "minimax"
	| "nousResearch"
	| "wandb"

export const DEFAULT_API_PROVIDER = "free" as ApiProvider

export interface ApiHandlerOptions extends Partial<ApiHandlerSettings> {
	ulid?: string // Used to identify the task in API requests
	onRetryAttempt?: (attempt: number, maxRetries: number, delay: number, error: any) => void // Callback function
}

export type ApiConfiguration = ApiHandlerOptions

// Models

interface PriceTier {
	tokenLimit: number // Upper limit (inclusive) of *input* tokens for this price. Use Infinity for the highest tier.
	price: number // Price per million tokens for this tier.
}

export interface ModelInfo {
	name?: string
	maxTokens?: number
	contextWindow?: number
	supportsImages?: boolean
	supportsPromptCache: boolean // this value is hardcoded for now
	supportsReasoning?: boolean // Whether the model supports reasoning/thinking mode
	inputPrice?: number // Keep for non-tiered input models
	outputPrice?: number // Keep for non-tiered output models
	thinkingConfig?: {
		maxBudget?: number // Max allowed thinking budget tokens
		outputPrice?: number // Output price per million tokens when budget > 0
		outputPriceTiers?: PriceTier[] // Optional: Tiered output price when budget > 0
		geminiThinkingLevel?: "low" | "high" // Optional: preset thinking level
		supportsThinkingLevel?: boolean // Whether the model supports thinking level (low/high)
	}
	supportsGlobalEndpoint?: boolean // Whether the model supports a global endpoint with Vertex AI
	cacheWritesPrice?: number
	cacheReadsPrice?: number
	description?: string
	tiers?: {
		contextWindow: number
		inputPrice?: number
		outputPrice?: number
		cacheWritesPrice?: number
		cacheReadsPrice?: number
	}[]
	temperature?: number
	apiFormat?: ApiFormat // The API format used by this model
}

export interface OpenAiCompatibleModelInfo extends ModelInfo {
	temperature?: number
	isR1FormatRequired?: boolean
	systemRole?: "developer" | "system"
	supportsReasoningEffort?: boolean
	supportsTools?: boolean
	supportsStreaming?: boolean
}

export interface OcaModelInfo extends OpenAiCompatibleModelInfo {
	modelName: string
	surveyId?: string
	banner?: string
	surveyContent?: string
	supportsReasoning?: boolean
	reasoningEffortOptions: string[]
}

export const CLAUDE_SONNET_1M_SUFFIX = ":1m"
export const ANTHROPIC_FAST_MODE_SUFFIX = ":fast"
export const CLAUDE_SONNET_1M_TIERS = [
	{
		contextWindow: 200000,
		inputPrice: 3.0,
		outputPrice: 15,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
	},
	{
		contextWindow: Number.MAX_SAFE_INTEGER, // storing infinity in vs storage is not possible, it converts to 'null', which causes crash in webview ModelInfoView
		inputPrice: 6,
		outputPrice: 22.5,
		cacheWritesPrice: 7.5,
		cacheReadsPrice: 0.6,
	},
]
export const CLAUDE_OPUS_1M_TIERS = [
	{
		contextWindow: 200000,
		inputPrice: 5.0,
		outputPrice: 25,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
	},
	{
		contextWindow: Number.MAX_SAFE_INTEGER,
		inputPrice: 10,
		outputPrice: 37.5,
		cacheWritesPrice: 12.5,
		cacheReadsPrice: 1.0,
	},
]

// Anthropic
// https://docs.anthropic.com/en/docs/about-claude/models // prices updated 2025-01-02
export type AnthropicModelId = keyof typeof anthropicModels
export const anthropicDefaultModelId: AnthropicModelId = "claude-sonnet-4-5-20250929"
export const ANTHROPIC_MIN_THINKING_BUDGET = 1_024
export const ANTHROPIC_MAX_THINKING_BUDGET = 6_000
export const anthropicModels = {
	"claude-sonnet-4-6": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
	},
	"claude-sonnet-4-6:1m": {
		maxTokens: 64_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
		tiers: CLAUDE_SONNET_1M_TIERS,
	},
	"claude-sonnet-4-5-20250929": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
	},
	"claude-sonnet-4-5-20250929:1m": {
		maxTokens: 64_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
		tiers: CLAUDE_SONNET_1M_TIERS,
	},
	"claude-haiku-4-5-20251001": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 1,
		outputPrice: 5.0,
		cacheWritesPrice: 1.25,
		cacheReadsPrice: 0.1,
	},
	"claude-sonnet-4-20250514": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
	},
	"claude-sonnet-4-20250514:1m": {
		maxTokens: 64_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
		tiers: CLAUDE_SONNET_1M_TIERS,
	},
	"claude-opus-4-6": {
		maxTokens: 128_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
	},
	"claude-opus-4-6:fast": {
		maxTokens: 128_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 30.0,
		outputPrice: 150.0,
		cacheWritesPrice: 37.5,
		cacheReadsPrice: 3.0,
		description:
			"Anthropic fast mode preview for Claude Opus 4.6. Same model and capabilities with higher output token speed at premium pricing. Requires fast mode access on your Anthropic account.",
	},
	"claude-opus-4-6:1m": {
		maxTokens: 128_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
		tiers: CLAUDE_OPUS_1M_TIERS,
	},
	"claude-opus-4-6:1m:fast": {
		maxTokens: 128_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 30.0,
		outputPrice: 150.0,
		cacheWritesPrice: 37.5,
		cacheReadsPrice: 3.0,
		description:
			"Anthropic fast mode preview for Claude Opus 4.6 with the 1M context beta enabled. Same model and capabilities with higher output token speed at premium pricing across the full 1M context window. Requires both fast mode and 1M context access on your Anthropic account.",
	},
	"claude-opus-4-8": {
		maxTokens: 128_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
	},
	"claude-opus-4-8:1m": {
		maxTokens: 128_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
		tiers: CLAUDE_OPUS_1M_TIERS,
	},
	"claude-opus-4-7": {
		maxTokens: 128_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
	},
	"claude-opus-4-7:1m": {
		maxTokens: 128_000,
		contextWindow: 1_000_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
		tiers: CLAUDE_OPUS_1M_TIERS,
	},
	"claude-opus-4-5-20251101": {
		maxTokens: 64_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 5.0,
		outputPrice: 25.0,
		cacheWritesPrice: 6.25,
		cacheReadsPrice: 0.5,
	},
	"claude-opus-4-1-20250805": {
		maxTokens: 32_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 15.0,
		outputPrice: 75.0,
		cacheWritesPrice: 18.75,
		cacheReadsPrice: 1.5,
	},
	"claude-opus-4-20250514": {
		maxTokens: 32_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 15.0,
		outputPrice: 75.0,
		cacheWritesPrice: 18.75,
		cacheReadsPrice: 1.5,
	},
	"claude-3-7-sonnet-20250219": {
		maxTokens: 128_000,
		contextWindow: 200_000,
		supportsImages: true,

		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
	},
	"claude-3-5-sonnet-20241022": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: true,

		supportsPromptCache: true,
		inputPrice: 3.0, // $3 per million input tokens
		outputPrice: 15.0, // $15 per million output tokens
		cacheWritesPrice: 3.75, // $3.75 per million tokens
		cacheReadsPrice: 0.3, // $0.30 per million tokens
	},
	"claude-3-5-haiku-20241022": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.8,
		outputPrice: 4.0,
		cacheWritesPrice: 1.0,
		cacheReadsPrice: 0.08,
	},
	"claude-3-opus-20240229": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 15.0,
		outputPrice: 75.0,
		cacheWritesPrice: 18.75,
		cacheReadsPrice: 1.5,
	},
	"claude-3-haiku-20240307": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.25,
		outputPrice: 1.25,
		cacheWritesPrice: 0.3,
		cacheReadsPrice: 0.03,
	},
} as const satisfies Record<string, ModelInfo> // as const assertion makes the object deeply readonly

// Claude Code
export const openRouterDefaultModelId = "anthropic/claude-sonnet-4.5" // will always exist in openRouterModels
export const openRouterClaudeSonnet41mModelId = `anthropic/claude-sonnet-4${CLAUDE_SONNET_1M_SUFFIX}`
export const openRouterClaudeSonnet451mModelId = `anthropic/claude-sonnet-4.5${CLAUDE_SONNET_1M_SUFFIX}`
export const openRouterClaudeSonnet461mModelId = `anthropic/claude-sonnet-4.6${CLAUDE_SONNET_1M_SUFFIX}`
export const openRouterClaudeOpus461mModelId = `anthropic/claude-opus-4.6${CLAUDE_SONNET_1M_SUFFIX}`
export const openRouterClaudeOpus471mModelId = `anthropic/claude-opus-4.7${CLAUDE_SONNET_1M_SUFFIX}`
export const openRouterClaudeOpus481mModelId = `anthropic/claude-opus-4.8${CLAUDE_SONNET_1M_SUFFIX}`
export const openRouterDefaultModelInfo: ModelInfo = {
	maxTokens: 64_000,
	contextWindow: 200_000,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 3.0,
	outputPrice: 15.0,
	cacheWritesPrice: 3.75,
	cacheReadsPrice: 0.3,
	description:
		"Claude Sonnet 4.5 delivers superior intelligence across coding, agentic search, and AI agent capabilities. It's a powerful choice for agentic coding, and can complete tasks across the entire software development lifecycle, from initial planning to bug fixes, maintenance to large refactors. It offers strong performance in both planning and solving for complex coding tasks, making it an ideal choice to power end-to-end software development processes.\n\nRead more in the [blog post here](https://www.anthropic.com/claude/sonnet)",
}

// Cline custom model - Devstral
export const clineDevstralModelInfo: ModelInfo = {
	contextWindow: 256000,
	supportsImages: false,
	supportsPromptCache: false,
	inputPrice: 0,
	outputPrice: 0,
	cacheReadsPrice: 0,
	cacheWritesPrice: 0,
	description: "A stealth model for agentic coding tasks",
}

export const OPENROUTER_PROVIDER_PREFERENCES: Record<string, { order: string[]; allow_fallbacks: boolean }> = {
	// Exacto Providers
	"moonshotai/kimi-k2:exacto": {
		order: ["groq", "moonshotai"],
		allow_fallbacks: false,
	},
	"z-ai/glm-4.6:exacto": {
		order: ["z-ai", "novita"],
		allow_fallbacks: false,
	},
	"deepseek/deepseek-v3.1-terminus:exacto": {
		order: ["novita", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-coder:exacto": {
		order: ["baseten"],
		allow_fallbacks: false,
	},
	"openai/gpt-oss-120b:exacto": {
		order: ["groq", "novita"],
		allow_fallbacks: false,
	},

	// Normal Providers
	"moonshotai/kimi-k2": {
		order: ["groq", "fireworks", "baseten", "parasail", "novita", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-coder": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-235b-a22b-thinking-2507": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-235b-a22b-07-25": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-30b-a3b-thinking-2507": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-30b-a3b-instruct-2507": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-30b-a3b:free": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-next-80b-a3b-thinking": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-next-80b-a3b-instruct": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"qwen/qwen3-max": {
		order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
		allow_fallbacks: false,
	},
	"deepseek/deepseek-v3.2-exp": {
		order: ["deepseek", "novita", "fireworks", "nebius"],
		allow_fallbacks: false,
	},
	"z-ai/glm-4.6": {
		order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
		allow_fallbacks: false,
	},
	"z-ai/glm-4.5v": {
		order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
		allow_fallbacks: false,
	},
	"z-ai/glm-4.5": {
		order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
		allow_fallbacks: false,
	},
	"z-ai/glm-4.5-air": {
		order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
		allow_fallbacks: false,
	},
}

// Vertex AI
// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude
// https://cloud.google.com/vertex-ai/generative-ai/pricing#partner-models
export const openAiModelInfoSaneDefaults: OpenAiCompatibleModelInfo = {
	maxTokens: -1,
	contextWindow: 128_000,
	supportsImages: true,
	supportsPromptCache: false,
	isR1FormatRequired: false,
	inputPrice: 0,
	outputPrice: 0,
	temperature: 0,
}

// Gemini
// https://ai.google.dev/gemini-api/docs/models/gemini
export const azureOpenAiDefaultApiVersion = "2024-08-01-preview"

// DeepSeek
// https://api-docs.deepseek.com/zh-cn/quick_start/pricing
//
// 官方现行模型名为 deepseek-flash；旧名 deepseek-v4-flash 仍可调用，但已指向同一模型。
// 思考模式由请求参数控制，不再由模型名区分。
//
// 价格为「北京时间空闲时段」单价（元 / 百万 tokens），高峰时段（工作日 9:00-12:00、
// 14:00-18:00）为 2 倍。DeepSeek 的输入全部按缓存命中 / 未命中计价，inputPrice 恒为 0。
export type DeepSeekModelId = keyof typeof deepSeekModels
export const deepSeekDefaultModelId: DeepSeekModelId = "deepseek-flash"

const deepSeekFlashInfo: ModelInfo = {
	name: "DeepSeek V4.1 Flash",
	maxTokens: 384_000,
	contextWindow: 1_000_000,
	supportsImages: true,
	supportsPromptCache: true,
	supportsReasoning: true,
	inputPrice: 0, // 输入全部按缓存命中 / 未命中计价
	outputPrice: 4,
	cacheWritesPrice: 1, // 输入（缓存未命中）
	cacheReadsPrice: 0.02, // 输入（缓存命中）
}

export const deepSeekModels = {
	"deepseek-flash": deepSeekFlashInfo,
	"deepseek-v4-flash": {
		...deepSeekFlashInfo,
		name: "DeepSeek V4.1 Flash（旧名）",
	},
	"deepseek-v4-pro": {
		name: "DeepSeek V4 Pro",
		maxTokens: 384_000,
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		outputPrice: 13.5,
		cacheWritesPrice: 4.5,
		cacheReadsPrice: 0.15,
	},
} as const satisfies Record<string, ModelInfo>

/**
 * 按小写匹配官方模型 id。
 * 在线同步（GET /models）回来的 id 大小写不保证（如 `DeepSeek-V4-Pro`），
 * 不做归一化会让**已知**模型被当成未知 → 元数据落到 flash 的价格与上下文窗口。
 */
const deepSeekModelIdsByLowerCase = new Map<string, DeepSeekModelId>(
	Object.keys(deepSeekModels).map((id) => [id.toLowerCase(), id as DeepSeekModelId]),
)

export function resolveDeepSeekModelId(modelId: string): DeepSeekModelId | undefined {
	return deepSeekModelIdsByLowerCase.get(modelId.trim().toLowerCase())
}

export function getDeepSeekModelInfo(modelId: string, modelInfo?: ModelInfo): ModelInfo {
	const known = resolveDeepSeekModelId(modelId)
	if (known) {
		// 已知模型一律以官方数据为准：历史配置里可能残留旧的上限（例如 8000），
		// 与官方 1M 上下文 / 384K 输出对不上，会让设置页显示自相矛盾的数字。
		return { ...deepSeekModels[known] }
	}
	// 在线同步回来的未知模型：保留用户填写的上限，其余用默认模型的保守值
	return { ...deepSeekModels[deepSeekDefaultModelId], ...modelInfo }
}

// Xiaomi MiMo
// 官方文档（2026-10 逐页核对，不引用第三方报道）：
// - 模型列表 https://mimo.mi.com/docs/zh-CN/quick-start/summary/model
// - 首次调用 https://mimo.mi.com/docs/zh-CN/quick-start/summary/first-api-call
// - 深度思考 https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/text-generation/deep-thinking
//
// OpenAI 兼容基址 https://api.xiaomimimo.com/v1（实测无 key 访问 /v1/models 返回 401）；
// 另有 Anthropic 兼容 /anthropic、Token Plan（token-plan-cn.xiaomimimo.com/v1，密钥 tp-/ttp-）
// 与批量推理（batch-api-cn.xiaomimimo.com/v1）三个**不同入口**，同一个密钥不能跳着用。
// 官方模型表：三款 v2.6 均为「上下文 1M / 最大输出 128K」，限流 RPM 100、TPM 10M
// （UltraSpeed 为定制配额），
// 能力含全模态理解、深度思考（默认开启，由 thinking.type 开关）、流式、函数调用、
// 结构化输出、联网搜索。mimo-v2.5-pro / mimo-v2.5 已于 2026-10-21 下线，不收录。
//
// 价格（2026-10-22 核对 https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go 与三张模型页，
// 两处逐项一致；单位 元 / 百万 tokens，取实时推理档）：
//   flash 命中 0.02 / 未命中 1 / 输出 2；pro 0.025 / 3 / 6；pro-ultraspeed 0.25 / 30 / 60。
// 字段映射沿用 DeepSeek 口径：cacheReadsPrice=输入(缓存命中)、cacheWritesPrice=输入(缓存未命中)、
// inputPrice 恒 0。⚠️ cacheWritesPrice 在这里**不是**缓存写入费——官方写入限时免费，且 usage
// 不单列写入 token，该字段只承载「未命中输入价」；按字面理解会算错账。
// 未纳入本表：批量推理为实时档半价（UltraSpeed 不支持）、联网搜索 ¥16/1000 次另计、
// Token Plan 按套餐扣费（与按量计费额度不互通）。插件当前只走实时 API。
export type MimoModelId = keyof typeof mimoModels
export const mimoDefaultModelId: MimoModelId = "mimo-v2.6-flash"

const mimoBaseInfo: ModelInfo = {
	name: "MiMo V2.6 Flash",
	// 官方：最大输出 128K（思考内容与最终回答共用这个额度，小了会截断回答）
	maxTokens: 128_000,
	// 官方：上下文窗口 1M
	contextWindow: 1_000_000,
	// 官方：全系支持全模态理解
	supportsImages: true,
	// 响应里带 usage.prompt_tokens_details.cached_tokens，且官方列了缓存命中单价
	supportsPromptCache: true,
	// 官方：深度思考，三款 v2.6 默认开启
	supportsReasoning: true,
	// 输入全部按「缓存命中 / 未命中」两档计价，inputPrice 恒为 0（与 DeepSeek 同口径）
	inputPrice: 0,
	cacheReadsPrice: 0.02, // 输入（缓存命中），元/百万 tokens
	cacheWritesPrice: 1, // 输入（缓存未命中）——不是缓存写入费，官方写入限时免费
	outputPrice: 2,
}

export const mimoModels = {
	"mimo-v2.6-flash": mimoBaseInfo,
	"mimo-v2.6-pro": {
		...mimoBaseInfo,
		name: "MiMo V2.6 Pro",
		cacheReadsPrice: 0.025,
		cacheWritesPrice: 3,
		outputPrice: 6,
	},
	"mimo-v2.6-pro-ultraspeed": {
		...mimoBaseInfo,
		name: "MiMo V2.6 Pro UltraSpeed",
		cacheReadsPrice: 0.25,
		cacheWritesPrice: 30,
		outputPrice: 60,
	},
} as const satisfies Record<string, ModelInfo>

/**
 * 按小写匹配官方模型 id。
 * 在线同步（GET /v1/models）回来的 id 大小写可能与清单不一致（如 MiMo-V2.6-Pro），
 * 不做归一化会让已知模型被当成未知→元数据落到保守默认、并在切 provider 时被误纠正。
 */
const mimoModelIdsByLowerCase = new Map<string, MimoModelId>(
	Object.keys(mimoModels).map((id) => [id.toLowerCase(), id as MimoModelId]),
)

export function resolveMimoModelId(modelId: string): MimoModelId | undefined {
	return mimoModelIdsByLowerCase.get(modelId.trim().toLowerCase())
}

/**
 * 语音类模型段：ASR（识别）/ TTS（合成）走 `/audio/*` 接口，**不能**用于 chat/completions。
 *
 * 依据（2026-10-23 官方定价页，把模型分成「语言模型 / ASR 系列 / TTS 系列」三类）：
 * - 语言模型：`mimo-v2.6-flash` / `-pro` / `-pro-ultraspeed`
 * - ASR：`mimo-v2.5-asr`（¥0.5/小时音频）
 * - TTS：`mimo-v2.5-tts` / `-tts-voiceclone` / `-tts-voicedesign`（限时免费）
 *
 * `/v1/models` 只回 id，**不返回任何类型字段**，所以 id 里的 asr/tts 段是唯一可用信号。
 * 匹配的是机器标识符里的一个**段**（前后必须是 `-` 或边界），不是人类可读文案。
 */
const NON_CHAT_MODEL_SEGMENT = /(^|-)(asr|tts)(-|$)/i

/** 该 id 是不是对话模型（false = 语音类，选进聊天必然失败）。 */
export function isChatCapableModelId(modelId: string): boolean {
	const trimmed = modelId.trim()
	if (!trimmed) {
		return false
	}
	return !NON_CHAT_MODEL_SEGMENT.test(trimmed)
}

export function getMimoModelInfo(modelId: string, modelInfo?: ModelInfo): ModelInfo {
	const known = resolveMimoModelId(modelId)
	if (known) {
		return { ...mimoModels[known] }
	}
	// 在线同步回来的未知模型：保留用户填写的元数据，缺失时用种子默认值
	return { ...mimoModels[mimoDefaultModelId], ...modelInfo }
}

/**
 * 该 id 是否明显属于某家**有内置清单**的 provider。
 * 用来处理「切到无清单的 OpenAI 兼容端点时，别家的模型 id 会被原样发出去」。
 */
export function modelIdBelongsToKnownCatalog(modelId: string | undefined): boolean {
	if (!modelId?.trim()) {
		return false
	}
	// 两家都用同一个归一函数，别再各自手写 toLowerCase 循环（写两遍就会有一遍忘记 trim）
	return resolveMimoModelId(modelId) !== undefined || resolveDeepSeekModelId(modelId) !== undefined
}

/**
 * 切换 provider 时的默认模型 id（只有带内置清单的 provider 才有）。
 * OpenAI 兼容没有清单：模型 id 由用户自己填，不参与纠正。
 */
export function apiProviderDefaultModelId(provider: string | undefined): string | undefined {
	switch (provider) {
		case "deepseek":
			return deepSeekDefaultModelId
		case "mimo":
			return mimoDefaultModelId
		default:
			return undefined
	}
}

/** 该 id 是否属于目标 provider 的内置清单（无清单的 provider 一律返回 true，不纠正）。 */
export function isBuiltinModelId(provider: string | undefined, modelId: string | undefined): boolean {
	if (!provider || !modelId) {
		return false
	}
	switch (provider) {
		case "deepseek":
			return resolveDeepSeekModelId(modelId) !== undefined
		case "mimo":
			return resolveMimoModelId(modelId) !== undefined
		default:
			return true
	}
}

/**
 * 从内置清单里挑模型 id：命中清单返回**规范 id**（大小写归一），
 * 未知但非空的 id **原样保留**（官方可能新增模型，静默改回默认等于替用户改配置），
 * 只有空值才落默认。
 *
 * 两个 provider 共用同一规则：写两遍必然有一遍把「未知 → 默认」和「未知 → 保留」
 * 弄反，设置页就会显示一个、扩展侧发另一个。
 */
export function resolveCatalogModelId(
	models: Record<string, ModelInfo>,
	modelId: string | undefined,
	defaultModelId: string,
): string {
	const requested = modelId?.trim()
	if (!requested) {
		return defaultModelId
	}
	const canonical = Object.keys(models).find((id) => id.toLowerCase() === requested.toLowerCase())
	return canonical ?? requested
}

/**
 * 切换 provider 时要不要把模型 id 重置成目标 provider 的默认档。
 *
 * 只纠正「明显属于**别家**清单」的 id：`deepseek-v5` 这种官方新增、在线同步回来的
 * 未知 id 必须保留，否则用户刚选的模型会被静默换掉（与 MiMo 分支的既有规则一致）。
 */
export function shouldResetModelForProvider(provider: string | undefined, modelId: string | undefined): boolean {
	if (!modelId?.trim()) {
		return true
	}
	if (isBuiltinModelId(provider, modelId)) {
		return false
	}
	return modelIdBelongsToKnownCatalog(modelId)
}

/**
 * 切换 provider 时要**写入**的模型 id；返回 `undefined` 表示「别动 modelId」。
 *
 * 为什么必须收成一个函数：这个判据原先只在设置页写了一份，底部「切换模型来源」
 * 菜单自己另写了一遍「只改 provider」——于是从 MiMo 切到 DeepSeek 时，
 * provider 变成了 deepseek，modelId 还留着 `mimo-v2.6-pro`。实测后果：
 * 界面显示小米模型、请求却打到 DeepSeek 官方（402 Insufficient Balance）；
 * 再切回 MiMo 又因为两边状态对不上，一路 401。两处必须调同一份判据。
 */
export function modelIdToWriteOnProviderSwitch(
	provider: string | undefined,
	currentModelId: string | undefined,
): string | undefined {
	const fallbackModelId = apiProviderDefaultModelId(provider)
	if (!fallbackModelId) {
		// free / openai 没有内置清单：模型 id 由用户自己填，不参与纠正
		return undefined
	}
	return shouldResetModelForProvider(provider, currentModelId) ? fallbackModelId : undefined
}

// Hugging Face Inference Providers
// https://huggingface.co/docs/inference-providers/en/index

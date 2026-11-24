import type { ModelInfo } from "./api"

/**
 * 腾讯云 TokenHub 内置模型清单（纯数据，零运行时依赖）。
 *
 * 单独成文件的理由（与 moonshot 不同）：api.ts 已在 20KB 旧文件放行名单里持续膨胀，
 * 本批（KB 08 #270）一次性加 16 个模型 + Coding Plan 档，继续塞会把「归属注册」与
 * 「模型数据」搅在一起；这里只放数据，api.ts 保留归属注册与 re-export。
 *
 * 事实来源（官方文档，2026-11-24 逐页核对 cloud.tencent.com/document/product/1823）：
 * - 模型列表 /130051：上下文窗口、最大输入、最大输出、深度思考、视觉能力逐行核对；
 * - 模型价格 /130054（2026-11-23 核对）：元/百万 tokens；DeepSeek 系按峰谷双价
 *   （工作日 9:00–12:00、14:00–18:00 北京时间 ×2），其余单价；
 * - hy4-flash / hy4 现价含限时折扣（分别至 2026-11-30 / 2026-12-31 到期，到期后以官方页为准，
 *   实测对账时复核，见知识库 28）。
 * - 不收录：hy4-preview（官方公告 2026-12-07 下线）、hy-mt2-*（翻译）、hy-role*（角色扮演）、
 *   旧代 / 重复端点（glm-5.2、kimi-k2.6 / k2.8-preview / k3.1-pro-highspeed、
 *   deepseek-v4-flash-0731、deepseek-v4.1-flash 无日期版、-0813/-202606 日期版）。
 *   上游 Cline 的 `hy3-preview` 官方列表已无此模型，同样不收录（cline#12014 的默认档已过时）。
 *
 * 计价口径沿用 DeepSeek/MiMo/Moonshot：输入按「缓存命中 / 未命中」两档 → inputPrice 恒 0、
 * cacheReadsPrice=命中、cacheWritesPrice 承载未命中输入价。峰谷倍率不写进静态表，
 * 由 @/shared/tencent-request 的 calculateTencentCost 按请求时刻精算。
 */

const hy4FlashBase: ModelInfo = {
	name: "混元 Hy4 Flash",
	// 官方最大输出 64k；上下文 1M、最大输入 960k → 输出走窗口内配额（contextWindowIncludesOutput）
	maxTokens: 65_536,
	contextWindow: 1_048_576,
	contextWindowIncludesOutput: true,
	// 官方模型列表：视觉「图片理解」
	supportsImages: true,
	// usage 带 prompt_tokens_details.cached_tokens（官方缓存单价单列）
	supportsPromptCache: true,
	// 官方模型列表：深度思考（保留式思考）
	supportsReasoning: true,
	inputPrice: 0,
	cacheReadsPrice: 0.02, // 输入（缓存命中），元/百万 tokens（现价含 5 折，至 2026-11-30）
	cacheWritesPrice: 0.5, // 输入（缓存未命中）
	outputPrice: 2,
}

/** TokenHub 按量（Metered）模型清单。 */
export const tencentTokenhubModels = {
	"hy4-flash": hy4FlashBase,
	hy4: {
		...hy4FlashBase,
		name: "混元 Hy4",
		cacheReadsPrice: 0.3, // 现价含 5 折，至 2026-12-31
		cacheWritesPrice: 6,
		outputPrice: 18,
	},
	hy3: {
		name: "混元 Hy3",
		maxTokens: 131_072,
		contextWindow: 262_144,
		// 官方：最大输入 192k + 最大输出 128k > 上下文 256k，按「输出占窗口」保守处理
		contextWindowIncludesOutput: true,
		supportsImages: false, // 官方模型列表：视觉 ❌
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.25,
		cacheWritesPrice: 1,
		outputPrice: 4,
	},
	"deepseek-v4.1-flash-1017": {
		name: "DeepSeek V4.1 Flash 1017",
		maxTokens: 393_216, // 官方最大输出 384k
		contextWindow: 1_048_576,
		supportsImages: true, // 官方模型列表：图片理解
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		// DeepSeek 系峰谷双价（闲时价；峰时 ×2 由 calculateTencentCost 精算）
		cacheReadsPrice: 0.02,
		cacheWritesPrice: 1,
		outputPrice: 4,
	},
	"deepseek/deepseek-flash": {
		name: "DeepSeek V4.1 Flash（原厂直供）",
		maxTokens: 393_216,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.02,
		cacheWritesPrice: 1,
		outputPrice: 4,
	},
	"deepseek-v4-pro": {
		name: "DeepSeek V4 Pro",
		maxTokens: 393_216,
		contextWindow: 1_048_576,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 1,
		cacheWritesPrice: 12,
		outputPrice: 24,
	},
	"glm-5.3": {
		name: "GLM-5.3",
		maxTokens: 131_072,
		contextWindow: 1_048_576,
		supportsImages: false,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 2,
		cacheWritesPrice: 8,
		outputPrice: 28,
	},
	"glm-5.3-flash": {
		name: "GLM-5.3 Flash",
		maxTokens: 131_072,
		contextWindow: 1_048_576,
		supportsImages: true, // 官方模型列表：多模态理解
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.23,
		cacheWritesPrice: 0.8,
		outputPrice: 2.8,
	},
	"glm-5.3-flashx": {
		name: "GLM-5.3 FlashX",
		maxTokens: 131_072,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.57,
		cacheWritesPrice: 2,
		outputPrice: 7,
	},
	"kimi-k3.1-pro": {
		name: "Kimi K3.1 Pro（TokenHub）",
		maxTokens: 1_048_576,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 1.3,
		cacheWritesPrice: 13,
		outputPrice: 68,
	},
	"kimi-k3": {
		name: "Kimi K3（TokenHub）",
		maxTokens: 1_048_576,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 2,
		cacheWritesPrice: 20,
		outputPrice: 100,
	},
	"kimi-k2.7-code": {
		name: "Kimi K2.7 Code（TokenHub）",
		maxTokens: 262_144,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 1.3,
		cacheWritesPrice: 6.5,
		outputPrice: 27,
	},
	"minimax-m3.1-flash": {
		name: "MiniMax M3.1 Flash",
		maxTokens: 524_288, // 官方最大输出 512k
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.1,
		cacheWritesPrice: 1,
		outputPrice: 4,
	},
	"mimo-v2.6-pro": {
		name: "MiMo V2.6 Pro（TokenHub）",
		maxTokens: 131_072,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.025,
		cacheWritesPrice: 3,
		outputPrice: 6,
	},
	"mimo-v2.6-flash": {
		name: "MiMo V2.6 Flash（TokenHub）",
		maxTokens: 131_072,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.02,
		cacheWritesPrice: 1,
		outputPrice: 2,
	},
	"step-5-preview": {
		name: "Step 5 Preview",
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0.35,
		cacheWritesPrice: 7,
		outputPrice: 20,
	},
} as const satisfies Record<string, ModelInfo>

export type TencentTokenhubModelId = keyof typeof tencentTokenhubModels

/** 官方快速入门示例与归属注册的默认档（用户裁定 2026-11-24：hy3）。 */
export const tencentTokenhubDefaultModelId: TencentTokenhubModelId = "hy3"

const tokenhubIdsByLowerCase = new Map<string, TencentTokenhubModelId>(
	Object.keys(tencentTokenhubModels).map((id) => [id.toLowerCase(), id as TencentTokenhubModelId]),
)

/** 小写归一查内置清单；在线同步回来的未知 id 返回 undefined。 */
export function resolveTencentTokenhubModelId(modelId: string): TencentTokenhubModelId | undefined {
	return tokenhubIdsByLowerCase.get(modelId.trim().toLowerCase())
}

export function getTencentTokenhubModelInfo(modelId: string, modelInfo?: ModelInfo): ModelInfo {
	const known = resolveTencentTokenhubModelId(modelId)
	if (known) {
		// 已知模型一律以官方数据为准（与 Moonshot/DeepSeek 同规则）
		return { ...tencentTokenhubModels[known] }
	}
	// 在线同步回来的未知模型（KB 08 #275）：保留用户填写的上限，其余沿用默认档的保守元数据，
	// 但默认档 hy3 的**混元专属字段必须剥掉**——「窗口含输出」能力位会让输入预算多扣一个
	// 输出位（第三方模型窗口多半是纯输入），混元价会按错价格估费。价格缺失时
	// calculateTencentCost 三档全 0（不估账），name 用传入 id 不再冒「混元 Hy3」。
	const fallback: ModelInfo = { ...tencentTokenhubModels[tencentTokenhubDefaultModelId], name: modelId }
	for (const key of [
		"contextWindowIncludesOutput",
		"inputPrice",
		"cacheReadsPrice",
		"cacheWritesPrice",
		"outputPrice",
	] as const) {
		delete fallback[key]
	}
	return { ...fallback, ...modelInfo }
}

// ---------------------------------------------------------------------------
// Coding Plan（订阅套餐）：按请求次数计费，不按 token 扣费 → 价格一律归零
// （与 bigmodelPlanModels 同一口径：照实记 token 供上下文进度条，金额恒 0）
// ---------------------------------------------------------------------------

/**
 * Coding Plan 唯一官方推荐 model 参数值：Auto（动态模型库，算法自动匹配，
 * 「通过配置 Model Name，切换模型」）。官方未公布窗口/输出上限 → 保守登记。
 * 套餐以请求次数计费（Lite 约 1,200 次/5h、9,000 次/周、18,000 次/月；Pro 约 6 倍），
 * 「暂不支持多模态能力」（官方概述原文）。
 */
export const tencentCodingPlanModels = {
	"tc-code-latest": {
		name: "Tencent Coding Plan Auto",
		maxTokens: 32_768, // 官方未公布，保守估值
		contextWindow: 131_072, // 官方未公布，保守估值
		supportsImages: false, // 官方概述：暂不支持多模态能力
		supportsPromptCache: true,
		supportsReasoning: true,
		inputPrice: 0,
		cacheReadsPrice: 0,
		cacheWritesPrice: 0,
		outputPrice: 0,
	},
} as const satisfies Record<string, ModelInfo>

export type TencentCodingPlanModelId = keyof typeof tencentCodingPlanModels

export const tencentCodingPlanDefaultModelId: TencentCodingPlanModelId = "tc-code-latest"

const codingPlanIdsByLowerCase = new Map<string, TencentCodingPlanModelId>(
	Object.keys(tencentCodingPlanModels).map((id) => [id.toLowerCase(), id as TencentCodingPlanModelId]),
)

export function resolveTencentCodingPlanModelId(modelId: string): TencentCodingPlanModelId | undefined {
	return codingPlanIdsByLowerCase.get(modelId.trim().toLowerCase())
}

export function getTencentCodingPlanModelInfo(modelId: string, modelInfo?: ModelInfo): ModelInfo {
	const known = resolveTencentCodingPlanModelId(modelId)
	if (known) {
		return { ...tencentCodingPlanModels[known] }
	}
	// 套餐允许手填模型名（动态模型库）：未知 id 保留原值 + 默认档保守元数据。
	// 套餐价格全 0 是「按请求计费」的语义（非混元价残留，不剥）；只把 name 换成传入 id，
	// 不再冒「Tencent Coding Plan Auto」档名（KB 08 #275）。
	return { ...tencentCodingPlanModels[tencentCodingPlanDefaultModelId], name: modelId, ...modelInfo }
}

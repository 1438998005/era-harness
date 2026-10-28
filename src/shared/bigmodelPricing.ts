import type { ModelInfo } from "./api"

/**
 * 智谱 BigModel 单次请求费用（人民币元）。
 *
 * 官方口径（https://docs.bigmodel.cn/cn/guide/start/pricing，2026-10-28 核对）：
 * - 输入分「缓存命中 / 未命中」两档，输出单列；缓存写入限时免费且 usage 不单列写入 token，
 *   故不参与计费（与 MiMo 同口径）。
 * - GLM-5.1 / GLM-5 / GLM-5-Turbo 按「输入长度 ≥32K」分两档：精算以**实际 promptTokens**
 *   为准（请求完成后 usage 已知）；静态 ModelInfo 只存 ≥32K 高档用于保守显示，
 *   低档表在这里。显示层用区间（DeepSeek 峰谷同款模式）。
 * - 免费款（glm-4.7-flash / glm-4.5-flash / glm-4-flash-250414 / 三个 V 系免费款）全 0。
 *
 * 本模块为纯函数、无 Node/网络依赖，扩展宿主与 webview 两侧均可安全 import。
 */

type PriceTier = { cacheHit: number; miss: number; output: number }

/** 阶梯分界：官方按「输入长度 ≥32K」升档（边界值 32K 本身归高档）。 */
const TIER_THRESHOLD_TOKENS = 32_000

const TIERED_PRICES: Record<string, { below: PriceTier; atOrAbove: PriceTier }> = {
	"glm-5.1": { below: { cacheHit: 1.3, miss: 6, output: 24 }, atOrAbove: { cacheHit: 2, miss: 8, output: 28 } },
	"glm-5": { below: { cacheHit: 1, miss: 4, output: 18 }, atOrAbove: { cacheHit: 1.5, miss: 6, output: 22 } },
	"glm-5-turbo": { below: { cacheHit: 1.2, miss: 5, output: 22 }, atOrAbove: { cacheHit: 1.8, miss: 7, output: 26 } },
}

/**
 * @param modelId    模型 id（阶梯表键，小写规范 id）
 * @param modelInfo  非阶梯款用 ModelInfo 的三档价（口径同 MiMo：cacheReadsPrice=命中、
 *                   cacheWritesPrice=未命中、outputPrice=输出）
 * @param promptTokens 实际输入 token 总数（usage.prompt_tokens，命中+未命中）
 */
export function calculateBigmodelCost(
	modelId: string,
	modelInfo: ModelInfo | undefined,
	promptTokens: number,
	cacheHitTokens: number,
	cacheMissTokens: number,
	outputTokens: number,
): number {
	// usage 来自第三方兼容端点时可能出现负值/NaN，钳到非负再算，避免把成本算成负数
	const hit = Math.max(0, cacheHitTokens || 0)
	const miss = Math.max(0, cacheMissTokens || 0)
	const out = Math.max(0, outputTokens || 0)
	const prompt = Math.max(0, promptTokens || 0)

	const tier = TIERED_PRICES[modelId]
	if (tier) {
		const prices = prompt >= TIER_THRESHOLD_TOKENS ? tier.atOrAbove : tier.below
		return (hit * prices.cacheHit + miss * prices.miss + out * prices.output) / 1_000_000
	}

	const hitPrice = modelInfo?.cacheReadsPrice ?? 0
	const missPrice = modelInfo?.cacheWritesPrice ?? 0
	const outPrice = modelInfo?.outputPrice ?? 0
	return (hit * hitPrice + miss * missPrice + out * outPrice) / 1_000_000
}

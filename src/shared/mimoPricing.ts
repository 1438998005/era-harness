import type { ModelInfo } from "./api"

/**
 * 小米 MiMo 单次请求费用（人民币元）。
 *
 * 官方口径（https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go，2026-10-22 核对）：
 * - 输入分「缓存命中 / 未命中」两档，输出单列；`prompt_tokens = 命中 + 未命中`。
 * - 缓存写入限时免费，且 usage 不单列写入 token，故不参与计费。
 * - 无峰谷分时，单价恒定——**不要照抄** `calculateDeepSeekCost` 的倍率逻辑。
 *
 * 字段语义沿用 DeepSeek 口径：`cacheReadsPrice`=输入(命中)、`cacheWritesPrice`=输入(未命中)、
 * `outputPrice`=输出，`inputPrice` 恒 0（见 `mimoModels` 注释）。
 *
 * 本模块为纯函数、无 Node/网络依赖，扩展宿主与 webview 两侧均可安全 import。
 */
export function calculateMimoCost(
	modelInfo: ModelInfo,
	cacheHitTokens: number,
	cacheMissTokens: number,
	outputTokens: number,
): number {
	const hitPrice = modelInfo.cacheReadsPrice ?? 0 // 输入（缓存命中）
	const missPrice = modelInfo.cacheWritesPrice ?? 0 // 输入（缓存未命中）
	const outPrice = modelInfo.outputPrice ?? 0 // 输出

	// usage 来自第三方兼容端点时可能出现负值/NaN，钳到非负再算，避免把成本算成负数
	const hit = Math.max(0, cacheHitTokens || 0)
	const miss = Math.max(0, cacheMissTokens || 0)
	const out = Math.max(0, outputTokens || 0)

	return (hit * hitPrice + miss * missPrice + out * outPrice) / 1_000_000
}

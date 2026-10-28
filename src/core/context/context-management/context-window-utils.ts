import { ApiHandler } from "@core/api"

/**
 * Gets context window information for the given API handler
 *
 * @param api The API handler to get context window information for
 * @returns contextWindow 原始窗口；maxAllowedSize 压缩/截断阈值；effectiveInputBudget 有效输入预算
 */
export function getContextWindowInfo(api: ApiHandler) {
	const contextWindow = api.getModel().info.contextWindow || 128_000
	let maxAllowedSize: number
	switch (contextWindow) {
		case 64_000: // deepseek models
			maxAllowedSize = contextWindow - 27_000
			break
		case 128_000: // most models
			maxAllowedSize = contextWindow - 30_000
			break
		case 200_000: // claude models
			maxAllowedSize = contextWindow - 40_000
			break
		default:
			maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8) // for deepseek, 80% of 64k meant only ~10k buffer which was too small and resulted in users getting context window errors.
	}

	// #58（2026-10-28）：窗口**含输出**的供应商（实测 BigModel glm-4.5-flash：满额 96K 输出
	// 把实际输入预算压到 32K，1261 前进度条/压缩阈值都按 128K 满窗算，双重高估）——
	// 阈值再减预留输出。预留取目录 maxTokens、至多窗口一半（防目录异常把阈值压成负/零）；
	// DeepSeek/Claude 等富余款与旧启发式取 min，行为不变。
	const maxTokens = api.getModel().info.maxTokens || 0
	const reservedOutput = Math.min(maxTokens, Math.floor(contextWindow / 2))
	const effectiveInputBudget = contextWindow - reservedOutput
	maxAllowedSize = Math.min(maxAllowedSize, effectiveInputBudget)

	return { contextWindow, maxAllowedSize, effectiveInputBudget }
}

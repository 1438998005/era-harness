import { ClineMessage } from "./ExtensionMessage"

interface ApiMetrics {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites?: number
	totalCacheReads?: number
	totalCost: number
}

/**
 * Calculates API metrics from an array of ClineMessages.
 *
 * This function processes usage-carrying say messages.
 * It includes:
 * - 'api_req_started' messages that have been combined with their corresponding 'api_req_finished' messages
 * - 'deleted_api_reqs' messages, which are aggregated from deleted messages
 * - 'subagent_usage' messages, which are aggregated usage snapshots emitted by subagent batches
 * It extracts and sums up the tokensIn, tokensOut, cacheWrites, cacheReads, and cost from these messages.
 *
 * @param messages - An array of ClineMessage objects to process.
 * @returns An ApiMetrics object containing totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, and totalCost.
 *
 * @example
 * const messages = [
 *   { type: "say", say: "api_req_started", text: '{"request":"GET /api/data","tokensIn":10,"tokensOut":20,"cost":0.005}', ts: 1000 }
 * ];
 * const { totalTokensIn, totalTokensOut, totalCost } = getApiMetrics(messages);
 * // Result: { totalTokensIn: 10, totalTokensOut: 20, totalCost: 0.005 }
 */
export function getApiMetrics(messages: ClineMessage[]): ApiMetrics {
	const result: ApiMetrics = {
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: undefined,
		totalCacheReads: undefined,
		totalCost: 0,
	}

	messages.forEach((message) => {
		if (
			message.type === "say" &&
			(message.say === "api_req_started" || message.say === "deleted_api_reqs" || message.say === "subagent_usage") &&
			message.text
		) {
			try {
				const parsedData = JSON.parse(message.text)
				const { tokensIn, tokensOut, cacheWrites, cacheReads, cost } = parsedData

				if (typeof tokensIn === "number") {
					result.totalTokensIn += tokensIn
				}
				if (typeof tokensOut === "number") {
					result.totalTokensOut += tokensOut
				}
				if (typeof cacheWrites === "number") {
					result.totalCacheWrites = (result.totalCacheWrites ?? 0) + cacheWrites
				}
				if (typeof cacheReads === "number") {
					result.totalCacheReads = (result.totalCacheReads ?? 0) + cacheReads
				}
				if (typeof cost === "number") {
					result.totalCost += cost
				}
			} catch {
				// Ignore JSON parse errors
			}
		}
	})

	return result
}

export interface LastApiReqUsage {
	/** 非缓存输入（Anthropic 口径；DeepSeek 恒为 0）*/
	tokensIn: number
	/** 缓存命中 */
	cacheReads: number
	/** 缓存未命中 / 写入 */
	cacheWrites: number
	/** 本次输入总量 = tokensIn + cacheReads + cacheWrites（= prompt_tokens）*/
	total: number
}

/**
 * 读取最近一条 api_req_started 的分段用量（与 getLastApiReqTotalTokens 同口径）。
 * 供上下文进度条旁的「命中」徽标使用，保证命中量与「已用」同属一次请求（否则
 * 命中取累计值会大于取单次值的已用）。无数据时 total=0。
 */
export function getLastApiReqUsage(messages: ClineMessage[]): LastApiReqUsage {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]
		if (msg.type === "say" && msg.say === "api_req_started" && msg.text) {
			try {
				const { tokensIn, cacheReads, cacheWrites } = JSON.parse(msg.text)
				const ti = tokensIn || 0
				const cr = cacheReads || 0
				const cw = cacheWrites || 0
				const total = ti + cr + cw
				if (total > 0) {
					return { tokensIn: ti, cacheReads: cr, cacheWrites: cw, total }
				}
			} catch {
				// Ignore JSON parse errors, continue searching
			}
		}
	}
	return { tokensIn: 0, cacheReads: 0, cacheWrites: 0, total: 0 }
}

/**
 * Gets the total token count from the last API request.
 *
 * This is used for context window progress display - it shows how much of the
 * context window is used in the current/most recent request, not cumulative totals.
 *
 * era harness 统一采用「加和」token 口径（与 ContextManager 的 totalTokens 一致）：
 * 提供方上报的 usage 被拆成互不重叠的三段——
 *   tokensIn = 非缓存输入，cacheReads = 缓存命中，cacheWrites = 缓存未命中/写入。
 * 三者相加 = 本次输入总量（= DeepSeek/OpenAI 的 prompt_tokens），故上下文占用
 * 取三者之和。tokensOut 是输出、不占本次输入窗口，排除。
 * 旧数据里 DeepSeek 的 tokensIn 恒为 0（全进 cache 段），只取 tokensIn 会显示 0，
 * 必须走加和口径。
 *
 * @param messages - An array of ClineMessage objects to process.
 * @returns The context-window used tokens (tokensIn + cacheReads + cacheWrites) from
 *          the last api_req_started message, or 0 if none found.
 */
export function getLastApiReqTotalTokens(messages: ClineMessage[]): number {
	return getLastApiReqUsage(messages).total
}

/**
 * KB 08 #247：连续同因流式失败的**纯逻辑单源**（host / webview 共用，零依赖）。
 *
 * 背景（任务 `1793967201589`）：pinned 单链上 28 次「重试」全是同一条错误
 * 「Beam 1.0 返回了空响应」，零工具调用、零有效输出，白烧 226,448 input tokens；
 * UI 从不告诉用户「已经连续失败 N 次、再试大概率一样」。
 *
 * 用户裁定：**N=3，只提示不退避**。所以这里只提供「算签名 / 累加 / 判定是否升级 /
 * 生成 error_retry 载荷字段」的纯函数，⛔ 不含退避、不含阻断、不含自动切换模型、
 * 不含清 `pinnedModelId` 的动作。改动候选链是 #242 明令禁止的，本模块一行都不碰。
 *
 * 「同因」的判定靠错误签名归一化：错误文本里常带 request id / 时间戳 / URL / token 数，
 * 原样做 key 会把连续 28 次同一错误误判成 28 种不同错误；反过来又必须让 429 与
 * 「空响应」分开计数，所以 HTTP 状态码这类短数字要保留。
 */

/** 用户裁定（2026-11-06）：连续同因失败达到该次数才在错误 UI 升级提示。 */
export const STREAM_ERROR_STREAK_THRESHOLD = 3

/**
 * 错误签名归一化。同一个渠道的同一类失败 → 同一个签名；429 与空响应 → 不同签名。
 *
 * 刻意保留 3 位数字（HTTP 4xx/5xx），只抹掉 4 位以上的长数字、长十六进制 id、
 * URL 与 pinned 恢复标记；大小写与空白折叠后截断，避免把整段错误正文带进审计。
 */
export function normalizeStreamErrorSignature(message: string | undefined): string {
	if (!message) {
		return "unknown"
	}
	const cleaned = message
		.replace(/\[ERA_FREE_PINNED_RECOVERY\]/g, "")
		.replace(/https?:\/\/\S+/gi, "<url>")
		// request id 常带短序号前缀（`req-1-abcdef0123456789` / `chatcmpl_7f...`）。
		// 只抹长 hex 会留下会变的 `req-1-`，把连续 28 次同一错误判成 28 种错误；
		// 整块抹掉才稳。HTTP 429/500 不带这些前缀，不受影响。
		.replace(/\b(?:req|request|chatcmpl|cmpl|msg|gen)[-_][a-z0-9_-]{2,}\b/gi, "<id>")
		.replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
		.replace(/\b\d{4,}\b/g, "<n>")
		.replace(/<[^>]{1,80}>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.slice(0, 160)
	return cleaned || "unknown"
}

/** 按 taskId 保存的连续失败状态；`signature` 变了就从 1 重新数。 */
export interface StreamErrorStreakState {
	signature: string
	streak: number
}

/**
 * 推进一次失败。纯函数：状态由调用方持有，便于回放 28 次与元测试。
 * 同签名 → +1；不同签名 → 重置为 1（429 与空响应不共用计数）。
 */
export function advanceStreamErrorStreak(
	previous: StreamErrorStreakState | undefined,
	signature: string,
): StreamErrorStreakState {
	return {
		signature,
		streak: previous && previous.signature === signature ? previous.streak + 1 : 1,
	}
}

/** 是否该在错误 UI 上升级提示。只提示，⛔ 不阻断手动重试。 */
export function isStreamErrorStreakEscalated(
	state: StreamErrorStreakState | undefined,
	threshold: number = STREAM_ERROR_STREAK_THRESHOLD,
): boolean {
	return !!state && state.streak >= threshold
}

/** `error_retry` 消息 JSON 里的升级字段（ChatRow 直接消费）。 */
export interface ErrorRetryStreakFields {
	streak?: number
	streakThreshold?: number
	streakEscalated?: boolean
}

/**
 * 生成 error_retry 载荷的升级字段。streak 无效 / 为 0 时返回空对象——
 * 老路径零改动，JSON.stringify 不会多出字段。
 */
export function buildErrorRetryStreakFields(
	streak: number | undefined,
	threshold: number = STREAM_ERROR_STREAK_THRESHOLD,
): ErrorRetryStreakFields {
	if (typeof streak !== "number" || !Number.isFinite(streak) || streak < 1) {
		return {}
	}
	return {
		streak,
		streakThreshold: threshold,
		...(streak >= threshold ? { streakEscalated: true } : {}),
	}
}

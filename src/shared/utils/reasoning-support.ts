import { normalizeOpenaiReasoningEffort, type OpenaiReasoningEffort } from "../storage/types"

export interface ClaudeOpusAdaptiveThinkingSettings {
	enabled: boolean
	effort?: OpenaiReasoningEffort
}

export function isClaudeOpusAdaptiveThinkingModel(modelId?: string): boolean {
	if (!modelId) {
		return false
	}

	const id = modelId.toLowerCase()
	const adaptiveVersions = ["4-6", "4.6", "4-7", "4.7", "4-8", "4.8"]
	return adaptiveVersions.some((version) => id.includes(`claude-opus-${version}`) || id.includes(`claude-${version}-opus`))
}

export function resolveClaudeOpusAdaptiveThinking(
	reasoningEffort?: string,
	legacyThinkingBudgetTokens?: number,
): ClaudeOpusAdaptiveThinkingSettings {
	if (reasoningEffort) {
		const effort = normalizeOpenaiReasoningEffort(reasoningEffort)
		return effort === "none" ? { enabled: false } : { enabled: true, effort }
	}

	return legacyThinkingBudgetTokens && legacyThinkingBudgetTokens > 0 ? { enabled: true, effort: "high" } : { enabled: false }
}

export function supportsReasoningEffortForModel(modelId?: string): boolean {
	if (!modelId) {
		return false
	}

	const id = modelId.toLowerCase()
	return (
		id.includes("gemini") ||
		id.includes("gpt") ||
		id.startsWith("openai/o") ||
		id.includes("/o") ||
		id.startsWith("o") ||
		id.includes("grok")
	)
}

/**
 * 已知思维家族：o1 / o3 / o4 / gpt-5（且不是 chat 变体）。
 * UI 与请求侧共用同一判据，避免“界面显示不发送、实际发了 medium”。
 */
export function isKnownReasoningModelFamily(modelId?: string): boolean {
	if (!modelId) {
		return false
	}

	const id = modelId.toLowerCase()
	return ["o1", "o3", "o4", "gpt-5"].some((prefix) => id.includes(prefix)) && !id.includes("chat")
}

/**
 * 请求侧是否发送 `reasoning_effort` 的唯一判据。
 *
 * 背景：`/models` 没有「是否支持 reasoning_effort」的标准字段，UI 只能把所有
 * 档位列出来；所以请求侧必须自己决定发不发，并且选错时能自动降级。
 *
 * - 已知思维家族（o1/o3/o4/gpt-5 且不是 chat）：沿用旧行为——未设置时发 medium，
 *   `none` 不发；它们本来也不接受 temperature。
 * - 未知模型：只有用户显式选了非 `none` 的档位才发；**不动 temperature**
 *   （默认值是 0，擅自丢弃会把贪心采样静默变成网关默认，属于意外的行为漂移）。
 */
export function resolveOpenAiReasoningRequest(args: { storedEffort?: string; isKnownReasoningFamily: boolean }): {
	effort?: string
	dropTemperature: boolean
} {
	if (args.isKnownReasoningFamily) {
		const effort = normalizeOpenaiReasoningEffort(args.storedEffort)
		return { effort: effort === "none" ? undefined : effort, dropTemperature: true }
	}

	if (!args.storedEffort) {
		return { effort: undefined, dropTemperature: false }
	}

	const effort = normalizeOpenaiReasoningEffort(args.storedEffort)
	if (effort === "none") {
		return { effort: undefined, dropTemperature: false }
	}

	return { effort, dropTemperature: false }
}

function extractStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object") {
		return undefined
	}

	const record = error as Record<string, unknown>
	for (const key of ["status", "statusCode"]) {
		const value = record[key]
		if (typeof value === "number") {
			return value
		}
	}

	return undefined
}

function extractErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") {
		return typeof error === "string" ? error : ""
	}

	const record = error as Record<string, unknown>
	const parts: string[] = []

	if (typeof record.message === "string") {
		parts.push(record.message)
	}

	// OpenAI SDK：error.error.message；axios 型兼容网关：error.response.data.error.message
	const nestedError = record.error
	if (nestedError && typeof nestedError === "object") {
		const nestedMessage = (nestedError as Record<string, unknown>).message
		if (typeof nestedMessage === "string") {
			parts.push(nestedMessage)
		}
	}

	const response = record.response as Record<string, unknown> | undefined
	const data = response?.data as Record<string, unknown> | undefined
	const responseDataError = data?.error as Record<string, unknown> | undefined
	if (typeof responseDataError?.message === "string") {
		parts.push(responseDataError.message)
	}

	return parts.join(" ")
}

const MENTIONS_REASONING_PARAMETER = /reasoning[_\s-]?effort|thinking[_\s-]?budget|enable_thinking/i
/**
 * 只收“明确说不支持/未知参数”的形态：
 * - `not\s+support` 同时覆盖 "is not supported" 与网关常见的 "does not support"；
 * - 不收裸 `invalid`：`Invalid request: reasoning_effort must be one of ...` 其实是档位值写错，
 *   归为“不支持”会把整个端点错拉黑。
 */
const UNSUPPORTED_HINT = /unsupported|not\s+support|doesn'?t\s+support|no\s+support|unknown\s+(argument|parameter)|unrecognized/i

/**
 * 端点是否明确拒绝了思维参数（400/422 + 报文同时指向参数名与“不支持”语义）。
 * 必须两者同时成立：单独的 "Unsupported value: 'temperature'..." 不能算，
 * 否则会把真实的 temperature 错误误判成思维参数问题，并永久污染端点记忆。
 */
export function isUnsupportedReasoningParameterError(error: unknown): boolean {
	const status = extractStatus(error)
	if (status !== 400 && status !== 422) {
		return false
	}

	const message = extractErrorMessage(error)
	return MENTIONS_REASONING_PARAMETER.test(message) && UNSUPPORTED_HINT.test(message)
}

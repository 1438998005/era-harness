/**
 * OpenAI 兼容的思维强度请求判据（任务 B2/B3）。
 *
 * 背景：`/models` 不告诉客户端某个模型是否支持 `reasoning_effort`，所以：
 * - 未知模型默认不发送，用户显式选择才发；
 * - 端点明确拒绝（400/422 且消息指向该参数）时自动去掉重试一次。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { isUnsupportedReasoningParameterError, resolveOpenAiReasoningRequest } from "../../src/shared/utils/reasoning-support"

// ————————————————————————————————————————————————
// 请求判据
// ————————————————————————————————————————————————

test("已知思维家族：未设置档位时沿用 medium", () => {
	const result = resolveOpenAiReasoningRequest({
		storedEffort: undefined,
		isKnownReasoningFamily: true,
	})

	assert.deepEqual(result, { effort: "medium", dropTemperature: true })
})

test("已知思维家族：none 不发送参数", () => {
	const result = resolveOpenAiReasoningRequest({
		storedEffort: "none",
		isKnownReasoningFamily: true,
	})

	assert.equal(result.effort, undefined)
	assert.equal(result.dropTemperature, true, "思维家族本来就不接受 temperature")
})

test("未知模型：未设置档位时不发送参数，也不动 temperature", () => {
	const result = resolveOpenAiReasoningRequest({
		storedEffort: undefined,
		isKnownReasoningFamily: false,
	})

	assert.deepEqual(result, { effort: undefined, dropTemperature: false })
})

test("未知模型：none 等同不发送", () => {
	const result = resolveOpenAiReasoningRequest({
		storedEffort: "none",
		isKnownReasoningFamily: false,
	})

	assert.deepEqual(result, { effort: undefined, dropTemperature: false })
})

test("未知模型：显式选了 high 就发送，但绝不顺手丢 temperature", () => {
	// 默认 temperature 是 0（贪心）；静默丢弃会让采样行为变成网关默认值
	const result = resolveOpenAiReasoningRequest({
		storedEffort: "high",
		isKnownReasoningFamily: false,
	})

	assert.deepEqual(result, { effort: "high", dropTemperature: false })
})

test("非法档位字符串按 medium 处理", () => {
	const result = resolveOpenAiReasoningRequest({
		storedEffort: "turbo",
		isKnownReasoningFamily: false,
	})

	assert.equal(result.effort, "medium")
	assert.equal(result.dropTemperature, false)
})

// ————————————————————————————————————————————————
// 自动降级判据
// ————————————————————————————————————————————————

test("400 + 明确提到 reasoning_effort → 视为不支持", () => {
	assert.equal(
		isUnsupportedReasoningParameterError({
			status: 400,
			message: "Unsupported parameter: 'reasoning_effort' is not supported with this model.",
		}),
		true,
	)
})

test("422 + unknown argument → 视为不支持", () => {
	assert.equal(isUnsupportedReasoningParameterError({ status: 422, message: "Unknown argument: reasoningEffort" }), true)
})

test("嵌套的 error.message 也能识别", () => {
	assert.equal(
		isUnsupportedReasoningParameterError({
			status: 400,
			error: { message: "Unrecognized request argument supplied: reasoning_effort" },
		}),
		true,
	)
})

test("401/429/500 不降级（不是参数问题）", () => {
	for (const status of [401, 403, 429, 500]) {
		assert.equal(isUnsupportedReasoningParameterError({ status, message: "unsupported reasoning_effort" }), false)
	}
})

test("400 但与思维参数无关时不降级", () => {
	assert.equal(isUnsupportedReasoningParameterError({ status: 400, message: "Invalid value for 'messages': too long" }), false)
})

test("真实的 temperature 400 不会被误判为思维参数问题", () => {
	assert.equal(
		isUnsupportedReasoningParameterError({
			status: 400,
			message:
				"Unsupported value: 'temperature' does not support 0.7 with this model. Only the default (1) value is supported.",
		}),
		false,
	)
})

test("thinking_budget 被拒仍可识别", () => {
	assert.equal(isUnsupportedReasoningParameterError({ status: 422, message: "unknown parameter: thinking_budget" }), true)
})

test("网关常见的 does not support 句式能降级", () => {
	for (const message of [
		"This model does not support reasoning effort.",
		"The model gpt-5-mini doesn't support reasoning_effort.",
		"reasoning_effort is not supported by this model.",
	]) {
		assert.equal(isUnsupportedReasoningParameterError({ status: 400, message }), true, message)
	}
})

test("档位值写错（Invalid request: reasoning_effort must be one of ...）不拉黑端点", () => {
	assert.equal(
		isUnsupportedReasoningParameterError({
			status: 400,
			message: "Invalid request: reasoning_effort must be one of 'low' | 'medium' | 'high'",
		}),
		false,
	)
})

test("axios 型网关的 response.data.error.message 也能识别", () => {
	assert.equal(
		isUnsupportedReasoningParameterError({
			status: 400,
			response: { data: { error: { message: "reasoning_effort is not supported here" } } },
		}),
		true,
	)
})

test("非对象错误不降级", () => {
	assert.equal(isUnsupportedReasoningParameterError(undefined), false)
	assert.equal(isUnsupportedReasoningParameterError(null), false)
	assert.equal(isUnsupportedReasoningParameterError("boom"), false)
})

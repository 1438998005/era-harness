/**
 * 上下文预算口径（#80）。
 *
 * 守的是三件会**静默出错**的事：
 * 1. 进度条分母、压缩阈值、设置页括注必须同源——公式只能有一份（`getContextBudget`）；
 * 2. `maxTokens: -1`（OpenAI 兼容默认）不能被当成真实输出，否则分母会变成 `window + 1`；
 * 3. **缺省不扣预留**：只有实测证明「窗口含输出」的模型才标 `contextWindowIncludesOutput`。
 *    把个例（glm-4.5-flash 的 1261）当通病，会凭空没收其它模型 128K～384K 可用上下文
 *    （2026-10-30 用户实测纠正：MiMo / DeepSeek / GLM-5.1 起 的上下文均为纯输入）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { anthropicModels, bigmodelModels, deepSeekModels, mimoModels } from "../../src/shared/api"
import { DEFAULT_CONTEXT_WINDOW, getContextBudget } from "../../src/shared/context-budget"

test("纯输入窗口不扣预留：MiMo 1M / DeepSeek 1M / GLM-5.1 起 1M", () => {
	assert.equal(getContextBudget(mimoModels["mimo-v2.6-flash"]).effectiveInputBudget, 1_000_000)
	assert.equal(getContextBudget(mimoModels["mimo-v2.6-pro"]).effectiveInputBudget, 1_000_000)
	assert.equal(getContextBudget(deepSeekModels["deepseek-flash"]).effectiveInputBudget, 1_000_000)
	assert.equal(getContextBudget(deepSeekModels["deepseek-v4-pro"]).effectiveInputBudget, 1_000_000)
	assert.equal(getContextBudget(bigmodelModels["glm-5.3-flash"]).effectiveInputBudget, 1_000_000)
	assert.equal(getContextBudget(bigmodelModels["glm-5.3"]).effectiveInputBudget, 1_000_000)
	assert.equal(getContextBudget(bigmodelModels["glm-5.1"]).effectiveInputBudget, 200_000)
})

test("唯一例外 glm-4.5-flash：窗口含输出，128K−96K=32K（D45 的 1261 实证）", () => {
	const budget = getContextBudget(bigmodelModels["glm-4.5-flash"])
	assert.equal(budget.includesOutput, true)
	assert.equal(budget.reservedOutput, 96_000)
	assert.equal(budget.effectiveInputBudget, 32_000)
})

test("能力位只标在例外上：其余模型不带该字段（缺省不扣）", () => {
	assert.notEqual(mimoModels["mimo-v2.6-flash"].contextWindowIncludesOutput, true)
	assert.notEqual(deepSeekModels["deepseek-flash"].contextWindowIncludesOutput, true)
	assert.notEqual(bigmodelModels["glm-5.3-flash"].contextWindowIncludesOutput, true)
	assert.notEqual(bigmodelModels["glm-5.1"].contextWindowIncludesOutput, true)
	assert.equal(bigmodelModels["glm-4.5-flash"].contextWindowIncludesOutput, true)
})

test("显式 contextWindowIncludesOutput:false 时不扣（Claude 一类输入输出分开的模型）", () => {
	const sonnet = anthropicModels["claude-sonnet-4-5-20250929"]
	const budget = getContextBudget({ ...sonnet, contextWindowIncludesOutput: false })
	assert.equal(budget.contextWindow, 200_000)
	assert.equal(budget.reservedOutput, 0)
	assert.equal(budget.effectiveInputBudget, 200_000)
})

test("非法输出上限不会污染分母：-1 / 0 / undefined / NaN", () => {
	for (const maxTokens of [-1, 0, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
		const budget = getContextBudget({ contextWindow: 128_000, maxTokens, contextWindowIncludesOutput: true })
		assert.equal(budget.reservedOutput, 0, `maxTokens=${String(maxTokens)} 不应产生预留`)
		assert.equal(budget.effectiveInputBudget, 128_000)
	}
})

test("窗口非法时兜底 128K，不产生 NaN 分母", () => {
	for (const contextWindow of [0, -1, undefined, Number.NaN]) {
		assert.equal(getContextBudget({ contextWindow }).contextWindow, DEFAULT_CONTEXT_WINDOW)
	}
})

test("预留至多「窗口 − 4K」：目录写错（输出 ≥ 窗口）也仍给输入留 4K", () => {
	const budget = getContextBudget({ contextWindow: 16_000, maxTokens: 64_000, contextWindowIncludesOutput: true })
	assert.equal(budget.reservedOutput, 11_904)
	assert.equal(budget.effectiveInputBudget, 4_096)

	// 小窗口正常值
	assert.equal(
		getContextBudget({ contextWindow: 16_000, maxTokens: 1_000, contextWindowIncludesOutput: true }).effectiveInputBudget,
		15_000,
	)
})

test("includesOutput 缺省为 false（输入输出独立，不做预留）", () => {
	const budget = getContextBudget({ contextWindow: 1_000_000, maxTokens: 128_000 })
	assert.equal(budget.includesOutput, false)
	assert.equal(budget.reservedOutput, 0)
	assert.equal(budget.effectiveInputBudget, 1_000_000)
})

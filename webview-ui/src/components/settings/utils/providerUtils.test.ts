// era harness：在线同步模型清单的合并规则单测。
// 运行：node webview-ui/node_modules/vitest/vitest.mjs run --root webview-ui
import { deepSeekModels, getDeepSeekModelInfo, ModelInfo, resolveDeepSeekModelId } from "@shared/api"
import { describe, expect, it } from "vitest"
import { mergeLiveModelIds } from "./providerUtils"

const BUILTIN = deepSeekModels as Record<string, ModelInfo>

/** 与 DeepSeekProvider / MimoProvider 里的 modelInfoFor 同构 */
function infoFor(id: string): ModelInfo {
	const known = resolveDeepSeekModelId(id)
	return (known && BUILTIN[known]) || getDeepSeekModelInfo(id)
}

describe("mergeLiveModelIds", () => {
	it("大小写不同的同一个模型只占一行（键用规范 id）", () => {
		const models = mergeLiveModelIds(["deepseek-v4-pro", "DeepSeek-V4-Pro", "deepseek-v5"], resolveDeepSeekModelId, infoFor)

		// 旧实现用原始 id 当键：`DeepSeek-V4-Pro` 与内置 `deepseek-v4-pro` 并存，
		// 而 ModelSelector 不去重 → 下拉框里同一个模型出现两行。
		expect(Object.keys(models)).toEqual(["deepseek-v4-pro", "deepseek-v5"])
	})

	it("规范 id 命中的行用的是内置元数据（不是保守默认值）", () => {
		const models = mergeLiveModelIds(["DeepSeek-V4-Pro"], resolveDeepSeekModelId, infoFor)
		expect(models["deepseek-v4-pro"]).toEqual(BUILTIN["deepseek-v4-pro"])
		expect(models["deepseek-v4-pro"].maxTokens).toBe(384_000)
	})

	it("选中的模型即使不在同步清单里也要补进列表", () => {
		const models = mergeLiveModelIds(["deepseek-v5"], resolveDeepSeekModelId, infoFor, "deepseek-v4-pro")
		expect(Object.keys(models)).toEqual(["deepseek-v5", "deepseek-v4-pro"])
	})

	it("选中项已存在时不重复插入", () => {
		const models = mergeLiveModelIds(["deepseek-v4-pro"], resolveDeepSeekModelId, infoFor, "deepseek-v4-pro")
		expect(Object.keys(models)).toEqual(["deepseek-v4-pro"])
	})

	it("未知 id 原样保留，不被静默改写成默认档", () => {
		const models = mergeLiveModelIds(["some-future-model"], resolveDeepSeekModelId, infoFor)
		expect(Object.keys(models)).toEqual(["some-future-model"])
	})

	it("空同步清单只留选中项", () => {
		expect(Object.keys(mergeLiveModelIds([], resolveDeepSeekModelId, infoFor))).toEqual([])
		expect(Object.keys(mergeLiveModelIds([], resolveDeepSeekModelId, infoFor, "deepseek-v4-pro"))).toEqual([
			"deepseek-v4-pro",
		])
	})
})

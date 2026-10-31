// era harness：在线同步模型清单的合并规则单测。
// 运行：node webview-ui/node_modules/vitest/vitest.mjs run --root webview-ui
import {
	bigmodelModels,
	deepSeekModels,
	getBigmodelModelInfo,
	getDeepSeekModelInfo,
	ModelInfo,
	resolveBigmodelModelId,
	resolveDeepSeekModelId,
} from "@shared/api"
import { describe, expect, it } from "vitest"
import { mergeLiveModelIds, modelOptionLabel } from "./providerUtils"

const BUILTIN = deepSeekModels as Record<string, ModelInfo>
const BIGMODEL_BUILTIN = bigmodelModels as Record<string, ModelInfo>

/** 与 DeepSeekProvider / MimoProvider 里的 modelInfoFor 同构 */
function infoFor(id: string): ModelInfo {
	const known = resolveDeepSeekModelId(id)
	return (known && BUILTIN[known]) || getDeepSeekModelInfo(id)
}

function bigmodelInfoFor(id: string): ModelInfo {
	const known = resolveBigmodelModelId(id)
	return (known && BIGMODEL_BUILTIN[known]) || getBigmodelModelInfo(id)
}

describe("mergeLiveModelIds", () => {
	it("大小写不同的同一个模型只占一行（键用规范 id）", () => {
		const models = mergeLiveModelIds(
			BUILTIN,
			["deepseek-v4-pro", "DeepSeek-V4-Pro", "deepseek-v5"],
			resolveDeepSeekModelId,
			infoFor,
		)

		// 旧实现用原始 id 当键：`DeepSeek-V4-Pro` 与内置 `deepseek-v4-pro` 并存，
		// 而 ModelSelector 不去重 → 下拉框里同一个模型出现两行。
		expect(Object.keys(models)).toEqual(["deepseek-flash", "deepseek-v4-flash", "deepseek-v4-pro", "deepseek-v5"])
	})

	it("规范 id 命中的行用的是内置元数据（不是保守默认值）", () => {
		const models = mergeLiveModelIds(BUILTIN, ["DeepSeek-V4-Pro"], resolveDeepSeekModelId, infoFor)
		expect(models["deepseek-v4-pro"]).toEqual(BUILTIN["deepseek-v4-pro"])
		expect(models["deepseek-v4-pro"].maxTokens).toBe(384_000)
	})

	it("选中的模型即使不在同步清单里也要补进列表", () => {
		const models = mergeLiveModelIds(BUILTIN, ["deepseek-v5"], resolveDeepSeekModelId, infoFor, "deepseek-v4-pro")
		expect(models["deepseek-v4-pro"]).toBeDefined()
		expect(Object.keys(models).indexOf("deepseek-v5")).toBeGreaterThan(-1)
	})

	it("选中项已存在时不重复插入", () => {
		const models = mergeLiveModelIds(BUILTIN, ["deepseek-v4-pro"], resolveDeepSeekModelId, infoFor, "deepseek-v4-pro")
		expect(Object.keys(models).filter((id) => id === "deepseek-v4-pro")).toHaveLength(1)
	})

	it("未知 id 原样保留，不被静默改写成默认档", () => {
		const models = mergeLiveModelIds(BUILTIN, ["some-future-model"], resolveDeepSeekModelId, infoFor)
		expect(Object.keys(models)).toContain("some-future-model")
	})

	it("空同步清单不影响内置清单（同步失败不该把清单清空）", () => {
		expect(Object.keys(mergeLiveModelIds(BUILTIN, [], resolveDeepSeekModelId, infoFor))).toEqual(Object.keys(BUILTIN))
	})

	// #62：2026-10-28 用户报「BigModel 在线同步后免费款消失」。
	// 根因是合并语义写成了「整体替换」——`GET /api/paas/v4/models` 根本不列免费六款，
	// 同步成功一次，免费款就从下拉框里整个消失，用户以为免费额度被取消了。
	it("#62 在线清单里没有的免费款必须留在下拉框（内置为底座，只加不换）", () => {
		const freeIds = Object.keys(BIGMODEL_BUILTIN).filter((id) => BIGMODEL_BUILTIN[id].outputPrice === 0)
		expect(freeIds.length).toBeGreaterThanOrEqual(6)

		// 接口只回付费款（免费款在端点里不存在），且大小写与内置清单不一致
		const liveIds = ["GLM-5.3", "glm-5.1", "GLM-4-Long"]
		const models = mergeLiveModelIds(BIGMODEL_BUILTIN, liveIds, resolveBigmodelModelId, bigmodelInfoFor)

		for (const id of freeIds) {
			expect(models[id], `免费款 ${id} 被同步抹掉了`).toBeDefined()
		}
		// 而且仍是内置元数据（价格全 0 → 下拉框会标「· 免费」）
		expect(models["glm-4.7-flash"].outputPrice).toBe(0)
	})

	it("#62 在线新增的模型仍然能出现（只加不换的另一半）", () => {
		const models = mergeLiveModelIds(BIGMODEL_BUILTIN, ["glm-6-preview"], resolveBigmodelModelId, bigmodelInfoFor)
		expect(models["glm-6-preview"]).toBeDefined()
	})

	it("#62 在线清单里的已知款不覆盖内置元数据（接口只给 id，价格以内置为准）", () => {
		const models = mergeLiveModelIds(BIGMODEL_BUILTIN, ["glm-5.3"], resolveBigmodelModelId, bigmodelInfoFor)
		expect(models["glm-5.3"]).toBe(BIGMODEL_BUILTIN["glm-5.3"])
	})

	it("#62 内置清单的顺序不被接口返回顺序打乱（下拉框按档位排，不按接口心情排）", () => {
		const models = mergeLiveModelIds(
			BIGMODEL_BUILTIN,
			["glm-4v-flash", "glm-5.3", "glm-4-long"],
			resolveBigmodelModelId,
			bigmodelInfoFor,
		)
		expect(Object.keys(models).slice(0, Object.keys(BIGMODEL_BUILTIN).length)).toEqual(Object.keys(BIGMODEL_BUILTIN))
	})
})

/**
 * #90：套餐页的下拉框曾把 14 款全部标成「· 免费」。
 *
 * 根因不是价格错（套餐的 price 就是 0，用量页靠这个 0 不累加金额），而是**计费上下文丢了**：
 * 「全 0 → 免费」是按量计费下的正确推导，搬到套餐页就变成「付费套餐免费」。
 * 修法是调用方显式传 `billingHint`，默认行为一个字节不改（否则按量页的免费六款就丢了标）。
 */
describe("modelOptionLabel（#90 计费上下文）", () => {
	const zeroPriced: Record<string, ModelInfo> = {
		"glm-5.3": {
			contextWindow: 1_000_000,
			maxTokens: 128_000,
			inputPrice: 0,
			outputPrice: 0,
			cacheReadsPrice: 0,
			cacheWritesPrice: 0,
		},
	}

	it("全 0 价 + plan → 「套餐内」（不再是「免费」）", () => {
		expect(modelOptionLabel(zeroPriced, "glm-5.3", "plan")).toBe("glm-5.3 · 套餐内")
	})

	it("全 0 价 + 默认（按量） → 仍是「免费」（回归 #55，按量页的免费六款不能丢标）", () => {
		expect(modelOptionLabel(zeroPriced, "glm-5.3")).toBe("glm-5.3 · 免费")
	})

	it("有价模型 + 默认 → 无尾缀", () => {
		const paid: Record<string, ModelInfo> = {
			"glm-5.3-flash": { contextWindow: 1_000_000, maxTokens: 128_000, inputPrice: 0.5, outputPrice: 2.8 },
		}
		expect(modelOptionLabel(paid, "glm-5.3-flash")).toBe("glm-5.3-flash")
	})

	it("清单外的 id 原样返回（两种上下文都不报错）", () => {
		expect(modelOptionLabel({}, "brand-new-model")).toBe("brand-new-model")
		expect(modelOptionLabel({}, "brand-new-model", "plan")).toBe("brand-new-model")
	})
})

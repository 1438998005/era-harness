/**
 * #64（2026-10-29 用户登记）：更新合并用哪个模型。
 *
 * 用户原话：「更新操作太重要，应该能指定模型并被提醒用智力水平最高的」。
 * 已裁定：**每次合并前选一次** + **可跨家选**（免费池不列）。
 *
 * 这里锁住的是「选得到、选得对、选完真的用它、用完还原」里可纯函数验证的部分。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	availableMergeModelOptions,
	defaultMergeModelOption,
	describeMergeModelPicker,
	describeMergeModelUsed,
	describeWeakMergeModel,
	mergeModelOptions,
	mergeModelOverride,
	mergeProviderSecretKey,
} from "../../src/core/update/mergeModel"

const OPTIONS = mergeModelOptions()

test("#64 候选覆盖三家全部清单，且每家恰好一款推荐", () => {
	const providers = new Set(OPTIONS.map((option) => option.provider))
	assert.deepEqual([...providers].sort(), ["bigmodel", "deepseek", "mimo"])

	for (const provider of providers) {
		const recommended = OPTIONS.filter((option) => option.provider === provider && option.recommended)
		assert.equal(recommended.length, 1, `${provider} 应有且只有一款推荐`)
		assert.match(recommended[0].description, /推荐/)
	}

	// 旗舰款就是推荐款（目录改档时这里会一起红）
	assert.equal(OPTIONS.find((o) => o.provider === "deepseek" && o.recommended)?.modelId, "deepseek-v4-pro")
	assert.equal(OPTIONS.find((o) => o.provider === "mimo" && o.recommended)?.modelId, "mimo-v2.6-pro")
	assert.equal(OPTIONS.find((o) => o.provider === "bigmodel" && o.recommended)?.modelId, "glm-5.3")
})

test("#64 免费池不列（用户选不了具体哪款，与「用最强」相悖）", () => {
	assert.equal(
		OPTIONS.some((option) => option.provider === "free"),
		false,
	)
})

test("#64 「弱」只按两个客观特征判：价格全 0、id 带 flash/air", () => {
	// 免费款 → 弱
	const free = OPTIONS.find((option) => option.modelId === "glm-4.7-flash")
	assert.ok(free)
	assert.equal(free.weak, true)

	// 小号命名 → 弱（哪怕收费）
	const flash = OPTIONS.find((option) => option.modelId === "glm-5.3-flash")
	assert.ok(flash)
	assert.equal(flash.weak, true)
	assert.notEqual(flash.description, "免费")

	// 旗舰款 → 不弱
	for (const option of OPTIONS.filter((o) => o.recommended)) {
		assert.equal(option.weak, false, `${option.modelId} 是推荐款，不该被判弱`)
	}
})

test("#64 默认项 = 当前在用的那款，而不是推荐款（⛔ 别偷偷换家花钱）", () => {
	const picked = defaultMergeModelOption(OPTIONS, { provider: "bigmodel", modelId: "glm-5" })
	assert.equal(picked?.provider, "bigmodel")
	assert.equal(picked?.modelId, "glm-5")
	assert.notEqual(picked?.recommended, true)
})

test("#64 当前模型不在候选里时退回同一家的第一款（别掉到别家去）", () => {
	const picked = defaultMergeModelOption(OPTIONS, { provider: "mimo", modelId: "mimo-live-only-xyz" })
	assert.equal(picked?.provider, "mimo")
})

test("#64 当前是免费池（无清单）时没有默认项——让用户自己选，不替他挑", () => {
	assert.equal(defaultMergeModelOption(OPTIONS, { provider: "free", modelId: "" }), undefined)
	assert.equal(defaultMergeModelOption(OPTIONS, {}), undefined)
})

test("#64 覆盖项同时写 plan/act 两套键（合并用哪个模式取决于用户当前模式）", () => {
	const option = OPTIONS.find((o) => o.provider === "bigmodel" && o.modelId === "glm-5.3")
	assert.ok(option)
	assert.deepEqual(mergeModelOverride(option), {
		actModeApiProvider: "bigmodel",
		actModeApiModelId: "glm-5.3",
		planModeApiProvider: "bigmodel",
		planModeApiModelId: "glm-5.3",
	})
})

test("#64 选模型的提示里必须带「合并质量决定代码保不保得住」的提醒", () => {
	const picker = describeMergeModelPicker()
	assert.match(picker.title, /合并/)
	assert.match(picker.placeHolder, /保不保得住/)
	assert.match(picker.placeHolder, /推荐/)
})

test("#64 选了弱模型要二次确认，并给出「换一款」的出口", () => {
	const weak = OPTIONS.find((option) => option.weak)
	assert.ok(weak)
	const warn = describeWeakMergeModel(weak)
	assert.match(warn.title, new RegExp(weak.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
	assert.match(warn.detail, /合错/)
	assert.match(warn.detail, /备份/)
	assert.ok(warn.change.length > 0 && warn.keep.length > 0)
	assert.notEqual(warn.keep, warn.change)
})

test("#64 结果里要能读到这次合并用的是哪款", () => {
	const option = OPTIONS.find((o) => o.modelId === "glm-5.3")
	assert.ok(option)
	assert.match(describeMergeModelUsed(option), /GLM-5\.3/)
})

test("#64 没填密钥的家不列（选了也调不通，只会 401 后白等一轮）", () => {
	const onlyBigmodel = availableMergeModelOptions(OPTIONS, (key) => key === "bigmodelApiKey")
	assert.ok(onlyBigmodel.length > 0)
	assert.deepEqual([...new Set(onlyBigmodel.map((option) => option.provider))], ["bigmodel"])

	// 全新用户：默认免费池、一个付费密钥都没有 → 空数组，调用方据此「沿用当前模型」，
	// ⛔ 绝不能当成用户放弃（那等于把免费用户的更新功能关掉）
	assert.deepEqual(
		availableMergeModelOptions(OPTIONS, () => false),
		[],
	)
})

test("#64 每家的密钥字段都对得上（写错名字等于永远查不到密钥）", () => {
	assert.equal(mergeProviderSecretKey("deepseek"), "deepSeekApiKey")
	assert.equal(mergeProviderSecretKey("mimo"), "mimoApiKey")
	assert.equal(mergeProviderSecretKey("bigmodel"), "bigmodelApiKey")
	// 免费池不在候选里，也不该有密钥字段
	assert.equal(mergeProviderSecretKey("free"), undefined)
})

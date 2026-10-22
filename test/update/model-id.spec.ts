/**
 * 模型 id 的归一与「切换 provider 要不要重置」（工作流 C 的收口）。
 *
 * 这里守两个会**静默出错**的点：
 * 1. 在线同步（GET /models）回来的 id 大小写不保证（`DeepSeek-V4-Pro`）。不做归一，
 *    已知模型会被当成未知 → 元数据落到 flash 的价格与上下文，设置页显示的和实际发的不是同一个；
 * 2. 切到有清单的 provider 时，「未知但合法」的 id（官方新增、用户同步来的）不能被静默换回默认档。
 *    只纠正「明显属于**别家**清单」的 id。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	deepSeekDefaultModelId,
	deepSeekModels,
	getDeepSeekModelInfo,
	isBuiltinModelId,
	mimoDefaultModelId,
	modelIdBelongsToKnownCatalog,
	resolveCatalogModelId,
	resolveDeepSeekModelId,
	resolveMimoModelId,
	shouldResetModelForProvider,
} from "../../src/shared/api"
import { normalizeApiConfiguration } from "../../webview-ui/src/components/settings/utils/providerUtils"

test("DeepSeek 模型 id 按小写归一：同步回来的大小写不能掉进未知分支", () => {
	assert.equal(resolveDeepSeekModelId("deepseek-v4-pro"), "deepseek-v4-pro")
	assert.equal(resolveDeepSeekModelId("DeepSeek-V4-Pro"), "deepseek-v4-pro")
	assert.equal(resolveDeepSeekModelId("  DEEPSEEK-FLASH  "), "deepseek-flash", "前后空白也要吃掉")
	assert.equal(resolveDeepSeekModelId("deepseek-v5"), undefined, "未知 id 不能瞎猜")

	// 价格是「归一有没有生效」最直接的证据：pro 13.5 / flash 4
	assert.equal(getDeepSeekModelInfo("deepseek-v4-pro").outputPrice, 13.5)
	assert.equal(getDeepSeekModelInfo("DeepSeek-V4-Pro").outputPrice, 13.5, "大小写不能影响元数据")
	assert.equal(getDeepSeekModelInfo("deepseek-flash").outputPrice, 4)

	// 未知模型仍走「保留用户填写 + 默认保守值」的老规则
	assert.equal(getDeepSeekModelInfo("deepseek-v5", { maxTokens: 8000 }).maxTokens, 8000)
})

test("两家清单的归属判定共用同一份归一函数", () => {
	assert.equal(modelIdBelongsToKnownCatalog("DeepSeek-V4-Pro"), true)
	assert.equal(modelIdBelongsToKnownCatalog("MiMo-V2.6-Pro"), true)
	assert.equal(modelIdBelongsToKnownCatalog("gpt-4o"), false)
	assert.equal(modelIdBelongsToKnownCatalog(""), false)
	assert.equal(modelIdBelongsToKnownCatalog(undefined), false)

	assert.equal(isBuiltinModelId("deepseek", "DeepSeek-V4-Pro"), true)
	assert.equal(isBuiltinModelId("deepseek", "mimo-v2.6-pro"), false)
	assert.equal(isBuiltinModelId("mimo", "MiMo-V2.6-Pro"), true)
	assert.equal(isBuiltinModelId("openai", "whatever"), true, "无清单的 provider 不参与纠正")
})

test("清单里挑 id：命中返回规范 id，未知非空保留，空才落默认", () => {
	assert.equal(resolveCatalogModelId(deepSeekModels, "DeepSeek-V4-Pro", deepSeekDefaultModelId), "deepseek-v4-pro")
	assert.equal(resolveCatalogModelId(deepSeekModels, "deepseek-v5", deepSeekDefaultModelId), "deepseek-v5")
	assert.equal(resolveCatalogModelId(deepSeekModels, "", deepSeekDefaultModelId), deepSeekDefaultModelId)
	assert.equal(resolveCatalogModelId(deepSeekModels, "   ", deepSeekDefaultModelId), deepSeekDefaultModelId)
	assert.equal(resolveCatalogModelId(deepSeekModels, undefined, deepSeekDefaultModelId), deepSeekDefaultModelId)
	assert.equal(resolveCatalogModelId(deepSeekModels, "DeepSeek-Flash", deepSeekDefaultModelId), "deepseek-flash")
})

test("切换 provider 只重置「明显属于别家清单」的 id", () => {
	// 本家命中 → 保留
	assert.equal(shouldResetModelForProvider("deepseek", "DeepSeek-V4-Pro"), false)
	assert.equal(shouldResetModelForProvider("mimo", "MiMo-V2.6-Pro"), false)
	// 未知但合法（官方新增 / 在线同步）→ 保留，不能静默换回默认档
	assert.equal(shouldResetModelForProvider("deepseek", "deepseek-v5"), false)
	assert.equal(shouldResetModelForProvider("mimo", "mimo-v2.7-pro"), false)
	// 明显属于别家 → 纠正
	assert.equal(shouldResetModelForProvider("deepseek", "mimo-v2.6-pro"), true)
	assert.equal(shouldResetModelForProvider("mimo", "deepseek-flash"), true)
	// 空 → 落默认
	assert.equal(shouldResetModelForProvider("deepseek", ""), true)
	assert.equal(shouldResetModelForProvider("deepseek", undefined), true)
	// 无清单的 provider 不参与纠正
	assert.equal(shouldResetModelForProvider("openai", "deepseek-flash"), false)
})

test("设置页归一 DeepSeek 配置：大小写归一且未知 id 不被改回默认", () => {
	const normalize = (modelId: string) =>
		normalizeApiConfiguration({ planModeApiProvider: "deepseek", planModeApiModelId: modelId } as never, "plan" as never)

	const pro = normalize("DeepSeek-V4-Pro")
	assert.equal(pro.selectedModelId, "deepseek-v4-pro", "大小写差异不能掉回默认 flash")
	assert.equal(pro.selectedModelInfo.outputPrice, 13.5, "元数据必须跟 id 对上")

	const unknown = normalize("deepseek-v5")
	assert.equal(unknown.selectedModelId, "deepseek-v5", "同步回来的新模型不能被改回默认")

	const empty = normalize("")
	assert.equal(empty.selectedModelId, deepSeekDefaultModelId)

	// MiMo 侧同样口径，防止两套规则再次漂移
	const mimo = normalizeApiConfiguration({ planModeApiProvider: "mimo", planModeApiModelId: "" } as never, "plan" as never)
	assert.equal(mimo.selectedModelId, mimoDefaultModelId)
	assert.equal(resolveMimoModelId(mimo.selectedModelId), mimoDefaultModelId)
})

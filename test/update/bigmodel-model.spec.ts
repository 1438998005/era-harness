/**
 * 智谱 BigModel 模型清单、阶梯精算与 provider 往返（计划任务 C）。
 *
 * 事实来源：智谱官方文档（2026-10-28 逐页核对，不引用第三方报道）：
 * - /cn/guide/start/pricing —— 平价四款 / 一维阶梯三款 / 长文款 / 免费款价格
 * - /cn/guide/start/model-overview —— 上下文 / 最大输出 / 输入模态
 * - /cn/guide/develop/openai/introduction —— 基址 /api/paas/v4 与 thinking.type
 *
 * 这里守的是四个**会静默出错**的点：
 * 1. 目录价格/上下文与官方漂移（抄错档位 = 算错账）；
 * 2. bigmodel 必须能在 proto 里往返（漏 case 会被存成 DeepSeek）；
 * 3. 切换 provider 时别家模型 id 必须被纠正（防 402/401 串家）；
 * 4. 阶梯精算按实际 promptTokens 选档（32K 边界归高档）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	apiProviderDefaultModelId,
	bigmodelDefaultModelId,
	bigmodelModels,
	modelIdToWriteOnProviderSwitch,
	resolveBigmodelModelId,
} from "../../src/shared/api"
import { BIGMODEL_BASE_URL, bigmodelThinkingParam, buildBigmodelParams } from "../../src/shared/bigmodel-request"
import { calculateBigmodelCost } from "../../src/shared/bigmodelPricing"
import { ApiProvider as ProtoApiProvider } from "../../src/shared/proto/cline/models"
import {
	convertApiConfigurationToProto,
	convertProtoToApiConfiguration,
} from "../../src/shared/proto-conversions/models/api-configuration-conversion"

test("内置清单符合官方定价：14 款 / 5.x 1M-128K / 免费款全 0", () => {
	// 平价款四款必须在清单里（不锁总数：官方新增模型不该判红）
	for (const id of ["glm-5.3-flash", "glm-5.3", "glm-5.3-flashx", "glm-5.2"] as const) {
		assert.ok(id in bigmodelModels, `${id} 必须在内置清单里`)
	}
	assert.ok(bigmodelDefaultModelId in bigmodelModels)

	const flash = bigmodelModels["glm-5.3-flash"]
	assert.equal(flash.contextWindow, 1_000_000)
	assert.equal(flash.maxTokens, 128_000)
	assert.equal(flash.cacheReadsPrice, 0.23)
	assert.equal(flash.cacheWritesPrice, 0.8)
	assert.equal(flash.outputPrice, 2.8)
	assert.equal(flash.supportsImages, true)
	assert.equal(bigmodelModels["glm-5.3"].outputPrice, 28)
	assert.equal(bigmodelModels["glm-5.2"].supportsReasoning, true, "官方 thinking 页实测示例")

	// 阶梯款 ModelInfo 只存 ≥32K 高档（低档在 bigmodelPricing 精算）
	assert.equal(bigmodelModels["glm-5.1"].cacheWritesPrice, 8)
	assert.equal(bigmodelModels["glm-5"].cacheWritesPrice, 6)
	assert.equal(bigmodelModels["glm-5-turbo"].cacheWritesPrice, 7)
	assert.equal(bigmodelModels["glm-4-long"].maxTokens, 4_000)

	// 免费款六款全 0 且名称带「免费」标识
	const freeIds = [
		"glm-4.7-flash",
		"glm-4.5-flash",
		"glm-4-flash-250414",
		"glm-4.6v-flash",
		"glm-4.1v-thinking-flash",
		"glm-4v-flash",
	] as const
	for (const id of freeIds) {
		const info = bigmodelModels[id]
		assert.ok(info, `${id} 必须在内置清单里`)
		assert.equal(info.inputPrice, 0, `${id} 免费款 inputPrice 应为 0`)
		assert.equal(info.cacheReadsPrice, 0, `${id} 免费款 cacheReadsPrice 应为 0`)
		assert.equal(info.cacheWritesPrice, 0, `${id} 免费款 cacheWritesPrice 应为 0`)
		assert.equal(info.outputPrice, 0, `${id} 免费款 outputPrice 应为 0`)
		assert.ok(info.name.includes("免费"), `${id} 显示名应带「免费」标识`)
	}
})

test("resolveBigmodelModelId：小写归一，未知 id 不强行归一", () => {
	assert.equal(resolveBigmodelModelId("GLM-5.3-Flash"), "glm-5.3-flash")
	assert.equal(resolveBigmodelModelId(" glm-5.3 "), "glm-5.3")
	assert.equal(resolveBigmodelModelId("glm-9.9"), undefined)
	assert.equal(BIGMODEL_BASE_URL, "https://open.bigmodel.cn/api/paas/v4")
})

test("阶梯精算：按实际 promptTokens 选档（32K 边界归高档），免费款恒 0", () => {
	const glm51 = bigmodelModels["glm-5.1"]
	// 低档（<32K）：官方 6 / 1.3 / 24
	assert.equal(calculateBigmodelCost("glm-5.1", glm51, 31_999, 0, 31_999, 1_000), (31_999 * 6 + 1_000 * 24) / 1_000_000)
	// 边界（=32K）归高档：官方 8 / 2 / 28
	assert.equal(calculateBigmodelCost("glm-5.1", glm51, 32_000, 0, 32_000, 1_000), (32_000 * 8 + 1_000 * 28) / 1_000_000)
	// 命中与未命中分别按档内单价计
	assert.equal(calculateBigmodelCost("glm-5.1", glm51, 40_000, 10_000, 30_000, 0), (10_000 * 2 + 30_000 * 8) / 1_000_000)
	// 免费款恒 0
	assert.equal(calculateBigmodelCost("glm-4.7-flash", bigmodelModels["glm-4.7-flash"], 50_000, 0, 50_000, 1_000), 0)
	// 非阶梯款走 ModelInfo 三档
	assert.equal(
		calculateBigmodelCost("glm-5.3-flash", bigmodelModels["glm-5.3-flash"], 10_000, 0, 10_000, 1_000),
		(10_000 * 0.8 + 1_000 * 2.8) / 1_000_000,
	)
})

test("请求体：thinking 只走开关、输出上限发 max_tokens（两字段绝不同发）", () => {
	const withThinking = buildBigmodelParams({
		model: "glm-5.2",
		messages: [{ role: "user", content: "hi" }] as never[],
		thinkingParam: { thinking: { type: "disabled" } },
		maxTokens: 128_000,
	})
	assert.deepEqual(withThinking.thinking, { type: "disabled" })
	assert.equal(withThinking.max_tokens, 128_000)
	assert.equal(withThinking.stream, true)

	const defaultParams = buildBigmodelParams({
		model: "glm-5.3-flash",
		messages: [{ role: "user", content: "hi" }] as never[],
		thinkingParam: {},
	})
	assert.equal("thinking" in defaultParams, false, "默认不发 thinking，交给官方")
	assert.equal("max_completion_tokens" in defaultParams, false, "不发 MiMo 式字段")
})

test("思考参数映射：none → disabled，其余不发", () => {
	assert.deepEqual(bigmodelThinkingParam("none"), { thinking: { type: "disabled" } })
	assert.deepEqual(bigmodelThinkingParam("high"), {})
	assert.deepEqual(bigmodelThinkingParam(undefined), {})
})

test("proto 往返：bigmodel ↔ BIGMODEL，key 与模型信息不会丢", () => {
	const proto = convertApiConfigurationToProto({
		planModeApiProvider: "bigmodel",
		actModeApiProvider: "bigmodel",
		bigmodelApiKey: "test-key",
		planModeApiModelId: "glm-5.3",
		actModeApiModelId: "glm-5.3-flash",
		planModeBigmodelModelInfo: {
			contextWindow: 1_000_000,
			maxTokens: 128_000,
			supportsImages: false,
			supportsPromptCache: true,
		},
	})
	assert.equal(proto.planModeApiProvider, ProtoApiProvider.BIGMODEL)
	assert.equal(proto.actModeApiProvider, ProtoApiProvider.BIGMODEL)
	assert.equal(proto.bigmodelApiKey, "test-key")

	const back = convertProtoToApiConfiguration(proto)
	assert.equal(back.planModeApiProvider, "bigmodel")
	assert.equal(back.actModeApiProvider, "bigmodel")
	assert.equal(back.bigmodelApiKey, "test-key")
	assert.equal(back.planModeBigmodelModelInfo?.contextWindow, 1_000_000)
})

test("默认档与防串家：bigmodel ↔ deepseek/mimo 切换时模型 id 必须被纠正", () => {
	assert.equal(apiProviderDefaultModelId("bigmodel"), bigmodelDefaultModelId)
	assert.equal(bigmodelDefaultModelId, "glm-5.3-flash")

	// 从 DeepSeek/MiMo 切到 bigmodel：别家 id 纠正为 bigmodel 默认档
	assert.equal(modelIdToWriteOnProviderSwitch("bigmodel", "deepseek-flash"), bigmodelDefaultModelId)
	assert.equal(modelIdToWriteOnProviderSwitch("bigmodel", "mimo-v2.6-pro"), bigmodelDefaultModelId)
	// 从 bigmodel 切走：glm id 属于已知清单，纠正为目标家默认档
	assert.equal(modelIdToWriteOnProviderSwitch("deepseek", "glm-5.3-flash"), "deepseek-flash")
	assert.equal(modelIdToWriteOnProviderSwitch("mimo", "glm-5.3"), "mimo-v2.6-flash")
	// bigmodel 自己的 id 不被纠正
	assert.equal(modelIdToWriteOnProviderSwitch("bigmodel", "glm-5.3"), undefined)
	// 未知 id 保留（官方可能新增模型，静默改回默认等于替用户改配置）
	assert.equal(modelIdToWriteOnProviderSwitch("bigmodel", "glm-9.9"), undefined)
})

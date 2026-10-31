/**
 * 智谱 GLM 套餐（Coding Plan）入口。
 *
 * 事实来源（官方文档 2026-10-31 复核）：
 * - /cn/coding-plan/quick-start —— 端点表：Anthropic `/api/anthropic`、
 *   OpenAI Chat Completions `/api/coding/paas/v4`、OpenAI Responses `/api/v1`
 * - /cn/guide/develop/cline —— Cline 接入指南：Base URL 用 coding 端点 + 模型编码
 * - /cn/coding-plan/notice/api-key-management —— 个人套餐 / 团队套餐 / 标准 API
 *   三种 Key **互不通用**
 *
 * 这里守的是五个会静默出错的点：
 * 1. 端点写错（打到按量端点 → 套餐 Key 鉴权失败，但报错信息不会说端点错）；
 * 2. 价格没清零（用量页显示一笔实际没花的钱）；
 * 3. proto 往返漏 case（配置被静默存成 DeepSeek）；
 * 4. 切 provider 时模型 id 不纠正（402/401 串家）；
 * 5. 套餐 Key 与按量 Key 混用（Key 不通用，必须各存一份）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { BigmodelHandler } from "../../src/core/api/providers/bigmodel"
import {
	apiProviderDefaultModelId,
	bigmodelModels,
	bigmodelPlanDefaultModelId,
	bigmodelPlanModels,
	getBigmodelPlanModelInfo,
	modelIdToWriteOnProviderSwitch,
	resolveBigmodelPlanModelId,
} from "../../src/shared/api"
import { BIGMODEL_BASE_URL, BIGMODEL_PLAN_BASE_URL } from "../../src/shared/bigmodel-request"
import { ApiProvider as ProtoApiProvider } from "../../src/shared/proto/cline/models"
import {
	convertApiConfigurationToProto,
	convertProtoToApiConfiguration,
} from "../../src/shared/proto-conversions/models/api-configuration-conversion"

test("端点：套餐走 /api/coding/paas/v4，按量走 /api/paas/v4（两个常量不得相同）", () => {
	assert.equal(BIGMODEL_PLAN_BASE_URL, "https://open.bigmodel.cn/api/coding/paas/v4")
	assert.equal(BIGMODEL_BASE_URL, "https://open.bigmodel.cn/api/paas/v4")
	assert.notEqual(BIGMODEL_PLAN_BASE_URL, BIGMODEL_BASE_URL)
})

test("套餐清单与按量同源，但价格一律归零（套餐不按 token 计费）", () => {
	assert.deepEqual(Object.keys(bigmodelPlanModels).sort(), Object.keys(bigmodelModels).sort())
	assert.equal(bigmodelPlanDefaultModelId, "glm-5.3")

	for (const [id, info] of Object.entries(bigmodelPlanModels)) {
		const metered = bigmodelModels[id as keyof typeof bigmodelModels]
		assert.equal(info.contextWindow, metered.contextWindow, `${id} 上下文窗口应与按量一致`)
		assert.equal(info.maxTokens, metered.maxTokens, `${id} 最大输出应与按量一致`)
		assert.equal(info.inputPrice, 0, `${id} 套餐 inputPrice 应为 0`)
		assert.equal(info.cacheReadsPrice, 0, `${id} 套餐 cacheReadsPrice 应为 0`)
		assert.equal(info.cacheWritesPrice, 0, `${id} 套餐 cacheWritesPrice 应为 0`)
		assert.equal(info.outputPrice, 0, `${id} 套餐 outputPrice 应为 0`)
	}
})

test("resolveBigmodelPlanModelId：与按量共用归一表，未知 id 不强行归一", () => {
	assert.equal(resolveBigmodelPlanModelId("GLM-5.3-Flash"), "glm-5.3-flash")
	assert.equal(resolveBigmodelPlanModelId(" glm-5.3 "), "glm-5.3")
	assert.equal(resolveBigmodelPlanModelId("glm-9.9"), undefined)

	// 未知 id 保留用户填的元数据，缺失时用默认档的保守值（且仍然是 0 价）
	const info = getBigmodelPlanModelInfo("glm-9.9")
	assert.equal(info.contextWindow, bigmodelPlanModels[bigmodelPlanDefaultModelId].contextWindow)
	assert.equal(info.outputPrice, 0)
})

test("handler：billingMode=plan 时用套餐清单（0 价）且基址切到 coding 端点", () => {
	const metered = new BigmodelHandler({ apiModelId: "glm-5.3", bigmodelApiKey: "k" })
	assert.equal(metered.getModel().info.outputPrice, 28)

	const plan = new BigmodelHandler({
		apiModelId: "glm-5.3",
		bigmodelApiKey: "k",
		baseUrlOverride: BIGMODEL_PLAN_BASE_URL,
		billingMode: "plan",
	})
	assert.equal(plan.getModel().id, "glm-5.3")
	assert.equal(plan.getModel().info.outputPrice, 0)

	// 没配 modelId 时落套餐默认档，而不是按量默认档（glm-5.3-flash）
	const planDefault = new BigmodelHandler({ bigmodelApiKey: "k", billingMode: "plan" })
	assert.equal(planDefault.getModel().id, bigmodelPlanDefaultModelId)
})

test("proto 往返：bigmodel-plan ↔ BIGMODEL_PLAN，套餐 Key 与模型信息不会丢", () => {
	const proto = convertApiConfigurationToProto({
		planModeApiProvider: "bigmodel-plan",
		actModeApiProvider: "bigmodel-plan",
		bigmodelPlanApiKey: "plan-key",
		planModeApiModelId: "glm-5.3",
		actModeApiModelId: "glm-5.3-flash",
		planModeBigmodelPlanModelInfo: {
			contextWindow: 1_000_000,
			maxTokens: 128_000,
			supportsImages: false,
			supportsPromptCache: true,
		},
	})
	assert.equal(proto.planModeApiProvider, ProtoApiProvider.BIGMODEL_PLAN)
	assert.equal(proto.actModeApiProvider, ProtoApiProvider.BIGMODEL_PLAN)
	assert.equal(proto.bigmodelPlanApiKey, "plan-key")
	assert.equal(proto.planModeBigmodelPlanModelInfo?.contextWindow, 1_000_000)

	const back = convertProtoToApiConfiguration(proto)
	assert.equal(back.planModeApiProvider, "bigmodel-plan")
	assert.equal(back.actModeApiProvider, "bigmodel-plan")
	assert.equal(back.bigmodelPlanApiKey, "plan-key")
	assert.equal(back.planModeBigmodelPlanModelInfo?.contextWindow, 1_000_000)
})

test("两把 Key 各存一份：套餐配置不会覆盖按量配置", () => {
	const proto = convertApiConfigurationToProto({
		actModeApiProvider: "bigmodel-plan",
		bigmodelApiKey: "metered-key",
		bigmodelPlanApiKey: "plan-key",
	})
	assert.equal(proto.bigmodelApiKey, "metered-key")
	assert.equal(proto.bigmodelPlanApiKey, "plan-key")

	const back = convertProtoToApiConfiguration(proto)
	assert.equal(back.bigmodelApiKey, "metered-key")
	assert.equal(back.bigmodelPlanApiKey, "plan-key")
})

test("默认档与防串家：bigmodel-plan 与按量共用 glm id，切走必须纠正", () => {
	assert.equal(apiProviderDefaultModelId("bigmodel-plan"), bigmodelPlanDefaultModelId)
	// 套餐自己的 glm id 不被纠正
	assert.equal(modelIdToWriteOnProviderSwitch("bigmodel-plan", "glm-5.3"), undefined)
	// 别家 id 切进套餐 → 纠正为套餐默认档
	assert.equal(modelIdToWriteOnProviderSwitch("bigmodel-plan", "deepseek-flash"), bigmodelPlanDefaultModelId)
	assert.equal(modelIdToWriteOnProviderSwitch("bigmodel-plan", "mimo-v2.6-pro"), bigmodelPlanDefaultModelId)
	// 从套餐切走 → glm id 属于已知清单，纠正为目标家默认档
	assert.equal(modelIdToWriteOnProviderSwitch("deepseek", "glm-5.3"), "deepseek-flash")
})

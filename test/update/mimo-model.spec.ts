/**
 * 小米 MiMo 模型清单与 provider 往返（工作流 C）。
 *
 * 这里守的是三个**曾经会静默出错**的点：
 * 1. 未知模型 id 不能被改回默认模型（否则用户选的模型静默失效）；
 * 2. `mimo` 必须能在 proto 里往返（漏 case 会被存成 DeepSeek）；
 * 3. 切换 provider 时旧 provider 的模型 id 必须被纠正，不能带到新端点。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	apiProviderDefaultModelId,
	getMimoModelInfo,
	isBuiltinModelId,
	mimoDefaultModelId,
	mimoModels,
} from "../../src/shared/api"
import { ApiProvider as ProtoApiProvider } from "../../src/shared/proto/cline/models"
import {
	convertApiConfigurationToProto,
	convertProtoToApiConfiguration,
	convertProtoToApiProvider,
} from "../../src/shared/proto-conversions/models/api-configuration-conversion"

test("内置清单：默认模型存在且都支持思维", () => {
	assert.ok(mimoDefaultModelId in mimoModels)
	for (const [id, info] of Object.entries(mimoModels)) {
		assert.equal(info.supportsReasoning, true, `${id} 应标记为支持思维`)
		// 价格未核实前必须是 0，避免用猜测数字算错账
		assert.equal(info.inputPrice, 0)
		assert.equal(info.outputPrice, 0)
	}
})

test("已知模型以官方数据为准，忽略残留配置", () => {
	const info = getMimoModelInfo(mimoDefaultModelId, {
		// 历史配置里可能残留别的 provider 的上限
		contextWindow: 1_000_000,
		maxTokens: 384_000,
		supportsImages: false,
		supportsPromptCache: false,
	})
	assert.equal(info.contextWindow, mimoModels[mimoDefaultModelId].contextWindow)
	assert.equal(info.maxTokens, mimoModels[mimoDefaultModelId].maxTokens)
})

test("未知模型保留用户填写的元数据，回落到种子默认值", () => {
	const custom = getMimoModelInfo("mimo-v9-ultra", {
		contextWindow: 200_000,
		maxTokens: 16_000,
		supportsImages: true,
		supportsPromptCache: false,
	})
	assert.equal(custom.contextWindow, 200_000)
	assert.equal(custom.maxTokens, 16_000)
	assert.equal(custom.supportsImages, true)
	// 未提供的能力标记沿用种子
	assert.equal(custom.supportsReasoning, mimoModels[mimoDefaultModelId].supportsReasoning)
})

test("proto 往返：mimo ↔ MIMO，且模型信息不会丢", () => {
	const proto = convertApiConfigurationToProto({
		planModeApiProvider: "mimo",
		actModeApiProvider: "mimo",
		mimoApiKey: "test-key",
		planModeApiModelId: "mimo-v2.6-pro",
		actModeApiModelId: "mimo-v2.6-flash",
		planModeMimoModelInfo: {
			contextWindow: 128_000,
			maxTokens: 8_000,
			supportsImages: false,
			supportsPromptCache: false,
			supportsReasoning: true,
		},
	})

	assert.equal(proto.planModeApiProvider, ProtoApiProvider.MIMO)
	assert.equal(proto.actModeApiProvider, ProtoApiProvider.MIMO)
	assert.equal(proto.mimoApiKey, "test-key", "密钥字段必须随配置一起转换（漏 case 会被悄悄丢掉）")
	assert.equal(proto.planModeMimoModelInfo?.contextWindow, 128_000)
	assert.equal(proto.actModeMimoModelInfo, undefined, "未设置的 act 模型信息保持未设置")

	const back = convertProtoToApiConfiguration(proto)
	assert.equal(back.planModeApiProvider, "mimo")
	assert.equal(back.actModeApiProvider, "mimo")
	assert.equal(back.mimoApiKey, "test-key", "反向转换也不能丢密钥")
	assert.equal(back.planModeApiModelId, "mimo-v2.6-pro")
	assert.equal(back.planModeMimoModelInfo?.maxTokens, 8_000)
	assert.equal(convertProtoToApiProvider(ProtoApiProvider.MIMO), "mimo")
})

test("切换 provider 时纠正外来模型 id", () => {
	assert.equal(apiProviderDefaultModelId("deepseek"), "deepseek-flash")
	assert.equal(apiProviderDefaultModelId("mimo"), mimoDefaultModelId)
	assert.equal(apiProviderDefaultModelId("openai"), undefined, "OpenAI 兼容没有内置清单，不纠正")

	assert.equal(isBuiltinModelId("mimo", "deepseek-flash"), false, "DeepSeek 的 id 不能带进 MiMo")
	assert.equal(isBuiltinModelId("mimo", mimoDefaultModelId), true)
	assert.equal(isBuiltinModelId("deepseek", "mimo-v2.6-flash"), false)
	assert.equal(isBuiltinModelId("deepseek", "deepseek-flash"), true)
	assert.equal(isBuiltinModelId("openai", "any-custom-id"), true, "自定义端点不纠正")
	assert.equal(isBuiltinModelId("mimo", ""), false)
})

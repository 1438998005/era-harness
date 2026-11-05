import assert from "node:assert/strict"
import { describe, it } from "node:test"

/**
 * 结构性防同类（2026-11-04；2026-11-05 #233 重写判据）：
 * proto 的 ModelInfo 字段在转换路径上必须对称且按 proto message 类型分派。
 *
 * 旧版 `written` 只收「写侧 convertApiConfigurationToProto 产出的字段」——写侧不产出的
 * 22 个 proto 独有字段（oca/aihubmix/liteLlm/requesty…）永不被断言，读侧漏转/误转测不到。
 * #233 正落在盲区里：通用分派按 `includes("OpenAi")` 二分，Oca（proto message 无 tiers）
 * 喂进 OpenRouter 转换 `protoInfo.tiers.length` 直接 TypeError，Aihubmix（字段名不含
 * "OpenAi"）被误转成 OpenRouter 形状丢 temperature/isR1FormatRequired。
 *
 * 新判据：不再依赖写侧产出——按 MODEL_INFO_FIELD_PROTO_TYPE 为每个 `*ModelInfo` 字段
 * 直接构造对应类型的最小 proto 对象，逐类型断言读侧行为。映射表对 proto 文本的完整性
 * 由 `model-info-proto-mapping.spec.ts`（从 proto 定义解析期望值）另行锁定，两者成链。
 */

import type { ApiConfiguration } from "@shared/api"
import { ModelsApiConfiguration } from "@shared/proto/cline/models"
import {
	convertApiConfigurationToProto,
	convertProtoToApiConfiguration,
	convertUpdateSettingsApiConfiguration,
	MODEL_INFO_FIELD_PROTO_TYPE,
} from "@shared/proto-conversions/models/api-configuration-conversion"
import { ApiHandlerSettingsKeys } from "@shared/storage/state-keys"

/** proto 全部 *ModelInfo 字段（ModelsApiConfiguration.create({}) 的 key 集合） */
const MODEL_INFO_FIELDS = Object.keys(ModelsApiConfiguration.create({})).filter((key) => key.endsWith("ModelInfo"))

/** app 侧（state-keys.ts 的 API_HANDLER_SETTINGS_FIELDS）声明的 ModelInfo 字段 —— 精简读路径应覆盖它 */
const APP_SIDE_MODEL_INFO_FIELDS = ApiHandlerSettingsKeys.filter((key) => key.endsWith("ModelInfo"))

/** 按 proto message 类型构造最小输入；contextWindow 逐字段不同，用于检测字段串位 */
function buildProtoModelInfo(typeName: string, contextWindow: number): Record<string, unknown> {
	const base = { contextWindow, maxTokens: 8_000, supportsImages: false, supportsPromptCache: true }
	switch (typeName) {
		case "OpenAiCompatibleModelInfo":
			return { ...base, tiers: [], temperature: 0.7, isR1FormatRequired: false }
		case "LiteLLMModelInfo":
			return { ...base, tiers: [], temperature: 0.9 }
		case "OcaModelInfo":
			// 刻意不带 tiers：修复前喂进 OpenRouter 转换（protoInfo.tiers.length）会 TypeError
			return { ...base, temperature: 0.5, modelName: "oca-model", reasoningEffortOptions: ["low", "high"] }
		default:
			return { ...base, tiers: [] }
	}
}

function protoInputForEveryModelInfo(): Record<string, Record<string, unknown>> {
	const input: Record<string, Record<string, unknown>> = {}
	MODEL_INFO_FIELDS.forEach((key, i) => {
		const typeName = MODEL_INFO_FIELD_PROTO_TYPE[key as keyof typeof MODEL_INFO_FIELD_PROTO_TYPE]
		assert.ok(typeName, `MODEL_INFO_FIELD_PROTO_TYPE 缺 ${key}：proto 有该字段而映射表未登记`)
		input[key] = buildProtoModelInfo(typeName, 100_000 + i)
	})
	return input
}

/** 逐字段断言「转换成应用形状且按类型还原」：contextWindow 不丢串、特殊类型特有字段保留、tiers 不留 proto 形状 */
function assertConvertedModelInfo(
	pathName: string,
	out: unknown,
	fields: readonly string[],
	input: Record<string, Record<string, unknown>>,
) {
	const result = out as Record<string, Record<string, unknown> | undefined>
	for (const key of fields) {
		const src = input[key]
		const got = result[key]
		assert.ok(got, `${pathName}: ${key} 转换结果缺失`)
		assert.equal(got.contextWindow, src.contextWindow, `${pathName}: ${key} contextWindow 丢失/串位`)
		if (src.modelName !== undefined) {
			// Oca：修复前在通用分派里直接 TypeError；modelName 与调查字段必须原样保留
			assert.equal(got.modelName, src.modelName, `${pathName}: ${key}（Oca）modelName 丢失`)
			assert.deepEqual(
				got.reasoningEffortOptions,
				src.reasoningEffortOptions,
				`${pathName}: ${key}（Oca）reasoningEffortOptions 丢失`,
			)
		}
		if (src.temperature !== undefined) {
			// OpenAiCompatible / LiteLLM：修复前 aihubmix 被误转 OpenRouter 形状丢 temperature
			assert.equal(got.temperature, src.temperature, `${pathName}: ${key} temperature 丢失（被误转成 OpenRouter 形状？）`)
		}
		if (src.tiers !== undefined) {
			assert.notDeepEqual(got.tiers, [], `${pathName}: ${key} 仍是 proto 形状（漏做 proto→应用转换）`)
		}
	}
}

describe("proto ModelInfo 字段的转换路径对称（#233 重写：判据来自类型映射，不再依赖写侧产出）", () => {
	it("映射表覆盖 proto 全部 *ModelInfo 字段，且不多登（proto 有 ↔ 映射表有 双向一致）", () => {
		assert.ok(MODEL_INFO_FIELDS.length >= 30, `解析出的 ModelInfo 字段太少（${MODEL_INFO_FIELDS.length}），探测可能失效`)
		for (const key of MODEL_INFO_FIELDS) {
			assert.ok(key in MODEL_INFO_FIELD_PROTO_TYPE, `MODEL_INFO_FIELD_PROTO_TYPE 缺 ${key}`)
		}
		assert.equal(
			Object.keys(MODEL_INFO_FIELD_PROTO_TYPE).length,
			MODEL_INFO_FIELDS.length,
			"映射表与 proto 字段集不一致（多登或漏登）",
		)
	})

	it("updateSettings 路径对全部 *ModelInfo 字段按类型正确转换（Oca 不炸、Aihubmix 不丢 temperature）", () => {
		const input = protoInputForEveryModelInfo()
		const out = convertUpdateSettingsApiConfiguration(input as unknown as ModelsApiConfiguration)
		assertConvertedModelInfo("convertUpdateSettingsApiConfiguration", out, MODEL_INFO_FIELDS, input)
	})

	it("convertProtoToApiConfiguration（精简字段版）覆盖 app 侧声明的每个 ModelInfo 字段", () => {
		const input = protoInputForEveryModelInfo()
		const out = convertProtoToApiConfiguration(input as unknown as ModelsApiConfiguration)
		assertConvertedModelInfo("convertProtoToApiConfiguration", out, APP_SIDE_MODEL_INFO_FIELDS, input)
		// 精简版只声明 app 侧子集；未来 app 侧新增 ModelInfo 字段而这里没转，上面的断言即红
		assert.ok(
			APP_SIDE_MODEL_INFO_FIELDS.length >= 14,
			`app 侧 ModelInfo 字段数异常（${APP_SIDE_MODEL_INFO_FIELDS.length}），探测可能失效`,
		)
	})

	it("写侧为 app 侧声明的每个 ModelInfo 字段产出 proto 形状（tiers undefined → []）", () => {
		const config = Object.fromEntries(
			APP_SIDE_MODEL_INFO_FIELDS.map((key, i) => [
				key,
				{ contextWindow: 100_000 + i, maxTokens: 8_000, supportsPromptCache: true },
			]),
		) as unknown as ApiConfiguration
		const proto = convertApiConfigurationToProto(config) as unknown as Record<string, { tiers?: unknown[] } | undefined>
		for (const key of APP_SIDE_MODEL_INFO_FIELDS) {
			assert.ok(proto[key], `写侧漏 ${key}（app 侧声明了但 convertApiConfigurationToProto 没写）`)
			assert.deepEqual(proto[key]?.tiers, [], `${key} 写侧未转 proto 形状（tiers 应为 []）`)
		}
	})

	it("未来新增的 *ModelInfo 字段不改代码也会被 updateSettings 路径转换（通用后缀判据）", () => {
		const futureProto = {
			futureModeModelInfo: {
				contextWindow: 42,
				maxTokens: 1,
				supportsPromptCache: false,
				tiers: [],
			},
		} as unknown as ModelsApiConfiguration
		const out = convertUpdateSettingsApiConfiguration(futureProto) as unknown as Record<
			string,
			{ contextWindow?: number; tiers?: unknown[] }
		>
		assert.equal(out.futureModeModelInfo?.contextWindow, 42)
		assert.notDeepEqual(out.futureModeModelInfo?.tiers, [], "新字段必须走通用转换，不能靠手写清单补")
	})

	it("provider 枚举在两条路径上都转成字符串（漏转会被存成数字）", () => {
		const proto = convertApiConfigurationToProto({
			planModeApiProvider: "moonshot",
			actModeApiProvider: "moonshot",
			enhanceApiProvider: "deepseek",
			subagentApiProvider: "mimo",
		})
		const back = convertProtoToApiConfiguration(proto)
		const viaSettings = convertUpdateSettingsApiConfiguration(proto)
		for (const key of ["planModeApiProvider", "actModeApiProvider", "enhanceApiProvider", "subagentApiProvider"]) {
			const a = (back as unknown as Record<string, unknown>)[key]
			const b = (viaSettings as unknown as Record<string, unknown>)[key]
			assert.equal(typeof a, "string", `convertProtoToApiConfiguration: ${key} 漏转`)
			assert.equal(a, b, `${key} 两条路径转换结果不一致`)
		}
		assert.equal(back.planModeApiProvider, "moonshot")
	})
})

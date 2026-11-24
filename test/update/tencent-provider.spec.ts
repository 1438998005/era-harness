import assert from "node:assert/strict"
import fs from "node:fs"
import { describe, it } from "node:test"

// 腾讯云 TokenHub / Coding Plan 模型常量、归属注册与接线回归（2026-11-24，KB 08 #270/#271）。
// 自原单文件拆出（20KB 单文件闸门，KB 08 #271）：本文件锁模型目录数据（16 款 + 套餐档）、
// 三处归属注册、proto/存储/转换/诊断接线与密钥互斥。
// 请求侧判据见 tencent-request.spec.ts；handler 级行为见 tencent-handler.spec.ts。

import {
	apiProviderDefaultModelId,
	getTencentCodingPlanModelInfo,
	getTencentTokenhubModelInfo,
	isBuiltinModelId,
	modelIdBelongsToKnownCatalog,
	resolveTencentCodingPlanModelId,
	resolveTencentTokenhubModelId,
	tencentCodingPlanDefaultModelId,
	tencentCodingPlanModels,
	tencentTokenhubDefaultModelId,
	tencentTokenhubModels,
} from "@shared/api"
import { calculateTencentCost, shouldAttachTencentReasoning } from "@shared/tencent-request"

function readRepo(relative: string): string {
	const fromCwd = fs.existsSync("src/shared/api.ts") ? process.cwd() : ".."
	return fs.readFileSync(`${fromCwd}/${relative}`, "utf8")
}

describe("腾讯云模型常量与归属注册", () => {
	it("TokenHub 在售 16 款 + 默认 hy3；已下线 / 翻译 / 角色款与上游过时默认档不收录", () => {
		assert.equal(Object.keys(tencentTokenhubModels).length, 16)
		assert.equal(tencentTokenhubDefaultModelId, "hy3")
		assert.equal(resolveTencentTokenhubModelId("hy4-preview"), undefined, "官方公告 2026-12-07 下线")
		assert.equal(resolveTencentTokenhubModelId("hy-mt2-pro"), undefined, "翻译款不收录")
		assert.equal(resolveTencentTokenhubModelId("hy-role"), undefined, "角色款不收录")
		assert.equal(resolveTencentTokenhubModelId("hy3-preview"), undefined, "上游 cline#12014 的默认档已从官方列表消失")
	})

	it("大小写归一：在线同步回来的 HY3 / DeepSeek-V4.1-FLASH-1017 命中规范 id", () => {
		assert.equal(resolveTencentTokenhubModelId("HY3"), "hy3")
		assert.equal(resolveTencentTokenhubModelId("DeepSeek-V4.1-Flash-1017"), "deepseek-v4.1-flash-1017")
	})

	it("官方窗口实证抽查：混元 1M、DeepSeek 1M/384k、hy3 256K、K2.7 Code 256K、MiMo 系 131k 输出", () => {
		assert.equal(tencentTokenhubModels["hy4-flash"].contextWindow, 1_048_576)
		assert.equal(tencentTokenhubModels["hy4-flash"].maxTokens, 65_536)
		assert.equal(tencentTokenhubModels["hy3"].contextWindow, 262_144)
		assert.equal(tencentTokenhubModels["hy3"].maxTokens, 131_072)
		assert.equal(tencentTokenhubModels["deepseek-v4.1-flash-1017"].maxTokens, 393_216)
		assert.equal(tencentTokenhubModels["kimi-k2.7-code"].contextWindow, 262_144)
		assert.equal(tencentTokenhubModels["mimo-v2.6-flash"].maxTokens, 131_072)
		// 混元两档 1M 窗口含输出（960k 输入 + 64k 输出 = 1M），截断口径依赖该位
		assert.equal(tencentTokenhubModels["hy4-flash"].contextWindowIncludesOutput, true)
		assert.equal(tencentTokenhubModels["deepseek-v4.1-flash-1017"].contextWindowIncludesOutput, undefined)
	})

	it("视觉按官方模型列表登记：hy4 系 / DeepSeek-Flash 系 / GLM-Flash 系 / Kimi 系开，hy3 / deepseek-v4-pro / glm-5.3 关", () => {
		assert.equal(tencentTokenhubModels["hy4"].supportsImages, true)
		assert.equal(tencentTokenhubModels["hy3"].supportsImages, false)
		assert.equal(tencentTokenhubModels["deepseek-v4.1-flash-1017"].supportsImages, true)
		assert.equal(tencentTokenhubModels["deepseek-v4-pro"].supportsImages, false)
		assert.equal(tencentTokenhubModels["glm-5.3"].supportsImages, false)
		assert.equal(tencentTokenhubModels["glm-5.3-flash"].supportsImages, true)
		assert.equal(tencentTokenhubModels["kimi-k3"].supportsImages, true)
		assert.equal(tencentTokenhubModels["step-5-preview"].supportsImages, true)
	})

	it("峰谷价抽查：DeepSeek 系存闲时价（0.02/1/4），其余单价照官方页", () => {
		assert.equal(tencentTokenhubModels["deepseek-v4.1-flash-1017"].cacheReadsPrice, 0.02)
		assert.equal(tencentTokenhubModels["deepseek-v4.1-flash-1017"].outputPrice, 4)
		assert.equal(tencentTokenhubModels["deepseek-v4-pro"].cacheWritesPrice, 12)
		assert.equal(tencentTokenhubModels["hy3"].outputPrice, 4)
		assert.equal(tencentTokenhubModels["glm-5.3"].outputPrice, 28)
		assert.equal(tencentTokenhubModels["kimi-k3"].outputPrice, 100)
		assert.equal(tencentTokenhubModels["mimo-v2.6-flash"].cacheReadsPrice, 0.02)
	})

	it("getTencentTokenhubModelInfo：已知 id 以官方数据为准，未知 id 保留用户元数据 + 默认档保守值", () => {
		const known = getTencentTokenhubModelInfo("hy3", { contextWindow: 8000 })
		assert.equal(known.contextWindow, 262_144)
		const unknown = getTencentTokenhubModelInfo("hy5-beta", { contextWindow: 2_000_000, maxTokens: 8_000 })
		assert.equal(unknown.contextWindow, 2_000_000)
		assert.equal(unknown.maxTokens, 8_000)
	})

	it("未知 id 回退不继承混元专属字段：能力位与混元价剥掉、name 用传入 id（#275）", () => {
		const unknown = getTencentTokenhubModelInfo("hy5-beta", { contextWindow: 2_000_000, maxTokens: 8_000 })
		assert.equal(
			unknown.contextWindowIncludesOutput,
			undefined,
			"第三方新模型不是「窗口含输出」（继承会让输入预算多扣一个输出位）",
		)
		assert.equal(unknown.inputPrice, undefined)
		assert.equal(unknown.cacheReadsPrice, undefined)
		assert.equal(unknown.cacheWritesPrice, undefined)
		assert.equal(unknown.outputPrice, undefined, "混元价不继承（按混元价估费 = 算错账）")
		assert.equal(unknown.name, "hy5-beta", "name 用传入 id，不继承「混元 Hy3」")
		// 价格缺失 → calculateTencentCost 三档全 0（未知模型不再估出一笔混元账）
		assert.equal(calculateTencentCost("hy5-beta", unknown, 1000, 2000, 500), 0)
		// 已知 id 行为不变：官方数据为准（含能力位与价格）
		assert.equal(getTencentTokenhubModelInfo("hy3").name, "混元 Hy3")
		assert.equal(getTencentTokenhubModelInfo("hy3").contextWindowIncludesOutput, true)
		// 套餐未知分支：价格保持 0（套餐按请求计费的语义，不是混元价残留）、name 用传入 id
		const planUnknown = getTencentCodingPlanModelInfo("glm-5")
		assert.equal(planUnknown.name, "glm-5")
		assert.equal(planUnknown.outputPrice, 0)
		assert.equal(planUnknown.contextWindowIncludesOutput, undefined)
	})

	it("Coding Plan：唯一档 tc-code-latest（Auto）、价格全 0、无多模态、未知名保留", () => {
		assert.equal(Object.keys(tencentCodingPlanModels).length, 1)
		assert.equal(tencentCodingPlanDefaultModelId, "tc-code-latest")
		assert.equal(tencentCodingPlanModels["tc-code-latest"].inputPrice, 0)
		assert.equal(tencentCodingPlanModels["tc-code-latest"].outputPrice, 0)
		assert.equal(tencentCodingPlanModels["tc-code-latest"].supportsImages, false, "官方概述：暂不支持多模态能力")
		assert.equal(resolveTencentCodingPlanModelId("TC-Code-Latest"), "tc-code-latest")
		const unknown = getTencentCodingPlanModelInfo("glm-5", { contextWindow: 200_000 })
		assert.equal(unknown.contextWindow, 200_000, "套餐动态库允许手填官方模型名，元数据保留")
		assert.equal(unknown.outputPrice, 0, "手填模型价格仍归零（套餐按请求计费）")
	})

	it("归属注册三处：两家默认档 / 内置判据 / 已知清单总判据（防别家 id 打错端点）", () => {
		assert.equal(apiProviderDefaultModelId("tencent-tokenhub"), "hy3")
		assert.equal(apiProviderDefaultModelId("tencent-coding-plan"), "tc-code-latest")
		assert.equal(isBuiltinModelId("tencent-tokenhub", "hy4-flash"), true)
		assert.equal(isBuiltinModelId("tencent-tokenhub", "hy4-preview"), false)
		assert.equal(isBuiltinModelId("tencent-coding-plan", "tc-code-latest"), true)
		assert.equal(isBuiltinModelId("tencent-coding-plan", "kimi-k3"), false, "Kimi 官方款属于 moonshot 清单，不属于套餐")
		assert.equal(modelIdBelongsToKnownCatalog("hy3"), true)
		assert.equal(modelIdBelongsToKnownCatalog("tc-code-latest"), true)
	})

	it("思考回传判据：TokenHub 清单内附加 reasoning_content，套餐动态库 / 未知 id 不附加", () => {
		assert.equal(shouldAttachTencentReasoning("hy3"), true)
		assert.equal(shouldAttachTencentReasoning("DeepSeek-V4.1-Flash-1017"), true)
		assert.equal(shouldAttachTencentReasoning("tc-code-latest"), false, "套餐模型库动态，保守不回传")
		assert.equal(shouldAttachTencentReasoning("not-a-known-model"), false)
	})
})

describe("腾讯云接线（proto / 存储 / 转换 / 归属 / 诊断）", () => {
	it("providers.json 两个条目标签", () => {
		const providers = JSON.parse(readRepo("src/shared/providers/providers.json")) as {
			list: Array<{ value: string; label: string }>
		}
		assert.equal(providers.list.find((p) => p.value === "tencent-tokenhub")?.label, "腾讯云 TokenHub")
		assert.equal(providers.list.find((p) => p.value === "tencent-coding-plan")?.label, "腾讯云 Coding Plan")
	})

	it("proto：enum 47/48、ModelsApiSecrets 43/44、ModelsApiConfiguration 277–284 全部落位", () => {
		const models = readRepo("proto/cline/models.proto")
		assert.match(models, /TENCENT_TOKENHUB = 47;/)
		assert.match(models, /TENCENT_CODING_PLAN = 48;/)
		assert.match(models, /optional string tencent_tokenhub_api_key = 43;/)
		assert.match(models, /optional string tencent_coding_plan_api_key = 44;/)
		assert.match(models, /optional string tencent_tokenhub_api_key = 277;/)
		assert.match(models, /optional string tencent_tokenhub_api_line = 278;/)
		assert.match(models, /optional string tencent_tokenhub_reasoning_effort = 279;/)
		assert.match(models, /optional string tencent_coding_plan_api_key = 280;/)
		assert.match(models, /optional OpenRouterModelInfo plan_mode_tencent_tokenhub_model_info = 281;/)
		assert.match(models, /optional OpenRouterModelInfo act_mode_tencent_tokenhub_model_info = 282;/)
		assert.match(models, /optional OpenRouterModelInfo plan_mode_tencent_coding_plan_model_info = 283;/)
		assert.match(models, /optional OpenRouterModelInfo act_mode_tencent_coding_plan_model_info = 284;/)
	})

	it("state.proto：Secrets 52/53、Settings 221–226（生成器产物）", () => {
		const state = readRepo("proto/cline/state.proto")
		assert.match(state, /optional string tencent_tokenhub_api_key = 52;/)
		assert.match(state, /optional string tencent_coding_plan_api_key = 53;/)
		assert.match(state, /optional string tencent_tokenhub_reasoning_effort = 221;/)
		assert.match(state, /optional string tencent_tokenhub_api_line = 226;/)
	})

	it("转换双向各两个 provider case（漏一个方向会被静默存成 DeepSeek）", () => {
		const conv = readRepo("src/shared/proto-conversions/models/api-configuration-conversion.ts")
		assert.equal((conv.match(/tencent-tokenhub/g) ?? []).length >= 2, true, "to/from 双向至少各一次")
		assert.equal((conv.match(/tencent-coding-plan/g) ?? []).length >= 2, true)
		assert.match(conv, /ProtoApiProvider\.TENCENT_TOKENHUB/)
		assert.match(conv, /ProtoApiProvider\.TENCENT_CODING_PLAN/)
		// 四个 ModelInfo 字段在写侧转换中出现（读侧走 MODEL_INFO_FIELD_PROTO_TYPE 通用分派）
		for (const field of [
			"planModeTencentTokenhubModelInfo",
			"actModeTencentTokenhubModelInfo",
			"planModeTencentCodingPlanModelInfo",
			"actModeTencentCodingPlanModelInfo",
		]) {
			assert.match(conv, new RegExp(`${field}: convertModelInfoToProtoOpenRouter`), `写侧缺 ${field}`)
		}
	})

	it("ModelInfo 类型映射表与 api/index 分派、updateApiConfigurationProto 读侧接线", () => {
		const mapping = readRepo("src/shared/proto-conversions/models/model-info-proto-fields.ts")
		for (const field of [
			"planModeTencentTokenhubModelInfo",
			"actModeTencentTokenhubModelInfo",
			"planModeTencentCodingPlanModelInfo",
			"actModeTencentCodingPlanModelInfo",
		]) {
			assert.match(mapping, new RegExp(`${field}: "OpenRouterModelInfo"`))
		}
		const index = readRepo("src/core/api/index.ts")
		assert.match(index, /case "tencent-tokenhub":/)
		assert.match(index, /case "tencent-coding-plan":/)
		assert.match(index, /new TencentHandler\(/)
		const updateProto = readRepo("src/core/controller/models/updateApiConfigurationProto.ts")
		assert.match(updateProto, /planModeTencentTokenhubModelInfo/)
		assert.match(updateProto, /actModeTencentCodingPlanModelInfo/)
	})

	it("webview 设置页接线：两个组件 + ApiOptions 渲染块 + 双语 locale 键", () => {
		for (const file of [
			"webview-ui/src/components/settings/providers/TencentTokenhubProvider.tsx",
			"webview-ui/src/components/settings/providers/TencentCodingPlanProvider.tsx",
		]) {
			assert.ok(fs.existsSync(file), `缺少组件文件 ${file}`)
		}
		const apiOptions = readRepo("webview-ui/src/components/settings/ApiOptions.tsx")
		assert.match(apiOptions, /selectedProvider === "tencent-tokenhub"/)
		assert.match(apiOptions, /selectedProvider === "tencent-coding-plan"/)
		for (const lng of ["en", "zh-CN"]) {
			const settings = JSON.parse(readRepo(`webview-ui/src/locales/${lng}/settings.json`)) as {
				providers: Record<string, Record<string, unknown>>
			}
			const zh = settings.providers.tencentTokenhub
			const plan = settings.providers.tencentCodingPlan
			assert.ok(zh && plan, `${lng} 缺腾讯云 providers 段`)
			assert.equal(typeof zh.lineHint, "string")
			assert.equal(typeof plan.planHint, "string")
			// 真断言（#271：原写法 `includes("9:00") || length > 0` 恒真）：峰谷计价文案两地
			// 必须写明 9:00 起的峰段与整单 ×2（zh 写「×2」、en 写「2×」）
			const priceNote = String(zh.priceNote)
			assert.ok(priceNote.includes("9:00"), `${lng} priceNote 缺峰段起点 9:00`)
			assert.ok(priceNote.includes("×2") || priceNote.includes("2×"), `${lng} priceNote 缺峰时倍率`)
		}
	})

	it("存储：密钥只进 SECRETS_KEYS、设置字段进 API_HANDLER_SETTINGS_FIELDS（互斥由 review-bugfix 总守）", () => {
		const keys = readRepo("src/shared/storage/state-keys.ts")
		assert.match(keys, /"tencentTokenhubApiKey"/)
		assert.match(keys, /"tencentCodingPlanApiKey"/)
		assert.match(keys, /tencentTokenhubApiLine: \{ default: undefined as string \| undefined \}/)
		assert.match(keys, /tencentTokenhubReasoningEffort: \{ default: undefined as string \| undefined \}/)
		for (const field of [
			"planModeTencentTokenhubModelInfo",
			"actModeTencentTokenhubModelInfo",
			"planModeTencentCodingPlanModelInfo",
			"actModeTencentCodingPlanModelInfo",
		]) {
			assert.match(keys, new RegExp(`${field}: \\{ default: undefined as ModelInfo \\| undefined \\}`))
		}
		const aux = readRepo("src/shared/aux-model.ts")
		assert.match(aux, /"tencent-tokenhub"/)
		assert.match(aux, /"tencent-coding-plan"/)
		assert.match(aux, /"tencent-tokenhub": "tencentTokenhubReasoningEffort"/)
		assert.match(aux, /"tencent-tokenhub": "tencentTokenhubApiKey"/)
		assert.match(aux, /"tencent-coding-plan": "tencentCodingPlanApiKey"/)
		const diagnostics = readRepo("src/hosts/vscode/diagnostics.ts")
		assert.match(diagnostics, /"tencentTokenhubApiKey"/)
		assert.match(diagnostics, /tencentBaseUrlForLine/)
	})
})

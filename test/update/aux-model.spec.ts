import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

/**
 * 「提示词增强 / 子代理」独立模型配置回归（2026-11-04 建立；2026-11-05 KB 08 #237 重写）。
 *
 * #237 用户裁定推翻了旧的「各一套完整独立配置」前提：两套都只选 provider + 模型，
 * 密钥与思维强度跟随所选 provider 对应的主 API 配置，且思维强度**按 provider 各存各的**。
 * 这里按 KB 04 §4.25 铺三层：行为（解析/门控/纯函数）、结构性（proto 往返与清单对齐）、
 * 元测试（源码断言钉住「旧字段不读」「单源映射」「七处读取已接线」「proto 号段不冲突」）。
 */

import type { ApiConfiguration } from "@shared/api"
import {
	AUXILIARY_CONFIG_KEYS,
	AUXILIARY_PREFIXES,
	AUXILIARY_SUPPORTED_PROVIDERS,
	extractAuxiliaryOverride,
	isAuxiliaryConfigured,
	PROVIDER_REASONING_EFFORT_KEY,
	resolveAuxiliaryApiConfiguration,
	resolveEffectiveSubagentProvider,
	resolveReasoningEffort,
} from "@shared/aux-model"
import {
	convertApiConfigurationToProto,
	convertProtoToApiConfiguration,
	convertUpdateSettingsApiConfiguration,
} from "@shared/proto-conversions/models/api-configuration-conversion"
import { ApiHandlerSettingsKeys, SecretKeys } from "@shared/storage/state-keys"

const REPO_ROOT = process.cwd()
const readCode = (p: string) => fs.readFileSync(path.join(REPO_ROOT, p), "utf8")
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

/** #237 用户验收场景：主模型 Moonshot、主配置同时填了 DeepSeek 与 Moonshot 两家的凭证/档位。 */
function baseConfig(): ApiConfiguration {
	return {
		planModeApiProvider: "moonshot",
		actModeApiProvider: "moonshot",
		moonshotApiKey: "sk-moonshot-main",
		deepSeekApiKey: "sk-deepseek-main",
		mimoApiKey: "sk-mimo-main",
		planModeApiModelId: "kimi-k3",
		actModeApiModelId: "kimi-k3",
		moonshotApiLine: "international",
		deepSeekReasoningEffort: "high",
		moonshotReasoningEffort: "low",
		planModeReasoningEffort: "xhigh",
		actModeReasoningEffort: "xhigh",
	} as ApiConfiguration
}

describe("KB 08 #237：isAuxiliaryConfigured / extractAuxiliaryOverride", () => {
	it("未选 provider / 不支持的 provider → 未配置", () => {
		assert.equal(isAuxiliaryConfigured(undefined), false)
		assert.equal(isAuxiliaryConfigured({}), false)
		assert.equal(isAuxiliaryConfigured({ provider: "openai" }), false) // openai 兼容暂不纳入
	})

	it("只选 provider 即生效（六家全通过，不再要求独立密钥）", () => {
		for (const provider of AUXILIARY_SUPPORTED_PROVIDERS) {
			assert.equal(isAuxiliaryConfigured({ provider, apiKey: undefined }), true, `${provider} 只选服务就该生效`)
		}
		assert.equal(isAuxiliaryConfigured({ provider: "free" }), true)
		// 旧判据在这里会静默失效：用户只选 DeepSeek 不给 key → 功能不生效（本次专防的形状）
		assert.equal(isAuxiliaryConfigured({ provider: "deepseek" }), true)
	})

	it("extract 屏蔽旧独立密钥 / 思维强度 / Kimi 入口，且两套互不串", () => {
		const config = {
			enhanceApiProvider: "deepseek",
			enhanceApiKey: "sk-enhance-old",
			enhanceReasoningEffort: "low",
			enhanceMoonshotApiLine: "china",
			enhanceApiModelId: "deepseek-chat",
			subagentApiProvider: "moonshot",
			subagentApiKey: "sk-subagent-old",
			subagentReasoningEffort: "high",
			subagentMoonshotApiLine: "international",
			subagentApiModelId: "kimi-k3",
		} as unknown as ApiConfiguration
		assert.deepEqual(extractAuxiliaryOverride(config, "enhance"), {
			provider: "deepseek",
			modelId: "deepseek-chat",
			modelInfo: undefined,
			apiKey: undefined,
			reasoningEffort: undefined,
			moonshotApiLine: undefined,
		})
		const sub = extractAuxiliaryOverride(config, "subagent")
		assert.equal(sub.provider, "moonshot")
		assert.equal(sub.modelId, "kimi-k3")
		assert.equal(sub.apiKey, undefined)
		assert.equal(sub.reasoningEffort, undefined)
		assert.equal(sub.moonshotApiLine, undefined)
	})
})

describe("KB 08 #237：resolveAuxiliaryApiConfiguration", () => {
	it("未配置 → undefined（消费点走主配置，零行为变化）", () => {
		assert.equal(resolveAuxiliaryApiConfiguration(undefined, baseConfig(), "act"), undefined)
		assert.equal(resolveAuxiliaryApiConfiguration({ provider: "openai" }, baseConfig(), "act"), undefined)
	})

	it("用户验收：主模型 Moonshot + 辅助选 DeepSeek → 用主 deepSeekApiKey 与 DeepSeek 档", () => {
		const base = baseConfig()
		const resolved = resolveAuxiliaryApiConfiguration({ provider: "deepseek" }, base, "act")!
		assert.equal(resolved.actModeApiProvider, "deepseek")
		assert.equal(resolved.planModeApiProvider, "deepseek")
		assert.equal(resolved.deepSeekApiKey, "sk-deepseek-main", "密钥跟随 DeepSeek 主配置")
		assert.equal(resolved.moonshotApiKey, "sk-moonshot-main", "主配置的别家密钥不被误覆盖")
		assert.equal(resolveReasoningEffort(resolved.actModeApiProvider, resolved, "act"), "high", "读 DeepSeek 页那一档")
		assert.equal(resolveReasoningEffort("moonshot", base, "act"), "low", "主模型仍读 Moonshot 档，各存各的")

		// 把主模型再切到别家，子代理选 DeepSeek 仍读 DeepSeek 档（用户举例的第二半）
		const switched = {
			...base,
			planModeApiProvider: "mimo",
			actModeApiProvider: "mimo",
			actModeReasoningEffort: "xhigh",
		} as ApiConfiguration
		const resolved2 = resolveAuxiliaryApiConfiguration({ provider: "deepseek" }, switched, "act")!
		assert.equal(resolveReasoningEffort(resolved2.actModeApiProvider, resolved2, "act"), "high")

		// 辅助配置不再把全局两槽覆盖成「辅助那一档」，否则请求侧读不到各家自己的槽
		assert.equal(resolved.actModeReasoningEffort, base.actModeReasoningEffort)
		assert.equal(resolved.planModeReasoningEffort, base.planModeReasoningEffort)
	})

	it("两套辅助都只选 provider 就生效，且旧独立凭证不进请求配置", () => {
		const config = {
			...baseConfig(),
			enhanceApiProvider: "deepseek",
			enhanceApiKey: "sk-enhance-old",
			subagentApiProvider: "deepseek",
			subagentApiKey: "sk-subagent-old",
		} as ApiConfiguration
		for (const prefix of AUXILIARY_PREFIXES) {
			const aux = extractAuxiliaryOverride(config, prefix)
			assert.equal(isAuxiliaryConfigured(aux), true, `${prefix} 只选服务就该生效`)
			const resolved = resolveAuxiliaryApiConfiguration(aux, config, "act")!
			assert.equal(resolved.actModeApiProvider, "deepseek")
			assert.equal(resolved.deepSeekApiKey, "sk-deepseek-main", `${prefix} 不得再用独立密钥`)
			assert.equal(resolved.enhanceApiKey, undefined, `${prefix} 旧 enhance 密钥不进请求`)
			assert.equal(resolved.subagentApiKey, undefined, `${prefix} 旧 subagent 密钥不进请求`)
			assert.equal(resolveReasoningEffort(resolved.actModeApiProvider, resolved, "act"), "high")
		}
	})

	it("模型 id 过归属纠偏：改 provider 没改 id → 落该家默认档（KB 18 §18.11 的 402 闸）", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "moonshot", modelId: "mimo-v2.6-pro" },
			baseConfig(),
			"act",
		)!
		assert.equal(resolved.actModeApiProvider, "moonshot")
		assert.equal(resolved.actModeApiModelId, "kimi-k3.1-pro")
	})

	it("辅助所选 id 属于本家清单 → 原样保留；未知 id 也保留", () => {
		const known = resolveAuxiliaryApiConfiguration({ provider: "moonshot", modelId: "kimi-k3" }, baseConfig(), "act")!
		assert.equal(known.actModeApiModelId, "kimi-k3")
		const unknown = resolveAuxiliaryApiConfiguration(
			{ provider: "moonshot", modelId: "kimi-k9-future" },
			baseConfig(),
			"act",
		)!
		assert.equal(unknown.actModeApiModelId, "kimi-k9-future")
	})

	it("yaml 覆盖优先级最高（子代理 agent YAML 的既有能力不回归）", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "deepseek", modelId: "deepseek-v4-pro" },
			baseConfig(),
			"act",
			"deepseek-flash",
		)!
		assert.equal(resolved.actModeApiModelId, "deepseek-flash")
	})

	it("Kimi 入口跟随主 moonshotApiLine，不再由辅助旧值覆盖", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "moonshot", moonshotApiLine: "china", apiKey: "old" },
			baseConfig(),
			"act",
		)!
		assert.equal(resolved.moonshotApiLine, "international")
		assert.equal(resolved.moonshotApiKey, "sk-moonshot-main")
	})

	it("per-mode ModelInfo 仍写进目标 provider 的槽位（ModelInfo 保持独立）", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "mimo", modelInfo: { contextWindow: 500_000, supportsPromptCache: true } },
			baseConfig(),
			"act",
		)!
		assert.equal(resolved.planModeMimoModelInfo?.contextWindow, 500_000)
		assert.equal(resolved.actModeMimoModelInfo?.contextWindow, 500_000)
	})

	it("ulid 保留主任务标识", () => {
		const base = { ...baseConfig(), ulid: "task-ulid" } as ApiConfiguration
		const resolved = resolveAuxiliaryApiConfiguration({ provider: "deepseek" }, base, "act")!
		assert.equal(resolved.ulid, "task-ulid")
	})

	it("free 辅助：主配置付费密钥与 Kimi 入口不残留（#235②）；modelId 仍可跟随主配置", () => {
		const base = {
			...baseConfig(),
			bigmodelApiKey: "sk-bigmodel",
			bigmodelPlanApiKey: "sk-plan",
		} as ApiConfiguration
		const resolved = resolveAuxiliaryApiConfiguration({ provider: "free" }, base, "act")!
		assert.equal(resolved.planModeApiProvider, "free")
		for (const key of ["deepSeekApiKey", "mimoApiKey", "bigmodelApiKey", "bigmodelPlanApiKey", "moonshotApiKey"]) {
			assert.equal((resolved as Record<string, unknown>)[key], undefined, `free 辅助不得残留主配置密钥 ${key}`)
		}
		assert.equal(resolved.moonshotApiLine, undefined, "free 辅助不得残留主配置的 Kimi 入口")
		assert.equal(resolved.actModeApiModelId, "kimi-k3")
	})

	it("门控仍读实际生效 provider：主付费 + 辅助 free 拦住、主 free + 辅助付费放行", () => {
		const freeAux = { ...baseConfig(), subagentApiProvider: "free" } as ApiConfiguration
		assert.equal(resolveEffectiveSubagentProvider(freeAux, "act"), "free")
		const paidAux = {
			...baseConfig(),
			planModeApiProvider: "free",
			actModeApiProvider: "free",
			subagentApiProvider: "deepseek",
		} as ApiConfiguration
		assert.equal(resolveEffectiveSubagentProvider(paidAux, "act"), "deepseek")
	})
})

describe("KB 08 #237：resolveReasoningEffort 纯函数（按 provider 各存各的）", () => {
	it("五家各自读自家档，期望值从 PROVIDER_REASONING_EFFORT_KEY 单源派生", () => {
		const config = Object.fromEntries(
			Object.values(PROVIDER_REASONING_EFFORT_KEY).map((key, i) => [key, `effort-${i}`]),
		) as ApiConfiguration
		Object.entries(PROVIDER_REASONING_EFFORT_KEY).forEach(([provider, key], i) => {
			assert.equal(
				resolveReasoningEffort(provider, config, "act"),
				`effort-${i}`,
				`${provider} 应读自己的槽 ${String(key)}`,
			)
		})
	})

	it("per-provider 槽优先于全局 mode 槽；存量未设 / 无槽 provider 回落全局槽", () => {
		const config = {
			...baseConfig(),
			deepSeekReasoningEffort: "high",
			actModeReasoningEffort: "xhigh",
			planModeReasoningEffort: "low",
		} as ApiConfiguration
		assert.equal(resolveReasoningEffort("deepseek", config, "act"), "high")
		assert.equal(resolveReasoningEffort("deepseek", config, "plan"), "high", "单槽不分 plan/act")
		assert.equal(resolveReasoningEffort("mimo", config, "act"), "xhigh", "mimo 未设 → 回落全局 act 槽")
		assert.equal(resolveReasoningEffort("mimo", config, "plan"), "low", "mimo 未设 → 回落全局 plan 槽")
		assert.equal(resolveReasoningEffort("free", config, "act"), "xhigh")
		assert.equal(resolveReasoningEffort("openai", config, "act"), "xhigh")
		assert.equal(resolveReasoningEffort(undefined, config, "act"), "xhigh")
	})
})

describe("KB 08 #237：per-provider 槽的结构性对称与清单对齐", () => {
	it("五个新槽都在 settings 名单、都不在 secrets 名单（否则会被 undefined 覆盖）", () => {
		const settings = new Set<string>(ApiHandlerSettingsKeys as readonly string[])
		const secrets = new Set<string>(SecretKeys as readonly string[])
		for (const key of Object.values(PROVIDER_REASONING_EFFORT_KEY)) {
			assert.ok(settings.has(String(key)), `${String(key)} 必须在 API_HANDLER_SETTINGS_FIELDS`)
			assert.equal(secrets.has(String(key)), false, `${String(key)} 不能登记为密钥`)
		}
		assert.equal(Object.keys(PROVIDER_REASONING_EFFORT_KEY).length, 5, "五家各一档，free/openai 无槽")
		assert.equal(PROVIDER_REASONING_EFFORT_KEY.free, undefined)
	})

	it("proto 往返对称：五个新槽两条转换路径都不丢", () => {
		const config = Object.fromEntries(
			Object.values(PROVIDER_REASONING_EFFORT_KEY).map((key, i) => [key, `roundtrip-${i}`]),
		) as ApiConfiguration
		const proto = convertApiConfigurationToProto(config)
		const back = convertProtoToApiConfiguration(proto)
		const viaSettings = convertUpdateSettingsApiConfiguration(proto)
		Object.values(PROVIDER_REASONING_EFFORT_KEY).forEach((key, i) => {
			assert.equal((back as unknown as Record<string, unknown>)[key as string], `roundtrip-${i}`, "写→读漏字段")
			assert.equal(
				(viaSettings as unknown as Record<string, unknown>)[key as string],
				`roundtrip-${i}`,
				"settings 路径漏字段",
			)
		})
	})

	it("AUXILIARY_CONFIG_KEYS 仍 6/6/12（旧字段保留但不删号），三处清单对齐不回归", () => {
		assert.equal(AUXILIARY_CONFIG_KEYS.enhance.length, 6)
		assert.equal(AUXILIARY_CONFIG_KEYS.subagent.length, 6)
		assert.equal(new Set([...AUXILIARY_CONFIG_KEYS.enhance, ...AUXILIARY_CONFIG_KEYS.subagent]).size, 12)
		const registered = new Set<string>([
			...(SecretKeys as readonly string[]),
			...(ApiHandlerSettingsKeys as readonly string[]),
		])
		for (const key of [...AUXILIARY_CONFIG_KEYS.enhance, ...AUXILIARY_CONFIG_KEYS.subagent]) {
			assert.ok(registered.has(key), `${key} 不在存储名单里，清空通道会被忽略`)
		}
	})
})

describe("KB 08 #237：元测试（旧字段不读 / 单源接线 / proto 号段）", () => {
	it("解析、请求、诊断、UI 四处都读不到旧独立凭证", () => {
		const aux = stripComments(readCode("src/shared/aux-model.ts"))
		assert.doesNotMatch(aux, /config\[`\$\{prefix\}ApiKey`/, "extract 不得再抽旧密钥")
		assert.doesNotMatch(aux, /config\[`\$\{prefix\}ReasoningEffort`/, "extract 不得再抽旧思维强度")
		assert.doesNotMatch(aux, /config\[`\$\{prefix\}MoonshotApiLine`/, "extract 不得再抽旧入口")
		assert.doesNotMatch(aux, /aux!\.apiKey/, "resolve 不得再写独立密钥")
		assert.doesNotMatch(aux, /aux!\.reasoningEffort/, "resolve 不得再覆盖全局思维强度")
		assert.doesNotMatch(aux, /aux!\.moonshotApiLine/, "resolve 不得再覆盖 Kimi 入口")

		const diagnostics = stripComments(readCode("src/hosts/vscode/diagnostics.ts"))
		assert.doesNotMatch(diagnostics, /"enhanceApiKey"|"subagentApiKey"/, "诊断摘要不得显示旧辅助凭证")

		const ui = stripComments(readCode("webview-ui/src/components/settings/AuxiliaryModelSettings.tsx"))
		assert.doesNotMatch(ui, /ApiKeyField/, "辅助卡片不得再有密钥框")
		assert.doesNotMatch(ui, /`\$\{prefix\}ReasoningEffort`/, "辅助卡片不得再有思考强度下拉")
		assert.doesNotMatch(ui, /`\$\{prefix\}MoonshotApiLine`/, "辅助卡片不得再有独立 Kimi 入口")
		assert.match(ui, /密钥与思维强度跟随该服务的主配置/, "两套卡片都要给出跟随主配置的说明")
	})

	it("映射单源：只有一份 PROVIDER_REASONING_EFFORT_KEY，请求侧七处都走共享纯函数", () => {
		const aux = readCode("src/shared/aux-model.ts")
		assert.equal((aux.match(/export const PROVIDER_REASONING_EFFORT_KEY/g) ?? []).length, 1)
		assert.match(aux, /export function resolveReasoningEffort\(/, "读取判据也收在同一纯函数里")
		const api = stripComments(readCode("src/core/api/index.ts"))
		assert.match(api, /import \{ resolveReasoningEffort \} from "@shared\/aux-model"/)
		assert.equal((api.match(/reasoningEffort: resolveReasoningEffort\(apiProvider, options, mode\)/g) ?? []).length, 7)
		assert.doesNotMatch(api, /reasoningEffort: mode === "plan"/, "七个分支不得再各自读全局两槽")
	})

	it("设置页五家 provider 页都传 provider，控件按单源映射写各家自己的槽", () => {
		const selector = stripComments(readCode("webview-ui/src/components/settings/ReasoningEffortSelector.tsx"))
		assert.match(selector, /PROVIDER_REASONING_EFFORT_KEY\[provider\]/)
		assert.match(selector, /handleFieldChange\(perProviderKey, value\)/)
		for (const [file, provider] of [
			["DeepSeekProvider.tsx", "deepseek"],
			["MimoProvider.tsx", "mimo"],
			["BigmodelProvider.tsx", "bigmodel"],
			["BigmodelPlanProvider.tsx", "bigmodel-plan"],
			["MoonshotProvider.tsx", "moonshot"],
		] as const) {
			const code = stripComments(readCode(`webview-ui/src/components/settings/providers/${file}`))
			assert.match(code, new RegExp(`provider="${provider}"`), `${file} 未把 provider 传给思维强度控件`)
		}
		const openaiCompatible = stripComments(readCode("webview-ui/src/components/settings/providers/OpenAICompatible.tsx"))
		assert.doesNotMatch(openaiCompatible, /<ReasoningEffortSelector\s+provider=/, "openai 兼容仍用全局两槽")
	})

	it("proto 号段：B3 占 models 270–274 / state 214–218，B4 的 275 / 219 由 pinned_model_id 占用且不冲突", () => {
		const models = readCode("proto/cline/models.proto")
		const state = readCode("proto/cline/state.proto")
		for (const [name, field] of [
			["deep_seek_reasoning_effort", 270],
			["mimo_reasoning_effort", 271],
			["bigmodel_reasoning_effort", 272],
			["bigmodel_plan_reasoning_effort", 273],
			["moonshot_reasoning_effort", 274],
		] as const) {
			assert.match(models, new RegExp(`${name} = ${field};`))
			assert.match(state, new RegExp(`${name} = ${field - 56};`))
		}
		// B4 已落地：预留号段兑现为 pinned_model_id，且与 #237 的 5 个槽位互不重叠
		assert.match(models, /optional string pinned_model_id = 275;/, "models 275 应由 pinned_model_id 占用")
		assert.match(state, /optional string pinned_model_id = 219;/, "state 219 应由 pinned_model_id 占用")
		assert.equal((models.match(/= 275;/g) ?? []).length, 1, "models 275 不得被第二个字段复用")
		assert.equal((state.match(/= 219;/g) ?? []).length, 1, "state 219 不得被第二个字段复用")
		// 旧字段号保留、不删号复用
		assert.match(models, /enhance_api_key = 259;/)
		assert.match(models, /subagent_reasoning_effort = 268;/)
		// 转换层双向接线：漏一处就会出现「设置页配好了、请求侧读不到」
		const conversion = readCode("src/shared/proto-conversions/models/api-configuration-conversion.ts")
		assert.equal((conversion.match(/pinnedModelId:/g) ?? []).length, 2, "pinnedModelId 必须在 toProto / fromProto 各出现一次")
		const stateKeys = readCode("src/shared/storage/state-keys.ts")
		assert.match(stateKeys, /pinnedModelId:\s*\{ default:/, "pinnedModelId 必须进 API_HANDLER_SETTINGS_FIELDS 自动派生")
	})
})

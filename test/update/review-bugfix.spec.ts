import assert from "node:assert/strict"
import { describe, it } from "node:test"

// 2026-11-04 未提交内容审查的修复回归。
// 这批 BUG 的共同点：纯函数测试全绿、但真实链路静默失效。所以这里刻意覆盖
// 「存储名单 → 读回」「proto 往返」「门控读哪份配置」这类跨层接线，而不是再测一遍纯逻辑。

import type { ApiConfiguration } from "@shared/api"
import { extractAuxiliaryOverride, resolveAuxiliaryApiConfiguration, resolveEffectiveSubagentProvider } from "@shared/aux-model"
import { moonshotThinkingParam } from "@shared/moonshot-request"
import {
	convertApiConfigurationToProto,
	convertProtoToApiConfiguration,
} from "@shared/proto-conversions/models/api-configuration-conversion"
import {
	ApiHandlerOptionSettings,
	ApiHandlerSettingsKeys,
	mergeApiConfigurationCaches,
	SecretKeys,
	type Secrets,
} from "@shared/storage/state-keys"
import { providerSupportsSubagents, resolveSubagentsEnabled } from "@shared/subagents"
import { readCode } from "./source-probe"

describe("P1：辅助密钥只能在 Secrets 名单注册一次", () => {
	it("ApiHandlerSettingsKeys 与 SecretKeys 无交集（否则 {...secrets, ...settings} 会用 undefined 覆盖密钥）", () => {
		const settingsSet = new Set<string>(ApiHandlerSettingsKeys as readonly string[])
		const overlap = (SecretKeys as readonly string[]).filter((key) => settingsSet.has(key))
		assert.deepEqual(overlap, [])
	})

	it("三个新密钥都在 SecretKeys，且都不在 ApiHandlerSettingsKeys", () => {
		const secrets = new Set<string>(SecretKeys as readonly string[])
		const settings = new Set<string>(ApiHandlerSettingsKeys as readonly string[])
		for (const key of ["moonshotApiKey", "enhanceApiKey", "subagentApiKey"]) {
			assert.equal(secrets.has(key), true, `${key} 必须走加密存储`)
			assert.equal(settings.has(key), false, `${key} 绝不能再登记为普通设置`)
		}
	})

	it("按 StateManager.constructApiConfigurationFromCache 的合并顺序读回辅助密钥（#235③ 换真实链路）", () => {
		// #235③：不再手工模拟 {...secrets, ...settings}——改用 StateManager 同款
		// mergeApiConfigurationCaches（判据单源在 state-keys.ts，合并顺序 secrets→settings，
		// 后者覆盖前者）。名单有交集时 settings 里的 undefined 会把密钥覆盖掉 → 两套辅助配置永不生效。
		const secrets = Object.fromEntries(
			SecretKeys.map((key) => [
				key,
				key === "enhanceApiKey" ? "sk-enhance" : key === "subagentApiKey" ? "sk-subagent" : undefined,
			]),
		) as Secrets
		const settings = Object.fromEntries(ApiHandlerSettingsKeys.map((key) => [key, undefined])) as ApiHandlerOptionSettings
		const readBack = mergeApiConfigurationCaches(secrets, settings) as Record<string, unknown>
		assert.equal(readBack.enhanceApiKey, "sk-enhance")
		assert.equal(readBack.subagentApiKey, "sk-subagent")
		// 结构性钉住：StateManager 必须真的调用共享函数，否则本用例测的就不是真实链路
		assert.match(
			readCode("src/core/storage/StateManager.ts"),
			/return mergeApiConfigurationCaches\(secrets, settings\)/,
			"StateManager.constructApiConfigurationFromCache 必须调用共享合并函数（判据单源）",
		)
	})

	it("密钥存在时辅助配置才被判为已配置（读回链路修好后功能才会生效）", () => {
		const config = {
			enhanceApiProvider: "deepseek",
			enhanceApiKey: "sk-enhance",
		} as unknown as ApiConfiguration
		const aux = extractAuxiliaryOverride(config, "enhance")
		assert.equal(aux.apiKey, "sk-enhance")
		assert.ok(resolveAuxiliaryApiConfiguration(aux, config, "act"), "密钥读得回来 → 辅助配置应生效")
	})
})

describe("P2-1：Kimi 模型元数据的 proto 往返 plan/act 对称", () => {
	it("planModeMoonshotModelInfo 与 actModeMoonshotModelInfo 都能原样往返", () => {
		const info = {
			contextWindow: 1_048_576,
			maxTokens: 131_072,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoning: true,
		}
		const proto = convertApiConfigurationToProto({
			planModeApiProvider: "moonshot",
			actModeApiProvider: "moonshot",
			planModeMoonshotModelInfo: { ...info },
			actModeMoonshotModelInfo: { ...info, maxTokens: 8_000 },
		})
		const back = convertProtoToApiConfiguration(proto)
		assert.equal(back.planModeMoonshotModelInfo?.maxTokens, 131_072, "plan 侧漏转会被清空")
		assert.equal(back.actModeMoonshotModelInfo?.maxTokens, 8_000)
		assert.equal(back.planModeApiProvider, "moonshot")
		assert.equal(back.actModeApiProvider, "moonshot")
	})

	it("辅助配置的 ModelInfo 与 provider 也往返一致", () => {
		const proto = convertApiConfigurationToProto({
			enhanceApiProvider: "moonshot",
			enhanceApiKey: "sk-enhance",
			enhanceModelInfo: { contextWindow: 500_000, supportsPromptCache: true },
		})
		const back = convertProtoToApiConfiguration(proto)
		assert.equal(back.enhanceApiProvider, "moonshot")
		assert.equal(back.enhanceApiKey, "sk-enhance")
		assert.equal(back.enhanceModelInfo?.contextWindow, 500_000)
	})
})

describe("P2-4：子代理门控读实际生效 provider（#94 免费池禁令不可绕过）", () => {
	const base = (plan: string | undefined, act: string | undefined) =>
		({
			planModeApiProvider: plan,
			actModeApiProvider: act,
		}) as unknown as ApiConfiguration

	it("未配置辅助模型 → 用主配置", () => {
		assert.equal(resolveEffectiveSubagentProvider(base("mimo", "mimo"), "act"), "mimo")
		assert.equal(resolveEffectiveSubagentProvider(base("free", "free"), "act"), "free")
	})

	it("主付费 + 子代理辅助选 free → 门控必须拒绝", () => {
		const config = {
			...base("mimo", "mimo"),
			subagentApiProvider: "free",
			subagentApiKey: undefined,
		} as ApiConfiguration
		const provider = resolveEffectiveSubagentProvider(config, "act")
		assert.equal(provider, "free")
		assert.equal(providerSupportsSubagents(provider), false)
		assert.equal(resolveSubagentsEnabled(true, provider), false, "不能让免费池跑子代理")
	})

	it("主 free + 子代理辅助用付费模型 → 门控应放行（跨厂商配置不被主配置误杀）", () => {
		const config = {
			...base("free", "free"),
			subagentApiProvider: "deepseek",
			subagentApiKey: "sk-subagent",
		} as ApiConfiguration
		const provider = resolveEffectiveSubagentProvider(config, "act")
		assert.equal(provider, "deepseek")
		assert.equal(resolveSubagentsEnabled(true, provider), true)
	})

	it("只填 provider 不填密钥 = 半配置，不生效，仍回落到主配置", () => {
		const config = {
			...base("mimo", "mimo"),
			subagentApiProvider: "free",
			subagentApiKey: "sk-orphan",
		} as ApiConfiguration
		// free 不需要密钥即视为已配置；其余 provider 必须有密钥
		const nonFree = { ...config, subagentApiProvider: "deepseek", subagentApiKey: undefined } as ApiConfiguration
		assert.equal(resolveEffectiveSubagentProvider(nonFree, "act"), "mimo")
	})
})

describe("P3：判据一致性", () => {
	it("未知 Kimi 模型不发 reasoning_effort，内置清单模型正常映射", () => {
		assert.deepEqual(moonshotThinkingParam("xhigh", "kimi-k3.1-pro"), { reasoning_effort: "max" })
		assert.deepEqual(moonshotThinkingParam("low", "kimi-k3"), { reasoning_effort: "low" })
		assert.deepEqual(moonshotThinkingParam("xhigh", "moonshot-v1-128k"), {})
		assert.deepEqual(moonshotThinkingParam("low", "kimi-k9-future"), {})
		// 不传 modelId 时保持旧行为（调用方已自行确认模型）
		assert.deepEqual(moonshotThinkingParam("xhigh"), { reasoning_effort: "max" })
	})

	it("辅助模型 id 双 mode 同值写入（注释与代码一致）", () => {
		const config = {
			planModeApiProvider: "mimo",
			actModeApiProvider: "mimo",
			planModeApiModelId: "mimo-v2.6-pro",
			actModeApiModelId: "mimo-v2.6-pro",
			subagentApiProvider: "moonshot",
			subagentApiKey: "sk-subagent",
			subagentApiModelId: "kimi-k3",
		} as unknown as ApiConfiguration
		const resolved = resolveAuxiliaryApiConfiguration(extractAuxiliaryOverride(config, "subagent"), config, "act")!
		assert.equal(resolved.actModeApiModelId, "kimi-k3")
		assert.equal(resolved.planModeApiModelId, "kimi-k3", "另一 mode 不能残留主配置的别家 id")
	})
})

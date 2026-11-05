import assert from "node:assert/strict"
import { describe, it } from "node:test"

// 「提示词增强 / 子代理」独立模型配置回归（2026-11-04，用户裁定各一套完整独立配置、可跨厂商）。
// 判据单源在 @shared/aux-model：未配置回落、跨厂商密钥槽、归属纠偏、yaml 覆盖优先级。

import type { ApiConfiguration } from "@shared/api"
import { extractAuxiliaryOverride, isAuxiliaryConfigured, resolveAuxiliaryApiConfiguration } from "@shared/aux-model"

function baseConfig(): ApiConfiguration {
	return {
		planModeApiProvider: "mimo",
		actModeApiProvider: "mimo",
		mimoApiKey: "sk-main",
		actModeApiModelId: "mimo-v2.6-pro",
		planModeApiModelId: "mimo-v2.6-pro",
	} as ApiConfiguration
}

describe("isAuxiliaryConfigured / extractAuxiliaryOverride", () => {
	it("未选 provider / 不支持的 provider / 只选 provider 不给 key → 未配置", () => {
		assert.equal(isAuxiliaryConfigured(undefined), false)
		assert.equal(isAuxiliaryConfigured({}), false)
		assert.equal(isAuxiliaryConfigured({ provider: "openai", apiKey: "k" }), false) // openai 兼容暂不纳入
		assert.equal(isAuxiliaryConfigured({ provider: "deepseek" }), false)
		assert.equal(isAuxiliaryConfigured({ provider: "deepseek", apiKey: "  " }), false)
	})

	it("五家预设 + 免费池可用；免费池零配置即可", () => {
		for (const provider of ["deepseek", "mimo", "bigmodel", "bigmodel-plan", "moonshot"]) {
			assert.equal(isAuxiliaryConfigured({ provider, apiKey: "k" }), true)
		}
		assert.equal(isAuxiliaryConfigured({ provider: "free" }), true)
	})

	it("extractAuxiliaryOverride 按前缀抽包，两组字段互不串", () => {
		const config = {
			enhanceApiProvider: "deepseek",
			enhanceApiKey: "sk-e",
			subagentApiProvider: "moonshot",
			subagentApiKey: "sk-s",
		} as unknown as ApiConfiguration
		assert.deepEqual(extractAuxiliaryOverride(config, "enhance"), {
			provider: "deepseek",
			apiKey: "sk-e",
			modelId: undefined,
			modelInfo: undefined,
			reasoningEffort: undefined,
			moonshotApiLine: undefined,
		})
		assert.equal(extractAuxiliaryOverride(config, "subagent").provider, "moonshot")
	})
})

describe("resolveAuxiliaryApiConfiguration", () => {
	it("未配置 → undefined（消费点走主配置，零行为变化）", () => {
		assert.equal(resolveAuxiliaryApiConfiguration(undefined, baseConfig(), "act"), undefined)
		assert.equal(resolveAuxiliaryApiConfiguration({ provider: "deepseek" }, baseConfig(), "act"), undefined)
	})

	it("跨厂商：provider/密钥写进对应槽位，思考强度双 mode 同值", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "deepseek", apiKey: " sk-aux ", modelId: "deepseek-v4-pro", reasoningEffort: "high" },
			baseConfig(),
			"act",
		)!
		assert.equal(resolved.actModeApiProvider, "deepseek")
		assert.equal(resolved.planModeApiProvider, "deepseek")
		assert.equal(resolved.deepSeekApiKey, "sk-aux") // trim 过
		assert.equal(resolved.mimoApiKey, "sk-main") // 主配置密钥原样保留（handler 只读目标槽）
		assert.equal(resolved.actModeReasoningEffort, "high")
		assert.equal(resolved.planModeReasoningEffort, "high")
	})

	it("模型 id 过归属纠偏：改 provider 没改 id → 落该家默认档（KB 18 §18.11 的 402 闸）", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "moonshot", apiKey: "k", modelId: "mimo-v2.6-pro" },
			baseConfig(),
			"act",
		)!
		assert.equal(resolved.actModeApiProvider, "moonshot")
		assert.equal(resolved.actModeApiModelId, "kimi-k3.1-pro") // 别家 id → 纠偏成 moonshot 默认档
	})

	it("辅助所选 id 属于本家清单 → 原样保留；未知 id 也保留（官方可能新增模型）", () => {
		const known = resolveAuxiliaryApiConfiguration(
			{ provider: "moonshot", apiKey: "k", modelId: "kimi-k3" },
			baseConfig(),
			"act",
		)!
		assert.equal(known.actModeApiModelId, "kimi-k3")
		const unknown = resolveAuxiliaryApiConfiguration(
			{ provider: "moonshot", apiKey: "k", modelId: "kimi-k9-future" },
			baseConfig(),
			"act",
		)!
		assert.equal(unknown.actModeApiModelId, "kimi-k9-future")
	})

	it("yaml 覆盖优先级最高（子代理 agent YAML 的既有能力不回归）", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "deepseek", apiKey: "k", modelId: "deepseek-v4-pro" },
			baseConfig(),
			"act",
			"deepseek-flash",
		)!
		assert.equal(resolved.actModeApiModelId, "deepseek-flash")
	})

	it("Kimi 入口由辅助配置决定，写入 moonshotApiLine；per-mode ModelInfo 写进目标槽", () => {
		const resolved = resolveAuxiliaryApiConfiguration(
			{ provider: "moonshot", apiKey: "k", moonshotApiLine: "international" },
			baseConfig(),
			"act",
		)!
		assert.equal(resolved.moonshotApiLine, "international")
		assert.equal(resolved.actModeMoonshotModelInfo, undefined)
		const withInfo = resolveAuxiliaryApiConfiguration(
			{ provider: "mimo", apiKey: "k", modelInfo: { contextWindow: 500_000, supportsPromptCache: true } },
			baseConfig(),
			"act",
		)!
		assert.equal(withInfo.planModeMimoModelInfo?.contextWindow, 500_000)
		assert.equal(withInfo.actModeMimoModelInfo?.contextWindow, 500_000)
	})

	it("ulid 保留主任务标识", () => {
		const base = { ...baseConfig(), ulid: "task-ulid" } as ApiConfiguration
		const resolved = resolveAuxiliaryApiConfiguration({ provider: "deepseek", apiKey: "k" }, base, "act")!
		assert.equal(resolved.ulid, "task-ulid")
	})

	it("free 辅助：主配置付费密钥与 Kimi 入口不残留（#235②）；modelId 仍可跟随主配置", () => {
		const base = {
			...baseConfig(),
			deepSeekApiKey: "sk-deepseek",
			bigmodelApiKey: "sk-bigmodel",
			bigmodelPlanApiKey: "sk-plan",
			moonshotApiKey: "sk-moonshot",
			moonshotApiLine: "international",
		} as ApiConfiguration
		const resolved = resolveAuxiliaryApiConfiguration({ provider: "free" }, base, "act")!
		assert.equal(resolved.planModeApiProvider, "free")
		for (const key of ["deepSeekApiKey", "mimoApiKey", "bigmodelApiKey", "bigmodelPlanApiKey", "moonshotApiKey"]) {
			assert.equal((resolved as Record<string, unknown>)[key], undefined, `free 辅助不得残留主配置密钥 ${key}`)
		}
		assert.equal(resolved.moonshotApiLine, undefined, "free 辅助不得残留主配置的 Kimi 入口")
		// modelId 不清：free 无内置清单且未给 modelId → 保留 base 值（「跟随主模型」既定语义）
		assert.equal(resolved.actModeApiModelId, "mimo-v2.6-pro")
	})
})

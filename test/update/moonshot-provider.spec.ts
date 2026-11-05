import assert from "node:assert/strict"
import { describe, it } from "node:test"

// Kimi (Moonshot) 接入回归（2026-11-04）。
// 锁三类「猜错就静默失效 / 直接 4xx」的点：双入口判据、思考参数映射（官方 low|high|max、
// 共用存储位 xhigh→max）、固定参数绝不发送；外加模型常量与三处归属注册。

import {
	apiProviderDefaultModelId,
	getMoonshotModelInfo,
	isBuiltinModelId,
	modelIdBelongsToKnownCatalog,
	moonshotDefaultModelId,
	moonshotModels,
	resolveMoonshotModelId,
} from "@shared/api"
import {
	buildMoonshotParams,
	MOONSHOT_DEFAULT_API_LINE,
	moonshotBaseUrlForLine,
	moonshotConsoleUrlForLine,
	moonshotThinkingParam,
	shouldAttachMoonshotReasoning,
} from "@shared/moonshot-request"

describe("moonshot 双入口判据", () => {
	it("china（含 undefined 非法值回落）→ 国内基址 api.moonshot.cn/v1", () => {
		assert.equal(moonshotBaseUrlForLine("china"), "https://api.moonshot.cn/v1")
		assert.equal(moonshotBaseUrlForLine(undefined), "https://api.moonshot.cn/v1")
		assert.equal(moonshotBaseUrlForLine("nonsense"), "https://api.moonshot.cn/v1")
	})

	it("international → 国际基址 api.moonshot.ai/v1，两站地址不同（密钥不互通的物理基础）", () => {
		assert.equal(moonshotBaseUrlForLine("international"), "https://api.moonshot.ai/v1")
		assert.notEqual(moonshotBaseUrlForLine("china"), moonshotBaseUrlForLine("international"))
	})

	it("默认入口是国内站（用户裁定）", () => {
		assert.equal(MOONSHOT_DEFAULT_API_LINE, "china")
	})

	it("控制台链接随入口切换：国内 platform.kimi.com / 国际 platform.moonshot.ai", () => {
		assert.equal(moonshotConsoleUrlForLine("china"), "https://platform.kimi.com/console/api-keys")
		assert.equal(moonshotConsoleUrlForLine("international"), "https://platform.moonshot.ai/console/api-keys")
		assert.equal(moonshotConsoleUrlForLine(undefined), moonshotConsoleUrlForLine("china"))
	})
})

describe("moonshot 思考参数映射", () => {
	it("low/high 原样发，xhigh 映射官方 max", () => {
		assert.deepEqual(moonshotThinkingParam("low"), { reasoning_effort: "low" })
		assert.deepEqual(moonshotThinkingParam("high"), { reasoning_effort: "high" })
		assert.deepEqual(moonshotThinkingParam("xhigh"), { reasoning_effort: "max" })
	})

	it("none / medium / 未设置 / 非法值 → 不发参数（官方默认 max，K3.1 系关不掉思考）", () => {
		assert.deepEqual(moonshotThinkingParam("none"), {})
		assert.deepEqual(moonshotThinkingParam("medium"), {})
		assert.deepEqual(moonshotThinkingParam(undefined), {})
		assert.deepEqual(moonshotThinkingParam("bogus"), {})
	})
})

describe("buildMoonshotParams", () => {
	const base = { model: "kimi-k3.1-pro", messages: [{ role: "user" as const, content: "hi" }] }

	it("流式 + include_usage；输出上限用 max_completion_tokens", () => {
		const params = buildMoonshotParams({ ...base, maxCompletionTokens: 131_072 })
		assert.equal(params.stream, true)
		assert.deepEqual(params.stream_options, { include_usage: true })
		assert.equal(params.max_completion_tokens, 131_072)
	})

	it("官方固定值绝不发送：temperature/top_p/presence_penalty/frequency_penalty/n 一概不存在", () => {
		const params = buildMoonshotParams({ ...base })
		assert.equal("temperature" in params, false)
		assert.equal("top_p" in params, false)
		assert.equal("presence_penalty" in params, false)
		assert.equal("frequency_penalty" in params, false)
		assert.equal("n" in params, false)
	})

	it("思考参数以顶层 reasoning_effort 发送（不是 thinking.type）", () => {
		const params = buildMoonshotParams({ ...base, thinkingParam: moonshotThinkingParam("xhigh") })
		assert.equal((params as { reasoning_effort?: string }).reasoning_effort, "max")
		assert.equal("thinking" in params, false)
	})
})

describe("moonshot 模型常量与归属注册", () => {
	it("在售三款 + 默认 kimi-k3.1-pro；下线的 K2 系/moonshot-v1 系不收录", () => {
		assert.deepEqual(Object.keys(moonshotModels).sort(), ["kimi-k3", "kimi-k3.1-pro", "kimi-k3.1-pro-highspeed"])
		assert.equal(moonshotDefaultModelId, "kimi-k3.1-pro")
		assert.equal(resolveMoonshotModelId("Kimi-K2.6"), undefined)
		assert.equal(resolveMoonshotModelId("moonshot-v1-128k"), undefined)
	})

	it("大小写归一：在线同步回来的 KIMI-K3.1-PRO 命中规范 id", () => {
		assert.equal(resolveMoonshotModelId("KIMI-K3.1-PRO"), "kimi-k3.1-pro")
	})

	it("三款窗口 1M、视觉、缓存、思考齐全；未命中输入价 = cacheWritesPrice 口径", () => {
		for (const info of Object.values(moonshotModels)) {
			assert.equal(info.contextWindow, 1_048_576)
			assert.equal(info.supportsImages, true)
			assert.equal(info.supportsPromptCache, true)
			assert.equal(info.supportsReasoning, true)
			assert.equal(info.inputPrice, 0)
		}
		assert.equal(moonshotModels["kimi-k3.1-pro"].cacheWritesPrice, 13)
		assert.equal(moonshotModels["kimi-k3.1-pro-highspeed"].outputPrice, 136)
		assert.equal(moonshotModels["kimi-k3"].cacheReadsPrice, 2)
	})

	it("getMoonshotModelInfo：已知 id 以官方数据为准，未知 id 保留用户元数据 + 默认档保守值", () => {
		const known = getMoonshotModelInfo("kimi-k3.1-pro", { contextWindow: 8000 })
		assert.equal(known.contextWindow, 1_048_576)
		const unknown = getMoonshotModelInfo("kimi-k4-beta", { contextWindow: 2_000_000, maxTokens: 8_000 })
		assert.equal(unknown.contextWindow, 2_000_000)
		assert.equal(unknown.maxTokens, 8_000)
	})

	it("归属注册三处：默认档 / 内置判据 / 已知清单总判据（防别家 id 打错端点）", () => {
		assert.equal(apiProviderDefaultModelId("moonshot"), "kimi-k3.1-pro")
		assert.equal(isBuiltinModelId("moonshot", "kimi-k3"), true)
		assert.equal(isBuiltinModelId("moonshot", "mimo-v2.6-pro"), false)
		assert.equal(modelIdBelongsToKnownCatalog("kimi-k3.1-pro"), true)
	})

	it("思考回传判据：清单内附加 reasoning_content，未知 id 不附加", () => {
		assert.equal(shouldAttachMoonshotReasoning("kimi-k3"), true)
		assert.equal(shouldAttachMoonshotReasoning("Kimi-K3.1-Pro-Highspeed"), true)
		assert.equal(shouldAttachMoonshotReasoning("kimi-k9-future"), false)
	})
})

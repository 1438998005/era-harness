import assert from "node:assert/strict"
import { describe, it } from "node:test"

// 腾讯云 TokenHub / Coding Plan 请求侧判据回归（2026-11-24，KB 08 #270/#271）。
// 自 tencent-provider.spec.ts 拆出（20KB 单文件闸门，KB 08 #271）：本文件只锁请求侧
// 「猜错就静默失效 / 直接 4xx / 算错账」的四类点——双线判据、混元思考参数映射
// （reasoning_effort / thinking.type / preserved_thinking，未知模型零参数）、
// buildTencentParams 请求体、峰谷计价。
// 模型常量与接线见 tencent-provider.spec.ts；handler 级行为（夹紧 / 计费 / 基址）
// 见 tencent-handler.spec.ts。

import {
	buildTencentParams,
	calculateTencentCost,
	isBeijingPeakHour,
	isHunyuanModelId,
	isPeakValleyModelId,
	TENCENT_CHINA_BASE_URL,
	TENCENT_CODING_PLAN_BASE_URL,
	TENCENT_CODING_PLAN_CONSOLE_URL,
	TENCENT_DEFAULT_API_LINE,
	TENCENT_DOCS_URL,
	TENCENT_TOKENHUB_CONSOLE_URL,
	tencentBaseUrlForLine,
	tencentConsoleUrlForLine,
	tencentThinkingParam,
} from "@shared/tencent-request"

describe("腾讯云双线判据", () => {
	it("china（含 undefined 非法值回落）→ 广州基址 tokenhub.tencentmaas.com/v1", () => {
		assert.equal(tencentBaseUrlForLine("china"), TENCENT_CHINA_BASE_URL)
		assert.equal(tencentBaseUrlForLine(undefined), TENCENT_CHINA_BASE_URL)
		assert.equal(tencentBaseUrlForLine("nonsense"), TENCENT_CHINA_BASE_URL)
		assert.equal(TENCENT_CHINA_BASE_URL, "https://tokenhub.tencentmaas.com/v1")
	})

	it("intl → 新加坡基址 tokenhub-intl，与广州不同（两地密钥不通用、不跨地域）", () => {
		assert.equal(tencentBaseUrlForLine("intl"), "https://tokenhub-intl.tencentmaas.com/v1")
		assert.notEqual(tencentBaseUrlForLine("china"), tencentBaseUrlForLine("intl"))
	})

	it("默认入口是广州站（用户裁定）；Coding Plan 固定 lkeap 套餐域", () => {
		assert.equal(TENCENT_DEFAULT_API_LINE, "china")
		assert.equal(TENCENT_CODING_PLAN_BASE_URL, "https://api.lkeap.cloud.tencent.com/coding/v3")
	})

	it("控制台与文档链接（官方快速入门 /130058 与 FAQ /130103 原文 URL）", () => {
		assert.equal(tencentConsoleUrlForLine("china"), "https://console.cloud.tencent.com/tokenhub/apikey")
		assert.equal(tencentConsoleUrlForLine("intl"), tencentConsoleUrlForLine("china"))
		assert.equal(TENCENT_CODING_PLAN_CONSOLE_URL, "https://console.cloud.tencent.com/tokenhub/codingplan")
		assert.equal(TENCENT_DOCS_URL, "https://cloud.tencent.com/document/product/1823")
		assert.equal(TENCENT_TOKENHUB_CONSOLE_URL, "https://console.cloud.tencent.com/tokenhub/apikey")
	})
})

describe("腾讯云思考参数映射（只作用于混元系）", () => {
	it("isHunyuanModelId：hy3/hy4/hy4-flash 命中，翻译/角色款（hy-）与第三方不命中", () => {
		assert.equal(isHunyuanModelId("hy3"), true)
		assert.equal(isHunyuanModelId("HY4-FLASH"), true)
		assert.equal(isHunyuanModelId("hy-mt2-pro"), false, "翻译款 hy- 前缀不是语言混元")
		assert.equal(isHunyuanModelId("hunyuan-role-latest"), false)
		assert.equal(isHunyuanModelId("deepseek-v4.1-flash-1017"), false)
	})

	it("low / medium / high 原样发 reasoning_effort，并附带 preserved_thinking", () => {
		assert.deepEqual(tencentThinkingParam("low", "hy3"), { preserved_thinking: true, reasoning_effort: "low" })
		assert.deepEqual(tencentThinkingParam("medium", "hy3"), { preserved_thinking: true, reasoning_effort: "medium" })
		assert.deepEqual(tencentThinkingParam("high", "hy4"), { preserved_thinking: true, reasoning_effort: "high" })
	})

	it("none → thinking:{type:'disabled'}（官方最接近「关闭」的开关）", () => {
		assert.deepEqual(tencentThinkingParam("none", "hy3"), {
			preserved_thinking: true,
			thinking: { type: "disabled" },
		})
	})

	it("xhigh / 未设置 / 非法值 → 只带 preserved_thinking（档位不发送 = 官方默认 high，#273 口径）", () => {
		assert.deepEqual(tencentThinkingParam("xhigh", "hy3"), { preserved_thinking: true })
		assert.deepEqual(tencentThinkingParam(undefined, "hy3"), { preserved_thinking: true })
		assert.deepEqual(tencentThinkingParam("bogus", "hy4-flash"), { preserved_thinking: true })
	})

	it("第三方 / 未知模型零参数（⛔ 不发明知参数：DeepSeek/GLM/Kimi 各有官方默认）", () => {
		assert.deepEqual(tencentThinkingParam("high", "deepseek-v4.1-flash-1017"), {})
		assert.deepEqual(tencentThinkingParam("low", "glm-5.3"), {})
		assert.deepEqual(tencentThinkingParam("low", "not-a-known-model"), {})
	})
})

describe("buildTencentParams", () => {
	const base = { model: "hy3", messages: [{ role: "user" as const, content: "hi" }] }

	it("流式 + include_usage；输出上限用 max_completion_tokens", () => {
		const params = buildTencentParams({ ...base, maxCompletionTokens: 131_072 })
		assert.equal(params.stream, true)
		assert.deepEqual(params.stream_options, { include_usage: true })
		assert.equal(params.max_completion_tokens, 131_072)
	})

	it("混元思考三参以官方字段名发送（thinking.type / preserved_thinking 不进 SDK 类型，单点 cast）", () => {
		const params = buildTencentParams({
			...base,
			thinkingParam: tencentThinkingParam("none", "hy3"),
		}) as unknown as Record<string, unknown>
		assert.deepEqual(params.thinking, { type: "disabled" })
		assert.equal(params.preserved_thinking, true)
		assert.equal("reasoning_effort" in params, false)
	})

	it("⛔ 绝不发 tool_choice:'required'（官方 API 协议说明：思考模式下部分模型直接 400）", () => {
		const params = buildTencentParams({
			...base,
			toolParams: { tool_choice: "required" as never },
		})
		assert.equal("tool_choice" in params, false, "required 必须被兜底删除")
		const auto = buildTencentParams({
			...base,
			toolParams: { tool_choice: "auto" as never },
		})
		assert.equal((auto as unknown as Record<string, unknown>).tool_choice, "auto", "auto 不受影响")
	})
})

describe("峰谷计价（DeepSeek 系）", () => {
	it("北京时间峰段判定：工作日 9–12 / 14–18（UTC+8 平移取钟点，与机器时区无关）", () => {
		// 2026-11-23（周一）北京时间 10:00 = UTC 02:00 → 峰
		assert.equal(isBeijingPeakHour(new Date("2026-11-23T02:00:00Z")), true)
		// 13:00（午休）→ 谷；12:00 整点归谷（[start,end) 口径）
		assert.equal(isBeijingPeakHour(new Date("2026-11-23T05:00:00Z")), false)
		assert.equal(isBeijingPeakHour(new Date("2026-11-23T04:00:00Z")), false)
		// 15:00 → 峰；18:00 整点归谷
		assert.equal(isBeijingPeakHour(new Date("2026-11-23T07:00:00Z")), true)
		assert.equal(isBeijingPeakHour(new Date("2026-11-23T10:00:00Z")), false)
		// 周六/周日全天谷（2026-11-28 是周六）
		assert.equal(isBeijingPeakHour(new Date("2026-11-28T02:00:00Z")), false)
		assert.equal(isBeijingPeakHour(new Date("2026-11-29T07:00:00Z")), false)
	})

	it("峰谷只作用于 DeepSeek 系（isPeakValleyModelId）", () => {
		assert.equal(isPeakValleyModelId("deepseek-v4.1-flash-1017"), true)
		assert.equal(isPeakValleyModelId("deepseek/deepseek-flash"), true)
		assert.equal(isPeakValleyModelId("deepseek-v4-pro"), true)
		assert.equal(isPeakValleyModelId("hy3"), false)
		assert.equal(isPeakValleyModelId("glm-5.3"), false)
	})

	it("calculateTencentCost：谷时原价、峰时整单 ×2（输入命中/未命中/输出三档全翻倍）", () => {
		const info = { cacheReadsPrice: 0.02, cacheWritesPrice: 1, outputPrice: 4 }
		const valley = calculateTencentCost("deepseek-v4.1-flash-1017", info, 1000, 2000, 500, new Date("2026-11-23T05:00:00Z"))
		const peak = calculateTencentCost("deepseek-v4.1-flash-1017", info, 1000, 2000, 500, new Date("2026-11-23T02:00:00Z"))
		assert.equal(valley, (1000 * 0.02 + 2000 * 1 + 500 * 4) / 1_000_000)
		assert.equal(peak, valley * 2)
		// 非峰谷模型任何时刻原价
		const glm = calculateTencentCost(
			"glm-5.3",
			{ cacheReadsPrice: 2, cacheWritesPrice: 8, outputPrice: 28 },
			1000,
			0,
			0,
			new Date("2026-11-23T02:00:00Z"),
		)
		assert.equal(glm, (1000 * 2) / 1_000_000)
		// 负值/NaN 钳到非负（第三方 usage 防御，bigmodel 同款）
		assert.equal(calculateTencentCost("hy3", info, -5, -5, -5, new Date("2026-11-23T02:00:00Z")), 0)
	})
})

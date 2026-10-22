/**
 * 小米 MiMo 模型清单、请求参数映射与 provider 往返（工作流 C）。
 *
 * 事实来源：Xiaomi MiMo 官方文档（2026-10 逐页核对，不引用第三方报道）
 * - /docs/zh-CN/quick-start/summary/model —— 三款 v2.6：上下文 1M、最大输出 128K、全模态理解、深度思考
 * - /docs/zh-CN/quick-start/summary/first-api-call —— 实时 / Token Plan 入口与密钥前缀
 * - /docs/zh-CN/quick-start/usage-guide/text-generation/deep-thinking —— thinking.type 开关（无档位）
 * - /docs/zh-CN/price/pay-as-you-go —— 按量计费单价（2026-10-21 更新，与三张模型页逐项一致）
 *
 * 这里守的是四个**会静默出错**的点：
 * 1. 未知模型 id 不能被改回默认模型（否则用户选的模型静默失效）；
 * 2. `mimo` 必须能在 proto 里往返（漏 case 会被存成 DeepSeek）；
 * 3. 切换 provider 时旧 provider 的模型 id 必须被处理，不能带到新端点；
 * 4. 思考参数只能发 `thinking`，发 `reasoning_effort` 等于用户的选择没生效。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { addReasoningContent, prepareMimoMessages } from "../../src/core/api/transform/r1-format"
import {
	apiProviderDefaultModelId,
	getMimoModelInfo,
	isBuiltinModelId,
	mimoDefaultModelId,
	mimoModels,
	modelIdBelongsToKnownCatalog,
	resolveMimoModelId,
} from "../../src/shared/api"
import {
	buildMimoParams,
	isThinkingParamRejected,
	MIMO_BASE_URL,
	MIMO_TOKEN_PLAN_BASE_URL,
	mimoBaseUrlForKey,
	mimoThinkingParam,
	shouldAttachMimoReasoning,
} from "../../src/shared/mimo-request"
import { calculateMimoCost } from "../../src/shared/mimoPricing"
import { ApiProvider as ProtoApiProvider } from "../../src/shared/proto/cline/models"
import {
	convertApiConfigurationToProto,
	convertProtoToApiConfiguration,
	convertProtoToApiProvider,
} from "../../src/shared/proto-conversions/models/api-configuration-conversion"
import { normalizeApiConfiguration } from "../../webview-ui/src/components/settings/utils/providerUtils"

test("内置清单符合官方模型表：三款 v2.6 / 1M 上下文 / 128K 输出 / 全模态 / 官方单价", () => {
	// 不锁总数：官方新增 v2.7 时这条不该判红；只要求这三款必须在清单里。
	for (const id of ["mimo-v2.6-flash", "mimo-v2.6-pro", "mimo-v2.6-pro-ultraspeed"] as const) {
		assert.ok(id in mimoModels, `${id} 必须在内置清单里`)
	}
	assert.ok(mimoDefaultModelId in mimoModels)

	// 官方按量计费实时推理档单价（元 / 百万 tokens）。
	// 来源：定价页 https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go + 三张模型页，两处逐项一致。
	const officialPrices = {
		"mimo-v2.6-flash": { cacheHit: 0.02, cacheMiss: 1, output: 2 },
		"mimo-v2.6-pro": { cacheHit: 0.025, cacheMiss: 3, output: 6 },
		"mimo-v2.6-pro-ultraspeed": { cacheHit: 0.25, cacheMiss: 30, output: 60 },
	} as const

	for (const id of Object.keys(officialPrices) as Array<keyof typeof officialPrices>) {
		const info = mimoModels[id]
		assert.ok(info, `${id} 必须在清单里`)
		assert.equal(info.contextWindow, 1_000_000, `${id} 官方上下文窗口 1M`)
		assert.equal(info.maxTokens, 128_000, `${id} 官方最大输出 128K`)
		// 官方：全系支持全模态理解 + 深度思考
		assert.equal(info.supportsImages, true, `${id} 应支持图像输入`)
		assert.equal(info.supportsReasoning, true, `${id} 应支持深度思考`)
		// 响应 usage 带 prompt_tokens_details.cached_tokens，且官方列了缓存命中单价
		assert.equal(info.supportsPromptCache, true, `${id} 有缓存命中`)

		const price = officialPrices[id]
		// 输入全部按「命中 / 未命中」两档计价（与 DeepSeek 同口径），没有单独的普通输入价
		assert.equal(info.inputPrice, 0, `${id} inputPrice 恒为 0`)
		assert.equal(info.cacheReadsPrice, price.cacheHit, `${id} 输入（缓存命中）单价`)
		// cacheWritesPrice 在本项目承载「未命中输入价」，不是缓存写入费（官方写入限时免费）
		assert.equal(info.cacheWritesPrice, price.cacheMiss, `${id} 输入（缓存未命中）单价`)
		assert.equal(info.outputPrice, price.output, `${id} 输出单价`)
	}
})

/** 成本是浮点除法结果，用容差比较，避免最后一位比特的噪声把用例变脆。 */
function assertCostClose(actual: number, expected: number, message: string) {
	assert.ok(Math.abs(actual - expected) < 1e-9, `${message}：期望 ${expected}，实际 ${actual}`)
}

test("成本按官方三档单价计算（元，无峰谷倍率）", () => {
	const flash = mimoModels["mimo-v2.6-flash"]
	const pro = mimoModels["mimo-v2.6-pro"]
	const ultra = mimoModels["mimo-v2.6-pro-ultraspeed"]

	// 1M 未命中输入 + 1M 输出
	assertCostClose(calculateMimoCost(flash, 0, 1_000_000, 1_000_000), 3, "flash 1+2")
	assertCostClose(calculateMimoCost(pro, 0, 1_000_000, 1_000_000), 9, "pro 3+6")
	assertCostClose(calculateMimoCost(ultra, 0, 1_000_000, 1_000_000), 90, "ultraspeed 30+60")

	// 纯缓存命中：Pro 命中价 0.025（固定 2 位小数会被显示成 0.03，成本这里不能四舍五入）
	assertCostClose(calculateMimoCost(pro, 1_000_000, 0, 0), 0.025, "pro 纯命中")

	// 混合：500k 未命中 + 500k 命中 + 1M 输出 = 1.5 + 0.0125 + 6
	assertCostClose(calculateMimoCost(pro, 500_000, 500_000, 1_000_000), 7.5125, "pro 混合")

	// 空/异常入参不产生负数
	assert.equal(calculateMimoCost(pro, 0, 0, 0), 0)
	assert.equal(calculateMimoCost(pro, -1, -1, -1), 0, "负值钳到 0，不能算出负成本")
})

test("已知模型以官方数据为准，忽略残留配置", () => {
	const info = getMimoModelInfo(mimoDefaultModelId, {
		// 历史配置里可能残留别的 provider（或旧版本）的上限
		contextWindow: 200_000,
		maxTokens: 32_000,
		supportsImages: false,
		supportsPromptCache: false,
	})
	assert.equal(info.contextWindow, 1_000_000, "官方值优先")
	assert.equal(info.maxTokens, 128_000)
	assert.equal(info.supportsImages, true)
})

test("未知模型保留用户填写的元数据，回落到种子默认值", () => {
	const custom = getMimoModelInfo("mimo-v9-ultra", {
		contextWindow: 200_000,
		maxTokens: 16_000,
		supportsImages: false,
		supportsPromptCache: false,
	})
	assert.equal(custom.contextWindow, 200_000)
	assert.equal(custom.maxTokens, 16_000)
	assert.equal(custom.supportsPromptCache, false, "用户显式填 false 时不擅自改成 true")
	// 未提供的能力标记沿用种子
	assert.equal(custom.supportsReasoning, mimoModels[mimoDefaultModelId].supportsReasoning)
})

test("模型 id 按小写匹配：在线同步的大小写差异不该把已知模型当未知", () => {
	assert.equal(resolveMimoModelId("MiMo-V2.6-Pro"), "mimo-v2.6-pro")
	assert.equal(resolveMimoModelId(" MIMO-V2.6-FLASH "), "mimo-v2.6-flash")
	assert.equal(resolveMimoModelId("gpt-4o"), undefined)

	assert.equal(isBuiltinModelId("mimo", "MiMo-V2.6-Pro"), true, "大小写不同仍是内置模型")
	assert.equal(getMimoModelInfo("MiMo-V2.6-Pro").contextWindow, 1_000_000, "元数据不能掉到保守默认")
	assert.equal(isBuiltinModelId("deepseek", "DeepSeek-V4-Pro"), true)
})

test("思考参数只能用 thinking.type，且默认不发（官方默认开启）", () => {
	assert.deepEqual(mimoThinkingParam(undefined), {}, "未设置 → 交给官方默认（enabled）")
	assert.deepEqual(mimoThinkingParam("high"), {}, "开启 = 不覆盖默认")
	assert.deepEqual(mimoThinkingParam("none"), { thinking: { type: "disabled" } }, "关闭必须显式发 disabled")
	// 官方只有开关：low/medium 这类档位对 MiMo 没有意义，不能发 reasoning_effort
	assert.equal(JSON.stringify(mimoThinkingParam("low")).includes("reasoning_effort"), false)
})

test("thinking 参数被拒时才降级重试，其它 4xx 不被闷掉", () => {
	assert.equal(isThinkingParamRejected({ status: 400, message: `Unsupported parameter: 'thinking'` }), true)
	assert.equal(isThinkingParamRejected({ status: 422, message: "Unknown argument: thinking" }), true)
	assert.equal(isThinkingParamRejected({ status: 400, message: "Invalid API key" }), false, "鉴权错误不能当参数问题")
	assert.equal(isThinkingParamRejected({ status: 500, message: "thinking unsupported" }), false, "只有 400/422 才算")
	assert.equal(isThinkingParamRejected({ status: 400, message: `Unsupported value: 'temperature'` }), false)

	// SDK 抛的是带 status 的 Error 实例（不是普通对象），必须也能认出来
	class ApiErrorLike extends Error {
		constructor(readonly status: number) {
			super("400 Bad Request: 'thinking' is not supported by this gateway")
		}
	}
	assert.equal(isThinkingParamRejected(new ApiErrorLike(400)), true)
})

test("入口按密钥前缀选择：Token Plan 与实时 API 不是同一个基址", () => {
	assert.equal(mimoBaseUrlForKey("sk-abcdef"), MIMO_BASE_URL)
	assert.equal(mimoBaseUrlForKey("tp-abcdef"), MIMO_TOKEN_PLAN_BASE_URL)
	assert.equal(mimoBaseUrlForKey("ttp-team-key"), MIMO_TOKEN_PLAN_BASE_URL)
	assert.equal(mimoBaseUrlForKey(undefined), MIMO_BASE_URL, "空密钥不猜入口")
})

test("proto 往返：mimo ↔ MIMO，且模型信息不会丢", () => {
	const proto = convertApiConfigurationToProto({
		planModeApiProvider: "mimo",
		actModeApiProvider: "mimo",
		mimoApiKey: "test-key",
		planModeApiModelId: "mimo-v2.6-pro",
		actModeApiModelId: "mimo-v2.6-flash",
		planModeMimoModelInfo: {
			contextWindow: 1_000_000,
			maxTokens: 128_000,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoning: true,
		},
	})

	assert.equal(proto.planModeApiProvider, ProtoApiProvider.MIMO)
	assert.equal(proto.actModeApiProvider, ProtoApiProvider.MIMO)
	assert.equal(proto.mimoApiKey, "test-key", "密钥字段必须随配置一起转换（漏 case 会被悄悄丢掉）")
	assert.equal(proto.planModeMimoModelInfo?.contextWindow, 1_000_000)
	assert.equal(proto.actModeMimoModelInfo, undefined, "未设置的 act 模型信息保持未设置")

	const back = convertProtoToApiConfiguration(proto)
	assert.equal(back.planModeApiProvider, "mimo")
	assert.equal(back.actModeApiProvider, "mimo")
	assert.equal(back.mimoApiKey, "test-key", "反向转换也不能丢密钥")
	assert.equal(back.planModeApiModelId, "mimo-v2.6-pro")
	assert.equal(back.planModeMimoModelInfo?.maxTokens, 128_000)
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

	// 切到无清单的 OpenAI 兼容时，别家 id 要被识别出来并清空（否则会原样发到自定义端点）
	assert.equal(modelIdBelongsToKnownCatalog("mimo-v2.6-flash"), true)
	assert.equal(modelIdBelongsToKnownCatalog("deepseek-flash"), true)
	assert.equal(modelIdBelongsToKnownCatalog("gpt-4o"), false, "用户自己的 id 不能被抹掉")
	assert.equal(modelIdBelongsToKnownCatalog(""), false)
})

test("关闭思考时不回传历史思考（disabled 与 reasoning_content 不能同时出现）", () => {
	assert.equal(shouldAttachMimoReasoning(undefined), true, "默认开启，仍要回传")
	assert.equal(shouldAttachMimoReasoning("high"), true)
	assert.equal(shouldAttachMimoReasoning("none"), false, "显式关闭时不回传")
})

test("混排 user 消息时，带 tool_calls 的 assistant 仍回传 reasoning_content", () => {
	// 转换后的形状：user → assistant(tool_calls) → tool → user（重复读软警告等混排文本）
	const openAiMessages = [
		{ role: "user", content: "任务" },
		{
			role: "assistant",
			content: null,
			tool_calls: [{ id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } }],
		},
		{ role: "tool", tool_call_id: "call_1", content: "文件内容" },
		{ role: "user", content: "[重复读软警告] 请换一个区间" },
	] as never[]

	const originalMessages = [
		{ role: "user", content: [{ type: "text", text: "任务" }] },
		{
			role: "assistant",
			content: [
				{ type: "text", text: "读一下" },
				{ type: "thinking", thinking: "先读文件" },
			],
		},
		{ role: "user", content: [{ type: "text", text: "[重复读软警告] 请换一个区间" }] },
	] as never[]

	const withoutOption = addReasoningContent(openAiMessages, originalMessages)
	assert.equal(
		(withoutOption[1] as { reasoning_content?: string }).reasoning_content,
		undefined,
		"旧行为：混排 user 让窗口边界后移，历史工具调用整批丢思考",
	)

	const withOption = addReasoningContent(openAiMessages, originalMessages, { attachToAllToolCalls: true })
	assert.equal(
		(withOption[1] as { reasoning_content?: string }).reasoning_content,
		"先读文件",
		"MiMo：带 tool_calls 的 assistant 必须回传，否则 400",
	)
})

/**
 * 上一条测的是 `addReasoningContent(..., {attachToAllToolCalls:true})` 本身。
 * 但「MiMo 必须带这个选项」是**接线**，写在 handler 里；把接线删掉，上一条照样绿。
 * 所以这里从 `prepareMimoMessages` 这一层进——它才是 mimo.ts 真正调用的入口。
 */
test("MiMo 的消息准备必须真的带上 attachToAllToolCalls：关思考才不回传", () => {
	const openAiMessages = [
		{ role: "user", content: "任务" },
		{
			role: "assistant",
			content: null,
			tool_calls: [{ id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } }],
		},
		{ role: "tool", tool_call_id: "call_1", content: "文件内容" },
		// 混排 user：正是知识库 §18.4 记录的「窗口边界被推后、历史思考整批丢」的形态
		{ role: "user", content: "[重复读软警告] 请换一个区间" },
	] as never[]

	const originalMessages = [
		{ role: "user", content: [{ type: "text", text: "任务" }] },
		{
			role: "assistant",
			content: [
				{ type: "text", text: "读一下" },
				{ type: "thinking", thinking: "先读文件" },
			],
		},
		{ role: "user", content: [{ type: "text", text: "[重复读软警告] 请换一个区间" }] },
	] as never[]

	// 未设置 / 非 none：思考默认开启（官方默认），必须回传
	for (const effort of [undefined, "high"]) {
		const prepared = prepareMimoMessages(openAiMessages, originalMessages, effort)
		assert.equal(
			(prepared[1] as { reasoning_content?: string }).reasoning_content,
			"先读文件",
			`effort=${effort}：带 tool_calls 的 assistant 必须回传 reasoning_content`,
		)
	}

	// 显式关思考：不回传，避免 disabled 与请求体里的思考自相矛盾
	const disabled = prepareMimoMessages(openAiMessages, originalMessages, "none")
	assert.equal((disabled[1] as { reasoning_content?: string }).reasoning_content, undefined)
})

test("设置页按大小写归一 MiMo 模型 id，未知 id 保留", () => {
	const normalize = (modelId: string) =>
		normalizeApiConfiguration({ planModeApiProvider: "mimo", planModeApiModelId: modelId } as never, "plan" as never)

	const pro = normalize("MiMo-V2.6-Pro")
	assert.equal(pro.selectedModelId, "mimo-v2.6-pro", "大小写差异不能掉回默认 flash")
	assert.equal(pro.selectedModelInfo.contextWindow, 1_000_000)

	const unknown = normalize("mimo-v2.7-pro")
	assert.equal(unknown.selectedModelId, "mimo-v2.7-pro", "同步回来的新模型不能被改回默认")
	assert.equal(unknown.selectedModelInfo.contextWindow, 1_000_000, "未知 id 用种子元数据兜底")

	const empty = normalize("")
	assert.equal(empty.selectedModelId, mimoDefaultModelId, "空值才落默认")
})

test("请求体：键名必须是 max_completion_tokens / thinking.type，不能出现 reasoning_effort", () => {
	const params = buildMimoParams({
		model: "mimo-v2.6-pro",
		messages: [{ role: "user", content: "hi" }] as never[],
		maxCompletionTokens: 128_000,
		thinkingParam: { thinking: { type: "disabled" } },
		toolParams: {
			tools: [{ type: "function", function: { name: "read_file", parameters: {} } }] as never,
		},
	})

	assert.equal(params.model, "mimo-v2.6-pro")
	assert.equal(params.max_completion_tokens, 128_000, "官方键名是 max_completion_tokens")
	assert.equal("max_tokens" in params, false, "不能退回 max_tokens")
	assert.equal("temperature" in params, false, "思考开启时温度无效，不发")
	assert.equal(params.stream, true)
	assert.deepEqual(params.stream_options, { include_usage: true })
	assert.deepEqual(params.thinking, { type: "disabled" })
	assert.ok(Array.isArray(params.tools), "工具参数必须合并进请求体")
	assert.equal(JSON.stringify(params).includes("reasoning_effort"), false, "MiMo 没有档位参数")
})

test("请求体：未开启思考 / 未配置输出上限时不出现对应键", () => {
	const params = buildMimoParams({
		model: "mimo-v2.6-flash",
		messages: [{ role: "user", content: "hi" }] as never[],
		thinkingParam: {},
	})

	assert.equal("thinking" in params, false, "默认开启时不发 thinking，交给官方")
	assert.equal("max_completion_tokens" in params, false, "未配置 maxTokens 时不发空值")
	assert.equal("tools" in params, false)
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type OpenAI from "openai"

// 腾讯云 handler 级行为回归（2026-11-24，KB 08 #274/#275，tencent-provider.spec.ts 拆分批次新增）。
// 假客户端经 Reflect.set(handler, "client", fake) 注入（ensureClient 对已存在的 this.client
// 直接复用），baseUrl 私有 getter 经 Reflect.get 读取——源码不为测试开口子。
// 锁五类点：getModel 归属、双入口基址、缺 Key 各报各的错（非限流错误 withRetry 不重试）、
// 用量拆分与金额（套餐恒 0 / 按量与 calculateTencentCost 同参一致）、「窗口含输出」请求侧
// 夹紧（#274，只夹混元系三个能力位模型，纯输入窗口按目录值发——08 #82 裁定）。

import { TencentHandler } from "../../src/core/api/providers/tencent"
import { tencentTokenhubModels } from "../../src/shared/api"
import type { ClineStorageMessage } from "../../src/shared/messages/content"
import {
	calculateTencentCost,
	TENCENT_CHINA_BASE_URL,
	TENCENT_CODING_PLAN_BASE_URL,
	TENCENT_INTL_BASE_URL,
} from "../../src/shared/tencent-request"

interface ChunkShape {
	content?: string
	usage?: OpenAI.Chat.ChatCompletionChunk["usage"]
}

/** 假 OpenAI 客户端：记录 create 的请求体，按脚本吐 chunk（handler 只走 chat.completions.create）。 */
function fakeClient(chunks: ChunkShape[]) {
	const created: OpenAI.Chat.ChatCompletionCreateParamsStreaming[] = []
	const client = {
		chat: {
			completions: {
				create: async (params: OpenAI.Chat.ChatCompletionCreateParamsStreaming) => {
					created.push(params)
					return (async function* () {
						for (const chunk of chunks) {
							yield {
								choices: [{ delta: { content: chunk.content } }],
								usage: chunk.usage,
							} as OpenAI.Chat.ChatCompletionChunk
						}
					})()
				},
			},
		},
	}
	return { client: client as unknown as OpenAI, created }
}

const USER_MESSAGES = [{ role: "user", content: [{ type: "text", text: "hi" }] }] as ClineStorageMessage[]

async function collect(handler: TencentHandler, chunks: ChunkShape[], messages: ClineStorageMessage[] = USER_MESSAGES) {
	const { client, created } = fakeClient(chunks)
	Reflect.set(handler, "client", client)
	const stream: unknown[] = []
	for await (const item of handler.createMessage("sys", messages)) {
		stream.push(item)
	}
	return { stream, created }
}

interface UsageEventShape {
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheReadTokens: number
	cacheWriteTokens: number
	totalCost: number
}

function usageEvent(stream: unknown[]): UsageEventShape {
	const usage = stream.find((item) => (item as { type: string }).type === "usage") as UsageEventShape | undefined
	assert.ok(usage, "流里必须有 usage 事件（兼容端点每 chunk 重复回传累计 usage，handler 只在流结束产出一次）")
	return usage
}

/** 一轮带 usage 的脚本：1000 输入（200 命中）+ 300 输出。 */
const USAGE_CHUNKS: ChunkShape[] = [
	{ content: "答" },
	{
		usage: {
			prompt_tokens: 1000,
			completion_tokens: 300,
			prompt_tokens_details: { cached_tokens: 200 },
		} as OpenAI.Chat.ChatCompletionChunk["usage"],
	},
]

/** 大行文本：序列化后 ~400k 字符 → 粗估 ~20 万输入 token（hy3 窗口 262k，足以触发夹紧）。 */
const BIG_MESSAGES = [{ role: "user", content: [{ type: "text", text: "x".repeat(400_000) }] }] as ClineStorageMessage[]

describe("腾讯云 handler：getModel 与基址", () => {
	it("按量默认 hy3；套餐默认 tc-code-latest；套餐手填未知 id 保留", () => {
		const metered = new TencentHandler({})
		assert.equal(metered.getModel().id, "hy3")
		assert.equal(metered.getModel().info.name, "混元 Hy3")

		const plan = new TencentHandler({ billingMode: "plan" })
		assert.equal(plan.getModel().id, "tc-code-latest")
		assert.equal(plan.getModel().info.outputPrice, 0)

		const manual = new TencentHandler({ apiModelId: "glm-5", billingMode: "plan" })
		assert.equal(manual.getModel().id, "glm-5")
	})

	it("baseUrl：按量未选/china → 广州；intl → 新加坡；套餐 → lkeap（私有 getter 经 Reflect.get 读）", () => {
		assert.equal(Reflect.get(new TencentHandler({}), "baseUrl"), TENCENT_CHINA_BASE_URL)
		assert.equal(Reflect.get(new TencentHandler({ apiLine: "china" }), "baseUrl"), TENCENT_CHINA_BASE_URL)
		assert.equal(Reflect.get(new TencentHandler({ apiLine: "intl" }), "baseUrl"), TENCENT_INTL_BASE_URL)
		assert.equal(Reflect.get(new TencentHandler({ billingMode: "plan" }), "baseUrl"), TENCENT_CODING_PLAN_BASE_URL)
	})

	it("缺 Key：按量与套餐各报各的错（官方明示两把 Key 不互通，套餐不回落按量）", async () => {
		await assert.rejects(
			new TencentHandler({}).createMessage("sys", USER_MESSAGES).next(),
			/Tencent TokenHub API key is required/,
		)
		await assert.rejects(
			new TencentHandler({ billingMode: "plan" }).createMessage("sys", USER_MESSAGES).next(),
			/Coding Plan API key is required/,
		)
	})
})

describe("腾讯云 handler：用量与金额", () => {
	it("按量 hy3：usage 三档拆分（inputTokens 恒 0）+ 金额与 calculateTencentCost 同参一致", async () => {
		const { stream } = await collect(new TencentHandler({ apiModelId: "hy3" }), USAGE_CHUNKS)
		const usage = usageEvent(stream)
		assert.equal(usage.inputTokens, 0)
		assert.equal(usage.outputTokens, 300)
		assert.equal(usage.cacheReadTokens, 200, "命中 = prompt_tokens_details.cached_tokens")
		assert.equal(usage.cacheWriteTokens, 800, "未命中 = prompt_tokens − 命中")
		// hy3 非峰谷模型，金额确定：(200×0.25 + 800×1 + 300×4) / 1e6
		assert.equal(usage.totalCost, (200 * 0.25 + 800 * 1 + 300 * 4) / 1_000_000)
		assert.equal(usage.totalCost, calculateTencentCost("hy3", tencentTokenhubModels["hy3"], 200, 800, 300))
	})

	it("套餐：token 照实记录（上下文进度条要用）、金额恒 0（按请求次数计费）", async () => {
		const { stream } = await collect(new TencentHandler({ apiModelId: "tc-code-latest", billingMode: "plan" }), USAGE_CHUNKS)
		const usage = usageEvent(stream)
		assert.equal(usage.totalCost, 0)
		assert.equal(usage.outputTokens, 300)
		assert.equal(usage.cacheWriteTokens, 800)
	})
})

describe("腾讯云 handler：窗口含输出请求侧夹紧（#274）", () => {
	it("hy3 小 prompt → 目录满额 131,072（夹紧不误伤）", async () => {
		const { created } = await collect(new TencentHandler({ apiModelId: "hy3" }), [{ content: "ok" }])
		assert.equal(created[0]?.max_completion_tokens, 131_072)
	})

	it("hy3 大 prompt → 夹到窗口余量内（< 目录值且 ≥ 4096）", async () => {
		const { created } = await collect(new TencentHandler({ apiModelId: "hy3" }), [{ content: "ok" }], BIG_MESSAGES)
		const sent = created[0]?.max_completion_tokens as number
		assert.ok(sent < 131_072, `大 prompt 应夹紧（实发 ${sent}）`)
		assert.ok(sent >= 4_096, `夹紧下限 4096（实发 ${sent}）`)
	})

	it("glm-5.3（无窗口含输出能力位）任何 prompt 都按目录值发，不夹（08 #82 裁定）", async () => {
		const { created } = await collect(new TencentHandler({ apiModelId: "glm-5.3" }), [{ content: "ok" }], BIG_MESSAGES)
		assert.equal(created[0]?.max_completion_tokens, tencentTokenhubModels["glm-5.3"].maxTokens)
	})
})

describe("腾讯云 handler：思考参数实发（请求体层）", () => {
	it("混元请求实发 preserved_thinking；未设置档位不发明 reasoning_effort（#273 请求侧行为不变）", async () => {
		const { created } = await collect(new TencentHandler({ apiModelId: "hy3" }), [{ content: "ok" }])
		const params = created[0] as unknown as Record<string, unknown>
		assert.equal(params.preserved_thinking, true, "工具定义在系统提示里（XML 协议），官方要求手动开启保留式思考")
		assert.equal("reasoning_effort" in params, false)
	})

	it("第三方模型（glm-5.3）零思考参数（不发明知参数）", async () => {
		const { created } = await collect(new TencentHandler({ apiModelId: "glm-5.3" }), [{ content: "ok" }])
		const params = created[0] as unknown as Record<string, unknown>
		assert.equal("preserved_thinking" in params, false)
		assert.equal("reasoning_effort" in params, false)
		assert.equal("thinking" in params, false)
	})
})

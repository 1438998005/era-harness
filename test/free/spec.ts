// era harness：免费模型路由层单元测试（node:test 驱动，经 run.mjs 用 esbuild 打包）。
// 运行：npm run test:free
// 覆盖：两渠道（Kilo / OVHcloud；Zen 已移出池、代码休眠保留）单一优先级池的顺序 / 候选链组装（多模态过滤 + Kilo listing 门控）/
//       渠道级 collectsData 元数据 / 错误三态分类 /
//       session 铸造格式与时间戳对账（free-session 保留）/ handler 的空停切换、限流切换、
//       上下文超限不切换、全部失败的引导报错、带图只路由 vision。
import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { FreeModelHandler } from "@core/api/providers/free"
import {
	classifyFreeFailure,
	composeFinalError,
	isFreeTierGateError,
	isRegionBlockedError,
	isUserAbort,
} from "@core/api/providers/free-errors"
import { resetFreeLaneCaches } from "@core/api/providers/free-lanes"
import { decodeSessionTimestamp, mintSessionId } from "@core/api/providers/free-session"
import { buildFreeCandidateChain, LANE_META, parseKiloFreeRows } from "@shared/free-pools"
import type OpenAI from "openai"

// ---------------------------------------------------------------------------
// 测试辅助
// ---------------------------------------------------------------------------

/** 伪造 OpenAI 客户端：responses.create 与 chat.completions.create 分别可定制 */
function fakeClient(behavior: {
	chat?: (model: string) => AsyncGenerator<Record<string, unknown>> | Error
	responses?: (model: string) => AsyncGenerator<Record<string, unknown>> | Error
}): OpenAI {
	const calls: Record<string, string[]> = {}
	const client = {
		chat: {
			completions: {
				create: async (body: { model: string }) => {
					calls.chat = [...(calls.chat ?? []), body.model]
					const behaviorFor = behavior.chat
					if (!behaviorFor) {
						throw new Error("chat wire 不在本测试范围")
					}
					const result = behaviorFor(body.model)
					if (result instanceof Error) {
						throw result
					}
					return result
				},
			},
		},
		responses: {
			create: async (body: { model: string }) => {
				calls.responses = [...(calls.responses ?? []), body.model]
				const behaviorFor = behavior.responses
				if (!behaviorFor) {
					throw new Error("responses wire 不在本测试范围")
				}
				const result = behaviorFor(body.model)
				if (result instanceof Error) {
					throw result
				}
				return result
			},
		},
	}
	;(client as unknown as { __calls: Record<string, string[]> }).__calls = calls
	return client as unknown as OpenAI
}

function callsOf(client: OpenAI): Record<string, string[]> {
	return (client as unknown as { __calls: Record<string, string[]> }).__calls
}

async function* textStream(text: string): AsyncGenerator<Record<string, unknown>> {
	yield { choices: [{ delta: { content: text } }] }
}

/** 空停：流直接结束，零内容零工具调用 */
async function* emptyStream(): AsyncGenerator<Record<string, unknown>> {
	// 无 yield
}

function apiError(status: number, message: string): Error {
	const error = new Error(message) as Error & { status: number }
	error.status = status
	return error
}

const userMessages = [{ role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }]

beforeEach(() => {
	resetFreeLaneCaches()
})

// ---------------------------------------------------------------------------
// 候选链组装（单一优先级池，2026-10-19 按真实编程能力重排 17 项跨两渠道）
// ---------------------------------------------------------------------------

test("单一池：无 listing 时 16 个候选（Ling 被门控剔除）且保持编程能力优先级顺序", () => {
	const chain = buildFreeCandidateChain({ hasImages: false })
	assert.equal(chain.length, 16) // 17 项池 - Ling（无精确 ID，listing 门控剔除）
	// 渠道分布：OVH 10 + Kilo 6（Ling 剔除）；Zen 已移出池
	assert.equal(chain.filter((c) => c.lane === "zen").length, 0)
	assert.equal(chain.filter((c) => c.lane === "ovh").length, 10)
	assert.equal(chain.filter((c) => c.lane === "kilo").length, 6)
	// 编程能力优先级顺序（2026-10-19 重排；无 listing 时 Ling 剔除，其余 16 项锁定）
	assert.equal(chain[0].id, "Qwen3.8-27B")
	assert.equal(chain[1].id, "Qwen3.6-27B")
	assert.equal(chain[2].id, "poolside/laguna-s-2.1:free")
	assert.equal(chain[3].id, "thinkingmachines/inkling-small:free")
	assert.equal(chain[4].id, "dots-studio/dots-3-note-preview:free")
	assert.equal(chain[5].id, "Qwen3.5-397B-A17B")
	assert.equal(chain[6].id, "nvidia/nemotron-3-ultra-550b-a55b:free")
	assert.equal(chain[7].id, "cohere/north-mini-code:free")
	assert.equal(chain[8].id, "gpt-oss-120b")
	assert.equal(chain[9].id, "Mistral-Small-3.2-24B-Instruct-2506")
	assert.equal(chain[10].id, "gpt-oss-20b")
	assert.equal(chain[11].id, "Meta-Llama-3_3-70B-Instruct")
	assert.equal(chain[12].id, "Qwen3.5-9B")
	assert.equal(chain[13].id, "Qwen2.5-VL-72B-Instruct")
	assert.equal(chain[14].id, "Mistral-Nemo-Instruct-2407")
	assert.equal(chain[15].id, "liquid/lfm-2.5-2.6b:free")
})

test("单一池：listing 含 Ling 时补足为 17 个且插在 Inkling 之后 / Dots3-Note 之前", () => {
	// 完整免费清单：6 个已实证 Kilo 条目 + Ling
	const rows = [
		{ id: "dots-studio/dots-3-note-preview:free", contextWindow: 512_000, maxOutput: 460_800, vision: true },
		{ id: "poolside/laguna-s-2.1:free", contextWindow: 262_144, maxOutput: 32_768, vision: false },
		{ id: "thinkingmachines/inkling-small:free", contextWindow: 1_048_576, maxOutput: 262_144, vision: true },
		{ id: "nvidia/nemotron-3-ultra-550b-a55b:free", contextWindow: 1_000_000, maxOutput: 65_536, vision: false },
		{ id: "cohere/north-mini-code:free", contextWindow: 256_000, maxOutput: 64_000, vision: false },
		{ id: "liquid/lfm-2.5-2.6b:free", contextWindow: 65_536, maxOutput: 8_192, vision: false },
		{ id: "vendor/ling-3.0-flash-sante:free", contextWindow: 262_144, maxOutput: 32_768, vision: false },
	]
	const chain = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: rows })
	assert.equal(chain.length, 17)
	assert.equal(chain[4].displayName, "Ling 3.0 Flash Sante")
	assert.equal(chain[5].id, "dots-studio/dots-3-note-preview:free")
	assert.equal(chain[7].id, "nvidia/nemotron-3-ultra-550b-a55b:free")
	assert.equal(chain[8].id, "cohere/north-mini-code:free")
	assert.equal(chain[9].id, "gpt-oss-120b")
	assert.equal(chain[12].id, "Meta-Llama-3_3-70B-Instruct")
	assert.equal(chain[13].id, "Qwen3.5-9B")
	assert.equal(chain[16].id, "liquid/lfm-2.5-2.6b:free")
})

test("代理标记：原需代理候选（Muse Spark 1.3/1.2、Cat Jam）随 Zen 移出池，当前池内无 needsProxy", () => {
	const chain = buildFreeCandidateChain({ hasImages: false })
	// 需代理候选均为 Zen 侧（muse-spark/cat-jam），已随 Zen 移出池
	assert.ok(!chain.some((candidate) => candidate.needsProxy === true), "当前池内不应有 needsProxy 候选")
})

test("渠道级 collectsData 元数据：仅 Kilo 标记收集（明文收集，UI 徽标数据源）", () => {
	// 渠道事实：Kilo listing 实证 mayTrainOnYourPrompts=true（明文收集）；OVH 零保留不训练；Zen 休眠保留 false
	assert.equal(LANE_META.kilo.collectsData, true)
	assert.equal(LANE_META.ovh.collectsData, false)
	assert.equal(LANE_META.zen.collectsData, false)
	const chain = buildFreeCandidateChain({ hasImages: false })
	const kilo = chain.filter((c) => c.lane === "kilo")
	assert.ok(kilo.length > 0, "应有 Kilo 候选")
	for (const candidate of chain) {
		const collects = LANE_META[candidate.lane].collectsData
		if (candidate.lane === "kilo") {
			assert.equal(collects, true, `${candidate.displayName} 应打明文收集标记`)
		} else {
			assert.notEqual(collects, true, `${candidate.displayName} 不应打收集标记`)
		}
	}
})

test("上下文窗口：OVH 端点 / Kilo 静态实证表的权威值", () => {
	const chain = buildFreeCandidateChain({ hasImages: false })
	const byId = (id: string) => chain.find((c) => c.id === id)
	// OVH 侧以端点 /v1/models 实证为准
	assert.equal(byId("Qwen3.8-27B")?.contextWindow, 262_144)
	assert.equal(byId("Qwen3.6-27B")?.contextWindow, 262_144)
	assert.equal(byId("Qwen3.5-397B-A17B")?.contextWindow, 262_144)
	assert.equal(byId("gpt-oss-120b")?.contextWindow, 131_072)
	assert.equal(byId("Meta-Llama-3_3-70B-Instruct")?.contextWindow, 131_072)
	assert.equal(byId("Qwen2.5-VL-72B-Instruct")?.contextWindow, 32_768)
	// Kilo 侧以静态实证表为准
	assert.equal(byId("dots-studio/dots-3-note-preview:free")?.contextWindow, 512_000)
	assert.equal(byId("thinkingmachines/inkling-small:free")?.contextWindow, 1_048_576)
})

test("带图链只含 vision 候选（OVH 的 Qwen2.5-VL + Kilo 的 dots/inkling）", () => {
	const chain = buildFreeCandidateChain({ hasImages: true })
	assert.ok(chain.length > 0)
	assert.ok(chain.every((candidate) => candidate.vision))
	assert.ok(!chain.some((candidate) => candidate.id === "gpt-oss-120b"), "纯文本候选应被过滤")
	assert.ok(
		chain.some((candidate) => candidate.id === "Qwen2.5-VL-72B-Instruct"),
		"OVH vision 候选应在带图链中",
	)
	assert.ok(chain.some((candidate) => candidate.id === "dots-studio/dots-3-note-preview:free"))
	assert.ok(chain.some((candidate) => candidate.id === "thinkingmachines/inkling-small:free"))
})

test("Kilo listing 门控：不在免费清单的 Kilo 条目被剔除", () => {
	const rows = [{ id: "vendor/not-in-pool:free", contextWindow: 1_000_000, maxOutput: 65_536, vision: true }]
	const chain = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: rows })
	assert.ok(!chain.some((candidate) => candidate.lane === "kilo"), "受限清单下不应有任何 Kilo 候选")
	// OVH 不受 listing 门控影响，始终在链；Zen 已移出池
	assert.ok(chain.some((candidate) => candidate.lane === "ovh"))
	assert.ok(!chain.some((candidate) => candidate.lane === "zen"))
})

test("Kilo listing 拉取失败时只放行已实证精确 ID 的条目", () => {
	const chain = buildFreeCandidateChain({ hasImages: false })
	const kilo = chain.filter((candidate) => candidate.lane === "kilo")
	assert.equal(kilo.length, 6, "6 个已实证 Kilo 条目应放行，Ling（无精确 ID）应剔除")
	assert.ok(!kilo.some((candidate) => candidate.displayName === "Ling 3.0 Flash Sante"))
})

test("Kilo listingMatch 条目从 listing 解析真实 ID 与元数据", () => {
	const rows = [{ id: "vendor/ling-3.0-flash-sante:free", contextWindow: 262_144, maxOutput: 32_768, vision: false }]
	const chain = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: rows })
	const ling = chain.find((candidate) => candidate.displayName === "Ling 3.0 Flash Sante")
	assert.ok(ling, "Ling 条目应被 listing 解析出来")
	assert.equal(ling?.id, "vendor/ling-3.0-flash-sante:free")
	assert.equal(ling?.contextWindow, 262_144)
})

test("parseKiloFreeRows: isFree 过滤 / vision / 缺省值", () => {
	const rows = parseKiloFreeRows({
		data: [
			{ id: "a:free", isFree: true, context_length: 200_000, architecture: { input_modalities: ["text", "image"] } },
			{ id: "b:free", isFree: true, top_provider: { context_length: 128_000, max_completion_tokens: 8_192 } },
			{ id: "c", isFree: false, context_length: 999_999 },
			{ id: "", isFree: true },
		],
	})
	assert.equal(rows.length, 2)
	assert.deepEqual(rows[0], { id: "a:free", contextWindow: 200_000, maxOutput: 32_768, vision: true })
	assert.deepEqual(rows[1], { id: "b:free", contextWindow: 128_000, maxOutput: 8_192, vision: false })
	assert.deepEqual(parseKiloFreeRows({}), [])
	assert.deepEqual(parseKiloFreeRows(null), [])
})

// ---------------------------------------------------------------------------
// 错误三态分类
// ---------------------------------------------------------------------------

test("classifyFreeFailure: 上下文超限 → context-exceeded（不切换候选）", () => {
	assert.equal(classifyFreeFailure(apiError(400, "context length exceeded")), "context-exceeded")
})

test("classifyFreeFailure: 用户中止 → fatal", () => {
	const abortError = new Error("The operation was aborted")
	abortError.name = "AbortError"
	assert.equal(classifyFreeFailure(abortError), "fatal")
	assert.ok(isUserAbort(abortError))
	const sdkAbort = new Error("aborted")
	sdkAbort.name = "APIUserAbortError"
	assert.equal(classifyFreeFailure(sdkAbort), "fatal")
})

test("classifyFreeFailure: 限流/区域/免费门/5xx/传输 → switchable", () => {
	assert.equal(classifyFreeFailure(apiError(429, "rate limit")), "switchable")
	assert.equal(classifyFreeFailure(apiError(429, "API rate limit exceeded")), "switchable") // OVH 匿名 2rpm 的错误体
	assert.equal(classifyFreeFailure(apiError(403, "RegionError: not available in your country")), "switchable")
	assert.equal(classifyFreeFailure(apiError(403, "FreeTierError")), "switchable")
	assert.equal(classifyFreeFailure(apiError(401, "INVALID_TOKEN")), "switchable")
	assert.equal(classifyFreeFailure(apiError(500, "internal")), "switchable")
	assert.equal(classifyFreeFailure(new TypeError("fetch failed")), "switchable")
})

test("isFreeTierGateError / isRegionBlockedError 识别", () => {
	assert.ok(isFreeTierGateError(apiError(403, "FreeTierError: free tier can only be used from within OpenCode")))
	assert.ok(!isFreeTierGateError(apiError(429, "rate limit")))
	assert.ok(isRegionBlockedError(apiError(403, "This model is not available in your country")))
	assert.ok(!isRegionBlockedError(apiError(403, "FreeTierError")))
})

test("composeFinalError 含候选数与 DeepSeek 引导", () => {
	const message = composeFinalError(apiError(429, "rate limit"), 3).message
	assert.ok(message.includes("3 个候选"))
	assert.ok(message.includes("DeepSeek"))
})

// ---------------------------------------------------------------------------
// session 铸造
// ---------------------------------------------------------------------------

test("mintSessionId: 形状合规且时间戳低 36 位可 roundtrip", () => {
	const before = Date.now()
	const session = mintSessionId()
	assert.match(session, /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
	const decoded = decodeSessionTimestamp(session)
	assert.ok(decoded !== undefined, "时间戳应可解码")
	// 铸造算法丢弃最高字节，只能对账低 36 位（允许跨毫秒 tick）
	const expectedLow36 = before % 2 ** 36
	assert.ok(Math.abs((decoded as number) - expectedLow36) <= 2, `低 36 位时间戳偏差过大: ${decoded} vs ${expectedLow36}`)
})

test("mintSessionId: 连续铸造不重复", () => {
	const seen = new Set<string>()
	for (let i = 0; i < 1_000; i++) {
		seen.add(mintSessionId())
	}
	assert.equal(seen.size, 1_000)
})

// ---------------------------------------------------------------------------
// handler 候选循环（注入伪造客户端；kiloFreeRows=[] 时链上 10 OVH，Kilo 全部门控剔除；Zen 已移出池）
// ---------------------------------------------------------------------------

test("空停切换：OVH 首选 Qwen3.8 空停 → Qwen3.6 命中", async () => {
	const ovh = fakeClient({
		chat: (model) => (model === "Qwen3.6-27B" ? textStream("OK") : emptyStream()),
	})
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	const chunks: string[] = []
	for await (const chunk of handler.createMessage("sys", userMessages)) {
		if (chunk.type === "text") {
			chunks.push(chunk.text)
		}
	}

	assert.equal(chunks.join(""), "OK")
	assert.equal(handler.getModel().id, "Qwen3.6-27B")
	assert.deepEqual(callsOf(ovh).chat, ["Qwen3.8-27B", "Qwen3.6-27B"])
})

test("限流切换：OVH 429 → 下一 OVH 候选命中", async () => {
	const ovh = fakeClient({
		chat: (model) => (model === "Qwen3.6-27B" ? textStream("OK") : apiError(429, "API rate limit exceeded")),
	})
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	const chunks: string[] = []
	for await (const chunk of handler.createMessage("sys", userMessages)) {
		if (chunk.type === "text") {
			chunks.push(chunk.text)
		}
	}

	assert.equal(chunks.join(""), "OK")
	assert.equal(handler.getModel().id, "Qwen3.6-27B")
	assert.deepEqual(callsOf(ovh).chat, ["Qwen3.8-27B", "Qwen3.6-27B"])
})

test("上下文超限：不切换候选，原样上抛（交 Task 层截断重试）", async () => {
	const ovh = fakeClient({ chat: () => apiError(400, "maximum context length exceeded") })
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	await assert.rejects(() => handler.createMessage("sys", userMessages).next(), /context length/)
	assert.deepEqual(callsOf(ovh).chat, ["Qwen3.8-27B"], "上下文超限不应继续烧后续候选")
})

test("全部候选失败：抛错含候选数与 DeepSeek 引导（kiloFreeRows=[] 时链上 10 个 OVH 候选）", async () => {
	const ovh = fakeClient({ chat: () => apiError(500, "upstream broke") })
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	await assert.rejects(() => handler.createMessage("sys", userMessages).next(), /已尝试 10 个候选/)
})

test("用户中止：候选失败后不得再烧下一个（停止键不能被忽略）", async () => {
	let handler: FreeModelHandler | undefined
	const ovh = fakeClient({
		chat: () => {
			// 模拟「第一候选失败的同一瞬间用户按了停止」：
			// 以前的实现只看 error.name，这里抛的是普通 Error，会被当成 switchable 继续 failover
			handler?.abort()
			return apiError(500, "boom")
		},
	})
	handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	// 上抛的是当时真正的错误（boom）；关键是「不再发起下一个请求」
	await assert.rejects(() => handler!.createMessage("sys", userMessages).next(), /boom/)
	assert.deepEqual(callsOf(ovh).chat, ["Qwen3.8-27B"], "中止后不应再发起任何请求")
})

test("已吐内容后失败：报错而不是拼上另一个模型的开头", async () => {
	async function* failAfterText(): AsyncGenerator<Record<string, unknown>> {
		yield { choices: [{ delta: { content: "半句话" } }] }
		throw apiError(500, "stream broke midway")
	}
	const ovh = fakeClient({ chat: () => failAfterText() })
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	const chunks: string[] = []
	await assert.rejects(async () => {
		for await (const chunk of handler.createMessage("sys", userMessages)) {
			if (chunk.type === "text") {
				chunks.push(chunk.text)
			}
		}
	}, /stream broke midway/)
	assert.equal(chunks.join(""), "半句话", "前半句应该已经吐给上层")
	assert.deepEqual(callsOf(ovh).chat, ["Qwen3.8-27B"], "不能换模型接着写（会拼成两段回复）")
})

test("带图请求：只路由 vision 候选，落 vision 链首选 Inkling Small（重排后）", async () => {
	const ovh = fakeClient({ chat: () => apiError(429, "rate limit") })
	const kilo = fakeClient({ chat: () => textStream("OK") })
	const handler = new FreeModelHandler({
		ovhClient: ovh,
		kiloClient: kilo,
		kiloFreeRows: [
			{ id: "dots-studio/dots-3-note-preview:free", contextWindow: 512_000, maxOutput: 460_800, vision: true },
			{ id: "thinkingmachines/inkling-small:free", contextWindow: 1_048_576, maxOutput: 262_144, vision: true },
		],
	})
	const imageMessages = [
		{
			role: "user" as const,
			content: [
				{ type: "text" as const, text: "describe" },
				{ type: "image" as const, source: { type: "base64" as const, media_type: "image/png", data: "AAAA" } },
			],
		},
	]

	const chunks: string[] = []
	for await (const chunk of handler.createMessage("sys", imageMessages)) {
		if (chunk.type === "text") {
			chunks.push(chunk.text)
		}
	}

	assert.equal(chunks.join(""), "OK")
	assert.equal(handler.getModel().id, "thinkingmachines/inkling-small:free")
	// 重排后 vision 链顺序：inkling(kilo #4) → dots-3-note(kilo #14) → Qwen2.5-VL(ovh #15)；inkling 命中即返回
	assert.deepEqual(callsOf(kilo).chat, ["thinkingmachines/inkling-small:free"])
	assert.equal(callsOf(ovh).chat, undefined, "inkling 先命中，OVH 不应被调")
})

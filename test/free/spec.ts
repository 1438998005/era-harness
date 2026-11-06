// era harness：免费模型路由层单元测试（node:test 驱动，经 run.mjs 用 esbuild 打包）。
// 运行：npm run test:free
// 覆盖：两渠道（Kilo / OVHcloud；Zen 已移出池、代码休眠保留）单一优先级池的顺序 / 候选链组装（多模态过滤 + Kilo listing 门控）/
//       渠道级 collectsData 元数据 / 错误三态分类 /
//       session 铸造格式与时间戳对账（free-session 保留）/ handler 的空停切换、限流切换、
//       上下文超限不切换、全部失败的引导报错、带图只路由 vision。
import assert from "node:assert/strict"
import fs from "node:fs"
import { beforeEach, test } from "node:test"
import { FreeModelHandler } from "@core/api/providers/free"
import {
	classifyFreeFailure,
	composeFinalError,
	composePinnedError,
	isFreeTierGateError,
	isRegionBlockedError,
	isUserAbort,
	stripPinnedRecoveryMarker,
	withPinnedRecoveryMarker,
} from "@core/api/providers/free-errors"
import { resetFreeLaneCaches } from "@core/api/providers/free-lanes"
import { decodeSessionTimestamp, mintSessionId } from "@core/api/providers/free-session"
import {
	buildFreeCandidateChain,
	describePinnedGateConflict,
	FREE_PINNED_RECOVERY_MARKER,
	FREE_POOL,
	FREE_POOL_MIN_VISIBLE_ROWS,
	LANE_META,
	parseKiloFreeRows,
} from "@shared/free-pools"
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

/** review #242：中途断流——先吐一段内容，再抛错（handler 必须原样上抛、不再切候选）。 */
async function* partialThenError(text: string, error: Error): AsyncGenerator<Record<string, unknown>> {
	yield { choices: [{ delta: { content: text } }] }
	throw error
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
// KB 08 #241 定稿池序（**单一常量表**）：本文件里任何顺序/位置断言都必须从它派生，
// ⛔ 禁止再抄第二份顺序（§4.25 结构性要求）。前 14 项 = #229 旧序剔除 NVIDIA 四项后的相对序，
// 逐字不动；后 4 项 = NVIDIA 家族按三源重排，Super VL 末位隔离。
// ---------------------------------------------------------------------------

const EXPECTED_POOL_ORDER = [
	"reflection/beam-free",
	"Qwen3.8-27B",
	"Qwen3.6-27B",
	"stealth/glyph-cluster",
	"stealth/crouton-alpha",
	"dots-studio/dots-3-note-preview:free",
	"Qwen3.5-397B-A17B",
	"cohere/north-mini-code:free",
	"gpt-oss-120b",
	"Mistral-Small-3.2-24B-Instruct-2506",
	"gpt-oss-20b",
	"Meta-Llama-3_3-70B-Instruct",
	"Qwen3.5-9B",
	"Qwen2.5-VL-72B-Instruct",
	"nvidia/nemotron-3-ultra-550b-a55b:free",
	"nvidia/nemotron-3.5-lightning:free",
	"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
	"nvidia/nemotron-3.5-super-vl:free",
] as const

/** #229 旧序（18 项），只用于钉住「其余 14 项相对顺序完全不动」这条不变量。 */
const POOL_ORDER_BEFORE_241 = [
	"nvidia/nemotron-3.5-super-vl:free",
	"reflection/beam-free",
	"Qwen3.8-27B",
	"nvidia/nemotron-3-ultra-550b-a55b:free",
	"Qwen3.6-27B",
	"stealth/glyph-cluster",
	"stealth/crouton-alpha",
	"dots-studio/dots-3-note-preview:free",
	"Qwen3.5-397B-A17B",
	"cohere/north-mini-code:free",
	"nvidia/nemotron-3.5-lightning:free",
	"gpt-oss-120b",
	"Mistral-Small-3.2-24B-Instruct-2506",
	"gpt-oss-20b",
	"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
	"Meta-Llama-3_3-70B-Instruct",
	"Qwen3.5-9B",
	"Qwen2.5-VL-72B-Instruct",
] as const

/** 从「期望顺序」派生，不在测试里再抄一份 vision 名单。 */
const expectedVisionOrder = (ids: readonly string[]) =>
	buildFreeCandidateChain({ hasImages: false })
		.filter((c) => c.vision && ids.includes(c.id))
		.map((c) => c.id)

// ---------------------------------------------------------------------------
// 候选链组装（KB 08 #241 定稿 18 项，三源并重排序口径）
// ---------------------------------------------------------------------------

test("单一池：无 listing 时 18 个候选（全部精确 ID）且逐字等于 #241 定稿序", () => {
	const chain = buildFreeCandidateChain({ hasImages: false })
	assert.equal(chain.length, 18) // OVH 9 + Kilo 9（全部精确 ID，无 listingMatch 条目）
	// 渠道分布：OVH 9 + Kilo 9；Zen 已移出池
	assert.equal(chain.filter((c) => c.lane === "zen").length, 0)
	assert.equal(chain.filter((c) => c.lane === "ovh").length, 9)
	assert.equal(chain.filter((c) => c.lane === "kilo").length, 9)
	assert.deepEqual(
		chain.map((c) => c.id),
		EXPECTED_POOL_ORDER,
	)
	// Laguna S 2.1 已移除：Kilo listing 整行消失（2026-11-04 实证，连付费行都不剩）
	assert.ok(!chain.some((c) => c.id === "poolside/laguna-s-2.1:free"), "已死的 Laguna 不应留在池中")
})

test("#241 结构性：FREE_POOL 与单一常量表一致，NVIDIA 四项恰在 #15–18 且 Super VL 末位", () => {
	assert.deepEqual(
		FREE_POOL.map((c) => c.id),
		EXPECTED_POOL_ORDER,
	)
	assert.equal(new Set(EXPECTED_POOL_ORDER).size, 18, "期望表自身不得有重复/漏项")
	assert.deepEqual(
		FREE_POOL.slice(14).map((c) => c.id),
		EXPECTED_POOL_ORDER.slice(14),
		"NVIDIA 四项：Ultra → Lightning → Nano Omni → Super VL",
	)
	assert.equal(FREE_POOL[17].id, "nvidia/nemotron-3.5-super-vl:free", "唯一有本地实测且实测失败 → 末位隔离")
	// 其余 14 项相对顺序完全不动：从 #229 旧序剔除 NVIDIA 四项后逐字比较
	const legacyNonNvidia = POOL_ORDER_BEFORE_241.filter((id) => !id.startsWith("nvidia/"))
	assert.deepEqual(EXPECTED_POOL_ORDER.slice(0, 14), legacyNonNvidia)
	assert.deepEqual(
		FREE_POOL.slice(0, 14).map((c) => c.id),
		legacyNonNvidia,
	)
})

test("#241 元测试：池首窗口与设置页同源，带图链不单独定序、候选链签名未变", () => {
	// 池首由 Super VL(1_000_000) 换成 Beam 1.0(1_048_576)，设置页必须仍从 FREE_POOL[0] 派生，不能写死旧值
	assert.equal(FREE_POOL[0].id, "reflection/beam-free")
	assert.equal(FREE_POOL[0].contextWindow, 1_048_576)
	const providerUtils = fs.readFileSync("webview-ui/src/components/settings/utils/providerUtils.ts", "utf8")
	// KB 08 #242：自动路由仍从 FREE_POOL[0] 派生；指定模型时改取该候选（按真实 ID 查池）
	assert.match(providerUtils, /\(windowCandidate \?\? FREE_POOL\[0\]\)\?\.contextWindow/, "窗口从池定义派生，不写死")
	assert.match(providerUtils, /FREE_POOL\.find\(\(c\) => c\.id === pinnedId\)/, "pinned 按真实上游 ID 查池，不是下标")
	const freeBranch = providerUtils.slice(providerUtils.indexOf('case "free":'), providerUtils.indexOf('case "deepseek":'))
	assert.doesNotMatch(freeBranch, /contextWindow:\s*1_000_000/, "不得把旧池首的窗口写死回 free 分支")
	const pools = fs.readFileSync("src/shared/free-pools.ts", "utf8")
	// KB 08 #242 后带图链仍是 filter(vision)，只是从「直接 return」改成先赋给 gated，
	// 再在末尾按 pinned 钳制——顺序不能反，否则指定模型会绕过 vision / 隐私 / listing 门。
	assert.match(pools, /chain\.filter\(\(candidate\) => candidate\.vision\)/, "带图链仍是 filter(vision)")
	assert.match(pools, /gated\.filter\(\(candidate\) => candidate\.id === pinned\)/, "钳制按真实 ID 落在门控之后")
	const chainCode = stripComments(pools)
	assert.ok(
		chainCode.indexOf("chain.filter((candidate) => candidate.vision)") <
			chainCode.indexOf("gated.filter((candidate) => candidate.id === pinned)"),
		"pinned 钳制必须在四道门之后",
	)
	assert.match(pools, /export function buildFreeCandidateChain\(options: FreeChainOptions\)/, "候选链签名未变")
	assert.equal(pools.includes("visionOrder"), false, "不得新增带图链专属顺序")
})

// 防同类回归（KB 08 #229）：2026-11-04 深夜全渠道存活复核的 6 个死项与 2 个虚拟路由器，
// 任何一个重新出现在 FREE_POOL 都应让本测试变红。清单判据见 KB 07 §7.8/§7.9。
test("存活复核回归：6 个已失效候选与 2 个虚拟路由器 ID 均不入静态池", () => {
	const ids = FREE_POOL.map((c) => c.id)
	const dead = [
		"thinkingmachines/inkling:free", // Kilo 免费行整行消失（仅剩付费行）
		"recursive/flint-v1.0:free",
		"xingchen-agi/xing4.0-29b-a4b:free",
		"google/gemma-4-31b-it:free",
		"liquid/lfm-2.5-2.6b:free",
		"Mistral-Nemo-Instruct-2407", // OVH 目录仍列，但 POST 稳定 404 no Route matched
	]
	for (const id of dead) {
		assert.ok(!ids.includes(id), `${id} 已判失效，不应回到静态池（目录/付费行不能补位）`)
	}
	const routers = [
		"kilo-auto/free", // Kilo Auto Model Free 档：上游轮换免费模型
		"openrouter/free", // OpenRouter Free Models Router：上游随机选免费模型
	]
	for (const id of routers) {
		assert.ok(!ids.includes(id), `${id} 是上游黑盒虚拟路由器，入池会破坏能力排序/vision 过滤/审计口径`)
	}
	assert.equal(new Set(ids).size, ids.length, "池内 ID 不应重复")
})

test("单一池：listing 行元数据覆盖静态表（exact-ID 解析）", () => {
	// 只给 dots 一行（其余 Kilo 条目不在清单 → 门控剔除），窗口/上限/vision 均以 listing 为准
	const rows = [{ id: "dots-studio/dots-3-note-preview:free", contextWindow: 999_000, maxOutput: 8_192, vision: false }]
	const chain = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: rows })
	assert.equal(chain.length, 10) // 9 OVH + 1 Kilo（其余 8 个 Kilo 条目不在清单 → 门控剔除）
	const dots = chain.find((candidate) => candidate.id === "dots-studio/dots-3-note-preview:free")
	assert.ok(dots, "dots 条目应被 listing 解析出来")
	assert.equal(dots?.contextWindow, 999_000)
	assert.equal(dots?.maxOutput, 8_192)
	assert.equal(dots?.vision, false)
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
	// Kilo 侧以静态实证表为准（2026-11-05 listing 复核；含本轮新增的 Crouton/Lightning/Nano Omni）
	assert.equal(byId("nvidia/nemotron-3.5-super-vl:free")?.contextWindow, 1_000_000)
	assert.equal(byId("reflection/beam-free")?.contextWindow, 1_048_576)
	assert.equal(byId("stealth/glyph-cluster")?.contextWindow, 256_000)
	assert.equal(byId("stealth/crouton-alpha")?.contextWindow, 1_048_576)
	assert.equal(byId("dots-studio/dots-3-note-preview:free")?.contextWindow, 512_000)
	assert.equal(byId("nvidia/nemotron-3.5-lightning:free")?.contextWindow, 1_000_000)
	assert.equal(byId("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")?.contextWindow, 256_000)
	// 新增行的 maxOutput 也按 listing 登记（Crouton 的极大值由 handler 截断兜底）
	assert.equal(byId("stealth/crouton-alpha")?.maxOutput, 943_718)
	assert.equal(byId("nvidia/nemotron-3.5-lightning:free")?.maxOutput, 65_536)
	assert.equal(byId("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")?.maxOutput, 65_536)
})

test("带图链只含 vision 候选，首位 stealth/crouton-alpha（#241：不单独定序，由 filter(vision) 自然得出）", () => {
	const chain = buildFreeCandidateChain({ hasImages: true })
	assert.equal(chain.length, 5, "池内 vision 候选恰好 5 个")
	assert.ok(chain.every((candidate) => candidate.vision))
	assert.ok(!chain.some((candidate) => candidate.id === "gpt-oss-120b"), "纯文本候选应被过滤")
	// 期望顺序从单一常量表派生，而不是再抄一份 vision 名单
	assert.deepEqual(
		chain.map((c) => c.id),
		expectedVisionOrder(EXPECTED_POOL_ORDER),
	)
	assert.equal(chain[0].id, "stealth/crouton-alpha", "用户明确裁定带图链首位合理")
	assert.equal(chain[4].id, "nvidia/nemotron-3.5-super-vl:free", "Super VL 末位隔离，不再是带图链首选")
	// Beam/Glyph/Lightning 免费行仅 text → 不在带图链
	assert.ok(!chain.some((candidate) => candidate.id === "reflection/beam-free"), "Beam 仅 text 不应进带图链")
	assert.ok(!chain.some((candidate) => candidate.id === "stealth/glyph-cluster"), "Glyph 仅 text 不应进带图链")
	assert.ok(!chain.some((candidate) => candidate.id === "nvidia/nemotron-3.5-lightning:free"), "Lightning 仅 text 不应进带图链")
})

test("Kilo listing 门控：不在免费清单的 Kilo 条目被剔除", () => {
	const rows = [{ id: "vendor/not-in-pool:free", contextWindow: 1_000_000, maxOutput: 65_536, vision: true }]
	const chain = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: rows })
	assert.ok(!chain.some((candidate) => candidate.lane === "kilo"), "受限清单下不应有任何 Kilo 候选")
	// OVH 不受 listing 门控影响，始终在链；Zen 已移出池
	assert.ok(chain.some((candidate) => candidate.lane === "ovh"))
	assert.ok(!chain.some((candidate) => candidate.lane === "zen"))
})

test("隐私开关：excludeCollecting 剔除收集渠道（Kilo），仅剩 OVH 且优先级不变", () => {
	const chain = buildFreeCandidateChain({ hasImages: false, excludeCollecting: true })
	assert.equal(chain.length, 9) // 2026-11-05：OVH 由 10 项减为 9 项（Nemo 实测 404 已移除）
	assert.ok(
		chain.every((candidate) => candidate.lane === "ovh"),
		"链上应只剩 OVH 候选",
	)
	// 即使 listing 给了 Kilo 免费行，收集渠道也必须被剔除（隐私开关先于 listing 门控）
	const rows = [{ id: "dots-studio/dots-3-note-preview:free", contextWindow: 512_000, maxOutput: 460_800, vision: true }]
	const chainWithRows = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: rows, excludeCollecting: true })
	assert.ok(!chainWithRows.some((candidate) => candidate.lane === "kilo"))
	// OVH 内部顺序保持池序
	assert.equal(chain[0].id, "Qwen3.8-27B")
	assert.equal(chain[8].id, "Qwen2.5-VL-72B-Instruct")
})

test("隐私开关 + 带图：vision 候选仅剩 Qwen2.5-VL（OVH 侧唯一 vision）", () => {
	const chain = buildFreeCandidateChain({ hasImages: true, excludeCollecting: true })
	assert.equal(chain.length, 1)
	assert.equal(chain[0].id, "Qwen2.5-VL-72B-Instruct")
})

test("Kilo listing 拉取失败时只放行已实证精确 ID 的条目", () => {
	const chain = buildFreeCandidateChain({ hasImages: false })
	const kilo = chain.filter((candidate) => candidate.lane === "kilo")
	assert.equal(kilo.length, 9, "9 个已实证 Kilo 条目应全部放行（池内已无待解析条目）")
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
// handler 候选循环（注入伪造客户端；kiloFreeRows=[] 时链上 9 OVH，Kilo 全部门控剔除；Zen 已移出池）
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

test("全部候选失败：抛错含候选数与 DeepSeek 引导（kiloFreeRows=[] 时链上 9 个 OVH 候选）", async () => {
	const ovh = fakeClient({ chat: () => apiError(500, "upstream broke") })
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	await assert.rejects(() => handler.createMessage("sys", userMessages).next(), /已尝试 9 个候选/)
})

test("隐私开关：不拉 Kilo listing、Kilo 零调用，OVH 全挂后只报 9 个候选", async () => {
	// kiloFreeRows 不传：正常路径会发 listing 网络请求；开关开启时必须跳过（若回归为发起请求，
	// 本测试会打到真实网络并可能让 Kilo 候选进链，下面的断言即失败）
	const ovh = fakeClient({ chat: () => apiError(429, "API rate limit exceeded") })
	const kilo = fakeClient({ chat: () => textStream("OK") })
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloClient: kilo, excludeCollecting: true })

	await assert.rejects(() => handler.createMessage("sys", userMessages).next(), /已尝试 9 个候选/)
	assert.equal(callsOf(kilo).chat, undefined, "隐私开关下 Kilo 不应被调用")
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

test("带图请求：listing 只给 dots 行时落 dots（其余 Kilo vision 不在清单 → 门控剔除，dots 仍是链首 vision）", async () => {
	const ovh = fakeClient({ chat: () => apiError(429, "rate limit") })
	const kilo = fakeClient({ chat: () => textStream("OK") })
	const handler = new FreeModelHandler({
		ovhClient: ovh,
		kiloClient: kilo,
		kiloFreeRows: [{ id: "dots-studio/dots-3-note-preview:free", contextWindow: 512_000, maxOutput: 460_800, vision: true }],
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
	assert.equal(handler.getModel().id, "dots-studio/dots-3-note-preview:free")
	// vision 链顺序（该 listing 下）：dots-3-note（#241 池位 #6）→ Qwen2.5-VL（OVH 侧 vision）；dots 命中即返回
	assert.deepEqual(callsOf(kilo).chat, ["dots-studio/dots-3-note-preview:free"])
	assert.equal(callsOf(ovh).chat, undefined, "dots 先命中，OVH 不应被调")
})

// ---------------------------------------------------------------------------
// KB 08 #242：指定模型（pinned）行为 / 结构性 / 元测试（KB 04 §4.25 三层）
// ---------------------------------------------------------------------------

/** 源码断言前剥注释：注释里常写「不要这么写」的反例（KB 08 同类型排查）。 */
function stripComments(code: string): string {
	return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

test("#242 buildFreeCandidateChain：pinned 后链长恰为 1、ID 相等；存真实 ID 而非下标", () => {
	for (const id of [EXPECTED_POOL_ORDER[0], EXPECTED_POOL_ORDER[9], EXPECTED_POOL_ORDER[17]]) {
		const chain = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: undefined, pinnedModelId: id })
		assert.equal(chain.length, 1, `${id} 指定后链长应为 1`)
		assert.equal(chain[0].id, id)
		// #241 池序变更后不串位：取的是 FREE_POOL 里按 ID 找到的同一个对象，与位次无关
		assert.equal(chain[0].displayName, FREE_POOL.find((c) => c.id === id)?.displayName)
		assert.equal(chain[0].contextWindow, FREE_POOL.find((c) => c.id === id)?.contextWindow)
	}
	// 未指定 = 自动路由，行为零变化
	assert.deepEqual(
		buildFreeCandidateChain({ hasImages: false, kiloFreeRows: undefined }).map((c) => c.id),
		EXPECTED_POOL_ORDER,
	)
})

test("#242 四道门：隐私 / vision / Kilo listing / 未知 ID 都给链空 + 专门归因", () => {
	const kilo = FREE_POOL.find((c) => c.lane === "kilo" && !c.vision)
	const nonVision = FREE_POOL.find((c) => c.lane === "ovh" && !c.vision)
	assert.ok(kilo && nonVision, "测试样本必须存在于池内")

	const privacy = { hasImages: false, excludeCollecting: true, kiloFreeRows: [] }
	assert.equal(buildFreeCandidateChain({ ...privacy, pinnedModelId: kilo.id }).length, 0)
	assert.match(describePinnedGateConflict(kilo.id, privacy) ?? "", /收集提示词/)

	const images = { hasImages: true, excludeCollecting: false, kiloFreeRows: undefined }
	assert.equal(buildFreeCandidateChain({ ...images, pinnedModelId: nonVision.id }).length, 0)
	assert.match(describePinnedGateConflict(nonVision.id, images) ?? "", /不支持图片/)

	const listing = { hasImages: false, excludeCollecting: false, kiloFreeRows: [] }
	assert.equal(buildFreeCandidateChain({ ...listing, pinnedModelId: kilo.id }).length, 0)
	assert.match(describePinnedGateConflict(kilo.id, listing) ?? "", /Kilo 免费清单/)
	assert.match(describePinnedGateConflict("no-such-model-id", listing) ?? "", /不在免费模型池中/)
	// 门控都通过时不该误报（OVH 非 vision 项在纯文本请求下可用）
	assert.equal(describePinnedGateConflict(nonVision.id, listing), undefined)
})

test("#242 handler：pinned + 429 只调一次、不切换，抛带恢复标记的专门错误", async () => {
	const target = FREE_POOL.find((c) => c.lane === "ovh" && !c.vision)
	assert.ok(target)
	const ovh = fakeClient({ chat: () => apiError(429, "rate limit") })
	const kilo = fakeClient({ chat: () => textStream("SHOULD NOT SWITCH") })
	const handler = new FreeModelHandler({
		ovhClient: ovh,
		kiloClient: kilo,
		kiloFreeRows: [],
		pinnedModelId: target.id,
	})
	await assert.rejects(
		async () => {
			for await (const chunk of handler.createMessage("sys", userMessages)) {
				void chunk
			}
		},
		(error: unknown) => {
			const message = (error as Error).message
			assert.match(message, /指定的免费模型/)
			assert.ok(message.includes(FREE_PINNED_RECOVERY_MARKER), "错误须带恢复标记")
			assert.match(message, /没有下一个模型可切换/, "必须写清链长=1 的因果")
			assert.doesNotMatch(message, /已尝试 \d+ 个候选/, "⛔ 不得落到自动路由的「已尝试 N 个候选」文案")
			assert.equal(stripPinnedRecoveryMarker(message).includes(FREE_PINNED_RECOVERY_MARKER), false)
			return true
		},
	)
	assert.deepEqual(callsOf(ovh).chat, [target.id], "只请求指定模型一次")
	assert.equal(callsOf(kilo).chat, undefined, "pinned 下不得切到 Kilo 候选")
	assert.equal(handler.getModel().id, target.id, "getModel 须指向指定候选的窗口")
})

test("#242 handler：pinned 被隐私门排除时不发任何请求，抛专门报错", async () => {
	const kilo = FREE_POOL.find((c) => c.lane === "kilo" && !c.vision)
	assert.ok(kilo)
	const ovh = fakeClient({ chat: () => textStream("SHOULD NOT RUN") })
	const kiloClient = fakeClient({ chat: () => textStream("SHOULD NOT RUN") })
	const handler = new FreeModelHandler({
		ovhClient: ovh,
		kiloClient: kiloClient,
		kiloFreeRows: [],
		excludeCollecting: true,
		pinnedModelId: kilo.id,
	})
	await assert.rejects(
		async () => {
			for await (const chunk of handler.createMessage("sys", userMessages)) {
				void chunk
			}
		},
		(error: unknown) => {
			const message = (error as Error).message
			assert.match(message, /收集提示词/)
			assert.match(message, /本次请求未发出/)
			assert.ok(message.includes(FREE_PINNED_RECOVERY_MARKER))
			assert.doesNotMatch(message, /已尝试 0 个候选/)
			return true
		},
	)
	assert.equal(callsOf(ovh).chat, undefined)
	assert.equal(callsOf(kiloClient).chat, undefined)
})

test("review #242：withPinnedRecoveryMarker 原地追加、保留类型/stack、幂等", () => {
	const err = apiError(429, "stream broke mid-way")
	const stack = err.stack
	assert.equal(withPinnedRecoveryMarker(err), err, "必须原地改同一个 Error 对象，不包装")
	assert.equal(err.status, 429, "上游 status 不丢")
	assert.equal(err.stack, stack, "stack 不丢")
	assert.equal(err.message.split(FREE_PINNED_RECOVERY_MARKER).length - 1, 1)
	withPinnedRecoveryMarker(err)
	assert.equal(err.message.split(FREE_PINNED_RECOVERY_MARKER).length - 1, 1, "幂等，不叠加标记")
	assert.equal(stripPinnedRecoveryMarker(err.message).includes(FREE_PINNED_RECOVERY_MARKER), false)
})

test("review #242：pinned 中途断流的原样上抛也带恢复标记，自动路由不带", async () => {
	const target = FREE_POOL.find((c) => c.lane === "ovh" && !c.vision)
	assert.ok(target)
	const pinnedClient = fakeClient({ chat: () => partialThenError("半截回复", apiError(429, "stream broke")) })
	const pinned = new FreeModelHandler({
		ovhClient: pinnedClient,
		kiloClient: fakeClient({ chat: () => textStream("SHOULD NOT SWITCH") }),
		kiloFreeRows: [],
		pinnedModelId: target.id,
	})
	await assert.rejects(
		async () => {
			for await (const chunk of pinned.createMessage("sys", userMessages)) {
				void chunk
			}
		},
		(error: unknown) => {
			const message = (error as Error).message
			assert.match(message, /stream broke/, "必须是原错误文本，不能被 composePinnedError 包装")
			assert.ok(message.includes(FREE_PINNED_RECOVERY_MARKER), "中途断流也要给恢复入口")
			assert.equal((error as Error & { status?: number }).status, 429, "原 error 的 status 保留")
			return true
		},
	)
	assert.deepEqual(callsOf(pinnedClient).chat, [target.id], "pinned 下只请求指定模型一次")

	// 自动路由下同一断流不带 marker：既有行为零改动
	const autoClient = fakeClient({ chat: () => partialThenError("半截回复", apiError(429, "stream broke")) })
	const auto = new FreeModelHandler({
		ovhClient: autoClient,
		kiloClient: fakeClient({ chat: () => textStream("OK") }),
		kiloFreeRows: [],
	})
	await assert.rejects(
		async () => {
			for await (const chunk of auto.createMessage("sys", userMessages)) {
				void chunk
			}
		},
		(error: unknown) => {
			assert.equal((error as Error).message.includes(FREE_PINNED_RECOVERY_MARKER), false)
			return true
		},
	)
	// 结构性：接线必须落在 sawContent 分支，不能只在「全链失败」路径补
	const free = fs.readFileSync("src/core/api/providers/free.ts", "utf8")
	assert.match(free, /if \(sawContent\)[\s\S]{0,300}withPinnedRecoveryMarker\(error\)/)
})

test("#242 composePinnedError：tried=0 不说「已尝试 0 个候选」，自动路由文案零改动", () => {
	const pinned0 = composePinnedError("some/model-id", "上游 429", 0)
	assert.match(pinned0.message, /本次请求未发出/)
	assert.doesNotMatch(pinned0.message, /已尝试 0 个候选/)
	assert.ok(pinned0.message.includes(FREE_PINNED_RECOVERY_MARKER))
	assert.match(composePinnedError("some/model-id", "上游 429", 1).message, /已尝试 1 次/)
	const auto = composeFinalError(apiError(429, "rate limit"), 3)
	assert.match(auto.message, /已尝试 3 个候选/)
	assert.equal(auto.message.includes(FREE_PINNED_RECOVERY_MARKER), false, "自动路由错误不得带恢复标记")
})

test("#236 元测试：保底 10 行常量单源、两个高度链注入源已收口、整页滚唯一", () => {
	assert.equal(FREE_POOL_MIN_VISIBLE_ROWS, 10, "用户裁定：保底 10 行")
	const provider = stripComments(fs.readFileSync("webview-ui/src/components/settings/providers/FreeModelProvider.tsx", "utf8"))
	assert.match(provider, /FREE_POOL_MIN_VISIBLE_ROWS \* POOL_ROW_HEIGHT_PX/, "表格高度必须由单源常量派生")
	assert.doesNotMatch(provider, /flex-1 min-h-0/, "表格容器不得再吃满视口")
	assert.doesNotMatch(provider, /overscroll-behavior:\s*contain/, "不得截断滚轮链（否则下滚有断点）")
	const section = stripComments(
		fs.readFileSync("webview-ui/src/components/settings/sections/ApiConfigurationSection.tsx", "utf8"),
	)
	assert.doesNotMatch(section, /max-h-\[40vh\]/, "辅助区不再自身限高")
	assert.doesNotMatch(section, /flex h-full flex-col/, "根 div 不再打通高度链")
	assert.match(section, /data-free-provider/, "#224 displayedMode 同源判据仍在")
	const apiOptions = stripComments(fs.readFileSync("webview-ui/src/components/settings/ApiOptions.tsx", "utf8"))
	assert.doesNotMatch(apiOptions, /selectedProvider === "free" \? \{ flex:/, "第二个高度链注入源已收口")
	const settingsView = stripComments(fs.readFileSync("webview-ui/src/components/settings/SettingsView.tsx", "utf8"))
	assert.match(settingsView, /TabContent className="flex-1 overflow-auto"/, "页面唯一主滚动容器仍在")
})

test("#242 元测试：存真实 ID、四道门复用、失败不自动切、双语齐备、恢复标记同源", () => {
	const pools = stripComments(fs.readFileSync("src/shared/free-pools.ts", "utf8"))
	assert.match(
		pools,
		/return gated\.filter\(\(candidate\) => candidate\.id === pinned\)/,
		"钳制必须按真实上游 ID，⛔ 不是 displayName / 下标",
	)
	const free = stripComments(fs.readFileSync("src/core/api/providers/free.ts", "utf8"))
	assert.match(free, /buildFreeCandidateChain\(\{ hasImages, kiloFreeRows, excludeCollecting, pinnedModelId \}\)/)
	assert.match(free, /describePinnedGateConflict\(pinnedModelId/, "链空必须复用四道门归因")
	assert.match(free, /composePinnedError\(pinnedModelId/)
	assert.doesNotMatch(free, /pinnedModelId = undefined/, "⛔ 路由层不得自动清掉 pinned")
	const index = stripComments(fs.readFileSync("src/core/api/index.ts", "utf8"))
	assert.match(index, /pinnedModelId: options\.pinnedModelId/, "请求侧必须把 pinned 传给 handler")
	const errors = stripComments(fs.readFileSync("src/core/api/providers/free-errors.ts", "utf8"))
	assert.match(errors, /FREE_PINNED_RECOVERY_MARKER/, "host 错误须写恢复标记")
	const errorRow = stripComments(fs.readFileSync("webview-ui/src/components/chat/ErrorRow.tsx", "utf8"))
	assert.match(errorRow, /FREE_PINNED_RECOVERY_MARKER/, "webview 与 host 从同一常量识别标记")
	// #243：清空必须写空串，⛔ 不能用 undefined（setApiConfiguration 会跳过、旧值永不消失）
	assert.match(errorRow, /handleFieldChange\("pinnedModelId", ""\)/, "点了才切回自动路由")
	assert.doesNotMatch(errorRow, /handleFieldChange\("pinnedModelId", undefined\)/, "⛔ 不得退回 undefined 清空")
	assert.match(errorRow, /TaskServiceClient\.askResponse/, "点了才重试")
	// 恢复标记必须能穿过 host 的 ClineError → api_req_failed 文案链路到达 ErrorRow
	const taskIndex = stripComments(fs.readFileSync("src/core/task/index.ts", "utf8"))
	assert.match(taskIndex, /await this\.ask\("api_req_failed", humanErrorMessage\)/, "错误文本原样送到 webview")
	assert.match(taskIndex, /const humanErrorMessage = clineError\.message \|\| errorMessage/, "文案取原始 message")
	// 用户裁定：快捷切换菜单不显示指定模型、不参与 per-provider 记忆
	const quickSwitch = stripComments(fs.readFileSync("webview-ui/src/components/chat/ModelQuickSwitchMenu.tsx", "utf8"))
	assert.doesNotMatch(quickSwitch, /pinnedModelId/, "快捷菜单不得读取/展示指定模型")
	// KB 08 #244：风险告知按 locale 单语（推翻 #242「强制中英双语」裁定）。
	// 单语不等于删因果：链长=1 → 429 / 区域封锁 / 超时 / 空响应 / 5xx 无 failover 必须保留。
	for (const lng of ["en", "zh-CN"]) {
		const settings = JSON.parse(fs.readFileSync(`webview-ui/src/locales/${lng}/settings.json`, "utf8")) as {
			settings: Record<string, string>
		}
		const risk = settings.settings.freePinnedRisk
		const confirm = settings.settings.freePinnedConfirm
		assert.equal(typeof risk, "string", `${lng} 缺 freePinnedRisk`)
		assert.equal(typeof confirm, "string", `${lng} 缺 freePinnedConfirm`)
		assert.match(risk, /429/, `${lng} 风险告知必须点名限流`)
		assert.match(risk, /5xx/, `${lng} 风险告知必须保留 5xx 因果`)
		assert.match(risk, /failover/, `${lng} 风险告知必须保留 failover 因果`)
		if (lng === "zh-CN") {
			assert.match(risk, /警告：/, "zh-CN 必须含中文警示句")
			assert.doesNotMatch(risk, /Warning:/, "zh-CN 不得再夹带英文警示段")
			assert.doesNotMatch(confirm, /Pinned:/, "zh-CN 确认文案不得再夹带英文段")
		} else {
			assert.match(risk, /Warning:.*[A-Za-z]{4,}/, "en 必须含完整英文警示句")
			assert.doesNotMatch(risk, /[一-龥]/, "en 风险告知不得再夹带中文段")
			assert.doesNotMatch(confirm, /[一-龥]/, "en 确认文案不得再夹带中文段")
		}
		const common = JSON.parse(fs.readFileSync(`webview-ui/src/locales/${lng}/common.json`, "utf8")) as {
			error: Record<string, string>
		}
		assert.equal(typeof common.error.freePinnedRecovery, "string", `${lng} 缺恢复按钮文案`)
	}
})

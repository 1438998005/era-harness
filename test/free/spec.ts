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
	composeFreeEmptyStopMessage,
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
	OPENROUTER_FREE_ROUTER_ID,
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
// 2026-11-08：只插入 `liquid/lfm-3-1.7b:free` 为新 #16（Ultra 之后、Lightning 之前），
// 其余 18 项相对顺序逐字不动；本轮新增项 = LFM3_ID 常量，不另抄一份。
// ---------------------------------------------------------------------------

const LFM3_ID = "liquid/lfm-3-1.7b:free"

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
	LFM3_ID,
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
// 候选链组装（KB 08 #241 定稿 18 项，2026-11-08 插入 LFM3-1.7B 后 19 项）
// ---------------------------------------------------------------------------

test("单一池：无 listing 时 19 个候选（全部精确 ID）且逐字等于定稿序", () => {
	const chain = buildFreeCandidateChain({ hasImages: false })
	assert.equal(chain.length, 19) // OVH 9 + Kilo 10（全部精确 ID，无 listingMatch 条目）
	// 渠道分布：OVH 9 + Kilo 10；Zen 已移出池
	assert.equal(chain.filter((c) => c.lane === "zen").length, 0)
	assert.equal(chain.filter((c) => c.lane === "ovh").length, 9)
	assert.equal(chain.filter((c) => c.lane === "kilo").length, 10)
	assert.deepEqual(
		chain.map((c) => c.id),
		EXPECTED_POOL_ORDER,
	)
	// Laguna S 2.1 已移除：Kilo listing 整行消失（2026-11-04 实证，连付费行都不剩）
	assert.ok(!chain.some((c) => c.id === "poolside/laguna-s-2.1:free"), "已死的 Laguna 不应留在池中")
})

test("#241 结构性：FREE_POOL 与单一常量表一致，LFM3 插在 #16、Super VL 仍末位", () => {
	assert.deepEqual(
		FREE_POOL.map((c) => c.id),
		EXPECTED_POOL_ORDER,
	)
	assert.equal(new Set(EXPECTED_POOL_ORDER).size, 19, "期望表自身不得有重复/漏项")
	assert.deepEqual(
		FREE_POOL.slice(14).map((c) => c.id),
		EXPECTED_POOL_ORDER.slice(14),
		"尾部五项：Ultra → LFM3 → Lightning → Nano Omni → Super VL",
	)
	assert.equal(FREE_POOL[15].id, LFM3_ID, "本轮新增项为新 #16，其余 18 项相对序不动")
	const nvidiaIds = EXPECTED_POOL_ORDER.filter((id) => id.startsWith("nvidia/"))
	assert.equal(nvidiaIds.length, 4, "NVIDIA 家族仍是四项")
	assert.equal(nvidiaIds[0], "nvidia/nemotron-3-ultra-550b-a55b:free", "Ultra 仍是家族首位")
	assert.equal(nvidiaIds[3], "nvidia/nemotron-3.5-super-vl:free", "Super VL 仍是家族末位")
	assert.equal(FREE_POOL[FREE_POOL.length - 1].id, "nvidia/nemotron-3.5-super-vl:free", "唯一有本地实测且实测失败 → 末位隔离")
	// 其余 14 项相对顺序完全不动：从新序剔除 NVIDIA 四项与本轮新增项后逐字比较（插在前段也不会假红）
	const legacyNonNvidia = POOL_ORDER_BEFORE_241.filter((id) => !id.startsWith("nvidia/"))
	const withoutNewAndNvidia = (ids: readonly string[]) => ids.filter((id) => !id.startsWith("nvidia/") && id !== LFM3_ID)
	assert.deepEqual(withoutNewAndNvidia(EXPECTED_POOL_ORDER), legacyNonNvidia)
	assert.deepEqual(withoutNewAndNvidia(FREE_POOL.map((c) => c.id)), legacyNonNvidia)
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

// 防同类回归（KB 08 #229）：2026-11-04 深夜全渠道存活复核的 6 个死项、付费行与 2 个虚拟路由器，
// 任何一个重新出现在 FREE_POOL 都应让本测试变红。清单判据见 KB 07 §7.8/§7.9。
test("存活复核回归：死项、付费行与 2 个虚拟路由器 ID 均不入静态池", () => {
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
	// 2026-11-08：LFM3 是新一代免费行，旧 LFM2.5 已转付费；不得用去 `:free` 的付费行补位
	const paidRows = ["liquid/lfm-2.5-2.6b", "google/gemma-4-31b-it", "google/gemma-4-26b-a4b-it"]
	for (const id of paidRows) {
		assert.ok(!ids.includes(id), `${id} 是付费行（isFree=false），混入会静默路由到付费模型`)
	}
	const routers = [
		"kilo-auto/free", // Kilo Auto Model Free 档：上游轮换免费模型
		OPENROUTER_FREE_ROUTER_ID, // OpenRouter Free Models Router：上游随机选免费模型
	]
	assert.equal(OPENROUTER_FREE_ROUTER_ID, "openrouter/free", "路由模式常量与 Kilo 清单精确 ID 一致")
	for (const id of routers) {
		assert.ok(!ids.includes(id), `${id} 是上游黑盒虚拟路由器，入池会破坏能力排序/vision 过滤/审计口径`)
	}
	assert.equal(new Set(ids).size, ids.length, "池内 ID 不应重复")
})

test("单一池：listing 行元数据覆盖静态表（exact-ID 解析）", () => {
	// 只给 dots 一行（其余 Kilo 条目不在清单 → 门控剔除），窗口/上限/vision 均以 listing 为准
	const rows = [{ id: "dots-studio/dots-3-note-preview:free", contextWindow: 999_000, maxOutput: 8_192, vision: false }]
	const chain = buildFreeCandidateChain({ hasImages: false, kiloFreeRows: rows })
	assert.equal(chain.length, 10) // 9 OVH + 1 Kilo（其余 9 个 Kilo 条目不在清单 → 门控剔除）
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
	// Kilo 侧以静态实证表为准（2026-11-05 listing 复核；含 11-08 新增的 LFM3）
	assert.equal(byId("nvidia/nemotron-3.5-super-vl:free")?.contextWindow, 1_000_000)
	assert.equal(byId("reflection/beam-free")?.contextWindow, 1_048_576)
	assert.equal(byId("stealth/glyph-cluster")?.contextWindow, 256_000)
	assert.equal(byId("stealth/crouton-alpha")?.contextWindow, 1_048_576)
	assert.equal(byId("dots-studio/dots-3-note-preview:free")?.contextWindow, 512_000)
	assert.equal(byId("nvidia/nemotron-3.5-lightning:free")?.contextWindow, 1_000_000)
	assert.equal(byId("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")?.contextWindow, 256_000)
	// 2026-11-08 新增行：262144/8192、纯文本（listing input_modalities 仅 text）
	assert.equal(byId(LFM3_ID)?.contextWindow, 262_144)
	assert.equal(byId(LFM3_ID)?.maxOutput, 8_192)
	assert.equal(byId(LFM3_ID)?.vision, false, "LFM3 纯文本，不得进带图链")
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
	assert.equal(kilo.length, 10, "10 个已实证 Kilo 条目应全部放行（池内已无待解析条目）")
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
	for (const id of [EXPECTED_POOL_ORDER[0], EXPECTED_POOL_ORDER[9], EXPECTED_POOL_ORDER[EXPECTED_POOL_ORDER.length - 1]]) {
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
	assert.match(
		errorRow,
		/handleFieldsChange\(\{[^}]*pinnedModelId: ""[^}]*freeUseOpenRouterRouter: false[^}]*\}\)/,
		"点了才切回自动路由；三态下必须同时清掉路由标志",
	)
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

// ---------------------------------------------------------------------------
// KB 08 #249 / #250 / #251（2026-11-07）：失败路径的行为与结构性回归
// ---------------------------------------------------------------------------

/** #250：只吐思考内容、content 为空的伪空停流（Kilo 侧 reasoning_content 字段名） */
async function* reasoningOnlyStream(): AsyncGenerator<Record<string, unknown>> {
	yield { choices: [{ delta: { reasoning_content: "让我想想如何调用 search_files" } }] }
}

/** #250 代码审查：只吐 reasoning 后上游断流（Kilo「ConnectionClosed after reasoning」，上游 cline #14795） */
async function* reasoningThenErrorStream(): AsyncGenerator<Record<string, unknown>> {
	yield { choices: [{ delta: { reasoning_content: "让我想想" } }] }
	throw new Error("Connection closed by upstream")
}

test("#250 review：reasoning-only 后断流（catch 路径）也给出可诊断归因", async () => {
	const target = FREE_POOL.find((c) => c.lane === "ovh" && !c.vision)
	assert.ok(target)
	const handler = new FreeModelHandler({
		ovhClient: fakeClient({ chat: () => reasoningThenErrorStream() }),
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
			assert.match(message, /只返回了思考内容，未产出正文或工具调用/)
			assert.doesNotMatch(message, /Connection closed/, "⛔ 上游网络错误不得再当主文案误导用户")
			assert.ok(message.includes(FREE_PINNED_RECOVERY_MARKER), "⛔ #243 按钮标记不得丢")
			return true
		},
	)
})

test("#250 review：自动路由下 reasoning-only 后断流仍可切换（判定语义不变）", async () => {
	const ovh = fakeClient({
		chat: (model) => (model === "Qwen3.6-27B" ? textStream("OK") : reasoningThenErrorStream()),
	})
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	const types: string[] = []
	for await (const chunk of handler.createMessage("sys", userMessages)) {
		types.push(chunk.type)
	}

	assert.ok(types.includes("reasoning"))
	assert.equal(handler.getModel().id, "Qwen3.6-27B")
	assert.deepEqual(callsOf(ovh).chat, ["Qwen3.8-27B", "Qwen3.6-27B"])
})

test("#250 review：composeFinalError 不出现「。）。」双重标点", async () => {
	const handler = new FreeModelHandler({
		ovhClient: fakeClient({ chat: () => reasoningOnlyStream() }),
		kiloFreeRows: [],
	})
	await assert.rejects(
		async () => {
			for await (const chunk of handler.createMessage("sys", userMessages)) {
				void chunk
			}
		},
		(error: unknown) => {
			const message = (error as Error).message
			assert.doesNotMatch(message, /。）。/, "⛔ 不得出现双重标点")
			assert.match(message, /最后一次错误：.*未产出正文或工具调用/)
			return true
		},
	)
})

test("#250 空停归因单源：真零 chunk 与 reasoning-only 文案可区分", () => {
	const empty = composeFreeEmptyStopMessage("Beam 1.0", false)
	assert.match(empty, /返回了空响应/)
	assert.doesNotMatch(empty, /思考内容/)

	const reasoningOnly = composeFreeEmptyStopMessage("Beam 1.0", true)
	assert.match(reasoningOnly, /只返回了思考内容，未产出正文或工具调用/)
	assert.doesNotMatch(reasoningOnly, /返回了空响应/, "⛔ 不再把只吐思考说成渠道空响应")
})

test("#250 reasoning-only 仍按可切换失败处理（判定语义不变），chunk 照常透传", async () => {
	const ovh = fakeClient({
		chat: (model) => (model === "Qwen3.6-27B" ? textStream("OK") : reasoningOnlyStream()),
	})
	const handler = new FreeModelHandler({ ovhClient: ovh, kiloFreeRows: [] })

	const types: string[] = []
	for await (const chunk of handler.createMessage("sys", userMessages)) {
		types.push(chunk.type)
	}

	assert.ok(types.includes("reasoning"), "reasoning chunk 必须透传给上层")
	assert.equal(handler.getModel().id, "Qwen3.6-27B")
	assert.deepEqual(callsOf(ovh).chat, ["Qwen3.8-27B", "Qwen3.6-27B"])
})

test("#250 pinned + 全链 reasoning-only：错误说明「只返回了思考内容」，链长=1 与恢复标记不变", async () => {
	const target = FREE_POOL.find((c) => c.lane === "ovh" && !c.vision)
	assert.ok(target)
	const handler = new FreeModelHandler({
		ovhClient: fakeClient({ chat: () => reasoningOnlyStream() }),
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
			assert.match(message, /只返回了思考内容，未产出正文或工具调用/)
			assert.doesNotMatch(message, /返回了空响应/)
			assert.match(message, /没有下一个模型可切换/, "⛔ #244 的风险因果文案一字不删")
			assert.ok(message.includes(FREE_PINNED_RECOVERY_MARKER), "⛔ #243 按钮标记不得丢")
			return true
		},
	)
})

test("#250 真零 chunk 空停仍判空响应（不放宽判定）", async () => {
	const handler = new FreeModelHandler({
		ovhClient: fakeClient({ chat: () => emptyStream() }),
		kiloFreeRows: [],
	})
	await assert.rejects(
		async () => {
			for await (const chunk of handler.createMessage("sys", userMessages)) {
				void chunk
			}
		},
		(error: unknown) => (error as Error).message.includes("返回了空响应"),
	)
})

test("#249/#250/#251 结构性元测试：可见文本单源、标记剥离边界、chunk 类型集合对齐", () => {
	const free = stripComments(fs.readFileSync("src/core/api/providers/free.ts", "utf8"))
	// ① sawContent 仍只认可消费内容；reasoning 单独诊断，⛔ 不并入成功判定（KB 08 #250 复核修订）
	assert.match(free, /chunk\.type === "text" \|\| chunk\.type === "tool_calls"/)
	assert.match(free, /chunk\.type === "reasoning"/)
	assert.match(free, /composeFreeEmptyStopMessage\(candidate\.displayName, sawReasoningOnly\)/)
	// ② catch 分支（reasoning-only 后断流）也必须走同一个归因单源，⛔ 不能照抄上游网络错误
	assert.match(free, /if \(sawReasoningOnly && !gateError\)/)
	// ③ 两条 wire 实际 yield 的类型集合必须与诊断分支一致（防恢复 Responses wire 再漏）
	assert.match(free, /yield \{ type: "reasoning", reasoning:/)
	assert.match(free, /yield \{\s*type: "usage",/)
	const responsesWire = stripComments(fs.readFileSync("src/core/api/utils/responses_api_support.ts", "utf8"))
	assert.match(responsesWire, /type: "reasoning"/, "⛔ Responses wire 的 reasoning type 必须与 free.ts 判定一致")
	assert.doesNotMatch(responsesWire, /type: "thinking"/, "⛔ 若上游改用别的类型名，诊断分支会漏判")

	const taskIndex = stripComments(fs.readFileSync("src/core/task/index.ts", "utf8"))
	// ④ 4 处 error_retry 载荷消费已剥离文本；2 个产生点；ask 与结构化字段保留 marker
	assert.equal((taskIndex.match(/errorMessage: visibleErrorMessage,/g) ?? []).length, 4)
	assert.equal((taskIndex.match(/const visibleErrorMessage = stripPinnedRecoveryMarker\(humanErrorMessage\)/g) ?? []).length, 2)
	assert.match(taskIndex, /await this\.ask\("api_req_failed", humanErrorMessage\)/, "⛔ ask 必须保留 marker")
	assert.match(taskIndex, /streamingFailedMessage,/, "⛔ api_req_started 结构化字段不得删")

	const errorRow = stripComments(fs.readFileSync("webview-ui/src/components/chat/ErrorRow.tsx", "utf8"))
	// ⑤ 放宽为「任何把 rawApiError 当 JSX 文本渲染」的写法都拦截，⛔ 别只防精确标签
	assert.doesNotMatch(errorRow, /\{rawApiError\}/, "⛔ serialize() 产物不得作为可见文本")
	assert.match(errorRow, /\[apiRequestFailedMessage, apiReqStreamingFailedMessage, message\.text\]/, "三源分别检测")
	assert.match(errorRow, /FREE_PINNED_RECOVERY_MARKER/, "#243 按钮判定仍在")

	const chatRow = stripComments(fs.readFileSync("webview-ui/src/components/chat/ChatRow.tsx", "utf8"))
	// ⑥ ⛔ 不得按 failed 隐藏 error_retry 文案：用户点重试后 ErrorRow 完全不渲染，
	//    而 combineErrorRetryMessages Case 2 仍保留 failed:true 卡片 —— 两边都删文案会让原因消失。
	assert.doesNotMatch(chatRow, /errorMessage && !isFailed/, "⛔ 不得把「失败原因消失」钉成契约")
	assert.match(chatRow, /\{errorMessage && \(/, "error_retry 必须始终渲染失败原因")
})

test("#249 review：stripPinnedRecoveryMarker 对非字符串输入安全兜底", () => {
	assert.equal(stripPinnedRecoveryMarker(undefined), "")
	assert.equal(stripPinnedRecoveryMarker(null), "")
	assert.equal(stripPinnedRecoveryMarker(`出错了${FREE_PINNED_RECOVERY_MARKER}`), "出错了")
})

test("#249 review 结构性：say=error 分支也走 ClineError.parse 单源", () => {
	const chatRow = stripComments(fs.readFileSync("webview-ui/src/components/chat/ChatRow.tsx", "utf8"))
	// ⛔ 不要断言 JSX 属性顺序或空白：pre-commit 的 `biome check --write --staged` 会重排属性、
	// 把多行压成单行（本批提交实测），精确正则会在提交后假红。只断言语义片段。
	const errorCase = [...chatRow.matchAll(/case "error":[\s\S]{0,400}/g)]
		.map((match) => match[0])
		.find((block) => block.includes("<ErrorRow"))
	assert.ok(errorCase, "⛔ say=error 分支必须渲染 ErrorRow")
	assert.match(errorCase, /apiRequestFailedMessage=\{message\.text\}/, "⛔ say=error 的文本不得落到 ErrorRow 的裸文本兜底分支")
})

// ---------------------------------------------------------------------------
// 2026-11-08：第三路由模式（自动路由 / 指定模型 / OpenRouter 免费路由三选一）
// 标志为真时单候选、不经 FREE_POOL / 四道门，失败不回落；虚拟路由器仍不入静态池。
// ---------------------------------------------------------------------------

async function* routerTextStream(model: string): AsyncGenerator<Record<string, unknown>> {
	yield { model, choices: [{ delta: { content: "OK" } }] }
}

const imageMessages = [{ role: "user", content: [{ type: "image" }] }] as unknown as Parameters<
	FreeModelHandler["createMessage"]
>[1]

test("第三路由模式：单候选只调 Kilo 网关一次，getModel 指向虚拟路由器窗口", async () => {
	const kilo = fakeClient({ chat: () => textStream("OK") })
	const handler = new FreeModelHandler({ kiloClient: kilo, freeUseOpenRouterRouter: true })
	assert.equal(handler.getModel().id, OPENROUTER_FREE_ROUTER_ID)
	assert.equal(handler.getModel().info.contextWindow, 200_000)
	const chunks: string[] = []
	for await (const chunk of handler.createMessage("sys", userMessages)) {
		if (chunk.type === "text") chunks.push(chunk.text)
	}
	assert.equal(chunks.join(""), "OK")
	assert.deepEqual(callsOf(kilo).chat, [OPENROUTER_FREE_ROUTER_ID])
})

test("第三路由模式：标志优先于 pinned 旧数据，且记录响应体真实 model", async () => {
	const kilo = fakeClient({ chat: () => routerTextStream("nvidia/nemotron-3.5-super-vl:free") })
	const handler = new FreeModelHandler({
		kiloClient: kilo,
		freeUseOpenRouterRouter: true,
		pinnedModelId: "Qwen3.8-27B",
	})
	for await (const chunk of handler.createMessage("sys", userMessages)) void chunk
	assert.deepEqual(callsOf(kilo).chat, [OPENROUTER_FREE_ROUTER_ID], "标志必须优先于 pinned")
	assert.equal(handler.getLastUpstreamModelId(), "nvidia/nemotron-3.5-super-vl:free")
})

test("第三路由模式：失败不回落、专门归因且不带恢复标记", async () => {
	const kilo = fakeClient({ chat: () => apiError(429, "rate limit") })
	const handler = new FreeModelHandler({ kiloClient: kilo, freeUseOpenRouterRouter: true })
	await assert.rejects(
		async () => {
			for await (const chunk of handler.createMessage("sys", userMessages)) void chunk
		},
		(error: unknown) => {
			const message = error instanceof Error ? error.message : ""
			assert.match(message, /OpenRouter 免费路由/)
			assert.match(message, /不会自动回落/)
			assert.ok(!message.includes(FREE_PINNED_RECOVERY_MARKER), "不得让 ErrorRow 渲染「切回自动路由」")
			return true
		},
	)
	assert.deepEqual(callsOf(kilo).chat, [OPENROUTER_FREE_ROUTER_ID], "只能调一次")
})

test("第三路由模式：隐私开关与带图请求明确拒绝且零调用", async () => {
	const kilo = fakeClient({ chat: () => textStream("OK") })
	const privacy = new FreeModelHandler({ kiloClient: kilo, freeUseOpenRouterRouter: true, excludeCollecting: true })
	await assert.rejects(async () => {
		for await (const chunk of privacy.createMessage("sys", userMessages)) void chunk
	}, /隐私开关/)
	const images = new FreeModelHandler({ kiloClient: kilo, freeUseOpenRouterRouter: true })
	await assert.rejects(async () => {
		for await (const chunk of images.createMessage("sys", imageMessages)) void chunk
	}, /图片/)
	assert.equal(callsOf(kilo).chat, undefined, "两种拒绝都不得发出请求")
})

test("第三路由模式结构性：五层接线完整、字段号无冲突、虚拟路由器不入池", () => {
	const models = fs.readFileSync("proto/cline/models.proto", "utf8")
	const state = fs.readFileSync("proto/cline/state.proto", "utf8")
	const keys = fs.readFileSync("src/shared/storage/state-keys.ts", "utf8")
	const conv = fs.readFileSync("src/shared/proto-conversions/models/api-configuration-conversion.ts", "utf8")
	const index = fs.readFileSync("src/core/api/index.ts", "utf8")
	const handler = fs.readFileSync("src/core/api/providers/free.ts", "utf8")
	const router = fs.readFileSync("src/core/api/providers/free-router.ts", "utf8")
	assert.match(models, /optional bool free_use_open_router_router = 276;/)
	assert.match(state, /optional bool free_use_open_router_router = 220;/)
	assert.match(keys, /freeUseOpenRouterRouter: \{ default: false as boolean \}/)
	assert.equal((conv.match(/freeUseOpenRouterRouter:/g) ?? []).length, 2, "to/from 双向各一次")
	assert.match(index, /freeUseOpenRouterRouter: options\.freeUseOpenRouterRouter/)
	assert.match(handler, /freeUseOpenRouterRouter\?: boolean/)
	assert.match(router, /OPENROUTER_FREE_ROUTER_ID/, "路由单候选必须复用单源常量")
	assert.match(handler, /OPENROUTER_ROUTER_CANDIDATE/, "handler 必须消费独立路由模块的单候选")
	assert.match(handler, /assertOpenRouterRouterAllowed/, "隐私与带图门必须落在 handler 入口")
	assert.match(handler, /composeOpenRouterRouterFailure/, "全链失败必须走不回落的专门归因")
	assert.ok(!FREE_POOL.some((c) => c.id === OPENROUTER_FREE_ROUTER_ID), "虚拟路由器不得进静态池")
})

// ---------------------------------------------------------------------------
// 2026-11-08 代码审查回归：三态互斥必须贯穿 handler / 设置页 / 错误恢复 / 双语文案。
// ---------------------------------------------------------------------------

test("审查：路由模式 + pinned 旧数据中途断流不得带恢复标记", async () => {
	const kilo = fakeClient({ chat: () => partialThenError("PART", apiError(429, "stream broke")) })
	const handler = new FreeModelHandler({
		kiloClient: kilo,
		freeUseOpenRouterRouter: true,
		pinnedModelId: "Qwen3.8-27B",
	})
	await assert.rejects(
		async () => {
			for await (const chunk of handler.createMessage("sys", userMessages)) void chunk
		},
		(error: unknown) => {
			assert.ok(
				!String((error as Error)?.message).includes(FREE_PINNED_RECOVERY_MARKER),
				"路由模式下不得渲染「切回自动路由」按钮：该按钮只清 pinned，点了也没用",
			)
			return true
		},
	)
	assert.deepEqual(callsOf(kilo).chat, [OPENROUTER_FREE_ROUTER_ID], "仍只调一次路由器")
})

test("审查：路由模式 getModel 不受实例里残留的 activeCandidate 影响", () => {
	const handler = new FreeModelHandler({ kiloClient: fakeClient({}), freeUseOpenRouterRouter: true })
	const stale = FREE_POOL[0]
	assert.ok(stale)
	// 模拟同一 handler 实例曾跑过自动路由后再切到路由模式（状态残留）
	;(handler as unknown as { activeCandidate: unknown }).activeCandidate = stale
	assert.equal(handler.getModel().id, OPENROUTER_FREE_ROUTER_ID)
	assert.equal(handler.getModel().info.contextWindow, 200_000)
})

test("审查结构性：三态互斥不得静默清空隐私开关", () => {
	const provider = stripComments(fs.readFileSync("webview-ui/src/components/settings/providers/FreeModelProvider.tsx", "utf8"))
	const selectMode = provider.slice(provider.indexOf("const selectMode"), provider.indexOf("const pin ="))
	assert.match(selectMode, /const selectMode/)
	assert.doesNotMatch(
		selectMode,
		/freeExcludeCollecting/,
		"⛔ 不得静默关掉用户隐私开关（切回自动路由也不会恢复，等于永久丢失偏好）",
	)
	assert.match(selectMode, /freeUseOpenRouterRouter: true/)
	assert.match(selectMode, /freeUseOpenRouterRouter: false/)
})

test("审查结构性：隐私冲突有 UI 门禁/提示，恢复按钮同时清两个字段", () => {
	const provider = stripComments(fs.readFileSync("webview-ui/src/components/settings/providers/FreeModelProvider.tsx", "utf8"))
	assert.match(provider, /disabled=\{excludeCollecting\}/, "隐私开关开启时不得再选入路由模式")
	assert.match(provider, /freeRouterPrivacyConflict/, "旧数据同时为真时须有明确冲突提示")
	const errorRow = stripComments(fs.readFileSync("webview-ui/src/components/chat/ErrorRow.tsx", "utf8"))
	assert.match(
		errorRow,
		/handleFieldsChange\(\{[^}]*pinnedModelId: ""[^}]*freeUseOpenRouterRouter: false[^}]*\}\)/,
		"「切回自动路由」按钮必须同时清掉路由标志，否则承诺的动作不生效",
	)
})

test("审查结构性：双语文案须说明请求仍经 Kilo 网关并含冲突提示", () => {
	const zh = JSON.parse(fs.readFileSync("webview-ui/src/locales/zh-CN/settings.json", "utf8")).settings
	const en = JSON.parse(fs.readFileSync("webview-ui/src/locales/en/settings.json", "utf8")).settings
	assert.match(zh.freeRouterOption, /Kilo 网关/, "不得让用户误以为链路与 Kilo 无关")
	assert.match(en.freeRouterOption, /Kilo gateway/)
	assert.match(zh.freeRouterRisk, /Kilo 网关/)
	assert.match(en.freeRouterRisk, /Kilo gateway/)
	assert.ok(zh.freeRouterPrivacyConflict?.length > 0)
	assert.ok(en.freeRouterPrivacyConflict?.length > 0)
})

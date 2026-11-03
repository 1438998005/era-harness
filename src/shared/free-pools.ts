/**
 * 免费模型池：单一静态候选表 + Kilo listing 解析 + 候选链组装。
 *
 * 数据来源（2026-10-19 更新）：
 * - Zen 侧上下文/输出以 **models.dev 的 opencode provider 免费版登记**为准
 *   （免费版与付费版窗口不同：GLM 5.3 Flash Free / DeepSeek V4.1 Flash Free /
 *     Big Pickle 均为 200K，付费版才是 1M；Cat Jam 正式 ID 为 `cat-jam-free`）；
 * - Kilo 侧以运行时 listing 的 `isFree` 行为准（context_length / input_modalities）；
 * - OVH 侧以端点 `GET /v1/models`（无 key 可拉）的 context_length 为准；
 *   maxOutput 端点未登记 → 保守估值，handler 的 FREE_REQUEST_MAX_OUTPUT 截断兜底。
 * - vision 以 zen-gate 实测探测口径为准（未验证不声明，保守 false）。
 *
 * 池顺序（2026-11-04 修订：以 Artificial Analysis / SWE-bench / Terminal-Bench 等编码与工程基准为骨架，
 * 社区实测评价覆盖基准分（用户裁定：社区口碑 > 自报分 > 合成指数）；纯按编码能力降序，未加隐私权重）：
 * Inkling(kilo) → Beam 1.0(kilo) → Glyph Cluster(kilo) → Qwen3.8-27B(ovh) → Qwen3.6-27B(ovh) → Flint(kilo) →
 * Dots3-Note(kilo) → Qwen3.5-397B(ovh) → Nemotron 3 Ultra(kilo) → Nemotron 3.5 Super VL(kilo) →
 * Xing4.0-29B(kilo) → North Mini Code(kilo) → Gemma 4 31B(kilo) → gpt-oss-120b(ovh) → Mistral Small 3.2(ovh) →
 * gpt-oss-20b(ovh) → Llama 3.3 70B(ovh) → Qwen3.5-9B(ovh) → Qwen2.5-VL-72B(ovh) → Mistral Nemo(ovh) →
 * LFM 2.5 2.6B(kilo)。
 * （共 21 项：OVH 10 + Kilo 11；原 Zen 10 项已移出池，客户端代码休眠保留待恢复，门控判据见 free-lanes.ts。
 * 逐模型出处与用户裁定以本文件为准（开发期编号知识库已退役，无在册副本）；纯能力序不加隐私权重。
 * 2026-11-04 修订（用户发起：Gemma 社区口碑降位 + 7 个攻略站候选核实 + 全池存活复检）：
 * ① Gemma 4 31B 从 #2 降至 #13——社区实测编码远逊基准分：r/LocalLLaMA 共识 Qwen 编码「大幅胜出」、
 *    SWE-V 73.4(Qwen3.6) vs 52.0(Gemma)、agentic 对比 Qwen3.5 胜 5/8（towardsdeeplearning.com 实测文）；
 *    教训与 Dots3-Note 同款：**合成基准分系统性高估 Gemma 系编码，社区口碑优先**。
 * ② 新增 5 个 Kilo 免费行（listing 2026-11-04 实证）：
 *    Beam 1.0 = reflection/beam-free（1M/131_072；Reflection AI 501B-A23B，SWE-V 80.9~81.6 > Inkling 77.6、
 *      TB 2.1 80.1、SWE-Pro-Hard 77.2、对标 GLM-5.2 → #2）；
 *    Glyph Cluster = stealth/glyph-cluster（256K/256K；Kilo/Vercel 双渠道 stealth 槽位，tokenizer 疑似
 *      Microsoft，Kilo 自家榜用量 11.3%，无任何基准分 → #3 **低置信**，仅凭用量+疑似一线，随时可调）；
 *    Flint = recursive/flint-v1.0:free（262_144/235_929；Recursive 39.8B-A2.5B 编码特化，自报 SWE-Pro v2
 *      89.7% 打折，Wired 实测「小模型里出奇地稳」但「不是最强」→ #6）；
 *    Nemotron 3.5 Super VL = nvidia/nemotron-3.5-super-vl:free（1M/131_072，vision；120B-A12B 通用代理，
 *      r/opencode 有「失望」帖 → 排 3 Ultra 之后 #10）；
 *    Xing4.0 = xingchen-agi/xing4.0-29b-a4b:free（262_144/235_929；中国电信 29B-A4B，自报胜 Gemma4/Qwen3.6
 *      打折，4B 活跃 → #11）。
 * ③ Ling 3.1 Flash **未加入**：listing 实证 `inclusionai/ling-3.1-flash` 为付费行（isFree=false，免费档已
 *    终止）——与 2026-10-23 Inkling Small 同款情形，宁缺毋滥。
 * ④ Laguna S 2.1 **移除**：listing 实证 `poolside/laguna-s-2.1:free` 整行消失（连付费行都不剩）。
 * ⑤ OVH 侧全 10 项存活（含 Mistral Small 3.2 / Nemo——11-04 退役表生效日实测未下架，继续保留观察）。
 * ⑥ Glyph Cluster 无 `:free` 后缀但 isFree=true，注意 id 匹配是逐字相等；stealth 期 prompt 会被上游留存
 *    （Kilo 渠道级 collectsData=true 已覆盖，无新增恶化）。
 * 2026-11-03 修订：Inkling（完整版免费回归）与 Gemma 4 31B 加入；2026-10-24 修订：移除 Inkling Small /
 * Ling 3.0 Flash Sante。历史裁定详见 git 与 KB 07 §7.9。）
 *
 * 设计要点：
 * - 顺序 = 真实编程能力优先级，依次尝试直到成功；
 * - OVH 候选始终进链（匿名可打全部；Zen 免费门为 lane 级拒绝，已暂时移出池、代码保留）；
 * - Kilo 候选受 listing 门控：拉取成功时只保留仍在免费池的；拉取失败时只放行已实证
 *   精确 ID 的条目（宁缺毋滥）；
 * - `needsProxy`：原区域敏感候选（Muse Spark 1.3/1.2、Cat Jam）均随 Zen 移出池，当前池内不触发；
 * - `collectsData` 按渠道查表（LANE_META）：Kilo 实证 mayTrainOnYourPrompts=true（明文收集）；
 *   OVH 零数据保留、不用于训练。UI「明文收集」徽标的数据源。
 */

export type FreeLane = "zen" | "kilo" | "ovh"
export type FreeWire = "chat" | "responses"

/** 渠道级元数据：UI 徽标与激活引导的数据源（按渠道查，不逐模型硬编码） */
export interface FreeLaneMeta {
	/** 上游是否标记会收集（训练）提示词 */
	collectsData: boolean
	/** 渠道当前可用性备注（设置页引导文案用） */
	note?: string
}

export const LANE_META: Record<FreeLane, FreeLaneMeta> = {
	// Zen 渠道已暂时移出池（开箱即用原则）；客户端代码保留休眠待恢复，门控三要素见 free-lanes.ts
	zen: { collectsData: false, note: "已暂时移出池，代码保留待恢复（需本机 opencode 客户端激活，三要素见 free-lanes.ts）" },
	// Kilo listing 实证全部 mayTrainOnYourPrompts=true → 明文收集（提示词以明文被上游收集/可能用于训练）
	kilo: { collectsData: true },
	// OVH：欧盟托管、零数据保留、不用于训练；匿名 2rpm（无需配置，Key 槽已移除）
	ovh: { collectsData: false, note: "匿名 2 次/分钟（无需配置）" },
}

export interface FreeCandidate {
	/** 上游真实模型 ID；待 listing 解析的条目为空串（此时必须带 listingMatch） */
	id: string
	lane: FreeLane
	wire: FreeWire
	displayName: string
	contextWindow: number
	maxOutput: number
	vision: boolean
	/** 需要代理才能访问（区域敏感；被 RegionError 封锁时走 failover，换出口可解） */
	needsProxy?: boolean
	/** Kilo 条目从 listing 解析真实 ID 的匹配器（ID 未实证时使用；2026-10-24 起池内无使用者，机制休眠保留） */
	listingMatch?: RegExp
}

/** 单一候选池：顺序 = 真实编码能力优先级（2026-11-04 修订，21 项跨两渠道，裁定记录见本文件头部注释） */
export const FREE_POOL: readonly FreeCandidate[] = [
	{
		id: "thinkingmachines/inkling:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Inkling",
		contextWindow: 1_048_576, // Kilo listing 实证（2026-11-03）
		maxOutput: 262_144,
		vision: true, // listing input_modalities 含 image
	},
	{
		id: "reflection/beam-free",
		lane: "kilo",
		wire: "chat",
		displayName: "Beam 1.0",
		contextWindow: 1_048_576, // Kilo listing 实证（2026-11-04）
		maxOutput: 131_072,
		vision: false, // listing input_modalities 仅 text
		// Reflection AI 501B-A23B（Apache 2.0）：SWE-V 80.9~81.6（> Inkling 77.6）、TB 2.1 80.1、
		// SWE-Pro-Hard 77.2、对标 GLM-5.2；注意 id 无 `:free` 后缀，逐字匹配
	},
	{
		id: "stealth/glyph-cluster",
		lane: "kilo",
		wire: "chat",
		displayName: "Glyph Cluster",
		contextWindow: 256_000, // Kilo listing 实证（2026-11-04）
		maxOutput: 256_000,
		vision: false,
		// Kilo/Vercel 双渠道 stealth 槽位（接替 Pixel Canary），tokenizer 疑似 Microsoft，无任何基准分；
		// 排位依据仅 Kilo 自家榜用量 11.3% + 疑似一线定位 → **低置信，随时可调**。
		// stealth 期 prompt 被上游留存：Kilo 渠道级 collectsData=true 已覆盖
	},
	{
		id: "Qwen3.8-27B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.8 27B",
		contextWindow: 262_144, // OVH 端点 /v1/models 实证
		maxOutput: 32_768, // 端点未登记，保守估值（handler 截断兜底）
		vision: false,
	},
	{
		id: "Qwen3.6-27B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.6 27B",
		contextWindow: 262_144,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "recursive/flint-v1.0:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Flint",
		contextWindow: 262_144, // Kilo listing 实证（2026-11-04）
		maxOutput: 235_929,
		vision: false,
		// Recursive 39.8B-A2.5B 编码特化（Apache 2.0，AI 辅助构建的「RSI 实验」模型）：
		// 自报 SWE-Pro v2 89.7% 按 Dots3 先例打折；Wired 实测「小模型里出奇地稳」、
		// eesel 3.5/5「笔记本上最快，但不是最强」→ 排 Qwen3.6 之后
	},
	{
		id: "dots-studio/dots-3-note-preview:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Dots3-Note Preview",
		contextWindow: 512_000, // Kilo listing 实证
		maxOutput: 460_800,
		vision: true, // vision 链第 2 位（#1 Inkling 之后；2026-11-04 起池内排位最高的小尺寸 vision 候选）
	},
	{
		id: "Qwen3.5-397B-A17B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.5 397B A17B",
		contextWindow: 262_144,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3 Ultra (550B-A55B)",
		contextWindow: 1_000_000, // Kilo listing 实证
		maxOutput: 65_536,
		vision: false,
	},
	{
		id: "nvidia/nemotron-3.5-super-vl:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3.5 Super VL (120B-A12B)",
		contextWindow: 1_000_000, // Kilo listing 实证（2026-11-04）
		maxOutput: 131_072,
		vision: true, // listing input_modalities 含 image+video；vision 链第 3 位
		// NVIDIA 通用代理模型（编码/搜索/工具/文档），r/opencode 有「失望」帖 → 排 3 Ultra 之后
	},
	{
		id: "xingchen-agi/xing4.0-29b-a4b:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Xing4.0 29B A4B",
		contextWindow: 262_144, // Kilo listing 实证（2026-11-04）
		maxOutput: 235_929,
		vision: false,
		// 中国电信 TeleAI（XingChen-AGI，昇腾训练，Apache 2.0，256K 原生）：自报胜 Gemma4/Qwen3.6
		// 打折处理；4B 活跃 → 编码中段，排 North 之前
	},
	{
		id: "cohere/north-mini-code:free",
		lane: "kilo",
		wire: "chat",
		displayName: "North Mini Code",
		contextWindow: 256_000, // Kilo listing 实证
		maxOutput: 64_000,
		vision: false,
	},
	{
		id: "google/gemma-4-31b-it:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Gemma 4 31B",
		contextWindow: 262_144, // Kilo listing 实证（2026-11-03）
		maxOutput: 32_768,
		vision: true, // listing input_modalities 含 image+video；vision 链第 4 位
		// 2026-11-04 从 #2 降至 #13（用户纠正 + 社区实测覆盖基准分）：SWE-V 52.0 vs Qwen3.6 的 73.4、
		// r/LocalLLaMA 共识「Qwen 编码大幅胜出」、agentic 对比 Qwen3.5 胜 5/8——
		// AA 编码指数 43.4 被证明系统性高估 Gemma 系编码；通用任务仍强，编码中下
	},
	{
		id: "gpt-oss-120b",
		lane: "ovh",
		wire: "chat",
		displayName: "gpt-oss-120b",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Mistral-Small-3.2-24B-Instruct-2506",
		lane: "ovh",
		wire: "chat",
		displayName: "Mistral Small 3.2 24B",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
		// 端点实证：2026-10-19 拉 /v1/models 确认仍在（catalog_v2 avail=false 已被推翻）；旧 24B，编程中等偏下
	},
	{
		id: "gpt-oss-20b",
		lane: "ovh",
		wire: "chat",
		displayName: "gpt-oss-20b",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Meta-Llama-3_3-70B-Instruct",
		lane: "ovh",
		wire: "chat",
		displayName: "Llama 3.3 70B Instruct",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Qwen3.5-9B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.5 9B",
		contextWindow: 262_144,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Qwen2.5-VL-72B-Instruct",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen2.5 VL 72B",
		contextWindow: 32_768, // OVH 端点实证
		maxOutput: 8_192,
		vision: true, // VL = 视觉语言模型（vision 候选，但排序靠后：vision 链首选是池首的 Inkling）
	},
	{
		id: "Mistral-Nemo-Instruct-2407",
		lane: "ovh",
		wire: "chat",
		displayName: "Mistral Nemo Instruct 2407",
		contextWindow: 65_536,
		maxOutput: 16_384,
		vision: false,
		// 端点实证：2026-10-19 拉 /v1/models 确认仍在（catalog_v2 avail=false 已被推翻）；旧 12B，编程垫底
	},
	{
		id: "liquid/lfm-2.5-2.6b:free",
		lane: "kilo",
		wire: "chat",
		displayName: "LFM 2.5 2.6B",
		contextWindow: 65_536, // Kilo listing 实证
		maxOutput: 8_192,
		vision: false,
	},
]

/** Kilo listing 拉到的免费行（最小可用元数据） */
export interface KiloFreeRow {
	id: string
	contextWindow: number
	maxOutput: number
	vision: boolean
}

export interface FreeChainOptions {
	/** 请求是否携带图片（决定多模态硬过滤） */
	hasImages: boolean
	/** Kilo 免费清单；undefined = 拉取失败（回退静态实证表） */
	kiloFreeRows?: KiloFreeRow[]
	/** 隐私开关：true = 剔除收集提示词的渠道（LANE_META.collectsData），当前即排除 Kilo */
	excludeCollecting?: boolean
}

/**
 * 组装候选链（保持池内顺序 = 用户指定优先级）：
 * 1. 隐私开关开启时先剔除收集渠道（当前即 Kilo，listing 无需拉取/解析）；
 * 2. Kilo 条目按 listing 门控（见文件头说明）；Zen / OVH 始终进链；
 * 3. 带图请求只保留 vision 候选（"an image must never ride a text-only model"）。
 */
export function buildFreeCandidateChain(options: FreeChainOptions): FreeCandidate[] {
	const chain: FreeCandidate[] = []

	for (const candidate of FREE_POOL) {
		if (options.excludeCollecting && LANE_META[candidate.lane].collectsData) {
			continue
		}
		if (candidate.lane === "kilo") {
			const resolved = resolveKiloCandidate(candidate, options.kiloFreeRows)
			if (resolved) {
				chain.push(resolved)
			}
			continue
		}
		// Zen / OVH 候选始终进链：Zen 免费门是 lane 级拒绝且随时可能恢复；OVH 匿名可打全部
		chain.push(candidate)
	}

	if (options.hasImages) {
		return chain.filter((candidate) => candidate.vision)
	}
	return chain
}

function resolveKiloCandidate(candidate: FreeCandidate, rows: KiloFreeRow[] | undefined): FreeCandidate | undefined {
	if (!rows) {
		// listing 拉取失败：只放行已实证精确 ID 的条目
		return candidate.id ? candidate : undefined
	}
	if (candidate.id) {
		const row = rows.find((r) => r.id === candidate.id)
		if (!row) {
			return undefined // 已不在免费池（转付费或下线）
		}
		return { ...candidate, contextWindow: row.contextWindow, maxOutput: row.maxOutput, vision: row.vision }
	}
	if (candidate.listingMatch) {
		const row = rows.find((r) => candidate.listingMatch?.test(r.id))
		if (!row) {
			return undefined
		}
		return { ...candidate, id: row.id, contextWindow: row.contextWindow, maxOutput: row.maxOutput, vision: row.vision }
	}
	return undefined
}

/** 解析 Kilo `/models` 响应中的免费行（isFree === true） */
export function parseKiloFreeRows(payload: unknown): KiloFreeRow[] {
	const data = (payload as { data?: unknown[] })?.data
	if (!Array.isArray(data)) {
		return []
	}
	const rows: KiloFreeRow[] = []
	for (const item of data) {
		const row = item as {
			id?: unknown
			isFree?: unknown
			context_length?: unknown
			top_provider?: { context_length?: unknown; max_completion_tokens?: unknown }
			architecture?: { input_modalities?: unknown }
		}
		if (row.isFree !== true || typeof row.id !== "string" || !row.id) {
			continue
		}
		const contextWindow = numberOr(row.context_length) ?? numberOr(row.top_provider?.context_length) ?? 131_072
		const maxOutput = numberOr(row.top_provider?.max_completion_tokens) ?? 32_768
		const modalities = Array.isArray(row.architecture?.input_modalities) ? row.architecture?.input_modalities : []
		rows.push({
			id: row.id,
			contextWindow,
			maxOutput,
			vision: modalities.includes("image"),
		})
	}
	return rows
}

function numberOr(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** 全部候选（供设置页展示） */
export function getAllFreeCandidates(): FreeCandidate[] {
	return [...FREE_POOL]
}

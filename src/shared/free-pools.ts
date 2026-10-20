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
 * 池顺序（2026-10-19 重排：以 Artificial Analysis Coding Index 为骨架，用 SWE-bench Verified/Pro、
 * Terminal-Bench 2.1、DeepSWE 等独立基准与 OpenRouter 社区用量补位/破平；纯按编程能力降序，未加隐私权重）：
 * Qwen3.8-27B(ovh) → Qwen3.6-27B(ovh) → Laguna S 2.1(kilo) → Inkling Small(kilo) →
 * Ling 3.0 Flash Sante(kilo) → Dots3-Note(kilo) → Qwen3.5-397B(ovh) → Nemotron 3 Ultra(kilo) →
 * North Mini Code(kilo) → gpt-oss-120b(ovh) → Mistral Small 3.2(ovh) → gpt-oss-20b(ovh) →
 * Llama 3.3 70B(ovh) → Qwen3.5-9B(ovh) → Qwen2.5-VL-72B(ovh) → Mistral Nemo(ovh) → LFM 2.5 2.6B(kilo)。
 * （共 17 项：OVH 10 + Kilo 7；原 Zen 10 项已移出池，客户端代码休眠保留待恢复，见 知识库/07 §7.7。
 * 逐模型出处与用户裁定见 知识库/07 §7.9；纯能力序不加隐私权重。
 * 用户裁定（最高优先级）：Dots3-Note 自报 SWE-V 池内最高但实测 < Inkling → 排其后；Qwen3.6-27B 实测 > Laguna → 升 #2；
 * Ling 3.0 Flash Sante 由用户指定上移至 Dots3-Note 之前（#5，覆盖此前按编码可靠性让 Nemotron 先于 Ling 的排序）。）
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
	// Zen 渠道已暂时移出池（开箱即用原则）；客户端代码保留休眠待恢复，见 知识库/07 §7.7
	zen: { collectsData: false, note: "已暂时移出池，代码保留待恢复（需本机 opencode 客户端激活，§7.7）" },
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
	/** Kilo 条目从 listing 解析真实 ID 的匹配器（ID 未实证时使用） */
	listingMatch?: RegExp
}

/** 单一候选池：顺序 = 真实编程能力优先级（2026-10-19 重排，17 项跨两渠道，依据见 知识库/07 §7.9） */
export const FREE_POOL: readonly FreeCandidate[] = [
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
		id: "poolside/laguna-s-2.1:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Laguna S 2.1",
		contextWindow: 262_144, // Kilo listing 实证
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "thinkingmachines/inkling-small:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Inkling Small",
		contextWindow: 1_048_576, // Kilo listing 实证
		maxOutput: 262_144,
		vision: true,
	},
	{
		id: "",
		lane: "kilo",
		wire: "chat",
		displayName: "Ling 3.0 Flash Sante",
		contextWindow: 262_144,
		maxOutput: 32_768,
		vision: false,
		listingMatch: /ling-3[.\-_]?0.*flash/i, // ID 未实证（models.dev 仅有 ling-3.0-flash-fin-free），依赖 listing 解析
	},
	{
		id: "dots-studio/dots-3-note-preview:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Dots3-Note Preview",
		contextWindow: 512_000, // Kilo listing 实证
		maxOutput: 460_800,
		vision: true,
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
		id: "cohere/north-mini-code:free",
		lane: "kilo",
		wire: "chat",
		displayName: "North Mini Code",
		contextWindow: 256_000, // Kilo listing 实证
		maxOutput: 64_000,
		vision: false,
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
		vision: true, // VL = 视觉语言模型（vision 候选，但排序靠后：Inkling Small 为 vision 链首选）
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
}

/**
 * 组装候选链（保持池内顺序 = 用户指定优先级）：
 * 1. Kilo 条目按 listing 门控（见文件头说明）；Zen / OVH 始终进链；
 * 2. 带图请求只保留 vision 候选（"an image must never ride a text-only model"）。
 */
export function buildFreeCandidateChain(options: FreeChainOptions): FreeCandidate[] {
	const chain: FreeCandidate[] = []

	for (const candidate of FREE_POOL) {
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

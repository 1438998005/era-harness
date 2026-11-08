/**
 * OpenRouter 官方免费模型清单：仅用于设置页「列表切换」的展示，以及 host 拉取失败时的回落。
 *
 * ⛔ 绝不进 `FREE_POOL`、不参与候选链、不改变两个渠道的自动路由行为。请求链路仍是
 * Kilo 网关的 `openrouter/free` 虚拟路由器：上游在单次请求内部随机选一个免费模型，
 * **不按优先级依次尝试、结果不可复现**。这里列出的只是「可能被选中的模型」，
 * 不是路由顺序，也不保证一定命中清单内（采样 35% 命中池外独有免费模型）。
 *
 * 数据来源：2026-11-08 实测 `GET https://openrouter.ai/api/v1/models`（HTTP 200、
 * total 461、`:free` 后缀 12 项、零价 16 项）。零价但无 `:free` 后缀的 4 项为
 * `stealth/crouton-alpha`（Kilo 池首，不是 OpenRouter 免费变体）、两个 Lyria 音乐生成模型
 * 与虚拟路由器 `openrouter/free` 本身，均不纳入展示——音乐模型不参与聊天路由，
 * 虚拟路由器只是请求 ID、不是真实权重。
 */

export interface OpenRouterFreeModel {
	/** 官方 `:free` 变体 ID（不是 displayName、不是下标） */
	id: string
	name: string
	/** 上下文窗口；`OPENROUTER_UNKNOWN_CONTEXT_WINDOW` 表示官方未列或字段非法，UI 显示「—」 */
	contextWindow: number
	/** `architecture.input_modalities` 含 `image`；字段缺失按不支持处理 */
	vision: boolean
}

/** 「未列」哨兵：⛔ 不得把 undefined 隐式当成 0 上下文窗口，UI 见到该值显示「—」而非 0K。 */
export const OPENROUTER_UNKNOWN_CONTEXT_WINDOW = 0

/** 官方公开端点（无需 Key）；生产 webview CSP 只允许扩展源，故由 host 侧 `@/shared/net` 代拉。 */
export const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models"

/**
 * 内置静态快照（2026-11-08 实测 12 项，按 id 稳定排序）。
 * 只用于展示与失败回落，⛔ 绝不进 `FREE_POOL`、不参与候选链。
 */
export const OPENROUTER_FREE_MODELS_SNAPSHOT: readonly OpenRouterFreeModel[] = Object.freeze([
	{ id: "cohere/north-mini-code:free", name: "Cohere: North Mini Code (free)", contextWindow: 256_000, vision: false },
	{
		id: "dots-studio/dots-3-note-preview:free",
		name: "Dots Studio: Dots3-Note Preview (free)",
		contextWindow: 512_000,
		vision: true,
	},
	{
		id: "google/gemma-4-26b-a4b-it:free",
		name: "Google: Gemma 4 26B A4B (free)",
		contextWindow: 262_144,
		vision: true,
	},
	{ id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)", contextWindow: 262_144, vision: true },
	{ id: "liquid/lfm-2.5-2.6b:free", name: "LiquidAI: LFM2.5-2.6B (free)", contextWindow: 65_536, vision: false },
	{ id: "liquid/lfm-3-1.7b:free", name: "LiquidAI: LFM3-1.7B (free)", contextWindow: 262_144, vision: false },
	{
		id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
		name: "NVIDIA: Nemotron 3 Nano Omni (free)",
		contextWindow: 256_000,
		vision: true,
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		name: "NVIDIA: Nemotron 3 Ultra (free)",
		contextWindow: 1_000_000,
		vision: false,
	},
	{
		id: "nvidia/nemotron-3.5-lightning:free",
		name: "NVIDIA: Nemotron 3.5 Lightning (free)",
		contextWindow: 1_000_000,
		vision: false,
	},
	{
		id: "nvidia/nemotron-3.5-super-vl:free",
		name: "NVIDIA: Nemotron 3.5 Super VL (free)",
		contextWindow: 1_000_000,
		vision: true,
	},
	{ id: "recursive/flint-v1.0:free", name: "Recursive: Flint (free)", contextWindow: 262_144, vision: false },
	{
		id: "xingchen-agi/xing4.0-29b-a4b:free",
		name: "XingChen: Xing4.0 29B A4B (free)",
		contextWindow: 262_144,
		vision: false,
	},
])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toContextWindow(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? Math.floor(value)
		: OPENROUTER_UNKNOWN_CONTEXT_WINDOW
}

function toVision(architecture: unknown): boolean {
	if (!isRecord(architecture)) {
		return false
	}
	const modalities = architecture.input_modalities
	return Array.isArray(modalities) && modalities.includes("image")
}

/**
 * 定价归一：等价零写法（数字 `0` / `"0"` / `"0.0"`）一律视为免费；
 * 字段缺失按「无法判定」放行，非数值或脏字符串按非免费处理。
 * 官方当前返回字符串 `"0"`，但不能只认这一种字面量。
 */
function isZeroPrice(value: unknown): boolean {
	if (value === undefined || value === null || value === "") {
		return true
	}
	const numeric = typeof value === "number" ? value : Number(value)
	return Number.isFinite(numeric) && numeric === 0
}

/**
 * `:free` 后缀是主判据（官方免费变体标记），`pricing` 只是二次防线：
 * 缺失或非对象时无法判定，保守放行；是对象时两个价格必须都为零。
 */
function isFreePricing(pricing: unknown): boolean {
	if (!isRecord(pricing)) {
		return true
	}
	return isZeroPrice(pricing.prompt) && isZeroPrice(pricing.completion)
}

/**
 * 防御性解析 `/api/v1/models` 响应，供 host 侧复用。
 * 只保留 `id` 以 `:free` 结尾的免费变体；付费行、虚拟路由器、零价但无 `:free` 后缀的条目、
 * 以及任何坏数据一律排除。输出按 id 稳定排序并去重，字段缺失给保守值。
 */
export function parseOpenRouterFreeModels(payload: unknown): OpenRouterFreeModel[] {
	if (!isRecord(payload) || !Array.isArray(payload.data)) {
		return []
	}
	const byId = new Map<string, OpenRouterFreeModel>()
	for (const raw of payload.data) {
		if (!isRecord(raw)) {
			continue
		}
		const id = raw.id
		if (typeof id !== "string" || !id.endsWith(":free") || byId.has(id)) {
			continue
		}
		// 二次防线：上游若给 :free 变体挂上非零定价，按付费行处理，不要展示成免费。
		if (!isFreePricing(raw.pricing)) {
			continue
		}
		const name = typeof raw.name === "string" && raw.name.trim() ? raw.name : id
		byId.set(id, {
			id,
			name,
			contextWindow: toContextWindow(raw.context_length),
			vision: toVision(raw.architecture),
		})
	}
	return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

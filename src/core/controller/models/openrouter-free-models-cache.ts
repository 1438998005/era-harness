/**
 * 「OpenRouter 列表」展示清单的纯状态机：缓存 / TTL / 冷却 / 回落来源 / 并发去重。
 *
 * ⛔ 只负责展示数据，不进 `FREE_POOL`、不参与候选链；请求仍走 Kilo 网关的 `openrouter/free`
 * 虚拟路由器（上游随机选模型、非顺序路由）。
 *
 * 抽出本模块的理由：host handler 带 `Controller` / vscode 依赖，无法脱离扩展进程做行为测试；
 * 这里通过注入 `fetchModels` / `now`，让 TTL、失败冷却、三态来源与 in-flight 去重都能被
 * `node:test` 直接验证。与 20KB 闸门下拆出 `free-router.ts` / `openrouter-free-models.ts` 同理。
 */
import {
	OPENROUTER_FREE_MODELS_SNAPSHOT,
	type OpenRouterFreeModel,
	parseOpenRouterFreeModels,
} from "@shared/openrouter-free-models"

/**
 * 清单来源三态：
 * - `live`：本次成功拉取，或命中未过期的成功缓存（正常快路径，不报警）
 * - `cache`：刷新失败，回落上次成功拉取的官方清单（已过期，但不是内置快照）
 * - `snapshot`：刷新失败且无可用缓存，回落内置静态快照
 */
export type OpenRouterListingSource = "live" | "cache" | "snapshot"

export interface OpenRouterListingState {
	models: OpenRouterFreeModel[]
	source: OpenRouterListingSource
}

export interface OpenRouterListingDeps {
	/** 拉官方端点并返回解析前的 JSON；HTTP 非 2xx / 超时 / 解析失败一律抛错。 */
	fetchModels: () => Promise<unknown>
	/** 注入时钟，便于行为测试控制 TTL / 冷却。 */
	now: () => number
}

/** 与 `free-lanes.ts` 的 listing 缓存同构：成功 10 分钟、失败冷却 60 秒。 */
const SUCCESS_TTL_MS = 10 * 60 * 1000
const FAILURE_COOLDOWN_MS = 60 * 1000

type ListingModels = ReturnType<typeof parseOpenRouterFreeModels>

let successCache: { at: number; models: ListingModels } | undefined
let failedAt = 0
/** 并发去重：同一时刻只发一次官方请求，所有调用者共享同一个 Promise。 */
let inFlight: Promise<OpenRouterListingState> | undefined

/** 回落优先用上次成功的官方清单，没有才用内置快照；两者来源不同，UI 提示也必须不同。 */
function fallback(): OpenRouterListingState {
	return successCache
		? { models: successCache.models, source: "cache" }
		: { models: [...OPENROUTER_FREE_MODELS_SNAPSHOT], source: "snapshot" }
}

export function loadOpenRouterFreeModels(deps: OpenRouterListingDeps): Promise<OpenRouterListingState> {
	// ⛔ in-flight 判断必须早于 TTL / 冷却早退：并发中一个失败不能覆盖另一个刚写入的成功缓存。
	if (inFlight) {
		return inFlight
	}
	const now = deps.now()
	if (successCache && now - successCache.at < SUCCESS_TTL_MS) {
		return Promise.resolve({ models: successCache.models, source: "live" })
	}
	if (failedAt > 0 && now - failedAt < FAILURE_COOLDOWN_MS) {
		return Promise.resolve(fallback())
	}
	const pending = (async (): Promise<OpenRouterListingState> => {
		try {
			const models = parseOpenRouterFreeModels(await deps.fetchModels())
			if (models.length === 0) {
				failedAt = now
				return fallback()
			}
			successCache = { at: now, models }
			failedAt = 0
			return { models, source: "live" as const }
		} catch {
			failedAt = now
			return fallback()
		} finally {
			inFlight = undefined
		}
	})()
	inFlight = pending
	return pending
}

/** 测试辅助：清空成功缓存、失败冷却与 in-flight。 */
export function resetOpenRouterListingCache(): void {
	successCache = undefined
	failedAt = 0
	inFlight = undefined
}

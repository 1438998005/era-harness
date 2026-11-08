/**
 * 给设置页「OpenRouter 列表」返回官方免费模型清单（**只用于展示**）。
 *
 * 生产 webview 的 CSP `connect-src` 只允许扩展自身资源，直连 openrouter.ai 会被拦，
 * 所以由 host 侧代拉；按 `src/shared/net.ts` 的约定用代理感知的 `fetch`。
 *
 * ⛔ 这份清单不进 `FREE_POOL`、不参与候选链：请求仍走 Kilo 网关的 `openrouter/free`
 * 虚拟路由器（上游随机选模型、非顺序路由）。刷新失败时按真实来源回落到旧缓存或内置快照，
 * 分别标注，不抛错、不阻断设置页，也不落响应正文或任何凭据。
 *
 * 本文件是薄封装：缓存 / TTL / 冷却 / 三态来源 / 并发去重全部收口在
 * `openrouter-free-models-cache.ts` 的纯状态机里（可脱离 Controller 做行为测试）。
 */
import { OPENROUTER_MODELS_ENDPOINT } from "@shared/openrouter-free-models"
import { Empty } from "@shared/proto/cline/common"
import { OpenRouterFreeModelsResponse } from "@shared/proto/cline/models"
import { fetch } from "@/shared/net"
import { Controller } from ".."
import { loadOpenRouterFreeModels } from "./openrouter-free-models-cache"

const REQUEST_TIMEOUT_MS = 4000

/** 文件名与导出名必须等于 rpc 名：`generate-protobus-setup.mjs` 按名生成 import 与 handler 映射。 */
export async function refreshOpenRouterFreeModels(
	_controller: Controller,
	_request: Empty,
): Promise<OpenRouterFreeModelsResponse> {
	const state = await loadOpenRouterFreeModels({
		fetchModels: async () => {
			const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
				method: "GET",
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			})
			if (!response.ok) {
				throw new Error(`OpenRouter models endpoint returned ${response.status}`)
			}
			return response.json()
		},
		now: Date.now,
	})
	return OpenRouterFreeModelsResponse.create({
		models: state.models.map((model) => ({
			id: model.id,
			name: model.name,
			contextWindow: model.contextWindow,
			vision: model.vision,
		})),
		fromSnapshot: state.source === "snapshot",
		stale: state.source !== "live",
	})
}

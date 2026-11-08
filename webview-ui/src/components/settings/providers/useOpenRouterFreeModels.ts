/**
 * 设置页「OpenRouter 列表」的展示清单：切到该列表时才经 grpc 向 host 拉取。
 *
 * 生产 webview 的 CSP `connect-src` 只允许扩展自身资源，不能直连 openrouter.ai；
 * host handler 已带成功 TTL / 失败冷却与三态来源回落，这里只负责调用与状态。
 * grpc 一元请求没有 AbortSignal，用 `active` 标志忽略卸载/切换后的过期响应。
 */
import { OPENROUTER_FREE_MODELS_SNAPSHOT, type OpenRouterFreeModel } from "@shared/openrouter-free-models"
import { useEffect, useState } from "react"
import { ModelsServiceClient } from "@/services/grpc-client"

export interface OpenRouterFreeModelsState {
	models: readonly OpenRouterFreeModel[]
	/** true = 无可用缓存，正在展示内置静态快照 */
	fromSnapshot: boolean
	/** true = 本次未成功刷新（回落旧缓存或内置快照），false = 官方实时清单 */
	stale: boolean
	loading: boolean
}

export function useOpenRouterFreeModels(enabled: boolean): OpenRouterFreeModelsState {
	// ⛔ 首帧不得同时满足「fromSnapshot=true 且 loading=false」：那会在 effect 跑起来之前
	// 先闪一帧黄色「内置快照」警告。首次请求有结论前只显示「读取中」。
	const [state, setState] = useState<OpenRouterFreeModelsState>({
		models: OPENROUTER_FREE_MODELS_SNAPSHOT,
		fromSnapshot: false,
		stale: false,
		loading: enabled,
	})

	useEffect(() => {
		if (!enabled) {
			return
		}
		let active = true
		setState((previous) => ({ ...previous, loading: true }))
		void ModelsServiceClient.refreshOpenRouterFreeModels({})
			.then((response) => {
				if (!active) {
					return
				}
				const models = response.models ?? []
				const empty = models.length === 0
				setState({
					models: empty ? OPENROUTER_FREE_MODELS_SNAPSHOT : models,
					fromSnapshot: response.fromSnapshot === true || empty,
					stale: response.stale === true || response.fromSnapshot === true || empty,
					loading: false,
				})
			})
			.catch(() => {
				if (!active) {
					return
				}
				setState({
					models: OPENROUTER_FREE_MODELS_SNAPSHOT,
					fromSnapshot: true,
					stale: true,
					loading: false,
				})
			})
		return () => {
			active = false
		}
	}, [enabled])

	return state
}

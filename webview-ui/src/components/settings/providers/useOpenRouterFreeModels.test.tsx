// 2026-11-08 代码审查回归：OpenRouter 列表 hook 的首帧、三态来源与乱序响应。
// 运行：npm run test:ui
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ refreshOpenRouterFreeModels: vi.fn() }))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: { refreshOpenRouterFreeModels: mocks.refreshOpenRouterFreeModels },
}))

import { OPENROUTER_FREE_MODELS_SNAPSHOT } from "@shared/openrouter-free-models"
import { useOpenRouterFreeModels } from "./useOpenRouterFreeModels"

const liveModel = { id: "a/model:free", name: "A", contextWindow: 8192, vision: false }

describe("useOpenRouterFreeModels", () => {
	beforeEach(() => {
		mocks.refreshOpenRouterFreeModels.mockReset()
	})

	it("首帧只显示读取中，不闪假的「内置快照」警告", async () => {
		let resolveRequest: ((value: unknown) => void) | undefined
		mocks.refreshOpenRouterFreeModels.mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve
			}),
		)
		const { result, unmount } = renderHook(() => useOpenRouterFreeModels(true))
		expect(result.current.loading).toBe(true)
		expect(result.current.fromSnapshot).toBe(false)
		expect(result.current.stale).toBe(false)
		await act(async () => {
			resolveRequest?.({ models: [liveModel], fromSnapshot: false, stale: false })
		})
		unmount()
	})

	it("官方实时清单：fromSnapshot=false / stale=false", async () => {
		mocks.refreshOpenRouterFreeModels.mockResolvedValue({ models: [liveModel], fromSnapshot: false, stale: false })
		const { result } = renderHook(() => useOpenRouterFreeModels(true))
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.fromSnapshot).toBe(false)
		expect(result.current.stale).toBe(false)
		expect(result.current.models[0]?.id).toBe("a/model:free")
	})

	it("回落旧缓存：stale=true 但 fromSnapshot=false（不谎报内置快照）", async () => {
		mocks.refreshOpenRouterFreeModels.mockResolvedValue({ models: [liveModel], fromSnapshot: false, stale: true })
		const { result } = renderHook(() => useOpenRouterFreeModels(true))
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.stale).toBe(true)
		expect(result.current.fromSnapshot).toBe(false)
		expect(result.current.models[0]?.id).toBe("a/model:free")
	})

	it("回落内置快照：stale=true 且 fromSnapshot=true", async () => {
		mocks.refreshOpenRouterFreeModels.mockResolvedValue({ models: [], fromSnapshot: true, stale: true })
		const { result } = renderHook(() => useOpenRouterFreeModels(true))
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.fromSnapshot).toBe(true)
		expect(result.current.stale).toBe(true)
		expect(result.current.models).toEqual(OPENROUTER_FREE_MODELS_SNAPSHOT)
	})

	it("host 抛错：回落内置快照并标 stale", async () => {
		mocks.refreshOpenRouterFreeModels.mockRejectedValue(new Error("host down"))
		const { result } = renderHook(() => useOpenRouterFreeModels(true))
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.fromSnapshot).toBe(true)
		expect(result.current.stale).toBe(true)
	})

	it("disabled 时不发请求，切到 enabled 才拉一次", async () => {
		mocks.refreshOpenRouterFreeModels.mockResolvedValue({ models: [liveModel], fromSnapshot: false, stale: false })
		const { rerender } = renderHook(({ enabled }) => useOpenRouterFreeModels(enabled), {
			initialProps: { enabled: false },
		})
		expect(mocks.refreshOpenRouterFreeModels).not.toHaveBeenCalled()
		rerender({ enabled: true })
		await waitFor(() => expect(mocks.refreshOpenRouterFreeModels).toHaveBeenCalledTimes(1))
	})

	it("切换后过期响应不覆盖新结果（active 标志）", async () => {
		let resolveFirst: ((value: unknown) => void) | undefined
		let resolveSecond: ((value: unknown) => void) | undefined
		mocks.refreshOpenRouterFreeModels
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFirst = resolve
				}),
			)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveSecond = resolve
				}),
			)
		const { result, rerender } = renderHook(({ enabled }) => useOpenRouterFreeModels(enabled), {
			initialProps: { enabled: true },
		})
		await waitFor(() => expect(mocks.refreshOpenRouterFreeModels).toHaveBeenCalledTimes(1))
		rerender({ enabled: false })
		rerender({ enabled: true })
		await waitFor(() => expect(mocks.refreshOpenRouterFreeModels).toHaveBeenCalledTimes(2))
		const fresh = { id: "new:free", name: "New", contextWindow: 1, vision: false }
		await act(async () => {
			resolveSecond?.({ models: [fresh], fromSnapshot: false, stale: false })
		})
		await act(async () => {
			resolveFirst?.({ models: [], fromSnapshot: true, stale: true })
		})
		expect(result.current.models[0]?.id).toBe("new:free")
		expect(result.current.fromSnapshot).toBe(false)
	})
})

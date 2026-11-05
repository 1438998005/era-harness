import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Kimi (Moonshot) 设置卡回归（2026-11-04；2026-11-05 修 #231 后改用真实 locale 解析）。
// 断言 UI 从 @shared/moonshot-request 派生入口文案（与请求路由同一判据，不手写基址——门禁锁死）。
//
// #231 教训：原先 `t: key => key` 会把「namespace 写错」也判成通过——组件里写
// t("settings.providers.moonshot.*") 时，测试直接断言这个错误 key 存在，全绿但真实 UI 显示原始 key。
// 现在 mock 的 t 从真实 locale JSON 查表，解析不到就返回 `MISSING_I18N_KEY:<key>`，
// 于是任何错误 key 都会让下面的断言失败。

const mocks = vi.hoisted(() => ({
	handleFieldChange: vi.fn(),
	handleModeFieldsChange: vi.fn(),
	refreshOpenAiModels: vi.fn().mockResolvedValue({ values: [] }),
	// #232：mergeLiveModelIds 是观察在线同步结果的现成落点（第 2 参 = liveModelIds）
	mergeLiveModelIds: vi.fn(() => ({})),
}))

const state = vi.hoisted(() => ({ apiKey: "", apiLine: undefined as string | undefined }))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: { refreshOpenAiModels: mocks.refreshOpenAiModels },
	UiServiceClient: { openUrl: vi.fn().mockResolvedValue({}) },
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ apiConfiguration: { moonshotApiKey: state.apiKey, moonshotApiLine: state.apiLine } }),
}))

vi.mock("../utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: () => ({
		handleFieldChange: mocks.handleFieldChange,
		handleModeFieldsChange: mocks.handleModeFieldsChange,
	}),
}))

vi.mock("../utils/providerUtils", () => ({
	normalizeApiConfiguration: () => ({ selectedModelId: "kimi-k3.1-pro", selectedModelInfo: {} }),
	mergeLiveModelIds: mocks.mergeLiveModelIds,
}))

vi.mock("react-i18next", async () => {
	// useTranslation("settings") 已经吃掉一层 namespace：key 相对 settings.json 的顶层键。
	const enSettings = (await import("../../../locales/en/settings.json")).default as Record<string, unknown>
	const enCommon = (await import("../../../locales/en/common.json")).default as Record<string, unknown>
	const lookup = (root: Record<string, unknown>, key: string): unknown =>
		key
			.split(".")
			.reduce<unknown>(
				(node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
				root,
			)
	const t = (key: string, options?: { count?: number }) => {
		const value = lookup(enSettings, key) ?? lookup(enCommon, key)
		if (typeof value !== "string") {
			return `MISSING_I18N_KEY:${key}`
		}
		return value.replace(/\{\{count\}\}/g, String(options?.count ?? ""))
	}
	return {
		useTranslation: () => ({ t, i18n: { language: "en" } }),
		Trans: ({ children }: { children?: unknown }) => children,
	}
})

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ onInput, value, placeholder, children }: any) => (
		<div>
			{children}
			<input
				aria-label={placeholder}
				data-testid="toolkit-input"
				onInput={(e: any) => onInput?.(e)}
				placeholder={placeholder}
				value={value ?? ""}
			/>
		</div>
	),
	VSCodeLink: ({ children }: any) => <a>{children}</a>,
}))

vi.mock("../common/ModelSelector", () => ({
	ModelSelector: () => null,
	DropdownContainer: ({ children }: any) => children,
}))

vi.mock("../common/ModelInfoView", () => ({ ModelInfoView: () => null }))

vi.mock("../ReasoningEffortSelector", () => ({ default: () => null }))

import { MoonshotProvider } from "./MoonshotProvider"

const renderProvider = (apiKey: string, apiLine?: string, showModelOptions = true) => {
	state.apiKey = apiKey
	state.apiLine = apiLine
	return render(<MoonshotProvider currentMode={"act" as never} showModelOptions={showModelOptions} />)
}

describe("MoonshotProvider 双入口（用户裁定：默认国内站）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("默认（未选）→ 当前调用入口为国内基址 api.moonshot.cn/v1", () => {
		renderProvider("sk-test")
		const line = screen.getByText(/^当前调用入口：/)
		expect(line.textContent).toContain("api.moonshot.cn/v1")
		expect(line.textContent).not.toContain("api.moonshot.ai/v1")
	})

	it("international → 当前调用入口为国际基址 api.moonshot.ai/v1", () => {
		renderProvider("sk-test", "international")
		const line = screen.getByText(/^当前调用入口：/)
		expect(line.textContent).toContain("api.moonshot.ai/v1")
		expect(line.textContent).not.toContain("api.moonshot.cn/v1")
	})

	it("入口下拉与说明渲染真实本地化文案，不出现原始 key 或 MISSING_I18N_KEY（#231）", () => {
		renderProvider("sk-test")
		expect(screen.getByText(/^China endpoint: https:\/\/api\.moonshot\.cn\/v1/)).toBeTruthy()
		expect(screen.getByText("China (api.moonshot.cn)")).toBeTruthy()
		expect(screen.getByText("International (api.moonshot.ai)")).toBeTruthy()
		expect(screen.queryByText(/settings\.providers\.moonshot\./)).toBeNull()
		expect(screen.queryByText(/MISSING_I18N_KEY/)).toBeNull()
	})

	it("showModelOptions=true 时主区域的价格提示也是真实文案（不再靠 false 跳过主区）", () => {
		renderProvider("sk-test", undefined, true)
		expect(screen.getByText(/^Prices are official pay-as-you-go rates/)).toBeTruthy()
		expect(screen.queryByText(/MISSING_I18N_KEY/)).toBeNull()
	})
})

describe("MoonshotProvider 在线同步竞态守卫（#232）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it("旧请求慢返回不覆盖新 Key 的结果（以最后一次发起为准）", async () => {
		let resolveSlow: (value: { values: string[] }) => void = () => {}
		mocks.refreshOpenAiModels.mockReset()
		mocks.refreshOpenAiModels
			.mockImplementationOnce(
				() =>
					new Promise((res) => {
						resolveSlow = res
					}),
			)
			.mockImplementationOnce(() => Promise.resolve({ values: ["fast-new-model"] }))

		const { rerender } = renderProvider("sk-old")
		await act(async () => {
			vi.advanceTimersByTime(800)
		})
		expect(mocks.refreshOpenAiModels).toHaveBeenCalledTimes(1)
		expect(mocks.refreshOpenAiModels.mock.calls[0][0].apiKey).toBe("sk-old")

		// 换 Key 触发第二次防抖请求（旧请求仍在途）
		state.apiKey = "sk-new"
		rerender(<MoonshotProvider currentMode={"act" as never} showModelOptions />)
		await act(async () => {
			vi.advanceTimersByTime(800)
		})
		expect(mocks.refreshOpenAiModels).toHaveBeenCalledTimes(2)
		expect(mocks.refreshOpenAiModels.mock.calls[1][0].apiKey).toBe("sk-new")

		// 快请求已写回新结果之后，放掉旧响应：必须被作废，不得覆盖
		await act(async () => {
			resolveSlow({ values: ["slow-old-model"] })
		})
		const calls = mocks.mergeLiveModelIds.mock.calls
		expect(calls.length).toBe(2) // mount([]) + 快请求([new])；慢响应不再触发第 3 次
		expect(calls.at(-1)?.[1]).toEqual(["fast-new-model"])
		expect(screen.getByText("Synced 1 models from Kimi")).toBeTruthy()
	})

	it("清空 Key 作废在途请求：旧响应回来不再写回，刷新按钮不卡在加载态", async () => {
		let resolveSlow: (value: { values: string[] }) => void = () => {}
		mocks.refreshOpenAiModels.mockReset()
		mocks.refreshOpenAiModels.mockImplementationOnce(
			() =>
				new Promise((res) => {
					resolveSlow = res
				}),
		)

		const { rerender } = renderProvider("sk-x")
		await act(async () => {
			vi.advanceTimersByTime(800)
		})
		expect(mocks.refreshOpenAiModels).toHaveBeenCalledTimes(1)

		state.apiKey = ""
		rerender(<MoonshotProvider currentMode={"act" as never} showModelOptions />)
		await act(async () => {
			resolveSlow({ values: ["slow-old-model"] })
		})

		expect(mocks.mergeLiveModelIds).toHaveBeenCalledTimes(1) // 只有 mount 那次，旧结果不写回
		expect(mocks.mergeLiveModelIds.mock.calls[0][1]).toEqual([])
		// 刷新按钮复位为可点状态，不卡在「Syncing…」（在途请求被作废后由清空分支复位）
		expect(screen.getByText("Refresh model list")).toBeTruthy()
		expect(screen.queryByText("Syncing…")).toBeNull()
	})

	it("旧请求晚到的错误不覆盖新 Key 的成功结果", async () => {
		let rejectSlow: (error: Error) => void = () => {}
		mocks.refreshOpenAiModels.mockReset()
		mocks.refreshOpenAiModels
			.mockImplementationOnce(
				() =>
					new Promise((_res, rej) => {
						rejectSlow = rej
					}),
			)
			.mockImplementationOnce(() => Promise.resolve({ values: ["fast-new-model"] }))

		const { rerender } = renderProvider("sk-old")
		await act(async () => {
			vi.advanceTimersByTime(800)
		})
		state.apiKey = "sk-new"
		rerender(<MoonshotProvider currentMode={"act" as never} showModelOptions />)
		await act(async () => {
			vi.advanceTimersByTime(800)
		})
		await act(async () => {
			rejectSlow(new Error("stale-401"))
		})

		// 新 Key 的成功结果仍在，旧错误不出现（修复前会显示「同步失败原因：stale-401」并抹掉计数）
		expect(screen.getByText("Synced 1 models from Kimi")).toBeTruthy()
		expect(screen.queryByText(/同步失败原因：/)).toBeNull()
	})
})

import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// 腾讯云 TokenHub 设置卡回归（2026-11-24，KB 08 #270）。
// 断言 UI 从 @shared/tencent-request 派生入口文案（与请求路由同一判据，不手写基址——门禁锁死），
// 并沿用 #231 的真实 locale 解析（t 查真实 en/settings.json，错误 key 必然显形为 MISSING_I18N_KEY）。

const mocks = vi.hoisted(() => ({
	handleFieldChange: vi.fn(),
	handleModeFieldsChange: vi.fn(),
	refreshOpenAiModels: vi.fn().mockResolvedValue({ values: [] }),
	// 透传内置清单（第 1 参），在线清单合并逻辑不在本卡测试范围
	mergeLiveModelIds: vi.fn((builtin: Record<string, unknown>) => builtin),
}))

const state = vi.hoisted(() => ({ apiKey: "", apiLine: undefined as string | undefined }))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: { refreshOpenAiModels: mocks.refreshOpenAiModels },
	UiServiceClient: { openUrl: vi.fn().mockResolvedValue({}) },
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: {
			tencentTokenhubApiKey: state.apiKey,
			tencentTokenhubApiLine: state.apiLine,
		},
	}),
}))

vi.mock("../utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: () => ({
		handleFieldChange: mocks.handleFieldChange,
		handleModeFieldsChange: mocks.handleModeFieldsChange,
	}),
}))

vi.mock("../utils/providerUtils", () => ({
	normalizeApiConfiguration: () => ({ selectedModelId: "hy3", selectedModelInfo: {} }),
	mergeLiveModelIds: mocks.mergeLiveModelIds,
	nextProviderModelIds: vi.fn(() => ({})),
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

vi.mock("@/components/ui/button", () => ({ Button: ({ children }: any) => <button type="button">{children}</button> }))

vi.mock("../common/ApiKeyField", () => ({
	ApiKeyField: ({ initialValue, providerName }: any) => (
		<div>
			{providerName}:{initialValue}
		</div>
	),
}))

vi.mock("../common/ModelSelector", () => ({
	ModelSelector: ({ models }: any) => <div data-testid="model-selector">{Object.keys(models).join(",")}</div>,
}))

vi.mock("../common/ModelInfoView", () => ({ ModelInfoView: () => null }))
// #273：不再 mock 成 null——透传 defaultEffort，锁「界面默认档 = 官方默认 high」不回退
vi.mock("../ReasoningEffortSelector", () => ({
	default: ({ defaultEffort }: { defaultEffort?: string }) => (
		<div data-testid="reasoning-effort">{defaultEffort ?? "(unset)"}</div>
	),
}))

import { TencentTokenhubProvider } from "./TencentTokenhubProvider"

const renderProvider = (apiKey: string, apiLine?: string, showModelOptions = true) => {
	state.apiKey = apiKey
	state.apiLine = apiLine
	return render(<TencentTokenhubProvider currentMode={"act" as never} showModelOptions={showModelOptions} />)
}

describe("TencentTokenhubProvider 双入口（用户裁定：默认广州站）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("默认（未选）→ 当前调用入口为广州基址 tokenhub.tencentmaas.com/v1", () => {
		renderProvider("sk-test")
		const line = screen.getByText(/^当前调用入口：/)
		expect(line.textContent).toContain("https://tokenhub.tencentmaas.com/v1")
		expect(line.textContent).not.toContain("tokenhub-intl")
	})

	it("intl → 当前调用入口为新加坡基址 tokenhub-intl.tencentmaas.com/v1", () => {
		renderProvider("sk-test", "intl")
		const line = screen.getByText(/^当前调用入口：/)
		expect(line.textContent).toContain("https://tokenhub-intl.tencentmaas.com/v1")
	})

	it("入口下拉与说明渲染真实本地化文案，不出现原始 key 或 MISSING_I18N_KEY（#231）", () => {
		renderProvider("sk-test")
		expect(screen.getByText(/^Guangzhou endpoint https:\/\/tokenhub\.tencentmaas\.com\/v1/)).toBeTruthy()
		expect(screen.getByText("Guangzhou (tokenhub.tencentmaas.com)")).toBeTruthy()
		expect(screen.getByText("Singapore (tokenhub-intl.tencentmaas.com)")).toBeTruthy()
		expect(screen.queryByText(/settings\.providers\.tencentTokenhub\./)).toBeNull()
		expect(screen.queryByText(/MISSING_I18N_KEY/)).toBeNull()
	})

	it("showModelOptions=true 时模型下拉来自内置清单、价格提示为真实文案", () => {
		renderProvider("sk-test", undefined, true)
		const selector = screen.getByTestId("model-selector")
		expect(selector.textContent).toContain("hy3")
		expect(selector.textContent).toContain("deepseek-v4.1-flash-1017")
		expect(screen.getByText(/^Prices are official pay-as-you-go rates/)).toBeTruthy()
		expect(screen.queryByText(/MISSING_I18N_KEY/)).toBeNull()
	})

	it("思考强度默认档是 high（官方默认，#273）——不是 medium", () => {
		renderProvider("sk-test", undefined, true)
		expect(screen.getByTestId("reasoning-effort").textContent).toBe("high")
	})
})

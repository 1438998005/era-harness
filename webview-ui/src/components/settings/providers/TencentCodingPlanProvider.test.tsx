import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// 腾讯云 Coding Plan 设置卡回归（2026-11-24，KB 08 #270）。
// 断言：sk-sp- 与按量 Key 不互通的警示文案、套餐基址直出、默认 tc-code-latest、
// 套餐价格归零提示；沿用 #231 的真实 locale 解析（错误 key 显形为 MISSING_I18N_KEY）。

const mocks = vi.hoisted(() => ({
	handleFieldChange: vi.fn(),
	handleModeFieldsChange: vi.fn(),
}))

const state = vi.hoisted(() => ({ apiKey: "", modelId: undefined as string | undefined }))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: { refreshOpenAiModels: vi.fn().mockResolvedValue({ values: [] }) },
	UiServiceClient: { openUrl: vi.fn().mockResolvedValue({}) },
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: {
			tencentCodingPlanApiKey: state.apiKey,
			actModeApiModelId: state.modelId,
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
	normalizeApiConfiguration: () => ({ selectedModelId: state.modelId ?? "tc-code-latest", selectedModelInfo: {} }),
	nextProviderModelIds: vi.fn(() => ({})),
}))

vi.mock("react-i18next", async () => {
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

vi.mock("@/components/common/InlineCode", () => ({
	InlineCode: ({ children }: any) => <code>{children}</code>,
}))

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

import { TENCENT_CODING_PLAN_BASE_URL } from "@shared/tencent-request"
import { TencentCodingPlanProvider } from "./TencentCodingPlanProvider"

const renderProvider = (apiKey: string, modelId?: string, showModelOptions = true) => {
	state.apiKey = apiKey
	state.modelId = modelId
	return render(<TencentCodingPlanProvider currentMode={"act" as never} showModelOptions={showModelOptions} />)
}

describe("TencentCodingPlanProvider（套餐入口）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("警示文案写明 sk-sp- 与按量 Key 不互通，端点固定 lkeap 套餐域", () => {
		renderProvider("sk-sp-test")
		expect(screen.getByText("腾讯云 Coding Plan:sk-sp-test")).toBeTruthy()
		expect(screen.getByText(TENCENT_CODING_PLAN_BASE_URL)).toBeTruthy()
		expect(screen.getByText(/Coding Plan 专属 Key/)).toBeTruthy()
	})

	it("showModelOptions=true 时默认档 tc-code-latest 进下拉、套餐计费说明为真实文案", () => {
		renderProvider("sk-sp-test", undefined, true)
		expect(screen.getByTestId("model-selector").textContent).toContain("tc-code-latest")
		expect(screen.getByText(/^The plan is billed by subscription quota/)).toBeTruthy()
		expect(screen.queryByText(/MISSING_I18N_KEY/)).toBeNull()
	})

	it("手填的清单外模型名并进下拉（官方动态模型库），并显示未知模型警示", () => {
		renderProvider("sk-sp-test", "glm-5", true)
		const selector = screen.getByTestId("model-selector")
		expect(selector.textContent).toContain("tc-code-latest")
		expect(selector.textContent).toContain("glm-5")
		expect(screen.getByText(/not in the built-in catalog/)).toBeTruthy()
	})

	it("手填入口：输入清单外名字回车提交，handleModeFieldsChange 收到去空白后的 id（#276）", async () => {
		renderProvider("sk-sp-test", undefined, true)
		const input = screen.getByPlaceholderText(/officially published model name/)
		fireEvent.change(input, { target: { value: "  kimi-k2.5  " } })
		fireEvent.keyDown(input, { key: "Enter" })
		await waitFor(() => expect(mocks.handleModeFieldsChange).toHaveBeenCalledTimes(1))
		const [, values] = mocks.handleModeFieldsChange.mock.calls[0]
		expect(values.modelId).toBe("kimi-k2.5")

		// 空白输入不提交（trim 后为空直接忽略）
		fireEvent.change(input, { target: { value: "   " } })
		fireEvent.keyDown(input, { key: "Enter" })
		expect(mocks.handleModeFieldsChange).toHaveBeenCalledTimes(1)
	})
})

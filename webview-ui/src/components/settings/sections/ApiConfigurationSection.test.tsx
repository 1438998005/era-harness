import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// P2-5 防同类回归（2026-11-04 复审）：辅助模型设置曾被 `!isFree &&` 隐藏，
// 导致「主免费 + 辅助付费」这一跨厂商场景找不到入口。
// 这里钉住「无论主 provider 是不是免费池，辅助设置都必须渲染」，
// 且免费池页必须带自身限高（不破坏 FreePoolTable 内部滚动的高度链）。

const state = vi.hoisted(() => ({ provider: "free" as string }))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ children, onChange }: any) => (
		<label>
			<input onChange={onChange} type="checkbox" />
			{children}
		</label>
	),
}))

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		planActSeparateModelsSetting: false,
		mode: "act",
		apiConfiguration: {
			actModeApiProvider: state.provider,
			planModeApiProvider: state.provider,
		},
	}),
}))

vi.mock("@/services/grpc-client", () => ({
	StateServiceClient: { updateSettings: vi.fn().mockResolvedValue({}) },
}))

vi.mock("../../mcp/configuration/McpConfigurationView", () => ({
	TabButton: ({ children }: any) => <button type="button">{children}</button>,
}))

vi.mock("../ApiOptions", () => ({ default: () => <div data-api-options="" /> }))
vi.mock("../AuxiliaryModelSettings", () => ({ default: () => <div data-aux-settings="" /> }))
vi.mock("../utils/providerUtils", () => ({
	normalizeApiConfiguration: () => ({ selectedProvider: state.provider, selectedModelInfo: {} }),
	syncModeConfigurations: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("../utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: () => ({ handleFieldsChange: vi.fn() }),
}))

import ApiConfigurationSection from "./ApiConfigurationSection"

describe("ApiConfigurationSection 辅助模型设置常驻", () => {
	afterEach(() => {
		cleanup()
		state.provider = "free"
	})

	it("主模型是免费池时仍能看到辅助模型设置，且自身限高不挤压表格", () => {
		state.provider = "free"
		const { container } = render(<ApiConfigurationSection />)
		const aux = container.querySelector("[data-aux-settings]")
		expect(aux).not.toBeNull()
		expect(aux?.parentElement?.className).toContain("max-h-[40vh]")
	})

	it("主模型是付费 provider 时同样可见", () => {
		state.provider = "deepseek"
		const { container } = render(<ApiConfigurationSection />)
		expect(container.querySelector("[data-aux-settings]")).not.toBeNull()
	})
})

import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// P2-5 防同类回归（2026-11-04 复审）：辅助模型设置曾被 `!isFree &&` 隐藏，
// 导致「主免费 + 辅助付费」这一跨厂商场景找不到入口。
// KB 08 #236（2026-11-05 用户裁定）追加：这里同时钉住「辅助区不再限高自身滚动」——
// 旧实现用 max-h-[40vh] overflow-y-auto 把辅助区塞进独立滚动容器，与整页滚争滚轮、
// 从模型池往下滚会出现断点。现在整页滚由 SettingsView 的 TabContent 统一承担。

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

	it("主模型是免费池时仍能看到辅助模型设置，且交给整页滚、不再自身限高", () => {
		state.provider = "free"
		const { container } = render(<ApiConfigurationSection />)
		const aux = container.querySelector("[data-aux-settings]")
		expect(aux).not.toBeNull()
		const wrapperClass = aux?.parentElement?.className ?? ""
		expect(wrapperClass).not.toContain("max-h-[40vh]")
		expect(wrapperClass).not.toContain("overflow-y-auto")
		// #224 防回归：免费池判据仍与 ApiOptions 的 currentMode 同源，不能只看全局 mode
		expect(container.querySelector('[data-free-provider="true"]')).not.toBeNull()
	})

	it("主模型是付费 provider 时同样可见，且不打免费池标记", () => {
		state.provider = "deepseek"
		const { container } = render(<ApiConfigurationSection />)
		expect(container.querySelector("[data-aux-settings]")).not.toBeNull()
		expect(container.querySelector('[data-free-provider="true"]')).toBeNull()
	})
})

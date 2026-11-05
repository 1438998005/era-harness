import PROVIDERS from "@shared/providers/providers.json"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// P2-3 回归（2026-11-04 审查）：快速切换菜单是硬编码条目（KB 18 §18.11 同款坑），
// 设置页加了 Kimi 但菜单没加 → 用户切走后切不回来、当前是 Kimi 时也没有选中态。

const mocks = vi.hoisted(() => ({
	handleModeFieldsChange: vi.fn().mockResolvedValue(undefined),
	navigateToSettingsModelPicker: vi.fn(),
}))

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

vi.mock("@/components/ui/popover", () => ({
	Popover: ({ children }: any) => <div>{children}</div>,
	PopoverTrigger: ({ children }: any) => <>{children}</>,
	PopoverContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/components/settings/utils/providerUtils", () => ({
	normalizeApiConfiguration: () => ({ selectedProvider: "deepseek", selectedModelInfo: {} }),
}))

vi.mock("@/components/settings/utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: () => ({ handleModeFieldsChange: mocks.handleModeFieldsChange }),
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: {
			actModeApiProvider: "deepseek",
			planModeApiProvider: "deepseek",
			actModeApiModelId: "deepseek-v4-pro",
			planModeApiModelId: "deepseek-v4-pro",
		},
		navigateToSettingsModelPicker: mocks.navigateToSettingsModelPicker,
	}),
}))

import { ModelQuickSwitchMenu } from "./ModelQuickSwitchMenu"

describe("ModelQuickSwitchMenu 含 Kimi 条目", () => {
	afterEach(() => {
		cleanup()
		vi.clearAllMocks()
	})

	it("菜单里能看到「Kimi (Moonshot)」及其默认档价格", () => {
		render(<ModelQuickSwitchMenu mode={"act" as never} trigger={<button type="button">model</button>} />)
		expect(screen.getByText("Kimi (Moonshot)")).toBeTruthy()
		expect(screen.getByText(/输入 ¥1\.3–13 \/ 输出 ¥68/)).toBeTruthy()
	})

	it("结构性防同类：菜单条目与 providers.json 一一对应（新增 provider 忘了加菜单会红）", () => {
		render(<ModelQuickSwitchMenu mode={"act" as never} trigger={<button type="button">model</button>} />)
		const rendered = Array.from(document.querySelectorAll("[data-provider]"))
			.map((el) => el.getAttribute("data-provider"))
			.sort()
		const expected = PROVIDERS.list.map((entry) => entry.value).sort()
		expect(rendered).toEqual(expected)
	})

	it("点 Kimi 条目走同一份归属判据，写入 moonshot + 默认档 id", async () => {
		render(<ModelQuickSwitchMenu mode={"act" as never} trigger={<button type="button">model</button>} />)
		fireEvent.click(screen.getByText("Kimi (Moonshot)"))
		await waitFor(() => expect(mocks.handleModeFieldsChange).toHaveBeenCalledTimes(1))
		const [, values] = mocks.handleModeFieldsChange.mock.calls[0]
		expect(values.provider).toBe("moonshot")
		expect(values.modelId).toBe("kimi-k3.1-pro")
	})
})

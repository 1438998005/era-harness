// era harness：#27 自动实测 —— 真渲染 OpenAICompatibleProvider，验证选择 "OpenAI Compatible"
// 时设置 UI 是否真的给出可编辑的 Base URL 输入、且输入会落到 openAiBaseUrl 配置。
// 这是执行级验证（jsdom 渲染真实组件树 + testing-library 查询真实 DOM），不是读后端代码。
// 运行：node node_modules/vitest/vitest.mjs run src/components/settings/providers/OpenAICompatible.test.tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 共享 spy：由 useApiConfigurationHandlers mock 暴露，供断言"输入是否落到 openAiBaseUrl"。
const mocks = vi.hoisted(() => ({
	handleFieldChange: vi.fn(),
	handleModeFieldChange: vi.fn(),
	refreshOpenAiModels: vi.fn().mockResolvedValue({}),
}))

// 受控的 apiConfiguration / remoteConfigSettings：用可变对象，方便两个用例切换。
const state = vi.hoisted(() => ({ apiConfiguration: {} as any, remoteConfigSettings: undefined as any }))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	// 把 web component 换成原生 <input>，转发 onInput/value/placeholder/disabled，使 testing-library 可查询。
	VSCodeTextField: ({ onInput, value, placeholder, disabled, children, type }: any) => (
		<div>
			{children}
			<input
				aria-label={placeholder}
				data-testid="toolkit-input"
				disabled={disabled}
				onInput={(e: any) => onInput?.(e)}
				placeholder={placeholder}
				type={type ?? "text"}
				value={value ?? ""}
			/>
		</div>
	),
	VSCodeCheckbox: ({ children }: any) => <label>{children}</label>,
	VSCodeLink: ({ children }: any) => <a>{children}</a>,
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ apiConfiguration: state.apiConfiguration, remoteConfigSettings: state.remoteConfigSettings }),
}))

vi.mock("../utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: () => ({
		handleFieldChange: mocks.handleFieldChange,
		handleModeFieldChange: mocks.handleModeFieldChange,
	}),
}))

// providerUtils 里三个渲染期即调用的纯函数：给最小合法值，绕开对完整配置形态的依赖。
vi.mock("../utils/providerUtils", () => ({
	normalizeApiConfiguration: () => ({ selectedModelId: "", selectedModelInfo: {} }),
	getModeSpecificFields: () => ({ openAiModelInfo: undefined }),
	supportsReasoningEffortForModelId: () => false,
}))

vi.mock("react-i18next", () => ({
	// t(key) 原样返回 key，便于按 i18n key 精确定位元素。
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/ui/tooltip", () => ({
	Tooltip: ({ children }: any) => <div>{children}</div>,
}))
vi.mock("@radix-ui/react-tooltip", () => ({
	TooltipTrigger: ({ children }: any) => <div>{children}</div>,
	TooltipContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: { refreshOpenAiModels: mocks.refreshOpenAiModels },
}))

vi.mock("@/utils/vscStyles", () => ({
	getAsVar: () => "var(--vscode-descriptionForeground)",
	VSC_DESCRIPTION_FOREGROUND: "--vscode-descriptionForeground",
}))

// 折叠区/底部区才用到的重组件，showModelOptions=false 时不渲染，mock 仅为满足顶层 import。
vi.mock("../common/ModelInfoView", () => ({ ModelInfoView: () => null }))
vi.mock("../ReasoningEffortSelector", () => ({ default: () => null }))

import { OpenAICompatibleProvider } from "./OpenAICompatible"

describe("OpenAI Compatible 设置 UI（#27 实测）", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		mocks.handleFieldChange.mockClear()
		state.apiConfiguration = {}
		state.remoteConfigSettings = undefined
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it("渲染出 Base URL 输入框，默认（无远端锁定）可编辑", () => {
		render(<OpenAICompatibleProvider currentMode={"plan" as any} isPopup={false} showModelOptions={false} />)

		// 标签存在（getByText 找不到会抛错，即断言）
		expect(screen.getByText("commonFields.baseUrl")).toBeTruthy()
		// Base URL 输入存在且未被禁用（placeholder 键唯一标识它）
		const input = screen.getByPlaceholderText("commonFields.enterBaseUrl") as HTMLInputElement
		expect(input).toBeTruthy()
		expect(input.disabled).toBe(false)
	})

	it("在 Base URL 输入框键入端点 → 防抖后落到 openAiBaseUrl 配置", () => {
		render(<OpenAICompatibleProvider currentMode={"plan" as any} isPopup={false} showModelOptions={false} />)

		const input = screen.getByPlaceholderText("commonFields.enterBaseUrl")
		fireEvent.input(input, { target: { value: "https://my-domestic-endpoint/v1" } })

		// useDebouncedInput 默认 100ms 后回写
		vi.advanceTimersByTime(150)

		expect(mocks.handleFieldChange).toHaveBeenCalledWith("openAiBaseUrl", "https://my-domestic-endpoint/v1")
	})

	it("当远端配置锁定了 openAiBaseUrl 时，输入框被禁用", () => {
		state.remoteConfigSettings = { openAiBaseUrl: "https://locked.example/v1" }
		render(<OpenAICompatibleProvider currentMode={"plan" as any} isPopup={false} showModelOptions={false} />)

		const input = screen.getByPlaceholderText("commonFields.enterBaseUrl") as HTMLInputElement
		expect(input.disabled).toBe(true)
	})
})

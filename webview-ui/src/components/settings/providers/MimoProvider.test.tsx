import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// era harness：MiMo 设置卡「入口自动路由提示 + 当前调用路径实时显示」（计划任务 B）。
// 断言 UI 从 mimoRouteForKey 派生四态文案（与请求路由同一判据，不手写基址——门禁锁死）。

const mocks = vi.hoisted(() => ({
	handleFieldChange: vi.fn(),
	handleModeFieldsChange: vi.fn(),
	refreshOpenAiModels: vi.fn().mockResolvedValue({ values: [] }),
}))

const state = vi.hoisted(() => ({ apiKey: "" }))

vi.mock("@/services/grpc-client", () => ({
	ModelsServiceClient: { refreshOpenAiModels: mocks.refreshOpenAiModels },
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ apiConfiguration: { mimoApiKey: state.apiKey } }),
}))

vi.mock("../utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: () => ({
		handleFieldChange: mocks.handleFieldChange,
		handleModeFieldsChange: mocks.handleModeFieldsChange,
	}),
}))

vi.mock("../utils/providerUtils", () => ({
	normalizeApiConfiguration: () => ({ selectedModelId: "mimo-v2.6-flash", selectedModelInfo: {} }),
	mergeLiveModelIds: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

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

import { MimoProvider } from "./MimoProvider"

const renderProvider = (apiKey: string) => {
	state.apiKey = apiKey
	return render(<MimoProvider currentMode={"act" as never} showModelOptions={false} />)
}

describe("MimoProvider 入口路由显示（任务 B）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("tp- 密钥 → 显示 Token Plan 订阅入口（订阅基址）", () => {
		renderProvider("tp-test")
		expect(screen.getByText(/token-plan-cn\.xiaomimimo\.com\/v1/)).toBeTruthy()
		expect(screen.getByText(/按套餐扣费/)).toBeTruthy()
	})

	it("sk- 密钥 → 显示按量付费实时入口，且不出现订阅基址", () => {
		renderProvider("sk-test")
		expect(screen.getByText(/api\.xiaomimimo\.com\/v1/)).toBeTruthy()
		expect(screen.queryByText(/token-plan-cn/)).toBeNull()
	})

	it("未知前缀 → 警示文案（提醒确认复制完整）", () => {
		renderProvider("oops")
		expect(screen.getByText(/未识别的密钥格式/)).toBeTruthy()
	})

	it("空密钥 → 占位文案", () => {
		renderProvider("")
		expect(screen.getByText(/填入密钥后自动识别/)).toBeTruthy()
	})
})

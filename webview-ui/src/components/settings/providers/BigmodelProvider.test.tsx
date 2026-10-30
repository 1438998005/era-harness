import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// era harness：智谱 BigModel 设置卡（计划任务 C）。
// 断言：密钥框/控制台/文档入口存在；bigmodel provider 下价格与阶梯/免费说明在；
// 未知模型 id 不崩（归一化保留 + 保守元数据）。

const mocks = vi.hoisted(() => ({
	handleFieldChange: vi.fn(),
	handleModeFieldsChange: vi.fn(),
	openUrl: vi.fn().mockResolvedValue({}),
}))

const state = vi.hoisted(() => ({ apiConfig: {} as Record<string, unknown> }))

vi.mock("@/services/grpc-client", () => ({
	UiServiceClient: { openUrl: mocks.openUrl },
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ apiConfiguration: state.apiConfig }),
}))

vi.mock("../utils/useApiConfigurationHandlers", () => ({
	useApiConfigurationHandlers: () => ({
		handleFieldChange: mocks.handleFieldChange,
		handleModeFieldsChange: mocks.handleModeFieldsChange,
	}),
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

// 把档位选择器桩成回显 allowedEfforts：断言「哪些模型能调、能调哪几档」而不渲染真实控件
vi.mock("../ReasoningEffortSelector", () => ({
	default: ({ allowedEfforts, label }: any) => (
		<div data-efforts={allowedEfforts.join(",")} data-testid="effort-selector">
			{label}
		</div>
	),
}))

import { BigmodelProvider } from "./BigmodelProvider"

describe("BigmodelProvider（任务 C）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		state.apiConfig = {}
	})

	it("渲染密钥框与控制台/文档入口", () => {
		render(<BigmodelProvider currentMode={"act" as never} showModelOptions={false} />)
		expect(screen.getByLabelText("填入 API 密钥…")).toBeTruthy()
		expect(screen.getByText(/打开控制台/)).toBeTruthy()
		expect(screen.getByText(/API 文档/)).toBeTruthy()
	})

	it("bigmodel provider 下显示阶梯与免费说明", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel", bigmodelApiKey: "k", actModeApiModelId: "glm-5.3-flash" }
		render(<BigmodelProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByText(/32K/)).toBeTruthy()
		expect(screen.getByText(/· 免费/)).toBeTruthy()
		expect(screen.getByText(/额度不互通/)).toBeTruthy()
	})

	it("未知模型 id 不崩（归一化保留 + 保守元数据）", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel", actModeApiModelId: "glm-9.9" }
		render(<BigmodelProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByLabelText("填入 API 密钥…")).toBeTruthy()
	})

	it("#81 5.3 系渲染思维强度，档位 low/high/xhigh（不可关闭）", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel", bigmodelApiKey: "k", actModeApiModelId: "glm-5.3-flash" }
		render(<BigmodelProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByTestId("effort-selector").getAttribute("data-efforts")).toBe("low,high,xhigh")
	})

	it("#81 5.2 额外提供「关闭」档", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel", bigmodelApiKey: "k", actModeApiModelId: "glm-5.2" }
		render(<BigmodelProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByTestId("effort-selector").getAttribute("data-efforts")).toContain("none")
	})

	it("#81 未支持的模型不渲染思维强度（5.1 / 4.x / 未知）", () => {
		for (const modelId of ["glm-5.1", "glm-4.5-flash", "glm-9.9"]) {
			state.apiConfig = { actModeApiProvider: "bigmodel", bigmodelApiKey: "k", actModeApiModelId: modelId }
			const { unmount } = render(<BigmodelProvider currentMode={"act" as never} showModelOptions={true} />)
			expect(screen.queryByTestId("effort-selector")).toBeNull()
			unmount()
		}
	})
})

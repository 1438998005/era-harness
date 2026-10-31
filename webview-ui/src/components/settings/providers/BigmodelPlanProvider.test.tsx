import { BIGMODEL_PLAN_PERSONAL_URL, BIGMODEL_PLAN_TEAM_URL } from "@shared/bigmodel-request"
import { fireEvent } from "@testing-library/dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// 智谱 GLM 套餐（Coding Plan）设置卡。
// 断言：套餐 Key 框与套餐入口存在；「不按 token 扣费」说明在；思考档位按模型能力渲染；
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
	VSCodeLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// ModelSelector 被替身成只记录 billingHint：下拉文案由 providerUtils.test.ts 直接锁，
// 这里只断言「套餐页传对了计费上下文」（#90 的根因就是没传）。
vi.mock("../common/ModelSelector", () => ({
	ModelSelector: ({ billingHint }: any) => <div data-billing={billingHint ?? "price"} data-testid="model-selector" />,
	DropdownContainer: ({ children }: any) => children,
}))

vi.mock("../common/ModelInfoView", () => ({ ModelInfoView: () => null }))

vi.mock("../ReasoningEffortSelector", () => ({
	default: ({ allowedEfforts, label }: any) => (
		<div data-efforts={allowedEfforts.join(",")} data-testid="effort-selector">
			{label}
		</div>
	),
}))

import { BigmodelPlanProvider } from "./BigmodelPlanProvider"

describe("BigmodelPlanProvider（GLM 套餐）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		state.apiConfig = {}
	})

	it("渲染套餐密钥框与套餐入口", () => {
		render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={false} />)
		expect(screen.getByLabelText("填入 API 密钥…")).toBeTruthy()
		expect(screen.getByText(/个人套餐 Key/)).toBeTruthy()
		expect(screen.getByText(/团队套餐 Key/)).toBeTruthy()
		expect(screen.getByText(/套餐文档/)).toBeTruthy()
	})

	// #91：官方文档写的是 `/apikey/coding-plan-per`，实测会落到**标准 API Key 页**。
	// 断言钉在「不含 /apikey」+「含 coding-plan」上，避免下次又人肉抄错链接。
	it("#91 套餐入口指向 coding-plan 页，不再落到标准 API Key 页", () => {
		const { container } = render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={false} />)

		// ① 输入框旁的新建 Key 链接（ApiKeyField.signupUrl）指向个人套餐页
		const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "")
		expect(hrefs.some((href) => href.includes("/apikey"))).toBe(false)
		expect(hrefs).toContain(BIGMODEL_PLAN_PERSONAL_URL)

		// ② 两个按钮分别落个人 / 团队套餐页（openUrl 是唯一出口）
		fireEvent.click(screen.getByText(/个人套餐 Key/))
		fireEvent.click(screen.getByText(/团队套餐 Key/))
		const opened = mocks.openUrl.mock.calls.map((call) => String(call[0]?.value ?? ""))
		expect(opened).toContain(BIGMODEL_PLAN_PERSONAL_URL)
		expect(opened).toContain(BIGMODEL_PLAN_TEAM_URL)
		expect(opened.some((url) => url.includes("/apikey"))).toBe(false)
		expect(BIGMODEL_PLAN_PERSONAL_URL === BIGMODEL_PLAN_TEAM_URL).toBe(false)
	})

	// #90：套餐模型价格恒 0，按量口径会标成「免费」；套餐页必须传 plan
	it("#90 模型下拉按套餐口径渲染（不再标「免费」）", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel-plan", bigmodelPlanApiKey: "k", actModeApiModelId: "glm-5.3" }
		render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByTestId("model-selector").getAttribute("data-billing")).toBe("plan")
		expect(screen.queryByText(/免费/)).toBeNull()
	})

	it("强调「套餐 Key 与按量 Key 不通用」与端点", () => {
		render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={false} />)
		expect(screen.getByText(/互不通用/)).toBeTruthy()
		expect(screen.getByText("https://open.bigmodel.cn/api/coding/paas/v4")).toBeTruthy()
	})

	it("显示「不按 token 扣费」的计费说明（价格恒 0 不等于免费）", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel-plan", bigmodelPlanApiKey: "k", actModeApiModelId: "glm-5.3" }
		render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByText(/不按 token 扣费/)).toBeTruthy()
		expect(screen.getByText(/以智谱套餐页为准/)).toBeTruthy()
	})

	it("5.3 系渲染思维强度，档位 low/high/xhigh（不可关闭）", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel-plan", bigmodelPlanApiKey: "k", actModeApiModelId: "glm-5.3" }
		render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByTestId("effort-selector").getAttribute("data-efforts")).toBe("low,high,xhigh")
	})

	it("5.2 额外提供「关闭」档", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel-plan", bigmodelPlanApiKey: "k", actModeApiModelId: "glm-5.2" }
		render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByTestId("effort-selector").getAttribute("data-efforts")).toContain("none")
	})

	it("未知模型 id 不崩（归一化保留 + 保守元数据）", () => {
		state.apiConfig = { actModeApiProvider: "bigmodel-plan", actModeApiModelId: "glm-9.9" }
		render(<BigmodelPlanProvider currentMode={"act" as never} showModelOptions={true} />)
		expect(screen.getByLabelText("填入 API 密钥…")).toBeTruthy()
		expect(screen.queryByTestId("effort-selector")).toBeNull()
	})
})

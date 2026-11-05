import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// P2-2 回归（2026-11-04 审查）：首启模态不能只靠遮罩。
// 旧实现 ① 背景按钮键盘可达、② 模态只在 step==="intro" 渲染（切到 config 就消失）。
// 这里钉住背景 inert 与「未确认前跨 step 常驻」。

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick }: any) => (
		<button onClick={onClick} type="button">
			{children}
		</button>
	),
}))

vi.mock("lucide-react", () => ({
	ArrowLeftIcon: () => <span />,
	FileCode2Icon: () => <span />,
	ShieldCheckIcon: () => <span />,
	SparklesIcon: () => <span />,
	AlertTriangleIcon: () => <span />,
	CheckIcon: () => <span />,
	XIcon: () => <span />,
}))

vi.mock("@/assets/EraLogo", () => ({ default: () => <span data-logo="" /> }))
vi.mock("@/components/settings/ApiOptions", () => ({ default: () => <div data-api-options="" /> }))
vi.mock("@/utils/validate", () => ({ validateApiConfiguration: () => undefined }))
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ apiConfiguration: {}, mode: "act" }),
}))
vi.mock("@/services/grpc-client", () => ({
	StateServiceClient: { setWelcomeViewCompleted: vi.fn().mockResolvedValue({}) },
}))

import EraOnboardingView from "./EraOnboardingView"

const background = () => document.querySelector<HTMLElement & { inert?: boolean }>("div[class*='m-auto']")

describe("EraOnboardingView 首启模态", () => {
	afterEach(() => {
		cleanup()
		vi.clearAllMocks()
	})

	it("模态显示时背景内容被置 inert（键盘也到不了「开始配置」）", () => {
		render(<EraOnboardingView />)
		expect(screen.getByRole("alertdialog")).toBeTruthy()
		expect(background()?.inert).toBe(true)
	})

	it("未确认前切到配置步骤，模态仍在（不能靠切 step 绕过）", () => {
		render(<EraOnboardingView />)
		fireEvent.click(screen.getByRole("button", { name: "开始配置" }))
		expect(document.querySelector("[data-api-options]")).toBeTruthy()
		expect(screen.getByRole("alertdialog")).toBeTruthy()
	})

	it("点「知道了」后模态关闭且背景恢复可交互", () => {
		render(<EraOnboardingView />)
		fireEvent.click(screen.getByRole("button", { name: "知道了" }))
		expect(screen.queryByRole("alertdialog")).toBeNull()
		expect(background()?.inert).toBe(false)
	})
})

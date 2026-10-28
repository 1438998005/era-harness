import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// era harness：EraBasic 语法归属三选一（任务 A 语法高亮开关）。
// 断言：三卡渲染、off 分支映射到 disableHighlighting、era 分支映射到 reclaimFiles、
// sasami 分支映射到 yieldToSasami、读取失败不打崩组件。
// 运行：npm run test:ui（vitest 自动发现 *.test.tsx）

const mocks = vi.hoisted(() => ({
	getEraBasicLanguageOwner: vi.fn(),
	runCommand: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/services/grpc-client", () => ({
	UiServiceClient: {
		getEraBasicLanguageOwner: mocks.getEraBasicLanguageOwner,
		runCommand: mocks.runCommand,
	},
}))

import { EraBasicOwnerChoice } from "./EraBasicOwnerChoice"

describe("EraBasicOwnerChoice 三选一（语法高亮开关）", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.runCommand.mockResolvedValue({})
	})

	it("渲染三张卡：era harness / sasami.erabasic / 关闭高亮", async () => {
		mocks.getEraBasicLanguageOwner.mockResolvedValue({ value: "era" })
		render(<EraBasicOwnerChoice />)
		expect(await screen.findByRole("radio", { name: /era harness/ })).toBeTruthy()
		expect(screen.getByRole("radio", { name: /sasami\.erabasic/ })).toBeTruthy()
		expect(screen.getByRole("radio", { name: /关闭高亮/ })).toBeTruthy()
	})

	it("点「关闭高亮」→ 调 disableHighlighting 并回读刷新选中态", async () => {
		mocks.getEraBasicLanguageOwner.mockResolvedValueOnce({ value: "era" }).mockResolvedValueOnce({ value: "off" })
		render(<EraBasicOwnerChoice />)
		fireEvent.click(await screen.findByRole("radio", { name: /关闭高亮/ }))
		await waitFor(() => {
			expect(mocks.runCommand).toHaveBeenCalledWith({ value: "eraHarness.erabasic.disableHighlighting" })
		})
		await waitFor(() => {
			expect(screen.getByRole("radio", { name: /关闭高亮/ }).getAttribute("aria-checked")).toBe("true")
		})
	})

	it("点 sasami → 调 yieldToSasami", async () => {
		mocks.getEraBasicLanguageOwner.mockResolvedValue({ value: "era" })
		render(<EraBasicOwnerChoice />)
		fireEvent.click(await screen.findByRole("radio", { name: /sasami\.erabasic/ }))
		await waitFor(() => {
			expect(mocks.runCommand).toHaveBeenCalledWith({ value: "eraHarness.erabasic.yieldToSasami" })
		})
	})

	it("点 era → 调 reclaimFiles（收回 = 切回内置高亮）", async () => {
		mocks.getEraBasicLanguageOwner.mockResolvedValue({ value: "off" })
		render(<EraBasicOwnerChoice />)
		fireEvent.click(await screen.findByRole("radio", { name: /era harness/ }))
		await waitFor(() => {
			expect(mocks.runCommand).toHaveBeenCalledWith({ value: "eraHarness.erabasic.reclaimFiles" })
		})
	})

	it("读取失败不崩：三卡仍渲染、按钮禁用", async () => {
		mocks.getEraBasicLanguageOwner.mockRejectedValue(new Error("boom"))
		render(<EraBasicOwnerChoice />)
		const era = await screen.findByRole("radio", { name: /era harness/ })
		expect(era).toBeTruthy()
		expect((era as HTMLButtonElement).disabled).toBe(true)
	})
})

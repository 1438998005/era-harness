// 2026-11-08 代码审查回归：OpenRouter 列表表格的列、0 哨兵与两种回落提示。
// 运行：npm run test:ui
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

import { OpenRouterFreeModelsTable } from "./OpenRouterFreeModelsTable"

const baseProps = {
	models: [{ id: "a/model:free", name: "A Model", contextWindow: 0, vision: false }],
	loading: false,
	fromSnapshot: false,
	stale: false,
}

describe("OpenRouterFreeModelsTable", () => {
	it("四列齐全、无「指定」入口、渠道列标上游随机", () => {
		const { container } = render(<OpenRouterFreeModelsTable {...baseProps} />)
		expect(container.querySelectorAll("th")).toHaveLength(4)
		expect(container.querySelectorAll("td")).toHaveLength(4)
		expect(container.querySelectorAll("input, button")).toHaveLength(0)
		expect(screen.getAllByText("settings.freeListUpstreamRandom")).toHaveLength(2)
	})

	it("contextWindow=0 显示「—」而不是 0K", () => {
		const { container } = render(<OpenRouterFreeModelsTable {...baseProps} />)
		const cells = [...container.querySelectorAll("td")].map((cell) => cell.textContent)
		expect(cells[2]).toBe("—")
		expect(cells.join(" ")).not.toContain("0K")
	})

	it("实时清单：不显示任何回落提示", () => {
		render(<OpenRouterFreeModelsTable {...baseProps} />)
		expect(screen.queryByText("settings.freeListStale")).toBeNull()
		expect(screen.queryByText("settings.freeListSnapshot")).toBeNull()
	})

	it("回落旧缓存：显示 freeListStale，不显示 freeListSnapshot", () => {
		render(<OpenRouterFreeModelsTable {...baseProps} fromSnapshot={false} stale />)
		expect(screen.getByText("settings.freeListStale")).toBeTruthy()
		expect(screen.queryByText("settings.freeListSnapshot")).toBeNull()
	})

	it("回落内置快照：显示 freeListSnapshot，不显示 freeListStale", () => {
		render(<OpenRouterFreeModelsTable {...baseProps} fromSnapshot stale />)
		expect(screen.getByText("settings.freeListSnapshot")).toBeTruthy()
		expect(screen.queryByText("settings.freeListStale")).toBeNull()
	})

	it("读取中只显示 loading，不闪回落警告", () => {
		render(<OpenRouterFreeModelsTable {...baseProps} fromSnapshot loading stale />)
		expect(screen.getByText("settings.freeListLoading")).toBeTruthy()
		expect(screen.queryByText("settings.freeListSnapshot")).toBeNull()
		expect(screen.queryByText("settings.freeListStale")).toBeNull()
	})
})

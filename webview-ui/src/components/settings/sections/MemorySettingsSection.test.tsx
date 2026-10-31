// era harness：全局记忆设置页的真渲染测试（jsdom + testing-library）。
// 关注三件用户可感知的事：条目能显示、删除只删一条、清空必须点两次。
// 运行：node node_modules/vitest/vitest.mjs run src/components/settings/sections/MemorySettingsSection.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { GlobalMemoryDocument } from "../../../../../src/shared/global-memory"

const mocks = vi.hoisted(() => ({
	getGlobalMemory: vi.fn(),
	updateGlobalMemory: vi.fn(),
}))

const state = vi.hoisted(() => ({ document: undefined as unknown as GlobalMemoryDocument }))

vi.mock("@vscode/webview-ui-toolkit/react", async () => {
	const React = await import("react")
	return {
		VSCodeButton: ({ onClick, children, ...rest }: any) => (
			<button {...rest} onClick={onClick} type="button">
				{children}
			</button>
		),
		// 复刻真实 FAST 元素的语义（这是 3.93.0「关闭开关反复抽搐」的根因）：
		// React 包装器每次更新都把 checked 属性写回元素，值一变就 $emit("change")，
		// 且 DOM 的 disabled **拦不住**属性回写触发的事件。
		VSCodeCheckbox: ({ checked, onChange, disabled, children }: any) => {
			const last = React.useRef(checked)
			const handler = React.useRef(onChange)
			handler.current = onChange
			React.useEffect(() => {
				if (last.current !== checked) {
					last.current = checked
					handler.current?.({ target: { checked } })
				}
			}, [checked])
			return (
				<label>
					<input
						checked={checked}
						disabled={disabled}
						onChange={(event) => {
							last.current = event.target.checked
							handler.current?.(event)
						}}
						type="checkbox"
					/>
					{children}
				</label>
			)
		},
		VSCodeTextField: ({ onInput, value, placeholder, children }: any) => (
			<div>
				{children}
				<input aria-label={placeholder} onInput={onInput} placeholder={placeholder} value={value} />
			</div>
		),
	}
})

vi.mock("@/services/grpc-client", () => ({
	UiServiceClient: {
		getGlobalMemory: mocks.getGlobalMemory,
		updateGlobalMemory: mocks.updateGlobalMemory,
	},
}))

vi.mock("../Section", () => ({ default: ({ children }: any) => <div>{children}</div> }))

import MemorySettingsSection from "./MemorySettingsSection"

function makeDocument(): GlobalMemoryDocument {
	return {
		version: 1,
		enabled: true,
		updatedAt: 1,
		entries: [
			{ id: "a", text: "回答语言：简体中文", tags: ["偏好"], source: "plugin", createdAt: 1, updatedAt: 1 },
			{ id: "b", text: "称呼：小明", tags: ["身份"], source: "user", createdAt: 2, updatedAt: 2 },
		],
		seeded: ["language", "name"],
	}
}

async function renderSection() {
	render(<MemorySettingsSection renderSectionHeader={() => null} />)
	await waitFor(() => expect(screen.getByText("回答语言：简体中文")).toBeTruthy())
}

describe("全局记忆设置页", () => {
	beforeEach(() => {
		mocks.getGlobalMemory.mockReset()
		mocks.updateGlobalMemory.mockReset()
		state.document = makeDocument()
		mocks.getGlobalMemory.mockImplementation(async () => ({ value: JSON.stringify(state.document) }))
		// 写盘回写到内存（模拟真实 globalStorage）：否则读-改-写会拿到旧快照
		mocks.updateGlobalMemory.mockImplementation(async (request: { value: string }) => {
			state.document = JSON.parse(request.value) as GlobalMemoryDocument
			return {}
		})
	})

	it("挂载时读取并渲染条目（含来源与标签）", async () => {
		await renderSection()

		expect(mocks.getGlobalMemory).toHaveBeenCalledTimes(1)
		expect(screen.getByText("称呼：小明")).toBeTruthy()
		expect(screen.getByText(/插件/)).toBeTruthy()
		expect(screen.getByText(/用户/)).toBeTruthy()
		expect(screen.getByText(/已用 2\/50 条/)).toBeTruthy()
	})

	it("删除只移除对应条目，并整份回写", async () => {
		await renderSection()

		fireEvent.click(screen.getByLabelText("删除：回答语言：简体中文"))

		await waitFor(() => expect(mocks.updateGlobalMemory).toHaveBeenCalledTimes(1))
		const payload = JSON.parse(mocks.updateGlobalMemory.mock.calls[0][0].value) as GlobalMemoryDocument
		expect(payload.entries.map((entry) => entry.id)).toEqual(["b"])
	})

	it("清空需要点两次：第一次只变成确认文案", async () => {
		await renderSection()

		fireEvent.click(screen.getByText("清空全部记忆"))
		expect(mocks.updateGlobalMemory).not.toHaveBeenCalled()
		expect(screen.getByText("再次点击确认清空")).toBeTruthy()

		fireEvent.click(screen.getByText("再次点击确认清空"))
		await waitFor(() => expect(mocks.updateGlobalMemory).toHaveBeenCalledTimes(1))
		const payload = JSON.parse(mocks.updateGlobalMemory.mock.calls[0][0].value) as GlobalMemoryDocument
		expect(payload.entries).toEqual([])
		expect(payload.enabled).toBe(true)
	})

	it("关闭记忆只切换开关，不删除条目", async () => {
		await renderSection()

		fireEvent.click(screen.getByRole("checkbox"))

		await waitFor(() => expect(mocks.updateGlobalMemory).toHaveBeenCalledTimes(1))
		const payload = JSON.parse(mocks.updateGlobalMemory.mock.calls[0][0].value) as GlobalMemoryDocument
		expect(payload.enabled).toBe(false)
		expect(payload.entries).toHaveLength(2)
		expect(screen.getByText(/AI 不会读取或写入/)).toBeTruthy()
	})

	// 回归：3.93.0 实测「关闭全局记忆时界面反复抽搐」。
	// 根因是受控 FAST 复选框的属性回写会再发 change，而旧处理器不看事件值、只取反 → 来回翻转。
	it("关闭开关只写一次，不会因受控回写来回翻转", async () => {
		await renderSection()

		fireEvent.click(screen.getByRole("checkbox"))

		await waitFor(() => expect(mocks.updateGlobalMemory).toHaveBeenCalledTimes(1))
		// 留出多个宏任务：旧实现会在这段时间里继续收到回写触发的 change 并再次写盘
		await new Promise((resolve) => setTimeout(resolve, 30))

		expect(mocks.updateGlobalMemory).toHaveBeenCalledTimes(1)
		expect((state.document as GlobalMemoryDocument).enabled).toBe(false)
	})
})

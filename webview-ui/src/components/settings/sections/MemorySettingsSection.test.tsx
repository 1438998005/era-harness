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

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ onClick, children, ...rest }: any) => (
		<button {...rest} onClick={onClick} type="button">
			{children}
		</button>
	),
	VSCodeCheckbox: ({ checked, onChange, children }: any) => (
		<label>
			<input checked={checked} onChange={onChange} type="checkbox" />
			{children}
		</label>
	),
	VSCodeTextField: ({ onInput, value, placeholder, children }: any) => (
		<div>
			{children}
			<input aria-label={placeholder} onInput={onInput} placeholder={placeholder} value={value} />
		</div>
	),
}))

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
		mocks.getGlobalMemory.mockResolvedValue({ value: JSON.stringify(state.document) })
		mocks.updateGlobalMemory.mockResolvedValue({})
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
})

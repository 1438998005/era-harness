import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// P2-2 回归（2026-11-04 审查）：模态必须真的「必须确认」。
// 旧实现把 onKeyDown 挂在模态 div 上，初始焦点在 body 时 Tab 会落到背景按钮、
// Enter 直接跳过确认；这里用真实 document 键盘事件钉住焦点锁与关闭路径。

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, ...rest }: any) => (
		<button data-notice-ack="" onClick={onClick} type="button" {...rest}>
			{children}
		</button>
	),
}))

vi.mock("lucide-react", () => ({
	AlertTriangleIcon: () => <span data-icon="alert" />,
	CheckIcon: () => <span data-icon="check" />,
	XIcon: () => <span data-icon="x" />,
}))

import BuiltinChatNoticeModal from "./BuiltinChatNoticeModal"

const keyDown = (key: string, target: EventTarget = document) => {
	const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
	target.dispatchEvent(event)
	return event
}

describe("BuiltinChatNoticeModal 焦点锁", () => {
	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
	})

	it("挂载后焦点自动落在「知道了」按钮上", () => {
		render(<BuiltinChatNoticeModal onAck={vi.fn()} />)
		const ack = screen.getByRole("button", { name: "知道了" })
		expect(document.activeElement).toBe(ack)
	})

	it("Tab / Esc 被吞掉且焦点不逃出；不会触发 onAck", () => {
		const onAck = vi.fn()
		render(<BuiltinChatNoticeModal onAck={onAck} />)
		const ack = screen.getByRole("button", { name: "知道了" })

		const tab = keyDown("Tab")
		expect(tab.defaultPrevented).toBe(true)
		expect(document.activeElement).toBe(ack)

		const esc = keyDown("Escape")
		expect(esc.defaultPrevented).toBe(true)
		expect(onAck).not.toHaveBeenCalled()
	})

	it("焦点停在背景控件时按 Enter 也不会激活背景，而是确认模态", () => {
		const onAck = vi.fn()
		const background = document.createElement("button")
		background.textContent = "开始配置"
		const backgroundClick = vi.fn()
		background.addEventListener("click", backgroundClick)
		document.body.appendChild(background)
		background.focus()

		render(<BuiltinChatNoticeModal onAck={onAck} />)
		// 模拟用户把焦点留在背景按钮后再按 Enter
		background.focus()
		const enter = keyDown("Enter", background)
		expect(enter.defaultPrevented).toBe(true)
		expect(onAck).toHaveBeenCalledTimes(1)
		expect(backgroundClick).not.toHaveBeenCalled()
	})

	it("点击「知道了」才确认；点击遮罩没有任何关闭路径", () => {
		const onAck = vi.fn()
		const { container } = render(<BuiltinChatNoticeModal onAck={onAck} />)
		fireEvent.click(container.firstElementChild!)
		expect(onAck).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole("button", { name: "知道了" }))
		expect(onAck).toHaveBeenCalledTimes(1)
	})
})

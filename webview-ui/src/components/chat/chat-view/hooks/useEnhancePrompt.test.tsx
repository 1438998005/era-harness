// 08 #207：增强提示词按钮的交互测试（renderHook，脱离 ChatTextArea 的巨型 props）。
// 运行：npm run test:ui
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ enhancePrompt: vi.fn() }))

vi.mock("@/services/grpc-client", () => ({
	UiServiceClient: { enhancePrompt: mocks.enhancePrompt },
}))

import { useEnhancePrompt } from "./useEnhancePrompt"

const translate = (key: string) => key

function setup(initialValue: string, sendingDisabled = false) {
	let value = initialValue
	const setInputValue = vi.fn((next: string) => {
		value = next
	})
	const hook = renderHook(
		({ inputValue, disabled }) =>
			useEnhancePrompt({
				inputValue,
				setInputValue,
				sendingDisabled: disabled,
				translate,
			}),
		{ initialProps: { inputValue: initialValue, disabled: sendingDisabled } },
	)
	return {
		...hook,
		setInputValue,
		getValue: () => value,
		rerenderWithCurrent: () => hook.rerender({ inputValue: value, disabled: sendingDisabled }),
	}
}

describe("useEnhancePrompt", () => {
	beforeEach(() => {
		mocks.enhancePrompt.mockReset()
	})

	it("空输入禁用；发送中禁用", () => {
		expect(setup("").result.current.disabled).toBe(true)
		expect(setup("帮我改口上", true).result.current.disabled).toBe(true)
		expect(setup("帮我改口上").result.current.disabled).toBe(false)
		expect(setup("帮我改口上").result.current.label).toBe("chat.enhancePrompt")
	})

	it("生成中显示加载态并禁用重复点击", async () => {
		mocks.enhancePrompt.mockReturnValue(new Promise(() => {}))
		const h = setup("帮我改口上")
		await act(async () => {
			void h.result.current.run()
		})
		expect(h.result.current.isEnhancing).toBe(true)
		expect(h.result.current.disabled).toBe(true)
		expect(h.result.current.label).toBe("chat.enhancePromptBusy")
		expect(mocks.enhancePrompt).toHaveBeenCalledTimes(1)
	})

	it("成就地替换，再点一次撤销还原原文", async () => {
		mocks.enhancePrompt.mockResolvedValue({
			value: JSON.stringify({ ok: true, enhancedText: "```markdown\n目标：修口上\n```" }),
		})
		const h = setup("帮我改口上")
		await act(async () => {
			await h.result.current.run()
		})
		expect(mocks.enhancePrompt).toHaveBeenCalledWith({ value: JSON.stringify({ text: "帮我改口上" }) })
		expect(h.getValue()).toBe("目标：修口上")

		h.rerenderWithCurrent()
		await waitFor(() => expect(h.result.current.canUndo).toBe(true))
		expect(h.result.current.label).toBe("chat.enhancePromptUndo")

		await act(async () => {
			await h.result.current.run()
		})
		expect(h.getValue()).toBe("帮我改口上")
		h.rerenderWithCurrent()
		expect(h.result.current.canUndo).toBe(false)
	})

	it("请求期间用户继续输入时，结果不覆盖用户内容", async () => {
		let resolveResponse: ((value: unknown) => void) | undefined
		mocks.enhancePrompt.mockReturnValue(
			new Promise((resolve) => {
				resolveResponse = resolve
			}),
		)
		const h = setup("帮我改口上")
		let pending: Promise<void> | undefined
		await act(async () => {
			pending = h.result.current.run()
		})

		await act(async () => {
			h.rerender({ inputValue: "我自己补充了文件范围", disabled: false })
		})
		await act(async () => {
			resolveResponse?.({ value: JSON.stringify({ ok: true, enhancedText: "增强后的提示词" }) })
			await pending
		})

		expect(h.setInputValue).not.toHaveBeenCalled()
		expect(h.getValue()).toBe("帮我改口上")
		expect(h.result.current.canUndo).toBe(false)
		expect(h.result.current.isEnhancing).toBe(false)
	})

	it("失败保留原文，只给轻提示", async () => {
		mocks.enhancePrompt.mockRejectedValue(new Error("provider down"))
		const h = setup("帮我改口上")
		await act(async () => {
			await h.result.current.run()
		})
		expect(h.getValue()).toBe("帮我改口上")
		expect(h.setInputValue).not.toHaveBeenCalled()
		expect(h.result.current.errorText).toBe("chat.enhancePromptFailed")
		expect(h.result.current.isEnhancing).toBe(false)
	})

	it("宿主返回 ok:false 也不覆盖原文", async () => {
		mocks.enhancePrompt.mockResolvedValue({ value: JSON.stringify({ ok: false, message: "模型没有返回可用的提示词" }) })
		const h = setup("帮我改口上")
		await act(async () => {
			await h.result.current.run()
		})
		expect(h.getValue()).toBe("帮我改口上")
		expect(h.result.current.errorText).toBe("模型没有返回可用的提示词")
	})
})

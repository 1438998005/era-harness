import { parseEnhancePromptResponse } from "@shared/enhancePrompt"
import { useCallback, useEffect, useRef, useState } from "react"
import { UiServiceClient } from "@/services/grpc-client"

/**
 * 08 #207：发送按钮旁「增强提示词」的交互状态机。
 *
 * 竞品共性（Qoder/Trae/WorkBuddy/CodeBuddy）：就地替换、可编辑、可撤销、不自动发送、
 * 空输入禁用、失败保留原文。抽成 hook 是为了能脱离 1600 行的 ChatTextArea 直接跑交互测试。
 *
 * 撤销语义：保存增强前的原文，再点一次按钮就还原；用户若手动清空输入框，撤销态自动失效。
 */
export interface UseEnhancePromptArgs {
	inputValue: string
	setInputValue: (value: string) => void
	sendingDisabled: boolean
	translate: (key: string) => string
}

export function useEnhancePrompt({ inputValue, setInputValue, sendingDisabled, translate }: UseEnhancePromptArgs) {
	const [isEnhancing, setIsEnhancing] = useState(false)
	const [originalText, setOriginalText] = useState<string | null>(null)
	const [errorText, setErrorText] = useState<string | null>(null)
	// 请求是异步的，run() 闭包里的 inputValue 是发起时的快照；用 ref 记住最新输入，
	// 避免响应回来时把用户在这期间敲的内容覆盖掉（竞品基线：增强结果始终可编辑）。
	const latestInputRef = useRef(inputValue)

	useEffect(() => {
		latestInputRef.current = inputValue
		if (!inputValue) {
			setOriginalText(null)
			setErrorText(null)
		}
	}, [inputValue])

	const canUndo = originalText !== null
	const disabled = isEnhancing || sendingDisabled || (!inputValue.trim() && !canUndo)
	const label = isEnhancing
		? translate("chat.enhancePromptBusy")
		: canUndo
			? translate("chat.enhancePromptUndo")
			: translate("chat.enhancePrompt")

	const run = useCallback(async () => {
		if (isEnhancing || sendingDisabled) {
			return
		}
		if (originalText !== null) {
			setInputValue(originalText)
			setOriginalText(null)
			setErrorText(null)
			return
		}
		const original = inputValue
		if (!original.trim()) {
			return
		}

		setIsEnhancing(true)
		setErrorText(null)
		try {
			const response = await UiServiceClient.enhancePrompt({ value: JSON.stringify({ text: original }) })
			// 用户在等待期间编辑过输入框：丢弃这次结果，保留用户的新内容（也不建立撤销态）。
			if (latestInputRef.current !== original) {
				return
			}
			const result = parseEnhancePromptResponse(response?.value)
			if (result.ok && result.enhancedText) {
				setInputValue(result.enhancedText)
				setOriginalText(original)
			} else {
				setErrorText(result.message ?? translate("chat.enhancePromptFailed"))
			}
		} catch {
			// 不把用户原文或 provider 错误写进日志/UI，只给一句轻提示（KB 19 脱敏纪律）。
			setErrorText(translate("chat.enhancePromptFailed"))
		} finally {
			setIsEnhancing(false)
		}
	}, [inputValue, setInputValue, isEnhancing, sendingDisabled, originalText, translate])

	return { isEnhancing, canUndo, disabled, label, errorText, run }
}

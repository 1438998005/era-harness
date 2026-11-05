import { buildApiHandler } from "@core/api"
import { extractAuxiliaryOverride, resolveAuxiliaryApiConfiguration } from "@shared/aux-model"
import {
	buildEnhancePromptSystemPrompt,
	ENHANCE_PROMPT_MAX_OUTPUT_CHARS,
	ENHANCE_PROMPT_TIMEOUT_MS,
	type EnhancePromptResult,
	parseEnhancePromptRequest,
	sanitizeEnhancedText,
} from "@shared/enhancePrompt"
import type { String as StringMessage, StringRequest } from "@shared/proto/cline/common"
import { String as StringValue } from "@shared/proto/cline/common"
import { Logger } from "@shared/services/Logger"
import type { Controller } from "../index"

/**
 * 08 #207：输入框「增强提示词」的一元 RPC。
 *
 * 一次独立的单次文本改写：用当前 provider 的 `createMessage` 流式请求，只拼 text，
 * 不写 clineMessages、不计入 taskMetrics、不触发工具、不自动发送、不进任务历史。
 * 失败一律以 `{ok:false}` 回传，webview 保留用户原文（竞品共性：可撤销、不覆盖）。
 *
 * 安全/隐私：不把用户原文写进日志；provider 的错误文本也不落日志（可能回显密钥片段，
 * 见 KB 19 §19.12）。诊断包不为这个功能新增事件类。
 */
export async function enhancePrompt(controller: Controller, request: StringRequest): Promise<StringMessage> {
	const respond = (result: EnhancePromptResult) => StringValue.create({ value: JSON.stringify(result) })

	const parsed = parseEnhancePromptRequest(request.value)
	if (!parsed.ok) {
		return respond({ ok: false, message: parsed.message })
	}

	try {
		const apiConfiguration = controller.stateManager.getApiConfiguration()
		// 独立辅助模型（2026-11-04）：配置了「提示词增强」专用 provider+密钥时走辅助配置，
		// 未配置时 undefined → 原样走主配置（零行为变化）。判据单源在 @shared/aux-model。
		const auxConfiguration = resolveAuxiliaryApiConfiguration(
			extractAuxiliaryOverride(apiConfiguration, "enhance"),
			apiConfiguration,
			"act",
		)
		const api = buildApiHandler(auxConfiguration ?? apiConfiguration, "act")
		const { text, context } = parsed.request
		const userContent = context ? `${text}\n\n<context>\n${context}\n</context>` : text
		const stream = api.createMessage(buildEnhancePromptSystemPrompt(), [{ role: "user", content: userContent }])

		let buffer = ""
		let timer: ReturnType<typeof setTimeout> | undefined
		const collect = async () => {
			for await (const chunk of stream) {
				if (chunk.type !== "text") {
					continue
				}
				buffer += chunk.text
				if (buffer.length > ENHANCE_PROMPT_MAX_OUTPUT_CHARS * 2) {
					break
				}
			}
		}

		try {
			await Promise.race([
				collect(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => {
						try {
							api.abort?.()
						} catch {
							// 取消失败不影响超时判定
						}
						reject(new Error("timeout"))
					}, ENHANCE_PROMPT_TIMEOUT_MS)
				}),
			])
		} finally {
			if (timer) {
				clearTimeout(timer)
			}
		}

		const enhancedText = sanitizeEnhancedText(buffer)
		if (!enhancedText) {
			return respond({ ok: false, message: "模型没有返回可用的提示词" })
		}
		return respond({ ok: true, enhancedText })
	} catch {
		Logger.warn("[enhance-prompt] 单次改写失败，输入框保留原文")
		return respond({ ok: false, message: "提示词增强暂时不可用，请稍后再试" })
	}
}

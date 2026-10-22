import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { ClineAssistantThinkingBlock, ClineStorageMessage } from "@/shared/messages/content"
import { shouldAttachMimoReasoning } from "@/shared/mimo-request"

/**
 * DeepSeek Reasoner message format with reasoning_content support.
 */
export type DeepSeekReasonerMessage = OpenAI.Chat.ChatCompletionMessageParam & {
	reasoning_content?: string
}

/**
 * Adds reasoning_content to OpenAI messages for DeepSeek Reasoner / MiMo.
 * Per DeepSeek API: reasoning_content should be passed back during tool calling in the same turn,
 * and omitted when starting a new turn.
 *
 * MiMo 的官方要求更硬：**历史里所有带 `tool_calls` 的 assistant 都必须带 `reasoning_content`**，
 * 否则 400。而 `lastUserIndex` 是「转换后数组」的下标：只要某条 user 消息混排了非 tool 内容
 * （重复读软警告、图片块、hook context），它会被追加成 `role:"user"` 并排在所有 tool 消息之后，
 * 窗口边界随之后移，历史里的工具调用 assistant 就会整批丢掉 reasoning_content。
 * 因此 MiMo 传 `attachToAllToolCalls: true`；DeepSeek 保持原语义（不传）。
 */
export function addReasoningContent(
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
	originalMessages: ClineStorageMessage[],
	options?: { attachToAllToolCalls?: boolean },
): DeepSeekReasonerMessage[] {
	// Find last user message index (start of current turn)
	// If no user message exists (lastUserIndex = -1), all messages are in the "current turn",
	// so reasoning_content will be added to all assistant messages. This is intentional.
	let lastUserIndex = -1
	for (let i = openAiMessages.length - 1; i >= 0; i--) {
		if (openAiMessages[i].role === "user") {
			lastUserIndex = i
			break
		}
	}

	// Extract thinking content from original messages, keyed by assistant index
	const thinkingByIndex = new Map<number, string>()
	let assistantIdx = 0
	for (const msg of originalMessages) {
		if (msg.role === "assistant") {
			if (Array.isArray(msg.content)) {
				const thinking = msg.content
					.filter((p): p is ClineAssistantThinkingBlock => p.type === "thinking")
					.map((p) => p.thinking)
					.join("\n")
				if (thinking) {
					thinkingByIndex.set(assistantIdx, thinking)
				}
			}
			assistantIdx++
		}
	}

	// Add reasoning_content only to assistant messages in current turn
	let aiIdx = 0
	return openAiMessages.map((msg, i): DeepSeekReasonerMessage => {
		if (msg.role === "assistant") {
			const thinking = thinkingByIndex.get(aiIdx++)
			// 带 tool_calls 的 assistant 是 MiMo 的硬性要求：无论窗口边界在哪都必须回传。
			const toolCalls = (msg as { tool_calls?: unknown[] }).tool_calls
			const isToolCallAssistant = Array.isArray(toolCalls) && toolCalls.length > 0
			if (thinking && (i >= lastUserIndex || (options?.attachToAllToolCalls && isToolCallAssistant))) {
				return { ...msg, reasoning_content: thinking }
			}
		}
		return msg
	})
}

/**
 * MiMo 的消息准备（handler 的唯一入口）。
 *
 * 为什么单独成函数：`addReasoningContent` 的 `attachToAllToolCalls` 只是一层**接线**，
 * 写在 handler 里就等于没测——删掉它，只测 `addReasoningContent` 的用例照样全绿。
 * 把「effort → 是否回传思考」与「MiMo 必须 attachToAllToolCalls」钉在一处，
 * 测试从这里进，删掉接线就会红。
 */
export function prepareMimoMessages(
	openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
	originalMessages: ClineStorageMessage[],
	effort: string | undefined,
): OpenAI.Chat.ChatCompletionMessageParam[] {
	return shouldAttachMimoReasoning(effort)
		? addReasoningContent(openAiMessages, originalMessages, { attachToAllToolCalls: true })
		: openAiMessages
}

/**
 * Converts Anthropic messages to OpenAI format and merges consecutive messages with the same role.
 * This is required for DeepSeek Reasoner which does not support successive messages with the same role.
 * DeepSeek highly recommends using 'user' role instead of 'system' role for optimal performance.
 *
 * @param messages Array of Anthropic messages
 * @returns Array of OpenAI messages where consecutive messages with the same role are merged together
 */
export function convertToR1Format(messages: Anthropic.Messages.MessageParam[]): OpenAI.Chat.ChatCompletionMessageParam[] {
	return messages.reduce<OpenAI.Chat.ChatCompletionMessageParam[]>((merged, message) => {
		const lastMessage = merged[merged.length - 1]
		let messageContent: string | (OpenAI.Chat.ChatCompletionContentPartText | OpenAI.Chat.ChatCompletionContentPartImage)[] =
			""
		let hasImages = false

		if (Array.isArray(message.content)) {
			const textParts: string[] = []
			const imageParts: OpenAI.Chat.ChatCompletionContentPartImage[] = []

			message.content.forEach((part) => {
				if (part.type === "text") {
					textParts.push(part.text)
				}
				if (part.type === "image") {
					hasImages = true
					imageParts.push({
						type: "image_url",
						image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
					})
				}
			})

			if (hasImages) {
				const parts: (OpenAI.Chat.ChatCompletionContentPartText | OpenAI.Chat.ChatCompletionContentPartImage)[] = []
				if (textParts.length > 0) {
					parts.push({ type: "text", text: textParts.join("\n") })
				}
				parts.push(...imageParts)
				messageContent = parts
			} else {
				messageContent = textParts.join("\n")
			}
		} else {
			messageContent = message.content
		}

		// If the last message has the same role, merge the content
		if (lastMessage?.role === message.role) {
			if (typeof lastMessage.content === "string" && typeof messageContent === "string") {
				lastMessage.content += `\n${messageContent}`
			} else {
				const lastContent = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text" as const, text: lastMessage.content || "" }]

				const newContent = Array.isArray(messageContent)
					? messageContent
					: [{ type: "text" as const, text: messageContent }]

				if (message.role === "assistant") {
					const mergedContent = [
						...lastContent,
						...newContent,
					] as OpenAI.Chat.ChatCompletionAssistantMessageParam["content"]
					lastMessage.content = mergedContent
				} else {
					const mergedContent = [...lastContent, ...newContent] as OpenAI.Chat.ChatCompletionUserMessageParam["content"]
					lastMessage.content = mergedContent
				}
			}
		} else {
			// Adds new message with the correct type based on role
			if (message.role === "assistant") {
				const newMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
					role: "assistant",
					content: messageContent as OpenAI.Chat.ChatCompletionAssistantMessageParam["content"],
				}
				merged.push(newMessage)
			} else {
				const newMessage: OpenAI.Chat.ChatCompletionUserMessageParam = {
					role: "user",
					content: messageContent as OpenAI.Chat.ChatCompletionUserMessageParam["content"],
				}
				merged.push(newMessage)
			}
		}
		return merged
	}, [])
}

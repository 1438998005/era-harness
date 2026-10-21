import { DeepSeekModelId, deepSeekDefaultModelId, deepSeekModels, getDeepSeekModelInfo, ModelInfo } from "@shared/api"
import { calculateDeepSeekCost } from "@shared/deepseekPricing"
import OpenAI from "openai"
import type { ChatCompletionTool as OpenAITool } from "openai/resources/chat/completions"
import { buildExternalBasicHeaders } from "@/services/EnvUtils"
import { ClineStorageMessage } from "@/shared/messages/content"
import { fetch } from "@/shared/net"
import { ApiHandler, CommonApiHandlerOptions } from "../"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { addReasoningContent } from "../transform/r1-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"

interface DeepSeekHandlerOptions extends CommonApiHandlerOptions {
	deepSeekApiKey?: string
	apiModelId?: string
	deepSeekModelInfo?: ModelInfo
	reasoningEffort?: string
}

/**
 * 把界面上的 OpenAI 档位翻译成 DeepSeek 官方档位。
 * DeepSeek V4 只认 low / high / max（默认 high）：medium → high、xhigh → max、none/未设 → 不传（用官方默认）。
 */
function deepSeekReasoningEffort(effort?: string): "low" | "high" | "max" | undefined {
	switch (effort) {
		case "low":
			return "low"
		case "high":
			return "high"
		case "xhigh":
		case "max":
			return "max"
		default:
			return undefined
	}
}

export class DeepSeekHandler implements ApiHandler {
	private options: DeepSeekHandlerOptions
	private client: OpenAI | undefined

	constructor(options: DeepSeekHandlerOptions) {
		this.options = options
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			if (!this.options.deepSeekApiKey) {
				throw new Error("DeepSeek API key is required")
			}
			try {
				this.client = new OpenAI({
					baseURL: "https://api.deepseek.com/v1",
					apiKey: this.options.deepSeekApiKey,
					defaultHeaders: buildExternalBasicHeaders(),
					fetch, // Use configured fetch with proxy support
				})
			} catch (error) {
				throw new Error(`Error creating DeepSeek client: ${error.message}`)
			}
		}
		return this.client
	}

	private async *yieldUsage(info: ModelInfo, usage: OpenAI.Completions.CompletionUsage | undefined): ApiStream {
		// Deepseek reports total input AND cache reads/writes,
		// see context caching: https://api-docs.deepseek.com/guides/kv_cache)
		// where the input tokens is the sum of the cache hits/misses, just like OpenAI.
		// This affects:
		// 1) context management truncation algorithm, and
		// 2) cost calculation

		// Deepseek usage includes extra fields.
		// Safely cast the prompt token details section to the appropriate structure.
		interface DeepSeekUsage extends OpenAI.CompletionUsage {
			prompt_cache_hit_tokens?: number
			prompt_cache_miss_tokens?: number
		}
		const deepUsage = usage as DeepSeekUsage

		const inputTokens = deepUsage?.prompt_tokens || 0 // sum of cache hits and misses
		const outputTokens = deepUsage?.completion_tokens || 0
		const cacheReadTokens = deepUsage?.prompt_cache_hit_tokens || 0 // 缓存命中
		const cacheWriteTokens = deepUsage?.prompt_cache_miss_tokens || 0 // 缓存未命中
		// 精确计费：命中/未命中/输出三档，按当前峰谷时段×2（人民币）
		const totalCost = calculateDeepSeekCost(info, cacheReadTokens, cacheWriteTokens, outputTokens)
		const nonCachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens) // this will always be 0
		yield {
			type: "usage",
			inputTokens: nonCachedInputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
		}
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: OpenAITool[]): ApiStream {
		const client = this.ensureClient()
		const model = this.getModel()

		// V4 起不再用模型名区分思考能力（旧名 deepseek-reasoner 已停用），
		// 用前缀匹配以兼容在线同步回来的带日期后缀的 id。
		const isDeepSeekThinkingModel =
			model.id.includes("deepseek-flash") || model.id.includes("deepseek-v4") || model.id.includes("deepseek-reasoner")

		// 思维强度：只在思考模型上传；未设置时交给官方默认（high）
		const reasoningEffort = isDeepSeekThinkingModel ? deepSeekReasoningEffort(this.options.reasoningEffort) : undefined

		const convertedMessages = convertToOpenAiMessages(messages)
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = isDeepSeekThinkingModel
			? [{ role: "system", content: systemPrompt }, ...addReasoningContent(convertedMessages, messages)]
			: [{ role: "system", content: systemPrompt }, ...convertedMessages]

		// DeepSeek 的档位 max 不在 OpenAI SDK 的 ReasoningEffort 类型里（SDK 只有 low/medium/high），
		// 但 DeepSeek API 确实接受 max —— 在请求边界断言，不去改 SDK 类型。
		const streamParams = {
			model: model.id,
			max_completion_tokens: model.info.maxTokens,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
			// Only set temperature for non-thinking models
			...(isDeepSeekThinkingModel ? {} : { temperature: 0 }),
			...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
			...getOpenAIToolParams(tools),
		} as OpenAI.Chat.ChatCompletionCreateParamsStreaming
		const stream = await client.chat.completions.create(streamParams)

		const toolCallProcessor = new ToolCallProcessor()

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (delta?.tool_calls) {
				yield* toolCallProcessor.processToolCallDeltas(delta.tool_calls)
			}

			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					reasoning: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (chunk.usage) {
				yield* this.yieldUsage(model.info, chunk.usage)
			}
		}
	}

	getModel(): { id: DeepSeekModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId) {
			if (modelId in deepSeekModels) {
				const id = modelId as DeepSeekModelId
				return { id, info: getDeepSeekModelInfo(id, this.options.deepSeekModelInfo) }
			}
			// 在线同步回来的新模型不在内置清单里：保留用户选的 id，元数据用保守默认，
			// 否则请求会被悄悄改回默认模型。
			return {
				id: modelId as DeepSeekModelId,
				info:
					this.options.deepSeekModelInfo ??
					({
						contextWindow: 128_000,
						maxTokens: 8_000,
						supportsImages: false,
						supportsPromptCache: true,
					} as ModelInfo),
			}
		}
		return {
			id: deepSeekDefaultModelId,
			info: getDeepSeekModelInfo(deepSeekDefaultModelId, this.options.deepSeekModelInfo),
		}
	}
}

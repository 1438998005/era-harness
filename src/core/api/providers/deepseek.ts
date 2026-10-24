import { DeepSeekModelId, deepSeekDefaultModelId, getDeepSeekModelInfo, ModelInfo, resolveDeepSeekModelId } from "@shared/api"
import { deepSeekStreamsReasoning, deepSeekUsesR1Replay } from "@shared/deepseek-request"
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

		// 上游 PR #11392（cline#11339 修复）：把「一个标志管两件事」拆开——
		// streamsReasoning 管响应流行为（温度、reasoning_effort、reasoning_content 流），
		// usesR1Replay 管请求侧是否做 R1 历史思考回放。旧实现把 R1 回放也套在 V4 上，
		// 把输出带歪（原生工具调用标记泄漏成正文、输出畸形）。判据与反例如
		// @shared/deepseek-request 的注释；MiMo 相反（必须回传），两者不要合并。
		const streamsReasoning = deepSeekStreamsReasoning(model.id)
		const usesR1Replay = deepSeekUsesR1Replay(model.id)

		// 思维强度：只在思考模型上传；未设置时交给官方默认（high）
		const reasoningEffort = streamsReasoning ? deepSeekReasoningEffort(this.options.reasoningEffort) : undefined

		const convertedMessages = convertToOpenAiMessages(messages)
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = usesR1Replay
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
			...(streamsReasoning ? {} : { temperature: 0 }),
			...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
			...getOpenAIToolParams(tools),
		} as OpenAI.Chat.ChatCompletionCreateParamsStreaming
		const stream = await client.chat.completions.create(streamParams)

		const toolCallProcessor = new ToolCallProcessor()

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			// 上游 #11392：同一 delta 里 reasoning 先于 content 产出——模型本就先思考后作答，
			// 顺序反了思考块会被插到可见回答之后，流式渲染错位。
			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					reasoning: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (delta?.tool_calls) {
				yield* toolCallProcessor.processToolCallDeltas(delta.tool_calls)
			}

			if (chunk.usage) {
				yield* this.yieldUsage(model.info, chunk.usage)
			}
		}
	}

	getModel(): { id: DeepSeekModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId) {
			// 大小写归一：同步回来的 `DeepSeek-V4-Pro` 若不归一，会落进下面的「未知模型」分支
			// （官方价格/上下文全丢），并把非规范 id 原样发给端点。
			const known = resolveDeepSeekModelId(modelId)
			if (known) {
				return { id: known, info: getDeepSeekModelInfo(known, this.options.deepSeekModelInfo) }
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

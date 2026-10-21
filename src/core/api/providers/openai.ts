import { ModelInfo, OpenAiCompatibleModelInfo, openAiModelInfoSaneDefaults } from "@shared/api"
import {
	isKnownReasoningModelFamily,
	isUnsupportedReasoningParameterError,
	resolveOpenAiReasoningRequest,
} from "@shared/utils/reasoning-support"
import OpenAI from "openai"
import type { ChatCompletionReasoningEffort, ChatCompletionTool } from "openai/resources/chat/completions"
import { ClineStorageMessage } from "@/shared/messages/content"
import { createOpenAIClient } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"

/**
 * 已知拒绝 `reasoning_effort` 的 端点+模型（进程内记忆，带过期）。
 *
 * 必须会过期：一次误判（网关临时报错）如果把端点拉黑到重载窗口为止，
 * 用户会在“设置页选了 high”的状态下永远发不出去，而且看不到原因。
 */
const DEGRADED_REASONING_TTL_MS = 30 * 60 * 1000
const degradedReasoningEndpoints = new Map<string, number>()

function isReasoningDegraded(key: string): boolean {
	const expiresAt = degradedReasoningEndpoints.get(key)
	if (expiresAt === undefined) {
		return false
	}

	if (Date.now() >= expiresAt) {
		degradedReasoningEndpoints.delete(key)
		return false
	}

	return true
}

function markReasoningDegraded(key: string): void {
	degradedReasoningEndpoints.set(key, Date.now() + DEGRADED_REASONING_TTL_MS)
}

function reasoningEndpointKey(baseUrl: string | undefined, modelId: string): string {
	return `${baseUrl ?? ""}|${modelId}`
}

interface OpenAiHandlerOptions extends CommonApiHandlerOptions {
	openAiApiKey?: string
	openAiBaseUrl?: string
	openAiModelId?: string
	openAiModelInfo?: OpenAiCompatibleModelInfo
	reasoningEffort?: string
}

export class OpenAiHandler implements ApiHandler {
	private options: OpenAiHandlerOptions
	private client: OpenAI | undefined

	constructor(options: OpenAiHandlerOptions) {
		this.options = options
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			if (!this.options.openAiApiKey) {
				throw new Error("OpenAI API key is required")
			}
			try {
				this.client = createOpenAIClient({
					baseURL: this.options.openAiBaseUrl,
					apiKey: this.options.openAiApiKey,
				})
			} catch (error: any) {
				throw new Error(`Error creating OpenAI client: ${error.message}`)
			}
		}
		return this.client
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: ChatCompletionTool[]): ApiStream {
		const client = this.ensureClient()
		const modelId = this.options.openAiModelId ?? ""
		const isDeepseekReasoner = modelId.includes("deepseek-reasoner")
		const isR1FormatRequired = this.options.openAiModelInfo?.isR1FormatRequired ?? false
		const isReasoningModelFamily = isKnownReasoningModelFamily(modelId)

		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]
		let temperature: number | undefined
		const configuredTemperature = this.options.openAiModelInfo?.temperature
		if (configuredTemperature !== undefined) {
			const tempValue = Number(configuredTemperature)
			temperature = tempValue === 0 ? undefined : tempValue
		} else {
			temperature = openAiModelInfoSaneDefaults.temperature
		}
		let maxTokens: number | undefined

		if (this.options.openAiModelInfo?.maxTokens && this.options.openAiModelInfo.maxTokens > 0) {
			maxTokens = Number(this.options.openAiModelInfo.maxTokens)
		} else {
			maxTokens = undefined
		}

		if (isDeepseekReasoner || isR1FormatRequired) {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		if (isReasoningModelFamily) {
			openAiMessages = [{ role: "developer", content: systemPrompt }, ...convertToOpenAiMessages(messages)]
		}

		// 选错档位不应该把会话打死：端点明确拒绝时去掉参数重试一次，并记住该 端点+模型。
		const endpointKey = reasoningEndpointKey(this.options.openAiBaseUrl, modelId)
		const reasoningRequest = resolveOpenAiReasoningRequest({
			storedEffort: this.options.reasoningEffort,
			isKnownReasoningFamily: isReasoningModelFamily,
		})
		const reasoningDegraded = isReasoningDegraded(endpointKey)
		const requestedReasoningEffort = reasoningDegraded
			? undefined
			: (reasoningRequest.effort as ChatCompletionReasoningEffort | undefined)

		if (reasoningRequest.dropTemperature) {
			temperature = undefined // 思维模型/带思维参数的请求不支持自定义采样温度
		}

		const buildParams = (effort?: ChatCompletionReasoningEffort) =>
			({
				model: modelId,
				messages: openAiMessages,
				temperature,
				max_tokens: maxTokens,
				reasoning_effort: effort,
				stream: true,
				stream_options: { include_usage: true },
				...getOpenAIToolParams(tools),
			}) as OpenAI.Chat.ChatCompletionCreateParamsStreaming

		let stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>
		try {
			stream = await client.chat.completions.create(buildParams(requestedReasoningEffort))
		} catch (error) {
			if (!requestedReasoningEffort || !isUnsupportedReasoningParameterError(error)) {
				throw error
			}

			markReasoningDegraded(endpointKey)
			Logger.warn(
				`[openai] 端点不支持 reasoning_effort（${endpointKey}），已去掉该参数重试；${
					DEGRADED_REASONING_TTL_MS / 60000
				} 分钟内不再发送。`,
			)
			stream = await client.chat.completions.create(buildParams(undefined))
		}

		const toolCallProcessor = new ToolCallProcessor()

		// OpenAI 兼容提供方（DeepSeek/GLM 等）会在流式响应的每个 chunk 里重复回传「累计」usage，
		// 而消费端 task/index.ts 用 `+=` 累加，会把同一个 prompt_tokens 叠加 N 次 → 上下文数字爆炸。
		// 这里只在流结束后产出一次最终 usage（最后一个非空 chunk.usage 即该请求的完整累计用量）。
		let finalUsage: OpenAI.Chat.ChatCompletionChunk["usage"] | undefined

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					reasoning: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (delta?.tool_calls) {
				yield* toolCallProcessor.processToolCallDeltas(delta.tool_calls)
			}

			if (chunk.usage) {
				finalUsage = chunk.usage
			}
		}

		if (finalUsage) {
			// 统一 token 口径（与 Anthropic 加和约定一致，供上下文计算与显示复用）：
			// inputTokens = 非缓存输入，cacheReads = 缓存命中，cacheWrites = 0
			//（OpenAI 兼容端不单独计「缓存写入」费）。三者相加 = prompt_tokens，不再重复计缓存部分。
			// 部分兼容端点用 DeepSeek 字段名返回命中数，cached_tokens 缺失时回退到 prompt_cache_hit_tokens。
			const promptTokens = finalUsage.prompt_tokens || 0
			const usageWithDeepSeekFields = finalUsage as typeof finalUsage & { prompt_cache_hit_tokens?: number }
			const cacheHitTokens =
				finalUsage.prompt_tokens_details?.cached_tokens || usageWithDeepSeekFields.prompt_cache_hit_tokens || 0
			yield {
				type: "usage",
				inputTokens: Math.max(0, promptTokens - cacheHitTokens),
				outputTokens: finalUsage.completion_tokens || 0,
				cacheReadTokens: cacheHitTokens,
				cacheWriteTokens: 0,
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.openAiModelId ?? "",
			info: this.options.openAiModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}
}

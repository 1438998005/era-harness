/**
 * 小米 MiMo（OpenAI 兼容）请求 handler。
 *
 * 为什么不复用 DeepSeekHandler：基址不同、档位映射不同（MiMo 走低/中/高三档，
 * 没有 low/high/max 这套官方档位），计费字段也没有 DeepSeek 的缓存命中拆分。
 * 两者共享的只是「OpenAI 兼容」这一层形状。
 *
 * 已验证事实（勿凭猜测改动）：
 * - 基址 `https://api.xiaomimimo.com/v1`（无 key 访问 /v1/models 返回 401 Invalid API Key）
 * - 思维内容以 `delta.reasoning_content` 流式返回（与 DeepSeek/OpenAI 兼容端点一致）
 */
import { getMimoModelInfo, type MimoModelId, type ModelInfo, mimoDefaultModelId } from "@shared/api"
import { isUnsupportedReasoningParameterError } from "@shared/utils/reasoning-support"
import OpenAI from "openai"
import type { ChatCompletionReasoningEffort, ChatCompletionTool } from "openai/resources/chat/completions"
import { ClineStorageMessage } from "@/shared/messages/content"
import { createOpenAIClient } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"
import { isMimoModelFamily } from "@/utils/model-utils"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"

export const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1"

/**
 * 端点拒绝 `reasoning_effort` 时的降级记忆（进程内、带过期）。
 * 必须会过期：一次临时性 400 若把端点永久拉黑，用户选了「高」却永远发不出去且看不到原因。
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

/**
 * 界面档位（low|medium|high|xhigh|none）→ MiMo 的 OpenAI 兼容档位。
 * xhigh/max 收敛到 high（MiMo 没有更高档）；none/未设置不传，交给服务端默认。
 */
function mimoReasoningEffort(effort?: string): "low" | "medium" | "high" | undefined {
	switch (effort) {
		case "low":
			return "low"
		case "medium":
			return "medium"
		case "high":
		case "xhigh":
		case "max":
			return "high"
		default:
			return undefined
	}
}

interface MimoHandlerOptions extends CommonApiHandlerOptions {
	mimoApiKey?: string
	apiModelId?: string
	mimoModelInfo?: ModelInfo
	reasoningEffort?: string
	/** 私有网关/测试用；默认官方基址 */
	mimoBaseUrl?: string
}

export class MimoHandler implements ApiHandler {
	private options: MimoHandlerOptions
	private client: OpenAI | undefined

	constructor(options: MimoHandlerOptions) {
		this.options = options
	}

	private get baseUrl(): string {
		return this.options.mimoBaseUrl?.trim() || MIMO_BASE_URL
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			if (!this.options.mimoApiKey) {
				throw new Error("Xiaomi MiMo API key is required")
			}
			try {
				this.client = createOpenAIClient({
					baseURL: this.baseUrl,
					apiKey: this.options.mimoApiKey,
				})
			} catch (error) {
				throw new Error(`Error creating Xiaomi MiMo client: ${error instanceof Error ? error.message : error}`)
			}
		}
		return this.client
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: ChatCompletionTool[]): ApiStream {
		const client = this.ensureClient()
		const model = this.getModel()

		// 思维能力：以内置清单为准，在线同步回来的未知模型按 id 家族判断
		const supportsReasoning = model.info.supportsReasoning ?? isMimoModelFamily(model.id)
		const endpointKey = `${this.baseUrl}|${model.id}`
		const requestedEffort =
			supportsReasoning && !isReasoningDegraded(endpointKey) ? mimoReasoningEffort(this.options.reasoningEffort) : undefined

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const buildParams = (effort?: ChatCompletionReasoningEffort) =>
			({
				model: model.id,
				messages: openAiMessages,
				// 不传 temperature：MiMo 未文档化采样参数，思考档位下更不应覆盖
				max_tokens: model.info.maxTokens && model.info.maxTokens > 0 ? model.info.maxTokens : undefined,
				stream: true,
				stream_options: { include_usage: true },
				...(effort ? { reasoning_effort: effort } : {}),
				...getOpenAIToolParams(tools),
			}) as OpenAI.Chat.ChatCompletionCreateParamsStreaming

		let stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>
		try {
			stream = await client.chat.completions.create(buildParams(requestedEffort))
		} catch (error) {
			if (!requestedEffort || !isUnsupportedReasoningParameterError(error)) {
				throw error
			}

			markReasoningDegraded(endpointKey)
			Logger.warn(
				`[mimo] 端点不支持 reasoning_effort（${endpointKey}），已去掉该参数重试；${
					DEGRADED_REASONING_TTL_MS / 60000
				} 分钟内不再发送。`,
			)
			stream = await client.chat.completions.create(buildParams(undefined))
		}

		const toolCallProcessor = new ToolCallProcessor()
		// 兼容端点会在每个 chunk 重复回传「累计」usage，消费端按 += 累加，
		// 所以只在流结束后产出一次最终用量。
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
			const promptTokens = finalUsage.prompt_tokens || 0
			const cacheHitTokens = finalUsage.prompt_tokens_details?.cached_tokens || 0
			yield {
				type: "usage",
				inputTokens: Math.max(0, promptTokens - cacheHitTokens),
				outputTokens: finalUsage.completion_tokens || 0,
				cacheReadTokens: cacheHitTokens,
				cacheWriteTokens: 0,
			}
		}
	}

	getModel(): { id: MimoModelId | string; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId) {
			// 在线同步回来的新 id 不在内置清单里：保留用户选的 id（否则请求会被悄悄改回默认模型），
			// 元数据缺失时用种子默认的保守值。
			return { id: modelId, info: getMimoModelInfo(modelId, this.options.mimoModelInfo) }
		}
		return { id: mimoDefaultModelId, info: getMimoModelInfo(mimoDefaultModelId, this.options.mimoModelInfo) }
	}
}

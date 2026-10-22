/**
 * 小米 MiMo（OpenAI 兼容）请求 handler。
 *
 * 为什么不复用 DeepSeekHandler：两者只共享「OpenAI 兼容」这一层形状，
 * 思考开关的参数名、基址、能力开关都不同。
 *
 * 以下事实全部来自官方文档（逐页核对，不是从 SDK 形状推测）：
 * - 基址 `https://api.xiaomimimo.com/v1`（/docs/zh-CN/quick-start/summary/first-api-call）
 * - 思考用 `thinking: { type: "enabled" | "disabled" }`，**不是 `reasoning_effort`**，
 *   只有开关没有档位；三款 v2.6 默认开启（/docs/.../text-generation/deep-thinking）
 * - 输出长度用 `max_completion_tokens`（限制思考 + 回答总长，不是 `max_tokens`）
 * - 思考内容在 `delta.reasoning_content`；流式时先输出 reasoning_content 再输出 content
 * - **Agent 多轮 + 工具调用 + 思考开启时，历史 assistant 必须带 `reasoning_content`，
 *   否则 API 返回 400**（官方点名了 Cursor/TRAE/Roo Code/Codex 等产品的这个坑）
 * - 思考开启时 `temperature`/`top_p` 传了也无效（服务端强制 1.0/0.95），所以不发
 * - usage 带 `prompt_tokens_details.cached_tokens`（缓存命中）与
 *   `completion_tokens_details.reasoning_tokens`
 * - 计费：输入分「缓存命中 / 未命中」两档，输出单列，无峰谷倍率（见 @/shared/mimoPricing）
 */
import { getMimoModelInfo, type MimoModelId, type ModelInfo, mimoDefaultModelId } from "@shared/api"
import { calculateMimoCost } from "@shared/mimoPricing"
import OpenAI from "openai"
import type { ChatCompletionTool } from "openai/resources/chat/completions"
import { ClineStorageMessage } from "@/shared/messages/content"
import { buildMimoParams, isThinkingParamRejected, mimoBaseUrlForKey, mimoThinkingParam } from "@/shared/mimo-request"
import { createOpenAIClient } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { prepareMimoMessages } from "../transform/r1-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"

// 基址、入口选择与思考参数映射统一放在 @/shared/mimo-request：
// 设置页的在线同步与这里必须用同一份，否则会出现「同步地址 ≠ 请求地址」。
export { MIMO_BASE_URL } from "@/shared/mimo-request"

/**
 * 端点拒绝 `thinking` 参数时的降级记忆（进程内、带过期）。
 * 必须会过期：一次临时性 400 若把端点永久拉黑，用户选了「关闭思考」却永远发不出去且看不到原因。
 */
const DEGRADED_THINKING_TTL_MS = 30 * 60 * 1000
const degradedThinkingEndpoints = new Map<string, number>()

function isThinkingDegraded(key: string): boolean {
	const expiresAt = degradedThinkingEndpoints.get(key)
	if (expiresAt === undefined) {
		return false
	}
	if (Date.now() >= expiresAt) {
		degradedThinkingEndpoints.delete(key)
		return false
	}
	return true
}

function markThinkingDegraded(key: string): void {
	degradedThinkingEndpoints.set(key, Date.now() + DEGRADED_THINKING_TTL_MS)
}

interface MimoHandlerOptions extends CommonApiHandlerOptions {
	mimoApiKey?: string
	apiModelId?: string
	mimoModelInfo?: ModelInfo
	reasoningEffort?: string
}

export class MimoHandler implements ApiHandler {
	private options: MimoHandlerOptions
	private client: OpenAI | undefined

	constructor(options: MimoHandlerOptions) {
		this.options = options
	}

	/** 按密钥前缀选官方入口（sk- 实时 API / tp-、ttp- Token Plan）。 */
	private get baseUrl(): string {
		return mimoBaseUrlForKey(this.options.mimoApiKey)
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

		// MiMo 全系支持深度思考；只有配置里显式写 false 才关（正常不会出现）。
		const supportsReasoning = model.info.supportsReasoning !== false
		const endpointKey = `${this.baseUrl}|${model.id}`
		// 官方默认已开启思考，所以只有用户显式选「关闭」时才发参数；
		// 端点被拉黑时不发（否则每次 400），此时思考开关失效但请求仍可完成。
		const thinkingParam =
			supportsReasoning && !isThinkingDegraded(endpointKey) ? mimoThinkingParam(this.options.reasoningEffort) : {}
		const sendThinking = "thinking" in thinkingParam

		// 官方硬性要求：思考开启 + 历史含工具调用时，assistant 必须带回 reasoning_content，否则 400。
		// 混排 user 消息会让窗口判据失效，所以 MiMo 用 attachToAllToolCalls（见 prepareMimoMessages）。
		// 用户显式关闭思考时不回传，避免 disabled 与请求体里的思考内容自相矛盾。
		const convertedMessages = convertToOpenAiMessages(messages)
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...prepareMimoMessages(convertedMessages, messages, this.options.reasoningEffort),
		]

		const buildParams = (withThinking: boolean) =>
			buildMimoParams({
				model: model.id,
				messages: openAiMessages,
				// 官方用 max_completion_tokens 限制「思考 + 回答」总长（不是 max_tokens）；
				// 思考开启时 temperature/top_p 由服务端强制 1.0/0.95，传了也无效 → 不发。
				maxCompletionTokens: model.info.maxTokens,
				thinkingParam: withThinking ? thinkingParam : {},
				toolParams: getOpenAIToolParams(tools),
			})

		let stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>
		try {
			stream = await client.chat.completions.create(buildParams(sendThinking))
		} catch (error) {
			if (!sendThinking || !isThinkingParamRejected(error)) {
				throw error
			}

			markThinkingDegraded(endpointKey)
			Logger.warn(
				`[mimo] 端点不接受 thinking 参数（${endpointKey}），已去掉该参数重试；${
					DEGRADED_THINKING_TTL_MS / 60000
				} 分钟内不再发送（思考开关暂时失效）。`,
			)
			stream = await client.chat.completions.create(buildParams(false))
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
			// 未命中输入 = prompt_tokens - 命中。官方把输入拆成两档计价，没有「普通输入」这一档，
			// 所以沿用 DeepSeek 的口径：inputTokens 恒 0、未命中进 cacheWriteTokens。
			// 三段相加仍等于 prompt_tokens，上下文占用统计不受影响。
			const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens)
			const outputTokens = finalUsage.completion_tokens || 0
			yield {
				type: "usage",
				inputTokens: 0,
				outputTokens,
				cacheReadTokens: cacheHitTokens,
				cacheWriteTokens: cacheMissTokens,
				// 显式算成本，不依赖 task 层兜底公式（否则兜底口径一改，MiMo 成本会静默归零）
				totalCost: calculateMimoCost(model.info, cacheHitTokens, cacheMissTokens, outputTokens),
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

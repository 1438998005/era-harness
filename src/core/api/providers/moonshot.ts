/**
 * Kimi (Moonshot)（OpenAI 兼容）请求 handler。
 *
 * 为什么不复用 MimoHandler / DeepSeekHandler：三者只共享「OpenAI 兼容」这一层形状，
 * 思考参数名（reasoning_effort vs thinking.type）、入口判据（双入口下拉 vs 密钥前缀）、
 * 固定参数集合都不同（知识库 12 §12.22 的教训：方言/参数差异必须各自显式声明）。
 *
 * 以下事实全部来自官方文档（2026-11-04 逐页核对 platform.kimi.com，不是从 SDK 形状推测）：
 * - 基址：国内 `https://api.moonshot.cn/v1` / 国际 `https://api.moonshot.ai/v1`，
 *   由设置页入口下拉决定（moonshotApiLine），两站密钥不互通
 * - 鉴权 `Authorization: Bearer`（官方 SDK 示例即 api_key=，无 api-key 头歧义）
 * - K3.1 Pro 始终开启思考，顶层 `reasoning_effort` low|high|max（默认 max）；
 *   在售三款均始终思考（getMoonshotThinkingParam 的判据见 @/shared/moonshot-request）
 * - 输出长度用 `max_completion_tokens`（默认 131072、最大 1048576）
 * - temperature=1.0 / top_p=0.95 / n=1 / presence_penalty=0 / frequency_penalty=0 为官方
 *   固定值，**不要显式传入**（buildMoonshotParams 已保证不发送，插件全局 temperature 不生效）
 * - 思考内容在 `delta.reasoning_content`；**多轮与工具调用必须原样回传完整 assistant
 *   message（含 reasoning_content）**——与 MiMo 的 400 坑同族（知识库 18），历史含工具调用
 *   的 assistant 一律附加（prepareMoonshotMessages）
 * - usage 带 `prompt_tokens_details.cached_tokens`（缓存命中）；计费输入分命中/未命中两档、
 *   输出单列，字段口径与 DeepSeek/MiMo 一致（cacheWritesPrice 承载未命中输入价）
 */
import { getMoonshotModelInfo, type ModelInfo, moonshotDefaultModelId } from "@shared/api"
import OpenAI from "openai"
import type { ChatCompletionTool } from "openai/resources/chat/completions"
import { ClineStorageMessage } from "@/shared/messages/content"
import {
	buildMoonshotParams,
	moonshotBaseUrlForLine,
	moonshotThinkingParam,
	shouldAttachMoonshotReasoning,
} from "@/shared/moonshot-request"
import { createOpenAIClient } from "@/shared/net"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { addReasoningContent } from "../transform/r1-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"

// 基址与入口选择统一放在 @/shared/moonshot-request：
// 设置页的下拉/链接切换与这里必须用同一份，否则会出现「同步地址 ≠ 请求地址」。
export { MOONSHOT_CHINA_BASE_URL, MOONSHOT_INTERNATIONAL_BASE_URL } from "@/shared/moonshot-request"

interface MoonshotHandlerOptions extends CommonApiHandlerOptions {
	moonshotApiKey?: string
	apiModelId?: string
	moonshotModelInfo?: ModelInfo
	reasoningEffort?: string
	/** 入口下拉值（"china" | "international"）；undefined 回落默认国内站。 */
	apiLine?: string
}

export class MoonshotHandler implements ApiHandler {
	private options: MoonshotHandlerOptions
	private client: OpenAI | undefined

	constructor(options: MoonshotHandlerOptions) {
		this.options = options
	}

	/** 按设置页入口下拉选官方基址（与在线同步、控制台链接同一判据）。 */
	private get baseUrl(): string {
		return moonshotBaseUrlForLine(this.options.apiLine)
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			if (!this.options.moonshotApiKey) {
				throw new Error("Kimi API key is required")
			}
			try {
				this.client = createOpenAIClient({
					baseURL: this.baseUrl,
					apiKey: this.options.moonshotApiKey,
				})
			} catch (error) {
				throw new Error(`Error creating Kimi client: ${error instanceof Error ? error.message : error}`)
			}
		}
		return this.client
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: ChatCompletionTool[]): ApiStream {
		const client = this.ensureClient()
		const model = this.getModel()

		// 在售三款均始终思考；reasoning_effort 只在内置清单内的模型上发送（未知 id 不发，
		// 交给官方默认 max，避免新/老模型收到不认识的参数直接 400）。
		// 门控判据与「历史 reasoning_content 回传」共用 shouldAttachMoonshotReasoning（单源）。
		const thinkingParam = moonshotThinkingParam(this.options.reasoningEffort, model.id)

		// 历史 reasoning_content 回传（#234 口径对齐，以 r1-format.ts 实际行为为准）：
		// 当前轮（最后一条 user 之后）的 assistant 一律附加；历史轮只给带 tool_calls 的
		// assistant 附加，普通历史 assistant 不回传。「官方要求完整 assistant」的完整口径
		// 待真实 Key 多轮回放确认（KB 08 #234），确认前不得按想象扩判据。
		const convertedMessages = convertToOpenAiMessages(messages)
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...this.prepareMessages(convertedMessages, messages),
		]

		const params = buildMoonshotParams({
			model: model.id,
			messages: openAiMessages,
			maxCompletionTokens: model.info.maxTokens,
			thinkingParam,
			toolParams: getOpenAIToolParams(tools),
		})

		const stream = await client.chat.completions.create(params)

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
			// 未命中输入 = prompt_tokens - 命中。输入拆两档计价，没有「普通输入」这一档，
			// 沿用 DeepSeek/MiMo 口径：inputTokens 恒 0、未命中进 cacheWriteTokens，
			// 三段相加仍等于 prompt_tokens，上下文占用统计不受影响。
			const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens)
			const outputTokens = finalUsage.completion_tokens || 0
			const hitPrice = model.info.cacheReadsPrice ?? 0
			const missPrice = model.info.cacheWritesPrice ?? 0
			const outPrice = model.info.outputPrice ?? 0
			yield {
				type: "usage",
				inputTokens: 0,
				outputTokens,
				cacheReadTokens: cacheHitTokens,
				cacheWriteTokens: cacheMissTokens,
				// 显式算成本，不依赖 task 层兜底公式（与 calculateMimoCost 同式，无峰谷倍率）
				totalCost: (cacheHitTokens * hitPrice + cacheMissTokens * missPrice + outputTokens * outPrice) / 1_000_000,
			}
		}
	}

	/**
	 * 历史思考回传的接线（与 prepareMimoMessages 同位置语义）：
	 * 判据在 @/shared/moonshot-request（shouldAttachMoonshotReasoning，按内置清单），
	 * 附加策略是 attachToAllToolCalls——实际口径（r1-format.ts 实现）：当前轮全部
	 * assistant + 历史轮带 tool_calls 的 assistant，普通历史 assistant 不回传
	 * （#234：完整口径待真实 Key 回放确认，行为不盲改）。
	 * 单独成函数是为了让测试能从这里钉住接线，删掉判据就会红。
	 */
	private prepareMessages(
		openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
		originalMessages: ClineStorageMessage[],
	): OpenAI.Chat.ChatCompletionMessageParam[] {
		if (!shouldAttachMoonshotReasoning(this.getModel().id)) {
			return openAiMessages
		}
		return addReasoningContent(openAiMessages, originalMessages, { attachToAllToolCalls: true })
	}

	getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId) {
			// 在线同步回来的新 id 不在内置清单里：保留用户选的 id（否则请求会被悄悄改回默认模型），
			// 元数据缺失时用默认档的保守值。
			return { id: modelId, info: getMoonshotModelInfo(modelId, this.options.moonshotModelInfo) }
		}
		return { id: moonshotDefaultModelId, info: getMoonshotModelInfo(moonshotDefaultModelId, this.options.moonshotModelInfo) }
	}
}

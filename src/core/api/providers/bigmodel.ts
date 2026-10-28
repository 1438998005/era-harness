/**
 * 智谱 BigModel（GLM 系列，OpenAI 兼容）请求 handler。
 *
 * 结构照 MimoHandler：同一套 XML 协议提示（不发原生 tools）、思考开关（thinking.type，
 * 与 MiMo 同构）、reasoning_content 流式透出、usage「只取一次」+ 三档成本口径。
 *
 * 与 MiMo 的两点差异（事实来源见 @/shared/bigmodel-request 头注与知识库 23）：
 * - 基址固定国内线 `https://open.bigmodel.cn/api/paas/v4`，标准 Bearer（官方无 api-key 头要求）
 * - v1 不回传历史 reasoning_content：GLM 多轮是否硬性要求待验证；若实测 400，
 *   启用 r1-format 的 addReasoningContent(attachToAllToolCalls)（MiMo 同款机械）
 */
import { type BigmodelModelId, bigmodelDefaultModelId, getBigmodelModelInfo, type ModelInfo } from "@shared/api"
import { calculateBigmodelCost } from "@shared/bigmodelPricing"
import OpenAI from "openai"
import type { ChatCompletionTool } from "openai/resources/chat/completions"
import { BIGMODEL_BASE_URL, bigmodelThinkingParam, buildBigmodelParams } from "@/shared/bigmodel-request"
import { ClineStorageMessage } from "@/shared/messages/content"
import { createOpenAIClient } from "@/shared/net"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"

// 基址常量统一放 @/shared/bigmodel-request：设置页与这里必须用同一份。
export { BIGMODEL_BASE_URL } from "@/shared/bigmodel-request"

interface BigmodelHandlerOptions extends CommonApiHandlerOptions {
	bigmodelApiKey?: string
	apiModelId?: string
	bigmodelModelInfo?: ModelInfo
	reasoningEffort?: string
}

export class BigmodelHandler implements ApiHandler {
	private options: BigmodelHandlerOptions
	private client: OpenAI | undefined

	constructor(options: BigmodelHandlerOptions) {
		this.options = options
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			if (!this.options.bigmodelApiKey) {
				throw new Error("BigModel API key is required")
			}
			try {
				this.client = createOpenAIClient({
					baseURL: BIGMODEL_BASE_URL,
					apiKey: this.options.bigmodelApiKey,
				})
			} catch (error) {
				throw new Error(`Error creating BigModel client: ${error instanceof Error ? error.message : error}`)
			}
		}
		return this.client
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: ChatCompletionTool[]): ApiStream {
		const client = this.ensureClient()
		const model = this.getModel()

		// GLM 思考开关与 MiMo 同构（thinking.type）；官方默认态未逐条核实，
		// 所以只有用户显式选「关闭」时才发 disabled，其余情况不发参数交给官方默认。
		// supportsReasoning = false 的模型（待验证项）同样不发。
		const thinkingParam = model.info.supportsReasoning === false ? {} : bigmodelThinkingParam(this.options.reasoningEffort)

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const stream = await client.chat.completions.create(
			buildBigmodelParams({
				model: model.id,
				messages: openAiMessages,
				maxTokens: model.info.maxTokens,
				thinkingParam,
				toolParams: getOpenAIToolParams(tools),
			}),
		)

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
			// 沿用 DeepSeek/MiMo 口径：inputTokens 恒 0、未命中进 cacheWriteTokens。
			const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens)
			const outputTokens = finalUsage.completion_tokens || 0
			yield {
				type: "usage",
				inputTokens: 0,
				outputTokens,
				cacheReadTokens: cacheHitTokens,
				cacheWriteTokens: cacheMissTokens,
				// 阶梯款按实际 promptTokens 选档精算（免费款恒 0），不依赖 task 层兜底公式
				totalCost: calculateBigmodelCost(
					model.id,
					model.info,
					promptTokens,
					cacheHitTokens,
					cacheMissTokens,
					outputTokens,
				),
			}
		}
	}

	getModel(): { id: BigmodelModelId | string; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId) {
			// 未知但非空的 id：保留用户选的 id（官方可能新增模型，静默改回默认等于替用户改配置），
			// 元数据缺失时用默认模型的保守值。
			return { id: modelId, info: getBigmodelModelInfo(modelId, this.options.bigmodelModelInfo) }
		}
		return { id: bigmodelDefaultModelId, info: getBigmodelModelInfo(bigmodelDefaultModelId, this.options.bigmodelModelInfo) }
	}
}

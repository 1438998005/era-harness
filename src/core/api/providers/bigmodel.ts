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
import {
	BIGMODEL_BASE_URL,
	bigmodelThinkingParam,
	buildBigmodelParams,
	clampBigmodelOutputTokens,
	estimateBigmodelPromptTokens,
} from "@/shared/bigmodel-request"
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
	/**
	 * 上一轮真实用量（prompt+completion，#57）：下一轮的输入 ≈ 上一轮总量 + 新增消息，
	 * 与字符粗估取 max 作预估——Exact 但滞后 × 粗糙但新鲜，两个界取大的更稳。
	 */
	private lastRoundTokens: number | undefined

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

		// 思考参数由模型白名单决定（#81）：5.3 系强制思考、**绝不发 disabled**（官方会请求失败），
		// 5.2 可关；未知模型什么都不发。跨 provider 残留的 "none" 也在这里被吃掉。
		const thinkingParam = bigmodelThinkingParam(this.options.reasoningEffort, model.id)

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// #57：BigModel 窗口含输出，满额 max_tokens 会把实际输入预算压到窗口−输出
		// （glm-4.5-flash 仅 32K，实测 28.6k prompt 即 400×3）。输出上限按预估输入夹紧。
		const estimatedPromptTokens = Math.max(estimateBigmodelPromptTokens(openAiMessages), this.lastRoundTokens ?? 0)
		const stream = await client.chat.completions.create(
			buildBigmodelParams({
				model: model.id,
				messages: openAiMessages,
				maxTokens: clampBigmodelOutputTokens({
					maxTokens: model.info.maxTokens,
					contextWindow: model.info.contextWindow,
					estimatedPromptTokens,
				}),
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
			// 记住本轮总量（输入+输出），供下一轮预估输入预算（#57）
			this.lastRoundTokens = promptTokens + (finalUsage.completion_tokens || 0)
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

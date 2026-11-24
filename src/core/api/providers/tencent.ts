/**
 * 腾讯云 TokenHub（OpenAI 兼容）请求 handler：一个 handler 两个入口。
 *
 * - 按量（tencent-tokenhub）：广州/新加坡双线（设置页下拉），Bearer 按量 Key（sk-）；
 * - Coding Plan（tencent-coding-plan）：固定套餐基址 + 专属 Key（sk-sp-），按请求次数
 *   计费 → totalCost 恒 0（bigmodel-plan 同款 billingMode 口径）。
 *
 * 与 MoonshotHandler 的结构差异（事实来源见 @/shared/tencent-request 头注）：
 * - 思考参数只作用于混元系（reasoning_effort low|medium|high / thinking.type 开关 /
 *   preserved_thinking——工具定义在系统提示而非 tools 数组时官方要求手动开启，正是本插件
 *   XML 协议的形态）；第三方模型（DeepSeek/GLM/Kimi…）不发明知参数，交给官方默认；
 * - 两类 Key 官方明示「不互通、请勿混用」，套餐入口**不做**跨入口回落
 *   （bigmodel-plan 会回落按量 Key，这里两把 Key 前缀与站点都不同，回落只会制造困惑的 401）；
 * - 峰谷计价：DeepSeek 系工作日峰段整单 ×2，按请求时刻精算（calculateTencentCost）；
 * - 输出夹紧（#274）：只有标了「窗口含输出」的混元（hy4-flash / hy4 / hy3）按 bigmodel
 *   同款夹 max_completion_tokens（clampBigmodelOutputTokens 直接复用，不改其实现）；
 *   纯输入窗口的第三方模型按目录值发（08 #82 裁定：夹了等于凭空砍输出）。
 */

import type { ModelInfo } from "@shared/api"
import OpenAI from "openai"
import type { ChatCompletionTool } from "openai/resources/chat/completions"
import { clampBigmodelOutputTokens, estimateBigmodelPromptTokens } from "@/shared/bigmodel-request"
import { ClineStorageMessage } from "@/shared/messages/content"
import { createOpenAIClient } from "@/shared/net"
import {
	getTencentCodingPlanModelInfo,
	getTencentTokenhubModelInfo,
	tencentCodingPlanDefaultModelId,
	tencentTokenhubDefaultModelId,
} from "@/shared/tencent-models"
import {
	buildTencentParams,
	calculateTencentCost,
	shouldAttachTencentReasoning,
	TENCENT_CODING_PLAN_BASE_URL,
	tencentBaseUrlForLine,
	tencentThinkingParam,
} from "@/shared/tencent-request"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { addReasoningContent } from "../transform/r1-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"

// 基址常量统一放 @/shared/tencent-request：设置页与这里必须用同一份。
export { TENCENT_CHINA_BASE_URL, TENCENT_CODING_PLAN_BASE_URL } from "@/shared/tencent-request"

interface TencentHandlerOptions extends CommonApiHandlerOptions {
	tencentTokenhubApiKey?: string
	tencentCodingPlanApiKey?: string
	apiModelId?: string
	tencentTokenhubModelInfo?: ModelInfo
	tencentCodingPlanModelInfo?: ModelInfo
	reasoningEffort?: string
	/** 按量入口下拉值（"china" | "intl"）；undefined 回落默认广州站。 */
	apiLine?: string
	/** 计费口径：plan = Coding Plan 套餐额度，不按 token 计费（totalCost 恒 0） */
	billingMode?: "metered" | "plan"
}

export class TencentHandler implements ApiHandler {
	private options: TencentHandlerOptions
	private client: OpenAI | undefined
	/** 上一轮真实 usage 总量（输入+输出），供下一轮预估输入预算（bigmodel #57 同款，#274）。 */
	private lastRoundTokens: number | undefined

	constructor(options: TencentHandlerOptions) {
		this.options = options
	}

	private get isPlan(): boolean {
		return this.options.billingMode === "plan"
	}

	/** 按量入口按设置页下拉选官方基址；套餐入口固定 lkeap 套餐域（与按量 Key 不互通）。 */
	private get baseUrl(): string {
		return this.isPlan ? TENCENT_CODING_PLAN_BASE_URL : tencentBaseUrlForLine(this.options.apiLine)
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			// 两把 Key 官方明示不互通（sk- vs sk-sp-）：套餐入口缺 Key 就明确报缺，
			// 不像 bigmodel-plan 那样回落按量 Key——回落只会把「没买套餐」变成难懂的 401。
			const apiKey = this.isPlan ? this.options.tencentCodingPlanApiKey?.trim() : this.options.tencentTokenhubApiKey?.trim()
			if (!apiKey) {
				throw new Error(
					this.isPlan
						? "Tencent Coding Plan API key is required (sk-sp-…，与按量 Key 不互通)"
						: "Tencent TokenHub API key is required",
				)
			}
			try {
				this.client = createOpenAIClient({ baseURL: this.baseUrl, apiKey })
			} catch (error) {
				throw new Error(`Error creating Tencent client: ${error instanceof Error ? error.message : error}`)
			}
		}
		return this.client
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: ChatCompletionTool[]): ApiStream {
		const client = this.ensureClient()
		const model = this.getModel()

		// 思考参数只对混元系生效（reasoning_effort / thinking.type / preserved_thinking）；
		// 第三方与未知 id 不发（tencentThinkingParam 内部按内置清单门控）。
		const thinkingParam = tencentThinkingParam(this.options.reasoningEffort, model.id)

		const convertedMessages = convertToOpenAiMessages(messages)
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...this.prepareMessages(convertedMessages, messages),
		]

		// #274：只有标了「窗口含输出」的模型才夹输出（hy4-flash / hy4 / hy3，口径见
		// @/shared/context-budget）；纯输入窗口的模型（DeepSeek/GLM/Kimi 等）按目录值发——
		// 08 #82 用户裁定：夹了等于凭空砍输出。估算优先用上一轮真实 usage（粗估兜底）。
		const estimatedPromptTokens = Math.max(estimateBigmodelPromptTokens(openAiMessages), this.lastRoundTokens ?? 0)
		const params = buildTencentParams({
			model: model.id,
			messages: openAiMessages,
			maxCompletionTokens: clampBigmodelOutputTokens({
				maxTokens: model.info.maxTokens,
				contextWindow: model.info.contextWindow,
				estimatedPromptTokens,
				contextWindowIncludesOutput: model.info.contextWindowIncludesOutput,
			}),
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
			// 记住本轮总量（输入+输出），供下一轮预估输入预算（#274，bigmodel #57 同款）
			this.lastRoundTokens = promptTokens + (finalUsage.completion_tokens || 0)
			const cacheHitTokens = finalUsage.prompt_tokens_details?.cached_tokens || 0
			// 未命中输入 = prompt_tokens - 命中。输入拆两档计价：inputTokens 恒 0、
			// 未命中进 cacheWriteTokens，三段相加仍等于 prompt_tokens（Moonshot 同口径）
			const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens)
			const outputTokens = finalUsage.completion_tokens || 0
			yield {
				type: "usage",
				inputTokens: 0,
				outputTokens,
				cacheReadTokens: cacheHitTokens,
				cacheWriteTokens: cacheMissTokens,
				// 套餐按请求次数计费：照实记 token（上下文进度条要用），金额恒 0；
				// 按量走 calculateTencentCost，DeepSeek 系峰段（北京时间工作日）整单 ×2
				totalCost:
					this.isPlan && (model.info.outputPrice ?? 0) === 0
						? 0
						: calculateTencentCost(model.id, model.info, cacheHitTokens, cacheMissTokens, outputTokens),
			}
		}
	}

	/**
	 * 历史 reasoning_content 回传（Moonshot 同位置语义）：内置清单内的模型（在售 16 款全部
	 * 深度思考）当前轮全部 assistant + 历史轮带 tool_calls 的 assistant 附加；未知 id
	 * （在线同步 / Coding Plan 动态库）保守不附加，避免非思考模型收到该字段直接 400。
	 */
	private prepareMessages(
		openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
		originalMessages: ClineStorageMessage[],
	): OpenAI.Chat.ChatCompletionMessageParam[] {
		if (!shouldAttachTencentReasoning(this.getModel().id)) {
			return openAiMessages
		}
		return addReasoningContent(openAiMessages, originalMessages, { attachToAllToolCalls: true })
	}

	getModel(): { id: string; info: ModelInfo } {
		const plan = this.isPlan
		const fallback = plan ? tencentCodingPlanDefaultModelId : tencentTokenhubDefaultModelId
		const infoOf = (id: string) =>
			plan
				? getTencentCodingPlanModelInfo(id, this.options.tencentCodingPlanModelInfo)
				: getTencentTokenhubModelInfo(id, this.options.tencentTokenhubModelInfo)

		const modelId = this.options.apiModelId
		if (modelId) {
			// 未知但非空的 id：保留用户选的 id（官方可能新增模型 / 套餐动态库可手填），元数据用默认档保守值
			return { id: modelId, info: infoOf(modelId) }
		}
		return { id: fallback, info: infoOf(fallback) }
	}
}

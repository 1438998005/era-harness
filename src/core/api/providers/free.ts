/**
 * FreeModelHandler：免费模型路由 handler（当前两渠道：Kilo / OVHcloud AI Endpoints）。
 * Zen 渠道已暂时移出池（开箱即用原则）；其客户端构造、Responses wire 与车道级冷却代码
 * 保留休眠（链上无 zen 候选即永不触发），待未来按 知识库/07 §7.7 恢复。
 *
 * 每次 createMessage：
 * 1. 多模态硬过滤（带图只留 vision 候选）+ Kilo listing 门控；
 * 2. 池内按序号依次尝试，直到「流出内容」为止；
 * 3. 失败分类：上下文超限上抛（Task 层截断重试）；（Zen 恢复后）免费门触发车道级冷却；
 *    限流（含 OVH 匿名 2rpm）/区域/传输/5xx/空停 → 换下一个；用户中止 → 直接抛；
 * 4. 全部失败 → 抛错引导配置 DeepSeek。
 *
 * 双 wire：Chat 为当前唯一在用 wire；Responses 分支仅服务 Zen muse-spark，随 Zen 移出后休眠。
 * 免费车道不计费（usage 的 totalCost 恒 0）。
 */

import { ModelInfo } from "@shared/api"
import { buildFreeCandidateChain, FREE_POOL, type FreeCandidate, type KiloFreeRow } from "@shared/free-pools"
import OpenAI from "openai"
import type { ChatCompletionTool as OpenAITool } from "openai/resources/chat/completions"
import { toOpenAIResponseTools } from "@/core/prompts/system-prompt/spec"
import { ClineStorageMessage } from "@/shared/messages/content"
import { Logger } from "@/shared/services/Logger"
import { ApiHandler, CommonApiHandlerOptions } from "../"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { getOpenAIToolParams, ToolCallProcessor } from "../transform/tool-call-processor"
import { handleResponsesApiStreamResponse } from "../utils/responses_api_support"
import { classifyFreeFailure, composeFinalError, isFreeTierGateError, isUserAbort } from "./free-errors"
import {
	createKiloClient,
	createOvhClient,
	createZenClient,
	ensureFreshZenClient,
	fetchKiloFreeModels,
	isLaneCoolingDown,
	noteLaneCooldown,
	type ZenClientHandle,
} from "./free-lanes"

interface FreeModelHandlerOptions extends CommonApiHandlerOptions {
	/** 测试注入：伪造 Zen 车道客户端（跳过真实构造与网络） */
	zenClient?: OpenAI
	/** 测试注入：伪造 Kilo 车道客户端 */
	kiloClient?: OpenAI
	/** 测试注入：伪造 OVH 车道客户端 */
	ovhClient?: OpenAI
	/** 直接提供 Kilo 免费清单，跳过 listing 网络拉取 */
	kiloFreeRows?: KiloFreeRow[]
	/** OVHcloud AI Endpoints 可选 API Key（用户设置页选填；留空走匿名 2rpm） */
	ovhApiKey?: string
}

/**
 * 请求级输出上限。免费池个别模型登记的 maxOutput 极大（dots-3-note 460800），
 * 上游 provider 会直接 400 拒绝（2026-10-19 实测）；agent 单轮输出很少超过 32K，
 * 统一截到 32768（已验证可用）。
 */
const FREE_REQUEST_MAX_OUTPUT = 32_768

/** 请求是否携带图片（ClineImageContentBlock） */
function messagesHaveImages(messages: ClineStorageMessage[]): boolean {
	return messages.some((message) => Array.isArray(message.content) && message.content.some((block) => block.type === "image"))
}

function toFreeModelInfo(candidate: FreeCandidate): ModelInfo {
	return {
		name: candidate.displayName,
		contextWindow: candidate.contextWindow,
		maxTokens: candidate.maxOutput,
		supportsImages: candidate.vision,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
	}
}

export class FreeModelHandler implements ApiHandler {
	private options: FreeModelHandlerOptions
	private zen: ZenClientHandle
	private kilo: OpenAI
	private ovh: OpenAI
	/** 当前（或上次）路由候选：动态上下文的窗口来源，也是失败重试截断的对账依据 */
	private activeCandidate: FreeCandidate | undefined
	private abortController: AbortController | undefined

	constructor(options: FreeModelHandlerOptions) {
		this.options = options
		const now = Date.now()
		this.zen = options.zenClient ? { client: options.zenClient, session: "injected", mintedAt: now } : createZenClient()
		this.kilo = options.kiloClient ?? createKiloClient()
		this.ovh = options.ovhClient ?? createOvhClient(options.ovhApiKey)
	}

	getModel(): { id: string; info: ModelInfo } {
		const candidate = this.activeCandidate ?? FREE_POOL[0]
		return { id: candidate.id, info: toFreeModelInfo(candidate) }
	}

	abort(): void {
		this.abortController?.abort()
	}

	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: OpenAITool[]): ApiStream {
		this.zen = ensureFreshZenClient(this.zen)

		const hasImages = messagesHaveImages(messages)
		const kiloFreeRows = this.options.kiloFreeRows ?? (await fetchKiloFreeModels())
		const chain = buildFreeCandidateChain({ hasImages, kiloFreeRows })

		if (chain.length === 0) {
			throw new Error(
				hasImages
					? "免费模型当前没有支持图片输入的候选模型。请移除图片重试，或在 API 设置中切换 Provider。"
					: "免费候选当前全部在冷却中或不可用，请稍后重试，或在 API 设置中配置 DeepSeek API Key。",
			)
		}

		let lastError: unknown
		let tried = 0
		let switches = 0

		for (const candidate of chain) {
			if (isLaneCoolingDown(candidate.lane)) {
				continue
			}
			tried++
			// 进入候选即上报：上下文超限重试时 Task 层按本候选窗口截断（自纠 off-by-one）
			this.activeCandidate = candidate
			const controller = new AbortController()
			this.abortController = controller
			let sawContent = false

			try {
				const stream =
					candidate.wire === "responses"
						? this.createResponsesStream(candidate, systemPrompt, messages, tools, controller.signal)
						: this.createChatStream(candidate, systemPrompt, messages, tools, controller.signal)

				for await (const chunk of stream) {
					if (chunk.type === "text" || chunk.type === "tool_calls") {
						sawContent = true
					}
					yield chunk
				}

				if (!sawContent) {
					// 空停：流出零内容零工具调用，按可切换失败处理
					lastError = new Error(`${candidate.displayName} 返回了空响应`)
					switches++
					continue
				}

				Logger.log(`[free] 命中 ${candidate.id}（车道 ${candidate.lane} / wire ${candidate.wire}，切换 ${switches} 次）`)
				return
			} catch (error) {
				if (isUserAbort(error)) {
					throw error
				}
				const kind = classifyFreeFailure(error)
				if (kind === "context-exceeded") {
					// 不切换：交给 Task 层截断重试（此时 getModel() 已指向本候选的真实窗口）
					throw error
				}
				if (isFreeTierGateError(error)) {
					// lane 级拒绝：冷却整条车道，避免后续候选逐个白烧
					noteLaneCooldown(candidate.lane)
				}
				lastError = error
				switches++
			} finally {
				this.abortController = undefined
			}
		}

		throw composeFinalError(lastError, tried)
	}

	// --------------------------------------------------------------------------
	// 双 wire 实现
	// --------------------------------------------------------------------------

	private async *createChatStream(
		candidate: FreeCandidate,
		systemPrompt: string,
		messages: ClineStorageMessage[],
		tools: OpenAITool[] | undefined,
		signal: AbortSignal,
	): ApiStream {
		const client = candidate.lane === "zen" ? this.zen.client : candidate.lane === "ovh" ? this.ovh : this.kilo
		const stream = await client.chat.completions.create(
			{
				model: candidate.id,
				messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
				max_tokens: Math.min(candidate.maxOutput, FREE_REQUEST_MAX_OUTPUT),
				stream: true,
				stream_options: { include_usage: true },
				...getOpenAIToolParams(tools),
			},
			{ signal },
		)

		const toolCallProcessor = new ToolCallProcessor()
		// 与 openai.ts 同款口径：兼容端点会在每个 chunk 重复回传累计 usage，
		// 只在流结束产出一次最终用量，防止 Task 层 `+=` 累叠爆炸。
		let finalUsage: OpenAI.Chat.ChatCompletionChunk["usage"] | undefined

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}
			// 思考内容：Kilo 侧字段名为 reasoning_content 或 reasoning（实测两种都出现过）
			const reasoningText = (delta as { reasoning_content?: unknown; reasoning?: unknown } | undefined)?.reasoning_content
			const reasoningAlt = (delta as { reasoning?: unknown } | undefined)?.reasoning
			if (typeof reasoningText === "string" && reasoningText) {
				yield { type: "reasoning", reasoning: reasoningText }
			} else if (typeof reasoningAlt === "string" && reasoningAlt) {
				yield { type: "reasoning", reasoning: reasoningAlt }
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
			const cacheReadTokens = finalUsage.prompt_tokens_details?.cached_tokens || 0
			yield {
				type: "usage",
				inputTokens: Math.max(0, promptTokens - cacheReadTokens),
				outputTokens: finalUsage.completion_tokens || 0,
				cacheReadTokens,
				cacheWriteTokens: 0,
			}
		}
	}

	private async *createResponsesStream(
		candidate: FreeCandidate,
		systemPrompt: string,
		messages: ClineStorageMessage[],
		tools: OpenAITool[] | undefined,
		signal: AbortSignal,
	): ApiStream {
		const stream = await this.zen.client.responses.create(
			{
				model: candidate.id,
				instructions: systemPrompt,
				input: toResponsesInput(messages),
				max_output_tokens: Math.min(candidate.maxOutput, FREE_REQUEST_MAX_OUTPUT),
				stream: true,
				...(tools?.length ? { tools: toOpenAIResponseTools(tools) } : {}),
			},
			{ signal },
		)

		// 复用减法幸存的 Responses 流式管道；免费车道计费恒 0
		yield* handleResponsesApiStreamResponse(
			stream as unknown as AsyncIterable<OpenAI.Responses.ResponseStreamEvent> & { _request_id?: string | null },
			toFreeModelInfo(candidate),
			async () => 0,
		)
	}
}

/** Chat 消息 → Responses input 条目（文本/图片部件转换；tool 角色按 user 文本兜底） */
function toResponsesInput(messages: ClineStorageMessage[]): OpenAI.Responses.ResponseInputItem[] {
	const items: OpenAI.Responses.ResponseInputItem[] = []
	for (const message of convertToOpenAiMessages(messages)) {
		if (message.role === "system") {
			continue // system 由 instructions 承载
		}
		const role = message.role === "assistant" ? "assistant" : "user"
		if (typeof message.content === "string") {
			items.push({ role, content: message.content })
			continue
		}
		const parts: OpenAI.Responses.ResponseInputContent[] = []
		for (const part of message.content ?? []) {
			if (part.type === "text") {
				parts.push({ type: "input_text", text: part.text })
			} else if (part.type === "image_url") {
				parts.push({ type: "input_image", image_url: part.image_url.url, detail: "auto" })
			}
		}
		items.push({ role, content: parts.length > 0 ? parts : "" })
	}
	return items
}

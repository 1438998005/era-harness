import { ApiConfiguration, ModelInfo } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { ClineStorageMessage } from "@/shared/messages/content"
import { Logger } from "@/shared/services/Logger"
import { ClineTool } from "@/shared/tools"
import { DeepSeekHandler } from "./providers/deepseek"
import { FreeModelHandler } from "./providers/free"
import { OpenAiHandler } from "./providers/openai"
import { ApiStream, ApiStreamUsageChunk } from "./transform/stream"

export type CommonApiHandlerOptions = {
	onRetryAttempt?: ApiConfiguration["onRetryAttempt"]
}
export interface ApiHandler {
	createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: ClineTool[], useResponseApi?: boolean): ApiStream
	getModel(): ApiHandlerModel
	getApiStreamUsage?(): Promise<ApiStreamUsageChunk | undefined>
	abort?(): void
}

export interface ApiHandlerModel {
	id: string
	info: ModelInfo
}

export interface ApiProviderInfo {
	providerId: string
	model: ApiHandlerModel
	mode: Mode
	customPrompt?: string // "compact"
}

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

/**
 * era harness 只保留两个 provider：
 * - `deepseek`：DeepSeek 官方预设（默认）
 * - `openai`：OpenAI 兼容（自定义端点，填 baseUrl + key 即可接任何兼容服务）
 */
function createHandlerForProvider(
	apiProvider: string | undefined,
	options: Omit<ApiConfiguration, "apiProvider">,
	mode: Mode,
): ApiHandler {
	switch (apiProvider) {
		case "free":
			// 免费模型：OpenCode Zen + Kilo + OVH 三渠道路由，零配置可用（OVH 可选填 Key 提额）
			return new FreeModelHandler({
				onRetryAttempt: options.onRetryAttempt,
				ovhApiKey: options.ovhAiEndpointsApiKey,
			})
		case "openai":
			return new OpenAiHandler({
				onRetryAttempt: options.onRetryAttempt,
				openAiApiKey: options.openAiApiKey,
				openAiBaseUrl: options.openAiBaseUrl,
				openAiModelId: mode === "plan" ? options.planModeOpenAiModelId : options.actModeOpenAiModelId,
				openAiModelInfo: mode === "plan" ? options.planModeOpenAiModelInfo : options.actModeOpenAiModelInfo,
				reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
			})
		case "deepseek":
			return new DeepSeekHandler({
				onRetryAttempt: options.onRetryAttempt,
				deepSeekApiKey: options.deepSeekApiKey,
				apiModelId: mode === "plan" ? options.planModeApiModelId : options.actModeApiModelId,
				deepSeekModelInfo: mode === "plan" ? options.planModeDeepSeekModelInfo : options.actModeDeepSeekModelInfo,
				reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
			})
		default:
			// 未配置或历史配置里的未知 provider：回落 DeepSeek（产品默认预设）
			if (apiProvider) {
				Logger.warn(`未知 apiProvider "${apiProvider}"，已回落 DeepSeek`)
			}
			return new DeepSeekHandler({
				onRetryAttempt: options.onRetryAttempt,
				deepSeekApiKey: options.deepSeekApiKey,
				apiModelId: mode === "plan" ? options.planModeApiModelId : options.actModeApiModelId,
				deepSeekModelInfo: mode === "plan" ? options.planModeDeepSeekModelInfo : options.actModeDeepSeekModelInfo,
				reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
			})
	}
}

export function buildApiHandler(configuration: ApiConfiguration, mode: Mode): ApiHandler {
	const { planModeApiProvider, actModeApiProvider, ...options } = configuration

	const apiProvider = mode === "plan" ? planModeApiProvider : actModeApiProvider

	// era harness: DeepSeek / OpenAI 兼容不做 thinking budget 裁剪（该字段随非目标 provider 已剥离）
	return createHandlerForProvider(apiProvider, options, mode)
}

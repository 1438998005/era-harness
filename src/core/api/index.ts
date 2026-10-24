import { ApiConfiguration, ModelInfo, modelIdToWriteOnProviderSwitch } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { ClineStorageMessage } from "@/shared/messages/content"
import { Logger } from "@/shared/services/Logger"
import { ClineTool } from "@/shared/tools"
import { DeepSeekHandler } from "./providers/deepseek"
import { FreeModelHandler } from "./providers/free"
import { MimoHandler } from "./providers/mimo"
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
	// 发请求前再校验一次「模型 id 属于谁」。
	// UI 上任何一条路径漏改都会把 A 家的模型名发到 B 家的端点：底部快速切换曾经就是这样，
	// 结果是 provider=deepseek + model=mimo-v2.6-pro → 打到 DeepSeek 官方报 402。
	// 判据与设置页共用 @shared/api，这里只是最后一道闸。
	const configuredModelId = mode === "plan" ? options.planModeApiModelId : options.actModeApiModelId
	const correctedModelId = modelIdToWriteOnProviderSwitch(apiProvider, configuredModelId)
	if (correctedModelId) {
		Logger.warn(
			`[api] provider=${apiProvider} 的模型 id "${configuredModelId}" 属于别家清单，本次请求改用默认档 ${correctedModelId}`,
		)
	}
	const apiModelId = correctedModelId ?? configuredModelId

	switch (apiProvider) {
		case "free":
			// 免费模型：OpenCode Zen + Kilo + OVH 三渠道路由，零配置可用（OVH 可选填 Key 提额；
			// 隐私开关开启时仅路由不收集提示词的渠道）
			return new FreeModelHandler({
				onRetryAttempt: options.onRetryAttempt,
				ovhApiKey: options.ovhAiEndpointsApiKey,
				excludeCollecting: options.freeExcludeCollecting,
			})
		case "openai":
			return new OpenAiHandler({
				onRetryAttempt: options.onRetryAttempt,
				// 粘贴密钥时很容易带进首尾空白：`Bearer sk-xxx ` 会被服务端当成另一把 key（401）。
				// 统一在入口处吃掉，别指望用户肉眼看出多了一个空格。
				openAiApiKey: options.openAiApiKey?.trim(),
				openAiBaseUrl: options.openAiBaseUrl,
				openAiModelId: mode === "plan" ? options.planModeOpenAiModelId : options.actModeOpenAiModelId,
				openAiModelInfo: mode === "plan" ? options.planModeOpenAiModelInfo : options.actModeOpenAiModelInfo,
				reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
			})
		case "deepseek":
			return new DeepSeekHandler({
				onRetryAttempt: options.onRetryAttempt,
				deepSeekApiKey: options.deepSeekApiKey?.trim(),
				apiModelId,
				deepSeekModelInfo: mode === "plan" ? options.planModeDeepSeekModelInfo : options.actModeDeepSeekModelInfo,
				reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
			})
		case "mimo":
			return new MimoHandler({
				onRetryAttempt: options.onRetryAttempt,
				// 基址由密钥前缀（sk- / tp- / ttp-）决定，空白会让前缀判定和请求头一起错。
				mimoApiKey: options.mimoApiKey?.trim(),
				apiModelId,
				mimoModelInfo: mode === "plan" ? options.planModeMimoModelInfo : options.actModeMimoModelInfo,
				reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
			})
		default:
			// 未配置或历史配置里的未知 provider：回落 DeepSeek（产品默认预设）
			if (apiProvider) {
				Logger.warn(`未知 apiProvider "${apiProvider}"，已回落 DeepSeek`)
			}
			return new DeepSeekHandler({
				onRetryAttempt: options.onRetryAttempt,
				deepSeekApiKey: options.deepSeekApiKey?.trim(),
				apiModelId,
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

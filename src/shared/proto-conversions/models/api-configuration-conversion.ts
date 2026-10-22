import {
	OpenAiCompatibleModelInfo,
	OpenRouterModelInfo,
	ModelsApiConfiguration as ProtoApiConfiguration,
	ApiProvider as ProtoApiProvider,
	ThinkingConfig,
} from "@shared/proto/cline/models"
import { ApiConfiguration, ApiProvider, OpenAiCompatibleModelInfo as AppOpenAiCompatibleModelInfo, ModelInfo } from "../../api"
import { OpenaiReasoningEffort } from "../../storage/types"

// Convert application ThinkingConfig to proto ThinkingConfig
function convertThinkingConfigToProto(config: ModelInfo["thinkingConfig"]): ThinkingConfig | undefined {
	if (!config) {
		return undefined
	}

	return {
		maxBudget: config.maxBudget,
		outputPrice: config.outputPrice,
		outputPriceTiers: config.outputPriceTiers || [], // Provide empty array if undefined
	}
}

// Convert proto ThinkingConfig to application ThinkingConfig
function convertProtoToThinkingConfig(config: ThinkingConfig | undefined): ModelInfo["thinkingConfig"] | undefined {
	if (!config) {
		return undefined
	}

	return {
		maxBudget: config.maxBudget,
		outputPrice: config.outputPrice,
		outputPriceTiers: config.outputPriceTiers.length > 0 ? config.outputPriceTiers : undefined,
	}
}

// Convert application ModelInfo to proto OpenRouterModelInfo
function convertModelInfoToProtoOpenRouter(info: ModelInfo | undefined): OpenRouterModelInfo | undefined {
	if (!info) {
		return undefined
	}

	return {
		maxTokens: info.maxTokens,
		contextWindow: info.contextWindow,
		supportsImages: info.supportsImages,
		supportsPromptCache: info.supportsPromptCache ?? false,
		inputPrice: info.inputPrice,
		outputPrice: info.outputPrice,
		cacheWritesPrice: info.cacheWritesPrice,
		cacheReadsPrice: info.cacheReadsPrice,
		description: info.description,
		thinkingConfig: convertThinkingConfigToProto(info.thinkingConfig),
		supportsGlobalEndpoint: info.supportsGlobalEndpoint,
		tiers: info.tiers || [],
	}
}

// Convert proto OpenRouterModelInfo to application ModelInfo
function convertProtoToModelInfo(info: OpenRouterModelInfo | undefined): ModelInfo | undefined {
	if (!info) {
		return undefined
	}

	return {
		maxTokens: info.maxTokens,
		contextWindow: info.contextWindow,
		supportsImages: info.supportsImages,
		supportsPromptCache: info.supportsPromptCache,
		inputPrice: info.inputPrice,
		outputPrice: info.outputPrice,
		cacheWritesPrice: info.cacheWritesPrice,
		cacheReadsPrice: info.cacheReadsPrice,
		description: info.description,
		thinkingConfig: convertProtoToThinkingConfig(info.thinkingConfig),
		supportsGlobalEndpoint: info.supportsGlobalEndpoint,
		tiers: info.tiers.length > 0 ? info.tiers : undefined,
	}
}

// Convert application OpenAiCompatibleModelInfo to proto OpenAiCompatibleModelInfo
function convertOpenAiCompatibleModelInfoToProto(
	info: AppOpenAiCompatibleModelInfo | undefined,
): OpenAiCompatibleModelInfo | undefined {
	if (!info) {
		return undefined
	}

	return {
		maxTokens: info.maxTokens,
		contextWindow: info.contextWindow,
		supportsImages: info.supportsImages,
		supportsPromptCache: info.supportsPromptCache ?? false,
		inputPrice: info.inputPrice,
		outputPrice: info.outputPrice,
		thinkingConfig: convertThinkingConfigToProto(info.thinkingConfig),
		supportsGlobalEndpoint: info.supportsGlobalEndpoint,
		cacheWritesPrice: info.cacheWritesPrice,
		cacheReadsPrice: info.cacheReadsPrice,
		description: info.description,
		tiers: info.tiers || [],
		temperature: info.temperature,
		isR1FormatRequired: info.isR1FormatRequired,
	}
}

// Convert proto OpenAiCompatibleModelInfo to application OpenAiCompatibleModelInfo
function convertProtoToOpenAiCompatibleModelInfo(
	info: OpenAiCompatibleModelInfo | undefined,
): AppOpenAiCompatibleModelInfo | undefined {
	if (!info) {
		return undefined
	}

	return {
		maxTokens: info.maxTokens,
		contextWindow: info.contextWindow,
		supportsImages: info.supportsImages,
		supportsPromptCache: info.supportsPromptCache,
		inputPrice: info.inputPrice,
		outputPrice: info.outputPrice,
		thinkingConfig: convertProtoToThinkingConfig(info.thinkingConfig),
		supportsGlobalEndpoint: info.supportsGlobalEndpoint,
		cacheWritesPrice: info.cacheWritesPrice,
		cacheReadsPrice: info.cacheReadsPrice,
		description: info.description,
		tiers: info.tiers.length > 0 ? info.tiers : undefined,
		temperature: info.temperature,
		isR1FormatRequired: info.isR1FormatRequired,
	}
}

// Convert application ApiProvider to proto ApiProvider
//
// 注意：default 分支回落到 DEEPSEEK 是历史行为。新增 provider 必须同时在两个方向上补 case，
// 否则它会被静默存成 DeepSeek（配置看起来“没生效”，但又不报错）。
function convertApiProviderToProto(provider: string | undefined): ProtoApiProvider {
	switch (provider) {
		case "free":
			return ProtoApiProvider.FREE
		case "openai":
			return ProtoApiProvider.OPENAI
		case "deepseek":
			return ProtoApiProvider.DEEPSEEK
		case "mimo":
			return ProtoApiProvider.MIMO
		default:
			return ProtoApiProvider.DEEPSEEK
	}
}

// Convert proto ApiProvider to application ApiProvider
export function convertProtoToApiProvider(provider: ProtoApiProvider): ApiProvider {
	switch (provider) {
		case ProtoApiProvider.FREE:
			return "free"
		case ProtoApiProvider.OPENAI:
			return "openai"
		case ProtoApiProvider.DEEPSEEK:
			return "deepseek"
		case ProtoApiProvider.MIMO:
			return "mimo"
		default:
			return "deepseek"
	}
}

// Converts application ApiConfiguration to proto ApiConfiguration
export function convertApiConfigurationToProto(config: ApiConfiguration): ProtoApiConfiguration {
	return {
		// Global configuration fields
		apiKey: config.apiKey,
		ulid: config.ulid,
		// proto map 字段必填；era harness 不再持久化自定义头，恒置空对象
		openAiHeaders: {},
		openAiBaseUrl: config.openAiBaseUrl,
		openAiApiKey: config.openAiApiKey,
		deepSeekApiKey: config.deepSeekApiKey,
		mimoApiKey: config.mimoApiKey,
		ovhAiEndpointsApiKey: config.ovhAiEndpointsApiKey,
		requestTimeoutMs: config.requestTimeoutMs,

		// Plan mode configurations
		planModeApiProvider: config.planModeApiProvider ? convertApiProviderToProto(config.planModeApiProvider) : undefined,
		planModeApiModelId: config.planModeApiModelId,
		planModeReasoningEffort: config.planModeReasoningEffort,
		planModeOpenAiModelId: config.planModeOpenAiModelId,
		planModeOpenAiModelInfo: convertOpenAiCompatibleModelInfoToProto(config.planModeOpenAiModelInfo),
		planModeDeepSeekModelInfo: convertModelInfoToProtoOpenRouter(config.planModeDeepSeekModelInfo),
		planModeMimoModelInfo: convertModelInfoToProtoOpenRouter(config.planModeMimoModelInfo),

		// Act mode configurations
		actModeApiProvider: config.actModeApiProvider ? convertApiProviderToProto(config.actModeApiProvider) : undefined,
		actModeApiModelId: config.actModeApiModelId,
		actModeReasoningEffort: config.actModeReasoningEffort,
		actModeOpenAiModelId: config.actModeOpenAiModelId,
		actModeOpenAiModelInfo: convertOpenAiCompatibleModelInfoToProto(config.actModeOpenAiModelInfo),
		actModeDeepSeekModelInfo: convertModelInfoToProtoOpenRouter(config.actModeDeepSeekModelInfo),
		actModeMimoModelInfo: convertModelInfoToProtoOpenRouter(config.actModeMimoModelInfo),
	}
}

// Converts proto ApiConfiguration to application ApiConfiguration
export function convertProtoToApiConfiguration(protoConfig: ProtoApiConfiguration): ApiConfiguration {
	return {
		// Global configuration fields
		apiKey: protoConfig.apiKey,
		ulid: protoConfig.ulid,
		openAiBaseUrl: protoConfig.openAiBaseUrl,
		openAiApiKey: protoConfig.openAiApiKey,
		deepSeekApiKey: protoConfig.deepSeekApiKey,
		mimoApiKey: protoConfig.mimoApiKey,
		ovhAiEndpointsApiKey: protoConfig.ovhAiEndpointsApiKey,
		requestTimeoutMs: protoConfig.requestTimeoutMs,

		// Plan mode configurations
		planModeApiProvider:
			protoConfig.planModeApiProvider !== undefined
				? convertProtoToApiProvider(protoConfig.planModeApiProvider)
				: undefined,
		planModeApiModelId: protoConfig.planModeApiModelId,
		planModeReasoningEffort: protoConfig.planModeReasoningEffort as OpenaiReasoningEffort | undefined,
		planModeOpenAiModelId: protoConfig.planModeOpenAiModelId,
		planModeOpenAiModelInfo: convertProtoToOpenAiCompatibleModelInfo(protoConfig.planModeOpenAiModelInfo),
		planModeDeepSeekModelInfo: convertProtoToModelInfo(protoConfig.planModeDeepSeekModelInfo),
		planModeMimoModelInfo: convertProtoToModelInfo(protoConfig.planModeMimoModelInfo),

		// Act mode configurations
		actModeApiProvider:
			protoConfig.actModeApiProvider !== undefined ? convertProtoToApiProvider(protoConfig.actModeApiProvider) : undefined,
		actModeApiModelId: protoConfig.actModeApiModelId,
		actModeReasoningEffort: protoConfig.actModeReasoningEffort as OpenaiReasoningEffort | undefined,
		actModeOpenAiModelId: protoConfig.actModeOpenAiModelId,
		actModeOpenAiModelInfo: convertProtoToOpenAiCompatibleModelInfo(protoConfig.actModeOpenAiModelInfo),
		actModeDeepSeekModelInfo: convertProtoToModelInfo(protoConfig.actModeDeepSeekModelInfo),
		actModeMimoModelInfo: convertProtoToModelInfo(protoConfig.actModeMimoModelInfo),
	}
}

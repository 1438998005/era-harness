import {
	OpenAiCompatibleModelInfo,
	OpenRouterModelInfo,
	ModelsApiConfiguration as ProtoApiConfiguration,
	ApiProvider as ProtoApiProvider,
	OcaModelInfo as ProtoOcaModelInfo,
	ThinkingConfig,
} from "@shared/proto/cline/models"
import { ApiConfiguration, ApiProvider, OpenAiCompatibleModelInfo as AppOpenAiCompatibleModelInfo, ModelInfo } from "../../api"
import { OpenaiReasoningEffort } from "../../storage/types"
import { fromProtobufModelInfo, fromProtobufOcaModelInfo } from "./typeConversion"

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
		case "bigmodel":
			return ProtoApiProvider.BIGMODEL
		case "bigmodel-plan":
			return ProtoApiProvider.BIGMODEL_PLAN
		case "moonshot":
			return ProtoApiProvider.MOONSHOT
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
		case ProtoApiProvider.BIGMODEL:
			return "bigmodel"
		case ProtoApiProvider.BIGMODEL_PLAN:
			return "bigmodel-plan"
		case ProtoApiProvider.MOONSHOT:
			return "moonshot"
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
		bigmodelApiKey: config.bigmodelApiKey,
		bigmodelPlanApiKey: config.bigmodelPlanApiKey,
		moonshotApiKey: config.moonshotApiKey,
		moonshotApiLine: config.moonshotApiLine,
		// 「提示词增强 / 子代理」独立模型配置（跨厂商时的独立凭证与模型三元组）
		enhanceApiProvider: config.enhanceApiProvider ? convertApiProviderToProto(config.enhanceApiProvider) : undefined,
		enhanceApiKey: config.enhanceApiKey,
		enhanceApiModelId: config.enhanceApiModelId,
		enhanceModelInfo: convertModelInfoToProtoOpenRouter(config.enhanceModelInfo),
		enhanceReasoningEffort: config.enhanceReasoningEffort,
		enhanceMoonshotApiLine: config.enhanceMoonshotApiLine,
		subagentApiProvider: config.subagentApiProvider ? convertApiProviderToProto(config.subagentApiProvider) : undefined,
		subagentApiKey: config.subagentApiKey,
		subagentApiModelId: config.subagentApiModelId,
		subagentModelInfo: convertModelInfoToProtoOpenRouter(config.subagentModelInfo),
		subagentReasoningEffort: config.subagentReasoningEffort,
		subagentMoonshotApiLine: config.subagentMoonshotApiLine,
		ovhAiEndpointsApiKey: config.ovhAiEndpointsApiKey,
		freeExcludeCollecting: config.freeExcludeCollecting,
		freeUseOpenRouterRouter: config.freeUseOpenRouterRouter,
		pinnedModelId: config.pinnedModelId,
		// KB 08 #237：per-provider 思维强度槽（设置页各家控件写、请求侧按 apiProvider 读）
		deepSeekReasoningEffort: config.deepSeekReasoningEffort,
		mimoReasoningEffort: config.mimoReasoningEffort,
		bigmodelReasoningEffort: config.bigmodelReasoningEffort,
		bigmodelPlanReasoningEffort: config.bigmodelPlanReasoningEffort,
		moonshotReasoningEffort: config.moonshotReasoningEffort,
		requestTimeoutMs: config.requestTimeoutMs,

		// Plan mode configurations
		planModeApiProvider: config.planModeApiProvider ? convertApiProviderToProto(config.planModeApiProvider) : undefined,
		planModeApiModelId: config.planModeApiModelId,
		planModeReasoningEffort: config.planModeReasoningEffort,
		planModeOpenAiModelId: config.planModeOpenAiModelId,
		planModeOpenAiModelInfo: convertOpenAiCompatibleModelInfoToProto(config.planModeOpenAiModelInfo),
		planModeDeepSeekModelInfo: convertModelInfoToProtoOpenRouter(config.planModeDeepSeekModelInfo),
		planModeMimoModelInfo: convertModelInfoToProtoOpenRouter(config.planModeMimoModelInfo),
		planModeBigmodelModelInfo: convertModelInfoToProtoOpenRouter(config.planModeBigmodelModelInfo),
		planModeBigmodelPlanModelInfo: convertModelInfoToProtoOpenRouter(config.planModeBigmodelPlanModelInfo),
		planModeMoonshotModelInfo: convertModelInfoToProtoOpenRouter(config.planModeMoonshotModelInfo),
		planModeProviderModelIds: config.planModeProviderModelIds ?? {},

		// Act mode configurations
		actModeApiProvider: config.actModeApiProvider ? convertApiProviderToProto(config.actModeApiProvider) : undefined,
		actModeApiModelId: config.actModeApiModelId,
		actModeReasoningEffort: config.actModeReasoningEffort,
		actModeOpenAiModelId: config.actModeOpenAiModelId,
		actModeOpenAiModelInfo: convertOpenAiCompatibleModelInfoToProto(config.actModeOpenAiModelInfo),
		actModeDeepSeekModelInfo: convertModelInfoToProtoOpenRouter(config.actModeDeepSeekModelInfo),
		actModeMimoModelInfo: convertModelInfoToProtoOpenRouter(config.actModeMimoModelInfo),
		actModeBigmodelModelInfo: convertModelInfoToProtoOpenRouter(config.actModeBigmodelModelInfo),
		actModeBigmodelPlanModelInfo: convertModelInfoToProtoOpenRouter(config.actModeBigmodelPlanModelInfo),
		actModeMoonshotModelInfo: convertModelInfoToProtoOpenRouter(config.actModeMoonshotModelInfo),
		actModeProviderModelIds: config.actModeProviderModelIds ?? {},
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
		bigmodelApiKey: protoConfig.bigmodelApiKey,
		bigmodelPlanApiKey: protoConfig.bigmodelPlanApiKey,
		moonshotApiKey: protoConfig.moonshotApiKey,
		moonshotApiLine: protoConfig.moonshotApiLine,
		// 「提示词增强 / 子代理」独立模型配置（与 convertApiConfigurationToProto 一一对应）
		enhanceApiProvider:
			protoConfig.enhanceApiProvider !== undefined ? convertProtoToApiProvider(protoConfig.enhanceApiProvider) : undefined,
		enhanceApiKey: protoConfig.enhanceApiKey,
		enhanceApiModelId: protoConfig.enhanceApiModelId,
		enhanceModelInfo: convertProtoToModelInfo(protoConfig.enhanceModelInfo),
		enhanceReasoningEffort: protoConfig.enhanceReasoningEffort as OpenaiReasoningEffort | undefined,
		enhanceMoonshotApiLine: protoConfig.enhanceMoonshotApiLine,
		subagentApiProvider:
			protoConfig.subagentApiProvider !== undefined
				? convertProtoToApiProvider(protoConfig.subagentApiProvider)
				: undefined,
		subagentApiKey: protoConfig.subagentApiKey,
		subagentApiModelId: protoConfig.subagentApiModelId,
		subagentModelInfo: convertProtoToModelInfo(protoConfig.subagentModelInfo),
		subagentReasoningEffort: protoConfig.subagentReasoningEffort as OpenaiReasoningEffort | undefined,
		subagentMoonshotApiLine: protoConfig.subagentMoonshotApiLine,
		ovhAiEndpointsApiKey: protoConfig.ovhAiEndpointsApiKey,
		freeExcludeCollecting: protoConfig.freeExcludeCollecting,
		freeUseOpenRouterRouter: protoConfig.freeUseOpenRouterRouter,
		pinnedModelId: protoConfig.pinnedModelId,
		deepSeekReasoningEffort: protoConfig.deepSeekReasoningEffort,
		mimoReasoningEffort: protoConfig.mimoReasoningEffort,
		bigmodelReasoningEffort: protoConfig.bigmodelReasoningEffort,
		bigmodelPlanReasoningEffort: protoConfig.bigmodelPlanReasoningEffort,
		moonshotReasoningEffort: protoConfig.moonshotReasoningEffort,
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
		planModeBigmodelModelInfo: convertProtoToModelInfo(protoConfig.planModeBigmodelModelInfo),
		planModeBigmodelPlanModelInfo: convertProtoToModelInfo(protoConfig.planModeBigmodelPlanModelInfo),
		planModeMoonshotModelInfo: convertProtoToModelInfo(protoConfig.planModeMoonshotModelInfo),
		planModeProviderModelIds: protoConfig.planModeProviderModelIds ?? {},

		// Act mode configurations
		actModeApiProvider:
			protoConfig.actModeApiProvider !== undefined ? convertProtoToApiProvider(protoConfig.actModeApiProvider) : undefined,
		actModeApiModelId: protoConfig.actModeApiModelId,
		actModeReasoningEffort: protoConfig.actModeReasoningEffort as OpenaiReasoningEffort | undefined,
		actModeOpenAiModelId: protoConfig.actModeOpenAiModelId,
		actModeOpenAiModelInfo: convertProtoToOpenAiCompatibleModelInfo(protoConfig.actModeOpenAiModelInfo),
		actModeDeepSeekModelInfo: convertProtoToModelInfo(protoConfig.actModeDeepSeekModelInfo),
		actModeMimoModelInfo: convertProtoToModelInfo(protoConfig.actModeMimoModelInfo),
		actModeBigmodelModelInfo: convertProtoToModelInfo(protoConfig.actModeBigmodelModelInfo),
		actModeBigmodelPlanModelInfo: convertProtoToModelInfo(protoConfig.actModeBigmodelPlanModelInfo),
		actModeMoonshotModelInfo: convertProtoToModelInfo(protoConfig.actModeMoonshotModelInfo),
		actModeProviderModelIds: protoConfig.actModeProviderModelIds ?? {},
	}
}

/**
 * proto `ModelsApiConfiguration` 中全部 `*ModelInfo` 字段 → proto message 类型名 的静态映射。
 *
 * #233：通用分派原先只按 `key.includes("OpenAi")` 二分——Oca（proto message 无 `tiers`，
 * 喂进 OpenRouter 转换 `protoInfo.tiers.length` 直接 TypeError）与 Aihubmix（字段名不含
 * "OpenAi"，被误转成 OpenRouter 形状丢 `temperature`/`isR1FormatRequired`）都处理不了。
 * 期望值以 `proto/cline/models.proto` 的 `ModelsApiConfiguration` 为唯一事实源，
 * 完整性与类型一致性由 `test/update/model-info-proto-mapping.spec.ts` 从 proto 文本
 * 解析后锁定（手写字段名 → proto 文本核对，测出漂移即红）。
 */
export type ProtoModelInfoTypeName = "OpenRouterModelInfo" | "OpenAiCompatibleModelInfo" | "LiteLLMModelInfo" | "OcaModelInfo"

export const MODEL_INFO_FIELD_PROTO_TYPE = {
	// Plan mode（proto 108–144 区段）
	planModeOpenRouterModelInfo: "OpenRouterModelInfo",
	planModeOpenAiModelInfo: "OpenAiCompatibleModelInfo",
	planModeDeepSeekModelInfo: "OpenRouterModelInfo",
	planModeMimoModelInfo: "OpenRouterModelInfo",
	planModeBigmodelModelInfo: "OpenRouterModelInfo",
	planModeBigmodelPlanModelInfo: "OpenRouterModelInfo",
	planModeMoonshotModelInfo: "OpenRouterModelInfo",
	planModeLiteLlmModelInfo: "LiteLLMModelInfo",
	planModeRequestyModelInfo: "OpenRouterModelInfo",
	planModeGroqModelInfo: "OpenRouterModelInfo",
	planModeHuggingFaceModelInfo: "OpenRouterModelInfo",
	planModeHuaweiCloudMaasModelInfo: "OpenRouterModelInfo",
	planModeBasetenModelInfo: "OpenRouterModelInfo",
	planModeVercelAiGatewayModelInfo: "OpenRouterModelInfo",
	planModeOcaModelInfo: "OcaModelInfo",
	planModeAihubmixModelInfo: "OpenAiCompatibleModelInfo",
	planModeClineModelInfo: "OpenRouterModelInfo",
	// Act mode（proto 208–247 区段，与 plan 完全镜像）
	actModeOpenRouterModelInfo: "OpenRouterModelInfo",
	actModeOpenAiModelInfo: "OpenAiCompatibleModelInfo",
	actModeDeepSeekModelInfo: "OpenRouterModelInfo",
	actModeMimoModelInfo: "OpenRouterModelInfo",
	actModeBigmodelModelInfo: "OpenRouterModelInfo",
	actModeBigmodelPlanModelInfo: "OpenRouterModelInfo",
	actModeMoonshotModelInfo: "OpenRouterModelInfo",
	actModeLiteLlmModelInfo: "LiteLLMModelInfo",
	actModeRequestyModelInfo: "OpenRouterModelInfo",
	actModeGroqModelInfo: "OpenRouterModelInfo",
	actModeHuggingFaceModelInfo: "OpenRouterModelInfo",
	actModeHuaweiCloudMaasModelInfo: "OpenRouterModelInfo",
	actModeBasetenModelInfo: "OpenRouterModelInfo",
	actModeVercelAiGatewayModelInfo: "OpenRouterModelInfo",
	actModeOcaModelInfo: "OcaModelInfo",
	actModeAihubmixModelInfo: "OpenAiCompatibleModelInfo",
	actModeClineModelInfo: "OpenRouterModelInfo",
	// 全局辅助配置
	enhanceModelInfo: "OpenRouterModelInfo",
	subagentModelInfo: "OpenRouterModelInfo",
} as const satisfies Record<string, ProtoModelInfoTypeName>

/**
 * 按 proto message 类型名选转换器。LiteLLM 与 OpenAiCompatible 同构（tiers/temperature/
 * apiFormat，无 isR1FormatRequired），app 侧无独立 LiteLLM 类型，按 OpenAiCompatible
 * 形状还原不丢字段；Oca 的 proto message 没有 tiers 字段，绝不能进 OpenRouter 转换。
 */
function convertProtoModelInfoByType(protoType: ProtoModelInfoTypeName, value: object): unknown {
	switch (protoType) {
		case "OpenAiCompatibleModelInfo":
		case "LiteLLMModelInfo":
			return convertProtoToOpenAiCompatibleModelInfo(value as OpenAiCompatibleModelInfo)
		case "OcaModelInfo":
			return fromProtobufOcaModelInfo(value as ProtoOcaModelInfo)
		default:
			return fromProtobufModelInfo(value as OpenRouterModelInfo)
	}
}

/**
 * `UpdateSettingsRequest.apiConfiguration` 的 proto→应用结构转换。
 *
 * 单独成纯函数（放在轻量转换模块而不是 controller 里）有两个原因：
 * ① 这条写入路径与 `updateApiConfigurationProto` 各自手写一份，曾漏掉 4 个新增 ModelInfo 字段；
 * ② 纯函数可被行为测试直接调用——proto 里新增 ModelInfo/enum 字段而这里没转，对称性测试立刻红
 *    （`test/update/settings-conversion-symmetry.spec.ts`）。
 */
export function convertUpdateSettingsApiConfiguration(protoApiConfiguration: ProtoApiConfiguration): ApiConfiguration {
	const converted: Record<string, unknown> = {
		...protoApiConfiguration,
		planModeApiProvider: protoApiConfiguration.planModeApiProvider
			? convertProtoToApiProvider(protoApiConfiguration.planModeApiProvider)
			: undefined,
		actModeApiProvider: protoApiConfiguration.actModeApiProvider
			? convertProtoToApiProvider(protoApiConfiguration.actModeApiProvider)
			: undefined,
		planModeReasoningEffort: protoApiConfiguration.planModeReasoningEffort as OpenaiReasoningEffort | undefined,
		actModeReasoningEffort: protoApiConfiguration.actModeReasoningEffort as OpenaiReasoningEffort | undefined,
		enhanceApiProvider: protoApiConfiguration.enhanceApiProvider
			? convertProtoToApiProvider(protoApiConfiguration.enhanceApiProvider)
			: undefined,
		subagentApiProvider: protoApiConfiguration.subagentApiProvider
			? convertProtoToApiProvider(protoApiConfiguration.subagentApiProvider)
			: undefined,
	}

	// ⚠️ 按后缀通用转换，绝不手写字段名：本批曾因手写只补了 4 个 ModelInfo 而漏转，
	// 且将来新增 provider/辅助配置字段时手写清单必然再次漂移。只对 proto 里**非 undefined**
	// 的字段动手，未设置字段保持原 spread 语义（否则清空字段会失效，见 setApiConfiguration 跳过 undefined）。
	// #233：分派按 MODEL_INFO_FIELD_PROTO_TYPE 静态映射选转换器；未命中（proto 新增字段而
	// 映射表未更新）回落 OpenRouter 转换，保持「未来字段走通用判据」的既有语义。
	for (const [key, value] of Object.entries(protoApiConfiguration)) {
		if (!key.endsWith("ModelInfo") || !value || typeof value !== "object") {
			continue
		}
		const protoType = MODEL_INFO_FIELD_PROTO_TYPE[key as keyof typeof MODEL_INFO_FIELD_PROTO_TYPE]
		converted[key] = protoType
			? convertProtoModelInfoByType(protoType, value)
			: fromProtobufModelInfo(value as OpenRouterModelInfo)
	}
	return converted as unknown as ApiConfiguration
}

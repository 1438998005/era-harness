import { auxiliaryFieldsToClear } from "@shared/aux-model"
import { Empty } from "@shared/proto/cline/common"
import { UpdateApiConfigurationRequest } from "@shared/proto/cline/models"
import { convertProtoToApiProvider } from "@shared/proto-conversions/models/api-configuration-conversion"
import {
	fromProtobufModelInfo,
	fromProtobufOcaModelInfo,
	fromProtobufOpenAiCompatibleModelInfo,
} from "@shared/proto-conversions/models/typeConversion"
import { OpenaiReasoningEffort } from "@shared/storage/types"
import { buildApiHandler } from "@/core/api"
import { Logger } from "@/shared/services/Logger"
import type { Controller } from "../index"

/**
 * Updates API configuration
 * @param controller The controller instance
 * @param request The update API configuration request
 * @returns Empty response
 */
export async function updateApiConfigurationProto(
	controller: Controller,
	request: UpdateApiConfigurationRequest,
): Promise<Empty> {
	try {
		if (!request.apiConfiguration) {
			Logger.log("[APICONFIG: updateApiConfigurationProto] API configuration is required")
			throw new Error("API configuration is required")
		}

		const protoApiConfiguration = request.apiConfiguration

		const convertedApiConfigurationFromProto = {
			...protoApiConfiguration,
			// Convert proto ApiProvider enums to native string types
			planModeApiProvider:
				protoApiConfiguration.planModeApiProvider !== undefined
					? convertProtoToApiProvider(protoApiConfiguration.planModeApiProvider!)
					: undefined,
			actModeApiProvider:
				protoApiConfiguration.actModeApiProvider !== undefined
					? convertProtoToApiProvider(protoApiConfiguration.actModeApiProvider!)
					: undefined,
			// 「提示词增强 / 子代理」独立配置的 provider 同为 proto 枚举，必须一并转换
			enhanceApiProvider:
				protoApiConfiguration.enhanceApiProvider !== undefined
					? convertProtoToApiProvider(protoApiConfiguration.enhanceApiProvider)
					: undefined,
			subagentApiProvider:
				protoApiConfiguration.subagentApiProvider !== undefined
					? convertProtoToApiProvider(protoApiConfiguration.subagentApiProvider)
					: undefined,

			// Convert ModelInfo objects (empty arrays → undefined)
			// Plan Mode
			planModeOpenRouterModelInfo: protoApiConfiguration.planModeOpenRouterModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeOpenRouterModelInfo)
				: undefined,
			planModeClineModelInfo: protoApiConfiguration.planModeClineModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeClineModelInfo)
				: undefined,
			planModeOpenAiModelInfo: protoApiConfiguration.planModeOpenAiModelInfo
				? fromProtobufOpenAiCompatibleModelInfo(protoApiConfiguration.planModeOpenAiModelInfo)
				: undefined,
			planModeDeepSeekModelInfo: protoApiConfiguration.planModeDeepSeekModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeDeepSeekModelInfo)
				: undefined,
			planModeMimoModelInfo: protoApiConfiguration.planModeMimoModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeMimoModelInfo)
				: undefined,
			// #52 遗留缺口：bigmodel 一直漏转（切走再切回会丢模型元数据），随套餐入口一并补齐
			planModeBigmodelModelInfo: protoApiConfiguration.planModeBigmodelModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeBigmodelModelInfo)
				: undefined,
			planModeBigmodelPlanModelInfo: protoApiConfiguration.planModeBigmodelPlanModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeBigmodelPlanModelInfo)
				: undefined,
			planModeMoonshotModelInfo: protoApiConfiguration.planModeMoonshotModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeMoonshotModelInfo)
				: undefined,
			// #233：lite_llm 一直漏转（靠 spread 原样透传 proto 形状）；LiteLLM 与 OpenAiCompatible
			// 同构（tiers/temperature/apiFormat），按 OpenAiCompatible 形状还原不丢字段
			planModeLiteLlmModelInfo: protoApiConfiguration.planModeLiteLlmModelInfo
				? fromProtobufOpenAiCompatibleModelInfo(protoApiConfiguration.planModeLiteLlmModelInfo)
				: undefined,
			// 「提示词增强 / 子代理」独立配置的模型元数据
			enhanceModelInfo: protoApiConfiguration.enhanceModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.enhanceModelInfo)
				: undefined,
			subagentModelInfo: protoApiConfiguration.subagentModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.subagentModelInfo)
				: undefined,
			planModeHuggingFaceModelInfo: protoApiConfiguration.planModeHuggingFaceModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeHuggingFaceModelInfo)
				: undefined,
			planModeRequestyModelInfo: protoApiConfiguration.planModeRequestyModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeRequestyModelInfo)
				: undefined,
			planModeGroqModelInfo: protoApiConfiguration.planModeGroqModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeGroqModelInfo)
				: undefined,
			planModeHuaweiCloudMaasModelInfo: protoApiConfiguration.planModeHuaweiCloudMaasModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeHuaweiCloudMaasModelInfo)
				: undefined,
			planModeBasetenModelInfo: protoApiConfiguration.planModeBasetenModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeBasetenModelInfo)
				: undefined,
			planModeVercelAiGatewayModelInfo: protoApiConfiguration.planModeVercelAiGatewayModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.planModeVercelAiGatewayModelInfo)
				: undefined,
			planModeOcaModelInfo: protoApiConfiguration.planModeOcaModelInfo
				? fromProtobufOcaModelInfo(protoApiConfiguration.planModeOcaModelInfo)
				: undefined,
			planModeAihubmixModelInfo: protoApiConfiguration.planModeAihubmixModelInfo
				? fromProtobufOpenAiCompatibleModelInfo(protoApiConfiguration.planModeAihubmixModelInfo)
				: undefined,

			// Act Mode
			actModeOpenRouterModelInfo: protoApiConfiguration.actModeOpenRouterModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeOpenRouterModelInfo)
				: undefined,
			actModeClineModelInfo: protoApiConfiguration.actModeClineModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeClineModelInfo)
				: undefined,
			actModeOpenAiModelInfo: protoApiConfiguration.actModeOpenAiModelInfo
				? fromProtobufOpenAiCompatibleModelInfo(protoApiConfiguration.actModeOpenAiModelInfo)
				: undefined,
			actModeDeepSeekModelInfo: protoApiConfiguration.actModeDeepSeekModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeDeepSeekModelInfo)
				: undefined,
			actModeMimoModelInfo: protoApiConfiguration.actModeMimoModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeMimoModelInfo)
				: undefined,
			actModeBigmodelModelInfo: protoApiConfiguration.actModeBigmodelModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeBigmodelModelInfo)
				: undefined,
			actModeBigmodelPlanModelInfo: protoApiConfiguration.actModeBigmodelPlanModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeBigmodelPlanModelInfo)
				: undefined,
			actModeMoonshotModelInfo: protoApiConfiguration.actModeMoonshotModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeMoonshotModelInfo)
				: undefined,
			// #233：lite_llm 漏转，同 planModeLiteLlmModelInfo
			actModeLiteLlmModelInfo: protoApiConfiguration.actModeLiteLlmModelInfo
				? fromProtobufOpenAiCompatibleModelInfo(protoApiConfiguration.actModeLiteLlmModelInfo)
				: undefined,
			actModeRequestyModelInfo: protoApiConfiguration.actModeRequestyModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeRequestyModelInfo)
				: undefined,
			actModeGroqModelInfo: protoApiConfiguration.actModeGroqModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeGroqModelInfo)
				: undefined,
			actModeHuggingFaceModelInfo: protoApiConfiguration.actModeHuggingFaceModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeHuggingFaceModelInfo)
				: undefined,
			actModeHuaweiCloudMaasModelInfo: protoApiConfiguration.actModeHuaweiCloudMaasModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeHuaweiCloudMaasModelInfo)
				: undefined,
			actModeBasetenModelInfo: protoApiConfiguration.actModeBasetenModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeBasetenModelInfo)
				: undefined,
			actModeVercelAiGatewayModelInfo: protoApiConfiguration.actModeVercelAiGatewayModelInfo
				? fromProtobufModelInfo(protoApiConfiguration.actModeVercelAiGatewayModelInfo)
				: undefined,
			actModeOcaModelInfo: protoApiConfiguration.actModeOcaModelInfo
				? fromProtobufOcaModelInfo(protoApiConfiguration.actModeOcaModelInfo)
				: undefined,
			actModeAihubmixModelInfo: protoApiConfiguration.actModeAihubmixModelInfo
				? fromProtobufOpenAiCompatibleModelInfo(protoApiConfiguration.actModeAihubmixModelInfo)
				: undefined,
			geminiPlanModeThinkingLevel: protoApiConfiguration.geminiPlanModeThinkingLevel,
			geminiActModeThinkingLevel: protoApiConfiguration.geminiActModeThinkingLevel,
			planModeReasoningEffort: protoApiConfiguration.planModeReasoningEffort as OpenaiReasoningEffort | undefined,
			actModeReasoningEffort: protoApiConfiguration.actModeReasoningEffort as OpenaiReasoningEffort | undefined,
		}

		// Update the API configuration in storage.
		// #230：设置页的写入恒为「完整配置」（useApiConfigurationHandlers 的 {...apiConfiguration, ...updates}），
		// 因此 proto 里为空的辅助字段就是用户想清掉的字段。setApiConfiguration 会跳过 undefined，
		// 必须额外走显式删除通道，否则「跟随主模型 / 清空密钥」只是 UI 假动作，旧值永不消失。
		controller.stateManager.setApiConfiguration(convertedApiConfigurationFromProto)
		controller.stateManager.clearApiConfigurationFields(auxiliaryFieldsToClear(convertedApiConfigurationFromProto))

		// Update the task's API handler if there's an active task
		if (controller.task) {
			const currentMode = controller.stateManager.getGlobalSettingsKey("mode")
			controller.task.api = buildApiHandler(
				{ ...convertedApiConfigurationFromProto, ulid: controller.task.ulid },
				currentMode,
			)
		}

		// Post updated state to webview
		await controller.postStateToWebview()

		return Empty.create()
	} catch (error) {
		Logger.error(`Failed to update API configuration: ${error}`)
		throw error
	}
}

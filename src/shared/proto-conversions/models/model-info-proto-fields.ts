/**
 * proto `ModelsApiConfiguration` 中全部 `*ModelInfo` 字段 → proto message 类型名 的静态映射。
 *
 * #233：通用分派原先只按 `key.includes("OpenAi")` 二分——Oca（proto message 无 `tiers`，
 * 喂进 OpenRouter 转换 `protoInfo.tiers.length` 直接 TypeError）与 Aihubmix（字段名不含
 * "OpenAi"，被误转成 OpenRouter 形状丢 `temperature`/`isR1FormatRequired`）都处理不了。
 * 期望值以 `proto/cline/models.proto` 的 `ModelsApiConfiguration` 为唯一事实源，
 * 完整性与类型一致性由 `test/update/model-info-proto-mapping.spec.ts` 从 proto 文本
 * 解析后锁定（手写字段名 → proto 文本核对，测出漂移即红）。
 *
 * 拆分说明（2026-11-24，KB 08 #270）：本表原在 api-configuration-conversion.ts 内，
 * 该文件当时 20,408 字节、距 20KB 闸门只剩 72 字节，腾讯云两个 provider 的双向转换
 * 加进去必然超闸门，故把这张纯静态表抽到同级文件；原路径保留再导出，既有 import 不动。
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
	// 腾讯云（2026-11-24，KB 08 #270）：TokenHub 按量与 Coding Plan 套餐两个 provider，
	// ModelInfo 走 OpenRouter 形状（无 temperature/isR1FormatRequired 需求）
	planModeTencentTokenhubModelInfo: "OpenRouterModelInfo",
	actModeTencentTokenhubModelInfo: "OpenRouterModelInfo",
	planModeTencentCodingPlanModelInfo: "OpenRouterModelInfo",
	actModeTencentCodingPlanModelInfo: "OpenRouterModelInfo",
} as const satisfies Record<string, ProtoModelInfoTypeName>

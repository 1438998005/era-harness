import { type ModelInfo, resolveTencentCodingPlanModelId, tencentCodingPlanModels } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { TENCENT_CODING_PLAN_BASE_URL, TENCENT_CODING_PLAN_CONSOLE_URL, TENCENT_DOCS_URL } from "@shared/tencent-request"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { InlineCode } from "@/components/common/InlineCode"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { UiServiceClient } from "@/services/grpc-client"
import { ApiKeyField } from "../common/ApiKeyField"
import { ModelInfoView } from "../common/ModelInfoView"
import { ModelSelector } from "../common/ModelSelector"
import { nextProviderModelIds, normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

const BUILTIN_MODELS = tencentCodingPlanModels as Record<string, ModelInfo>

/** 未知模型名（套餐动态模型库）用的保守元数据；价格已归零（套餐不按 token 计费） */
const FALLBACK_MODEL_INFO: ModelInfo = {
	contextWindow: 131_072,
	maxTokens: 32_768,
	supportsImages: false, // 官方概述：暂不支持多模态能力
	supportsPromptCache: true,
	supportsReasoning: true,
	inputPrice: 0,
	cacheReadsPrice: 0,
	cacheWritesPrice: 0,
	outputPrice: 0,
}

function modelInfoFor(id: string): ModelInfo {
	const knownId = resolveTencentCodingPlanModelId(id)
	return (knownId && BUILTIN_MODELS[knownId]) || FALLBACK_MODEL_INFO
}

interface TencentCodingPlanProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * 腾讯云 Coding Plan（订阅套餐）配置（2026-11-24 新增，KB 08 #270）。
 *
 * 与「腾讯云 TokenHub」（按量）是**两个独立条目**：官方明确 sk-sp- 专属 Key 与按量 Key
 * （sk-）「不互通、请勿混用」，混在一个条目里会让「我花的是套餐还是余额」变得不可见。
 *
 * 与按量面板的差异：
 * 1. 端点固定 `https://api.lkeap.cloud.tencent.com/coding/v3`（OpenAI 兼容）；
 * 2. 按请求次数计费：价格一律归零，token 仍照实记录（上下文进度条要用）；
 * 3. 模型库动态更新：默认 tc-code-latest（Auto 自动匹配），清单外模型名可手填
 *    （官方概述「通过配置 Model Name，切换模型」）；套餐 FAQ 另列出 minimax-m2.5 /
 *    kimi-k2.5 / glm-5 等直连名，不在内置清单时由服务端判定可用性。
 */
export const TencentCodingPlanProvider = ({ showModelOptions, isPopup, currentMode }: TencentCodingPlanProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration, planActSeparateModelsSetting } = useExtensionState()
	const { handleFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	// 清单是静态的：套餐端点未暴露 /models（官方 FAQ 只给基址与 Key），不做在线同步；
	// 手填的清单外模型名并进下拉，保证显示不丢。
	const models = useMemo<Record<string, ModelInfo>>(() => {
		if (!selectedModelId || BUILTIN_MODELS[selectedModelId]) {
			return BUILTIN_MODELS
		}
		return { ...BUILTIN_MODELS, [selectedModelId]: modelInfoFor(selectedModelId) }
	}, [selectedModelId])

	const open = (url: string) => void UiServiceClient.openUrl({ value: url }).catch(console.error)

	// #276：套餐动态模型库允许手填官方模型名（getTencentCodingPlanModelInfo 已支持未知 id
	// 保留元数据）；下拉 onChange 与手填入口共用这一条提交路径，行为一致。
	const selectModel = (rawId: string) => {
		const modelId = rawId.trim()
		if (!modelId) {
			return
		}
		handleModeFieldsChange(
			{
				modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
				modelInfo: { plan: "planModeTencentCodingPlanModelInfo", act: "actModeTencentCodingPlanModelInfo" },
				providerModelIds: { plan: "planModeProviderModelIds", act: "actModeProviderModelIds" },
			},
			{
				modelId,
				modelInfo: models[modelId] ?? modelInfoFor(modelId),
				providerModelIds: nextProviderModelIds(
					apiConfiguration,
					"tencent-coding-plan",
					modelId,
					currentMode,
					planActSeparateModelsSetting,
				),
			},
			currentMode,
		)
	}

	return (
		<div>
			<ApiKeyField
				initialValue={apiConfiguration?.tencentCodingPlanApiKey || ""}
				onChange={(value) => handleFieldChange("tencentCodingPlanApiKey", value)}
				providerName="腾讯云 Coding Plan"
				signupUrl={TENCENT_CODING_PLAN_CONSOLE_URL}
			/>

			<p className="text-xs m-0 mt-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
				这里要填<b>Coding Plan 专属 Key</b>（sk-sp- 前缀，控制台 Coding Plan 页获取），不是按量的 sk- Key——官方明确
				<b>两类 Key 与 Base URL 均不互通、请勿混用</b>。端点固定为
				<InlineCode>{TENCENT_CODING_PLAN_BASE_URL}</InlineCode>。
			</p>

			<div className="flex flex-wrap items-center gap-2 mt-2">
				<Button onClick={() => open(TENCENT_CODING_PLAN_CONSOLE_URL)} size="sm" variant="outline-primary">
					{t("providers.tencentCodingPlan.consoleButton")}
				</Button>
				<Button onClick={() => open(TENCENT_DOCS_URL)} size="sm" variant="outline-primary">
					{t("providers.tencentCodingPlan.docsButton")}
				</Button>
			</div>

			{showModelOptions && (
				<>
					<ModelSelector
						billingHint="plan"
						label={t("settings.model")}
						models={models}
						onChange={(e: any) => selectModel(e.target.value as string)}
						selectedModelId={selectedModelId}
					/>

					{/* #276：手填清单外模型名入口（官方动态库）。普通 input + 失焦/回车提交，
					    不用 DebouncedTextField——逐键提交会打爆 proto 往返。 */}
					<label className="flex flex-col gap-1 mt-1">
						<span className="text-xs font-medium">{t("providers.tencentCodingPlan.manualLabel")}</span>
						<input
							className="w-full text-xs rounded px-2 py-1.5"
							onBlur={(e) => selectModel(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									selectModel(e.currentTarget.value)
								}
							}}
							placeholder={t("providers.tencentCodingPlan.manualPlaceholder")}
							style={{
								background: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
							}}
							type="text"
						/>
					</label>

					<div className="mt-1 text-xs text-(--vscode-descriptionForeground)">
						{t("providers.tencentCodingPlan.planHint")}
					</div>

					{selectedModelId && !resolveTencentCodingPlanModelId(selectedModelId) && (
						<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							{t("providers.tencentCodingPlan.unknownModel")}
						</p>
					)}

					<ModelInfoView isPopup={isPopup} modelInfo={selectedModelInfo} selectedModelId={selectedModelId} />

					<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
						{t("providers.tencentCodingPlan.priceNote")}
					</p>
				</>
			)}
		</div>
	)
}

import { deepSeekModels, ModelInfo } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient } from "@/services/grpc-client"
import { ApiKeyField } from "../common/ApiKeyField"
import { DebouncedTextField } from "../common/DebouncedTextField"
import { ModelInfoView } from "../common/ModelInfoView"
import { ModelSelector } from "../common/ModelSelector"
import { getModeSpecificFields, normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

const DEEPSEEK_BASE_URL = "https://api.deepseek.com"

const BUILTIN_MODELS = deepSeekModels as Record<string, ModelInfo>

/** API 返回了本地没有的模型时用的保守元数据；用户可在下方手动改上下文/输出上限 */
const FALLBACK_MODEL_INFO: ModelInfo = {
	contextWindow: 128_000,
	maxTokens: 8_000,
	supportsImages: false,
	supportsPromptCache: true,
}

/**
 * Props for the DeepSeekProvider component
 */
interface DeepSeekProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * DeepSeek 配置。模型列表以 `GET /models` 为准（DeepSeek 的模型更新频繁，
 * 硬编码清单必然过期），拉取失败或未填 Key 时才回落到内置清单。
 */
export const DeepSeekProvider = ({ showModelOptions, isPopup, currentMode }: DeepSeekProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange, handleModeFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	// Get the normalized configuration
	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)
	const { deepSeekModelInfo } = getModeSpecificFields(apiConfiguration, currentMode)

	const apiKey = apiConfiguration?.deepSeekApiKey || ""
	const [liveModelIds, setLiveModelIds] = useState<string[] | null>(null)
	const [isRefreshing, setIsRefreshing] = useState(false)

	const refreshModels = useCallback(async (key: string) => {
		if (!key) {
			setLiveModelIds(null)
			return
		}
		setIsRefreshing(true)
		try {
			const response = await ModelsServiceClient.refreshOpenAiModels({
				metadata: {},
				baseUrl: DEEPSEEK_BASE_URL,
				apiKey: key,
			} as any)
			const ids = (response?.values ?? []).filter((id): id is string => !!id)
			setLiveModelIds(ids.length > 0 ? ids : null)
		} catch {
			// 离线或 Key 无效时静默回落，不打断配置流程
			setLiveModelIds(null)
		} finally {
			setIsRefreshing(false)
		}
	}, [])

	// 输入 Key 后自动拉一次；防抖避免逐字符请求
	useEffect(() => {
		if (!apiKey) {
			setLiveModelIds(null)
			return
		}
		const timer = setTimeout(() => void refreshModels(apiKey), 800)
		return () => clearTimeout(timer)
	}, [apiKey, refreshModels])

	const models = useMemo<Record<string, ModelInfo>>(() => {
		if (!liveModelIds) {
			return BUILTIN_MODELS
		}
		const merged: Record<string, ModelInfo> = {}
		for (const id of liveModelIds) {
			merged[id] = BUILTIN_MODELS[id] ?? FALLBACK_MODEL_INFO
		}
		// 当前选中的模型必须始终在列表里，否则下拉框会显示空值
		if (selectedModelId && !merged[selectedModelId]) {
			merged[selectedModelId] = BUILTIN_MODELS[selectedModelId] ?? FALLBACK_MODEL_INFO
		}
		return merged
	}, [liveModelIds, selectedModelId])

	return (
		<div>
			<ApiKeyField
				initialValue={apiConfiguration?.deepSeekApiKey || ""}
				onChange={(value) => handleFieldChange("deepSeekApiKey", value)}
				providerName="DeepSeek"
				signupUrl="https://platform.deepseek.com/api_keys"
			/>

			{showModelOptions && (
				<>
					<ModelSelector
						label={t("settings.model")}
						models={models}
						onChange={(e: any) => {
							const modelId = e.target.value as string
							handleModeFieldsChange(
								{
									modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
									modelInfo: { plan: "planModeDeepSeekModelInfo", act: "actModeDeepSeekModelInfo" },
								},
								{ modelId, modelInfo: models[modelId] },
								currentMode,
							)
						}}
						selectedModelId={selectedModelId}
					/>

					<div className="flex items-center justify-between mt-1">
						<span className="text-xs text-(--vscode-descriptionForeground)">
							{liveModelIds
								? `已从 DeepSeek 同步 ${liveModelIds.length} 个模型`
								: apiKey
									? "同步失败，暂用内置清单"
									: "填入密钥后自动同步官方模型列表"}
						</span>
						<button
							className="text-xs underline bg-transparent border-none cursor-pointer p-0"
							disabled={!apiKey || isRefreshing}
							onClick={() => void refreshModels(apiKey)}
							style={{ color: "var(--vscode-textLink-foreground)", opacity: apiKey ? 1 : 0.5 }}
							type="button">
							{isRefreshing ? "同步中…" : "刷新模型列表"}
						</button>
					</div>

					<ModelInfoView isPopup={isPopup} modelInfo={selectedModelInfo} selectedModelId={selectedModelId} />

					{liveModelIds && selectedModelId && !BUILTIN_MODELS[selectedModelId] && (
						<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							该模型不在内置清单中，上下文与输出上限为保守默认值，请按官方文档在下方核对。
						</p>
					)}

					<div style={{ display: "flex", gap: 10, marginTop: "5px" }}>
						<DebouncedTextField
							initialValue={selectedModelInfo.contextWindow?.toString() ?? ""}
							onChange={(value) => {
								const modelInfo = deepSeekModelInfo ? { ...deepSeekModelInfo } : { ...selectedModelInfo }
								modelInfo.contextWindow = Number(value)
								handleModeFieldChange(
									{ plan: "planModeDeepSeekModelInfo", act: "actModeDeepSeekModelInfo" },
									modelInfo,
									currentMode,
								)
							}}
							style={{ flex: 1 }}>
							<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.contextWindowSize")}</span>
						</DebouncedTextField>

						<DebouncedTextField
							initialValue={selectedModelInfo.maxTokens?.toString() ?? ""}
							onChange={(value) => {
								const modelInfo = deepSeekModelInfo ? { ...deepSeekModelInfo } : { ...selectedModelInfo }
								modelInfo.maxTokens = Number(value)
								handleModeFieldChange(
									{ plan: "planModeDeepSeekModelInfo", act: "actModeDeepSeekModelInfo" },
									modelInfo,
									currentMode,
								)
							}}
							style={{ flex: 1 }}>
							<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.maxOutputTokens")}</span>
						</DebouncedTextField>
					</div>
				</>
			)}
		</div>
	)
}

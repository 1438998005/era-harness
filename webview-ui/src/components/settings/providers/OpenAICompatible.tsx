import { TooltipContent, TooltipTrigger } from "@radix-ui/react-tooltip"
import { openAiModelInfoSaneDefaults } from "@shared/api"
import { OpenAiModelsRequest } from "@shared/proto/cline/models"
import { Mode } from "@shared/storage/types"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "@/components/ui/tooltip"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient } from "@/services/grpc-client"
import { getAsVar, VSC_DESCRIPTION_FOREGROUND } from "@/utils/vscStyles"
import { ApiKeyField } from "../common/ApiKeyField"
import { DebouncedTextField } from "../common/DebouncedTextField"
import { ModelInfoView } from "../common/ModelInfoView"
import ReasoningEffortSelector from "../ReasoningEffortSelector"
import { parsePrice } from "../utils/pricingUtils"
import { getModeSpecificFields, normalizeApiConfiguration, supportsReasoningEffortForModelId } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

/**
 * Props for the OpenAICompatibleProvider component
 */
interface OpenAICompatibleProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * The OpenAI Compatible provider configuration component
 */
export const OpenAICompatibleProvider = ({ showModelOptions, isPopup, currentMode }: OpenAICompatibleProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration, remoteConfigSettings } = useExtensionState()
	const { handleFieldChange, handleModeFieldChange } = useApiConfigurationHandlers()

	const [modelConfigurationSelected, setModelConfigurationSelected] = useState(false)

	// Get the normalized configuration
	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)
	const showReasoningEffort = supportsReasoningEffortForModelId(selectedModelId, true)

	// Get mode-specific fields
	const { openAiModelInfo } = getModeSpecificFields(apiConfiguration, currentMode)

	// Debounced function to refresh OpenAI models (prevents excessive API calls while typing)
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [])

	const debouncedRefreshOpenAiModels = useCallback((baseUrl?: string, apiKey?: string) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		if (baseUrl && apiKey) {
			debounceTimerRef.current = setTimeout(() => {
				ModelsServiceClient.refreshOpenAiModels(
					OpenAiModelsRequest.create({
						baseUrl,
						apiKey,
					}),
				).catch((error) => {
					console.error("Failed to refresh OpenAI models:", error)
				})
			}, 500)
		}
	}, [])

	return (
		<div>
			<Tooltip>
				<TooltipTrigger>
					<div className="mb-2.5">
						<div className="flex items-center gap-2 mb-1">
							<span style={{ fontWeight: 500 }}>{t("commonFields.baseUrl")}</span>
							{remoteConfigSettings?.openAiBaseUrl !== undefined && (
								<i className="codicon codicon-lock text-description text-sm" />
							)}
						</div>
						<DebouncedTextField
							disabled={remoteConfigSettings?.openAiBaseUrl !== undefined}
							initialValue={apiConfiguration?.openAiBaseUrl || ""}
							onChange={(value) => {
								handleFieldChange("openAiBaseUrl", value)
								debouncedRefreshOpenAiModels(value, apiConfiguration?.openAiApiKey)
							}}
							placeholder={t("commonFields.enterBaseUrl")}
							style={{ width: "100%", marginBottom: 10 }}
							type="text"
						/>
					</div>
				</TooltipTrigger>
				<TooltipContent hidden={remoteConfigSettings?.openAiBaseUrl === undefined}>
					{t("settings.remotelyConfiguredMessage")}
				</TooltipContent>
			</Tooltip>

			<ApiKeyField
				initialValue={apiConfiguration?.openAiApiKey || ""}
				onChange={(value) => {
					handleFieldChange("openAiApiKey", value)
					debouncedRefreshOpenAiModels(apiConfiguration?.openAiBaseUrl, value)
				}}
				providerName="OpenAI Compatible"
			/>

			<DebouncedTextField
				initialValue={selectedModelId || ""}
				onChange={(value) =>
					handleModeFieldChange({ plan: "planModeOpenAiModelId", act: "actModeOpenAiModelId" }, value, currentMode)
				}
				placeholder={t("providers.openaiCompatible.enterModelId")}
				style={{ width: "100%", marginBottom: 10 }}>
				<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.modelId")}</span>
			</DebouncedTextField>

			<div
				onClick={() => setModelConfigurationSelected((val) => !val)}
				style={{
					color: getAsVar(VSC_DESCRIPTION_FOREGROUND),
					display: "flex",
					margin: "10px 0",
					cursor: "pointer",
					alignItems: "center",
				}}>
				<span
					className={`codicon ${modelConfigurationSelected ? "codicon-chevron-down" : "codicon-chevron-right"}`}
					style={{
						marginRight: "4px",
					}}
				/>
				<span
					style={{
						fontWeight: 700,
						textTransform: "uppercase",
					}}>
					{t("providers.openaiCompatible.modelConfiguration")}
				</span>
			</div>

			{modelConfigurationSelected && (
				<>
					<VSCodeCheckbox
						checked={!!openAiModelInfo?.supportsImages}
						onChange={(e: any) => {
							const isChecked = e.target.checked === true
							const modelInfo = openAiModelInfo ? openAiModelInfo : { ...openAiModelInfoSaneDefaults }
							modelInfo.supportsImages = isChecked
							handleModeFieldChange(
								{ plan: "planModeOpenAiModelInfo", act: "actModeOpenAiModelInfo" },
								modelInfo,
								currentMode,
							)
						}}>
						{t("providers.openaiCompatible.supportsImages")}
					</VSCodeCheckbox>

					<VSCodeCheckbox
						checked={!!openAiModelInfo?.isR1FormatRequired}
						onChange={(e: any) => {
							const isChecked = e.target.checked === true
							let modelInfo = openAiModelInfo ? openAiModelInfo : { ...openAiModelInfoSaneDefaults }
							modelInfo = { ...modelInfo, isR1FormatRequired: isChecked }

							handleModeFieldChange(
								{ plan: "planModeOpenAiModelInfo", act: "actModeOpenAiModelInfo" },
								modelInfo,
								currentMode,
							)
						}}>
						{t("providers.openaiCompatible.enableR1Format")}
					</VSCodeCheckbox>

					<div style={{ display: "flex", gap: 10, marginTop: "5px" }}>
						<DebouncedTextField
							initialValue={
								openAiModelInfo?.contextWindow
									? openAiModelInfo.contextWindow.toString()
									: (openAiModelInfoSaneDefaults.contextWindow?.toString() ?? "")
							}
							onChange={(value) => {
								const modelInfo = openAiModelInfo ? openAiModelInfo : { ...openAiModelInfoSaneDefaults }
								modelInfo.contextWindow = Number(value)
								handleModeFieldChange(
									{ plan: "planModeOpenAiModelInfo", act: "actModeOpenAiModelInfo" },
									modelInfo,
									currentMode,
								)
							}}
							style={{ flex: 1 }}>
							<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.contextWindowSize")}</span>
						</DebouncedTextField>

						<DebouncedTextField
							initialValue={
								openAiModelInfo?.maxTokens
									? openAiModelInfo.maxTokens.toString()
									: (openAiModelInfoSaneDefaults.maxTokens?.toString() ?? "")
							}
							onChange={(value) => {
								const modelInfo = openAiModelInfo ? openAiModelInfo : { ...openAiModelInfoSaneDefaults }
								modelInfo.maxTokens = Number(value)
								handleModeFieldChange(
									{ plan: "planModeOpenAiModelInfo", act: "actModeOpenAiModelInfo" },
									modelInfo,
									currentMode,
								)
							}}
							style={{ flex: 1 }}>
							<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.maxOutputTokens")}</span>
						</DebouncedTextField>
					</div>

					<div style={{ display: "flex", gap: 10, marginTop: "5px" }}>
						<DebouncedTextField
							initialValue={
								openAiModelInfo?.inputPrice
									? openAiModelInfo.inputPrice.toString()
									: (openAiModelInfoSaneDefaults.inputPrice?.toString() ?? "")
							}
							onChange={(value) => {
								const modelInfo = openAiModelInfo ? openAiModelInfo : { ...openAiModelInfoSaneDefaults }
								modelInfo.inputPrice = parsePrice(value, openAiModelInfoSaneDefaults.inputPrice ?? 0)
								handleModeFieldChange(
									{ plan: "planModeOpenAiModelInfo", act: "actModeOpenAiModelInfo" },
									modelInfo,
									currentMode,
								)
							}}
							style={{ flex: 1 }}>
							<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.inputPricePerMillion")}</span>
						</DebouncedTextField>

						<DebouncedTextField
							initialValue={
								openAiModelInfo?.outputPrice
									? openAiModelInfo.outputPrice.toString()
									: (openAiModelInfoSaneDefaults.outputPrice?.toString() ?? "")
							}
							onChange={(value) => {
								const modelInfo = openAiModelInfo ? openAiModelInfo : { ...openAiModelInfoSaneDefaults }
								modelInfo.outputPrice = parsePrice(value, openAiModelInfoSaneDefaults.outputPrice ?? 0)
								handleModeFieldChange(
									{ plan: "planModeOpenAiModelInfo", act: "actModeOpenAiModelInfo" },
									modelInfo,
									currentMode,
								)
							}}
							style={{ flex: 1 }}>
							<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.outputPricePerMillion")}</span>
						</DebouncedTextField>
					</div>

					<div style={{ display: "flex", gap: 10, marginTop: "5px" }}>
						<DebouncedTextField
							initialValue={
								openAiModelInfo?.temperature
									? openAiModelInfo.temperature.toString()
									: (openAiModelInfoSaneDefaults.temperature?.toString() ?? "")
							}
							onChange={(value) => {
								const modelInfo = openAiModelInfo ? openAiModelInfo : { ...openAiModelInfoSaneDefaults }
								modelInfo.temperature = parsePrice(value, openAiModelInfoSaneDefaults.temperature ?? 0)
								handleModeFieldChange(
									{ plan: "planModeOpenAiModelInfo", act: "actModeOpenAiModelInfo" },
									modelInfo,
									currentMode,
								)
							}}>
							<span style={{ fontWeight: 500 }}>{t("providers.openaiCompatible.temperature")}</span>
						</DebouncedTextField>
					</div>
				</>
			)}

			{showModelOptions && (
				<>
					{showReasoningEffort && <ReasoningEffortSelector currentMode={currentMode} />}
					<ModelInfoView isPopup={isPopup} modelInfo={selectedModelInfo} selectedModelId={selectedModelId} />
				</>
			)}
		</div>
	)
}

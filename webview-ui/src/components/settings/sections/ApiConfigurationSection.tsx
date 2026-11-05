import { UpdateSettingsRequest } from "@shared/proto/cline/state"
import { Mode } from "@shared/storage/types"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StateServiceClient } from "@/services/grpc-client"
import { TabButton } from "../../mcp/configuration/McpConfigurationView"
import ApiOptions from "../ApiOptions"
import AuxiliaryModelSettings from "../AuxiliaryModelSettings"
import Section from "../Section"
import { normalizeApiConfiguration, syncModeConfigurations } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

interface ApiConfigurationSectionProps {
	renderSectionHeader?: (tabId: string) => JSX.Element | null
	initialModelTab?: "recommended" | "free"
}

const ApiConfigurationSection = ({ renderSectionHeader, initialModelTab }: ApiConfigurationSectionProps) => {
	const { t } = useTranslation("settings")
	const { planActSeparateModelsSetting, mode, apiConfiguration } = useExtensionState()
	const [currentTab, setCurrentTab] = useState<Mode>(mode)
	const { handleFieldsChange } = useApiConfigurationHandlers()
	// 免费模型页要求「页面不滚、滚动条收进模型池表格内部」：isFree 时打通
	// 根 div → Section → ApiOptions → FreeModelProvider 的高度链（h-full / flex-1 / min-h-0），
	// 由 FreePoolTable 的 wrapper 作为唯一滚动容器；其他提供商不受影响。
	// 注意与下方 ApiOptions 的 currentMode 同源：分开模型时看 currentTab，否则看全局 mode——
	// 若只看 mode，切到另一模式的 tab 时高度链会错套到别的提供商页上。
	const displayedMode = planActSeparateModelsSetting ? currentTab : mode
	const isFree = normalizeApiConfiguration(apiConfiguration, displayedMode).selectedProvider === "free"
	return (
		<div className={isFree ? "flex h-full flex-col" : undefined}>
			{renderSectionHeader?.("api-config")}
			<Section className={isFree ? "flex-1 min-h-0" : undefined}>
				{/* Tabs container */}
				{planActSeparateModelsSetting ? (
					<div className={`rounded-md mb-5${isFree ? " flex flex-1 min-h-0 flex-col" : ""}`}>
						<div
							className={`flex gap-px mb-[10px] -mt-2 border-0 border-b border-solid border-(--vscode-panel-border)${
								isFree ? " shrink-0" : ""
							}`}>
							<TabButton
								disabled={currentTab === "plan"}
								isActive={currentTab === "plan"}
								onClick={() => setCurrentTab("plan")}
								style={{
									opacity: 1,
									cursor: "pointer",
								}}>
								{t("settings.planMode")}
							</TabButton>
							<TabButton
								disabled={currentTab === "act"}
								isActive={currentTab === "act"}
								onClick={() => setCurrentTab("act")}
								style={{
									opacity: 1,
									cursor: "pointer",
								}}>
								{t("settings.actMode")}
							</TabButton>
						</div>

						{/* Content container */}
						<div className={`-mb-3${isFree ? " flex flex-col flex-1 min-h-0" : ""}`}>
							<ApiOptions currentMode={currentTab} initialModelTab={initialModelTab} showModelOptions={true} />
						</div>
					</div>
				) : (
					<ApiOptions currentMode={mode} initialModelTab={initialModelTab} showModelOptions={true} />
				)}

				<div className={`mb-[5px]${isFree ? " shrink-0" : ""}`}>
					<VSCodeCheckbox
						checked={planActSeparateModelsSetting}
						className="mb-[5px]"
						onChange={async (e: any) => {
							const checked = e.target.checked === true
							try {
								// If unchecking the toggle, wait a bit for state to update, then sync configurations
								if (!checked) {
									await syncModeConfigurations(apiConfiguration, currentTab, handleFieldsChange)
								}
								await StateServiceClient.updateSettings(
									UpdateSettingsRequest.create({
										planActSeparateModelsSetting: checked,
									}),
								)
							} catch (error) {
								console.error("Failed to update separate models setting:", error)
							}
						}}>
						{t("settings.useDifferentModels")}
					</VSCodeCheckbox>
					<p className="text-xs mt-[5px] text-(--vscode-descriptionForeground)">
						{t("settings.useDifferentModelsDescription")}
					</p>
				</div>

				{/* 「提示词增强 / 子代理」独立模型配置（默认跟随主模型零行为变化）。
				     主模型是免费池时也必须可见——「主免费 + 辅助付费」同样是跨厂商场景；
				     免费池页有「表格内部滚动」的高度链，这里限高自身滚动、不挤压主表格。 */}
				<div className={isFree ? "shrink-0 max-h-[40vh] overflow-y-auto" : undefined}>
					<AuxiliaryModelSettings />
				</div>
			</Section>
		</div>
	)
}

export default ApiConfigurationSection

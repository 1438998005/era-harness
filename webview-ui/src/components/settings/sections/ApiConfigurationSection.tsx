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
	// KB 08 #236（2026-11-05 用户裁定）：整页滚为主、表格内滚只在表格区域生效。
	// 页面唯一主滚动容器是 SettingsView 的 TabContent(overflow-auto)；免费池页不再打通
	// h-full / flex-1 / min-h-0 高度链，否则模型池会吃满视口、把辅助模型区挤出屏幕。
	// 表格自己按 FREE_POOL_MIN_VISIBLE_ROWS 设最大高度（保底 10 行）：从表格往下滚能
	// 一路到辅助模型区、无断点，内滚条只在表格区域生效、不抢整页滚轮。
	// 注意与下方 ApiOptions 的 currentMode 同源：分开模型时看 currentTab，否则看全局 mode（#224 防回归）。
	const displayedMode = planActSeparateModelsSetting ? currentTab : mode
	const isFree = normalizeApiConfiguration(apiConfiguration, displayedMode).selectedProvider === "free"
	return (
		<div data-free-provider={isFree ? "true" : undefined}>
			{renderSectionHeader?.("api-config")}
			<Section>
				{/* Tabs container */}
				{planActSeparateModelsSetting ? (
					<div className="rounded-md mb-5">
						<div className="flex gap-px mb-[10px] -mt-2 border-0 border-b border-solid border-(--vscode-panel-border)">
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

						{/* Content container：#236 后不再参与高度链，整页滚交给外层 TabContent */}
						<div className="-mb-3">
							<ApiOptions currentMode={currentTab} initialModelTab={initialModelTab} showModelOptions={true} />
						</div>
					</div>
				) : (
					<ApiOptions currentMode={mode} initialModelTab={initialModelTab} showModelOptions={true} />
				)}

				<div className="mb-[5px]">
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
			     KB 08 #236：不再限高自身滚动，交给页面唯一主滚动容器，
			     保证从模型池往下滚能自然到达辅助区、中间没有断点。 */}
				<div>
					<AuxiliaryModelSettings />
				</div>
			</Section>
		</div>
	)
}

export default ApiConfigurationSection

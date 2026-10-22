import { apiProviderDefaultModelId, isBuiltinModelId } from "@shared/api"
import PROVIDERS from "@shared/providers/providers.json"
import { Mode } from "@shared/storage/types"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse from "fuse.js"
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import styled from "styled-components"
import { normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PLATFORM_CONFIG, PlatformType } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { DeepSeekProvider } from "./providers/DeepSeekProvider"
import { FreeModelProvider } from "./providers/FreeModelProvider"
import { MimoProvider } from "./providers/MimoProvider"
import { OpenAICompatibleProvider } from "./providers/OpenAICompatible"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

interface ApiOptionsProps {
	showModelOptions: boolean
	apiErrorMessage?: string
	modelIdErrorMessage?: string
	isPopup?: boolean
	currentMode: Mode
	initialModelTab?: "recommended" | "free"
}

// This is necessary to ensure dropdown opens downward, important for when this is used in popup
export const DROPDOWN_Z_INDEX = 10002

export const DropdownContainer = styled.div<{ zIndex?: number }>`
	position: relative;
	z-index: ${(props) => props.zIndex || DROPDOWN_Z_INDEX};

	// Force dropdowns to open downward
	& vscode-dropdown::part(listbox) {
		position: absolute !important;
		top: 100% !important;
		bottom: auto !important;
	}
`

const ApiOptions = ({
	showModelOptions,
	apiErrorMessage,
	modelIdErrorMessage,
	isPopup,
	currentMode,
	initialModelTab,
}: ApiOptionsProps) => {
	const { t } = useTranslation("settings")
	// Use full context state for immediate save payload
	const { apiConfiguration, remoteConfigSettings } = useExtensionState()

	const { selectedProvider, selectedModelId } = normalizeApiConfiguration(apiConfiguration, currentMode)

	const { handleModeFieldsChange } = useApiConfigurationHandlers()

	// Provider search state
	const [searchTerm, setSearchTerm] = useState("")
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const dropdownListRef = useRef<HTMLDivElement>(null)

	const providerOptions = useMemo(() => {
		let providers = PROVIDERS.list
		// Filter by platform
		if (PLATFORM_CONFIG.type !== PlatformType.VSCODE) {
			// Don't include VS Code LM API for non-VSCode platforms
			providers = providers.filter((option) => option.value !== "vscode-lm")
		}

		// Filter by remote config if remoteConfiguredProviders is set
		const remoteProviders: string[] = remoteConfigSettings?.remoteConfiguredProviders || []
		if (remoteProviders.length > 0) {
			providers = providers.filter((option) => remoteProviders.includes(option.value))
		}

		return providers
	}, [remoteConfigSettings])

	const currentProviderLabel = useMemo(() => {
		return providerOptions.find((option) => option.value === selectedProvider)?.label || selectedProvider
	}, [providerOptions, selectedProvider])

	// Sync search term with current provider when not searching
	useEffect(() => {
		if (!isDropdownVisible) {
			setSearchTerm(currentProviderLabel)
		}
	}, [currentProviderLabel, isDropdownVisible])

	const searchableItems = useMemo(() => {
		return providerOptions.map((option) => ({
			value: option.value,
			html: option.label,
		}))
	}, [providerOptions])

	const fuse = useMemo(() => {
		return new Fuse(searchableItems, {
			keys: ["html"],
			threshold: 0.3,
			shouldSort: true,
			isCaseSensitive: false,
			ignoreLocation: false,
			includeMatches: true,
			minMatchCharLength: 1,
		})
	}, [searchableItems])

	const providerSearchResults = useMemo(() => {
		return searchTerm && searchTerm !== currentProviderLabel ? fuse.search(searchTerm)?.map((r) => r.item) : searchableItems
	}, [searchableItems, searchTerm, fuse, currentProviderLabel])

	const handleProviderChange = (newProvider: string) => {
		// provider 与 modelId 必须**同批原子写入**：内部实现是「全量覆盖旧配置」，
		// 分两次调用（且不 await）时，后一次会用旧闭包里的 provider 把前一次覆盖回去，
		// 导致 UI 显示新 provider、后端实际仍走旧 provider。
		const fallbackModelId = apiProviderDefaultModelId(newProvider)
		const shouldResetModel = !!fallbackModelId && !isBuiltinModelId(newProvider, selectedModelId)

		void handleModeFieldsChange(
			{
				provider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
				modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
			},
			{ provider: newProvider, modelId: shouldResetModel ? fallbackModelId : selectedModelId },
			currentMode,
		)

		setIsDropdownVisible(false)
		setSelectedIndex(-1)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) {
			return
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < providerSearchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < providerSearchResults.length) {
					handleProviderChange(providerSearchResults[selectedIndex].value)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSelectedIndex(-1)
				setSearchTerm(currentProviderLabel)
				break
		}
	}

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
				setSearchTerm(currentProviderLabel)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [currentProviderLabel])

	// Reset selection when search term changes
	useEffect(() => {
		setSelectedIndex(-1)
		if (dropdownListRef.current) {
			dropdownListRef.current.scrollTop = 0
		}
	}, [])

	// Scroll selected item into view
	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	/*
	VSCodeDropdown has an open bug where dynamically rendered options don't auto select the provided value prop. You can see this for yourself by comparing  it with normal select/option elements, which work as expected.
	https://github.com/microsoft/vscode-webview-ui-toolkit/issues/433

	In our case, when the user switches between providers, we recalculate the selectedModelId depending on the provider, the default model for that provider, and a modelId that the user may have selected. Unfortunately, the VSCodeDropdown component wouldn't select this calculated value, and would default to the first "Select a model..." option instead, which makes it seem like the model was cleared out when it wasn't.

	As a workaround, we create separate instances of the dropdown for each provider, and then conditionally render the one that matches the current provider.
	*/

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: isPopup ? -10 : 0 }}>
			<style>
				{`
				.provider-item-highlight {
					background-color: var(--vscode-editor-findMatchHighlightBackground);
					color: inherit;
				}
				`}
			</style>
			<DropdownContainer className="dropdown-container">
				{remoteConfigSettings?.remoteConfiguredProviders && remoteConfigSettings.remoteConfiguredProviders.length > 0 ? (
					<Tooltip>
						<TooltipTrigger>
							<div className="flex items-center gap-2 mb-1">
								<label htmlFor="api-provider">
									<span style={{ fontWeight: 500 }}>{t("settings.apiProvider")}</span>
								</label>
								<i className="codicon codicon-lock text-description text-sm" />
							</div>
						</TooltipTrigger>
						<TooltipContent>{t("settings.providerManagedByOrg")}</TooltipContent>
					</Tooltip>
				) : (
					<label htmlFor="api-provider">
						<span style={{ fontWeight: 500 }}>{t("settings.apiProvider")}</span>
					</label>
				)}
				<ProviderDropdownWrapper ref={dropdownRef}>
					<VSCodeTextField
						data-testid="provider-selector-input"
						id="api-provider"
						onFocus={() => {
							setIsDropdownVisible(true)
							setSearchTerm("")
						}}
						onInput={(e) => {
							setSearchTerm((e.target as HTMLInputElement)?.value || "")
							setIsDropdownVisible(true)
						}}
						onKeyDown={handleKeyDown}
						placeholder={t("settings.searchSelectProvider")}
						role="combobox"
						style={{
							width: "100%",
							zIndex: DROPDOWN_Z_INDEX,
							position: "relative",
							minWidth: 130,
						}}
						value={searchTerm}>
						{searchTerm && searchTerm !== currentProviderLabel && (
							<div
								aria-label={t("settings.clearSearch")}
								className="input-icon-button codicon codicon-close"
								onClick={() => {
									setSearchTerm("")
									setIsDropdownVisible(true)
								}}
								slot="end"
								style={{
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									height: "100%",
								}}
							/>
						)}
					</VSCodeTextField>
					{isDropdownVisible && (
						<ProviderDropdownList ref={dropdownListRef} role="listbox">
							{providerSearchResults.map((item, index) => (
								<ProviderDropdownItem
									data-testid={`provider-option-${item.value}`}
									isSelected={index === selectedIndex}
									key={item.value}
									onClick={() => handleProviderChange(item.value)}
									onMouseEnter={() => setSelectedIndex(index)}
									ref={(el) => {
										itemRefs.current[index] = el
									}}
									role="option">
									<span>{item.html}</span>
								</ProviderDropdownItem>
							))}
						</ProviderDropdownList>
					)}
				</ProviderDropdownWrapper>
			</DropdownContainer>

			{apiConfiguration && selectedProvider === "free" && (
				<FreeModelProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
			)}

			{apiConfiguration && selectedProvider === "deepseek" && (
				<DeepSeekProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
			)}

			{apiConfiguration && selectedProvider === "mimo" && (
				<MimoProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
			)}

			{apiConfiguration && selectedProvider === "openai" && (
				<OpenAICompatibleProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
			)}

			{apiErrorMessage && (
				<p
					style={{
						margin: "-10px 0 4px 0",
						fontSize: 12,
						color: "var(--vscode-errorForeground)",
					}}>
					{apiErrorMessage}
				</p>
			)}
			{modelIdErrorMessage && (
				<p
					style={{
						margin: "-10px 0 4px 0",
						fontSize: 12,
						color: "var(--vscode-errorForeground)",
					}}>
					{modelIdErrorMessage}
				</p>
			)}
		</div>
	)
}

export default ApiOptions

const ProviderDropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

const ProviderDropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${DROPDOWN_Z_INDEX - 1};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

const ProviderDropdownItem = styled.div<{ isSelected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`

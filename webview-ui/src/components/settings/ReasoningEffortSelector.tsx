import type { ApiProvider } from "@shared/api"
import { PROVIDER_REASONING_EFFORT_KEY } from "@shared/aux-model"
import { isOpenaiReasoningEffort, Mode, OPENAI_REASONING_EFFORT_OPTIONS, OpenaiReasoningEffort } from "@shared/storage/types"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { getModeSpecificFields } from "./utils/providerUtils"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

interface ReasoningEffortSelectorProps {
	currentMode: Mode
	label?: string
	description?: string
	allowedEfforts?: readonly OpenaiReasoningEffort[]
	defaultEffort?: OpenaiReasoningEffort
	/** 档位显示名（不传时用首字母大写）；DeepSeek 这类官方档位名不同的 provider 用 */
	labels?: Partial<Record<OpenaiReasoningEffort, string>>
	/**
	 * KB 08 #237：传了 provider 就读写那家自己的思维强度槽（全局一档，不分 plan/act）；
	 * 不传（openai 兼容等）则沿用旧的全局 planMode/actModeReasoningEffort 两槽。
	 * 槽位映射单源在 @shared/aux-model，这里不另写一份字段名。
	 */
	provider?: ApiProvider
}

const ReasoningEffortSelector = ({
	currentMode,
	label,
	description,
	allowedEfforts = OPENAI_REASONING_EFFORT_OPTIONS,
	defaultEffort = "medium",
	labels,
	provider,
}: ReasoningEffortSelectorProps) => {
	const { t } = useTranslation("settings")
	const resolvedLabel = label ?? t("settings.reasoningEffort")
	const resolvedDescription = description ?? t("settings.reasoningEffortDescription")
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange, handleModeFieldChange } = useApiConfigurationHandlers()
	const perProviderKey = provider ? PROVIDER_REASONING_EFFORT_KEY[provider] : undefined
	const modeFields = getModeSpecificFields(apiConfiguration, currentMode)
	const storedEffort = perProviderKey ? (apiConfiguration?.[perProviderKey] as string | undefined) : modeFields.reasoningEffort
	const selectedEffort =
		isOpenaiReasoningEffort(storedEffort) && allowedEfforts.includes(storedEffort) ? storedEffort : defaultEffort

	return (
		<div style={{ marginTop: 10, marginBottom: 5 }}>
			<Label className="text-xs font-medium">{resolvedLabel}</Label>
			<Select
				onValueChange={(value) => {
					if (perProviderKey) {
						// #237：各家自己的槽只有一档，不再写全局 mode 槽，避免「最后改的那家覆盖别家」
						void handleFieldChange(perProviderKey, value)
					} else {
						void handleModeFieldChange(
							{ plan: "planModeReasoningEffort", act: "actModeReasoningEffort" },
							value,
							currentMode,
						)
					}
				}}
				value={selectedEffort}>
				<SelectTrigger className="w-full mt-1">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{allowedEfforts.map((effort) => (
						<SelectItem key={effort} value={effort}>
							{labels?.[effort] ?? effort.charAt(0).toUpperCase() + effort.slice(1)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p
				style={{
					fontSize: "12px",
					marginTop: 3,
					marginBottom: 0,
					color: "var(--vscode-descriptionForeground)",
				}}>
				{resolvedDescription}
			</p>
		</div>
	)
}

export default memo(ReasoningEffortSelector)

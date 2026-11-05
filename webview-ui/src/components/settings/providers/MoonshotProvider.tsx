import { type ModelInfo, moonshotModels, resolveMoonshotModelId } from "@shared/api"
import {
	MOONSHOT_DEFAULT_API_LINE,
	MOONSHOT_DOCS_URL,
	type MoonshotApiLine,
	moonshotBaseUrlForLine,
	moonshotConsoleUrlForLine,
} from "@shared/moonshot-request"
import { Mode } from "@shared/storage/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient, UiServiceClient } from "@/services/grpc-client"
import { ApiKeyField } from "../common/ApiKeyField"
import { ModelInfoView } from "../common/ModelInfoView"
import { ModelSelector } from "../common/ModelSelector"
import ReasoningEffortSelector from "../ReasoningEffortSelector"
import { mergeLiveModelIds, nextProviderModelIds, normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

const BUILTIN_MODELS = moonshotModels as Record<string, ModelInfo>

/** API 返回了本地没有的模型时用的保守元数据（不带价格：未知模型标错价 = 算错账） */
const FALLBACK_MODEL_INFO: ModelInfo = {
	contextWindow: 1_048_576,
	maxTokens: 131_072,
	supportsImages: true,
	supportsPromptCache: true,
	supportsReasoning: true,
}

/** 按小写命中内置清单：在线同步回来的 id 大小写可能与清单不一致。 */
function modelInfoFor(id: string): ModelInfo {
	const knownId = resolveMoonshotModelId(id)
	return (knownId && BUILTIN_MODELS[knownId]) || FALLBACK_MODEL_INFO
}

interface MoonshotProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * Kimi (Moonshot) 配置（2026-11-04 新增）。
 *
 * 双入口下拉（国内 api.moonshot.cn 默认 / 国际 api.moonshot.ai，密钥不互通）——
 * 判据单一来源在 @shared/moonshot-request，设置页显示、在线同步与请求侧共用同一份；
 * 模型清单以 `GET /v1/models` 在线同步并入内置清单（与 DeepSeek/MiMo/BigModel 同款）。
 */
export const MoonshotProvider = ({ showModelOptions, isPopup, currentMode }: MoonshotProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration, planActSeparateModelsSetting } = useExtensionState()
	const { handleFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	const apiKey = apiConfiguration?.moonshotApiKey || ""
	const apiLine = (apiConfiguration?.moonshotApiLine as MoonshotApiLine | undefined) ?? MOONSHOT_DEFAULT_API_LINE
	const [liveModelIds, setLiveModelIds] = useState<string[] | null>(null)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [syncError, setSyncError] = useState<string | null>(null)
	// #232 竞态守卫：每次发起或失效都自增一代；响应回来时只有仍是最新一代才允许写 state，
	// 防止旧 Key / 旧入口 / 慢响应覆盖新结果
	const requestIdRef = useRef(0)

	const refreshModels = useCallback(async (key: string, line: MoonshotApiLine) => {
		requestIdRef.current += 1
		const requestId = requestIdRef.current
		if (!key) {
			setLiveModelIds(null)
			setSyncError(null)
			setIsRefreshing(false)
			return
		}
		setIsRefreshing(true)
		try {
			const response = await ModelsServiceClient.refreshOpenAiModels({
				metadata: {},
				baseUrl: moonshotBaseUrlForLine(line),
				apiKey: key,
			} as any)
			if (requestId !== requestIdRef.current) {
				return // 已被更新的输入/刷新作废：旧响应不写回
			}
			const ids = (response?.values ?? []).filter((id): id is string => !!id)
			setLiveModelIds(ids.length > 0 ? ids : null)
			setSyncError(ids.length > 0 ? null : "接口返回了 0 个模型（密钥有效，但账号下没有可用模型）")
		} catch (error) {
			if (requestId !== requestIdRef.current) {
				return // 过期错误同样不覆盖新结果
			}
			// 离线或 Key 无效时不打断配置流程，但要把原因显示出来（MiMo 卡同款教训）
			setLiveModelIds(null)
			setSyncError(error instanceof Error ? error.message : String(error))
		} finally {
			if (requestId === requestIdRef.current) {
				setIsRefreshing(false)
			}
		}
	}, [])

	// 输入 Key 后自动拉一次；防抖避免逐字符请求（与 DeepSeek/MiMo 同款）
	useEffect(() => {
		if (!apiKey) {
			// #232：清空 Key 时作废在途请求，否则旧响应回来仍会写回已清空的状态
			requestIdRef.current += 1
			setLiveModelIds(null)
			setSyncError(null)
			setIsRefreshing(false)
			return
		}
		const timer = setTimeout(() => void refreshModels(apiKey, apiLine), 800)
		return () => {
			clearTimeout(timer)
			// #232：Key/入口变化即作废尚未返回的旧请求（新输入会重新发起）
			requestIdRef.current += 1
		}
	}, [apiKey, apiLine, refreshModels])

	// 内置清单打底、在线清单并入（#62）：在线结果只加不换，避免内置在售款被同步结果抹掉
	const models = useMemo<Record<string, ModelInfo>>(
		() => mergeLiveModelIds(BUILTIN_MODELS, liveModelIds ?? [], resolveMoonshotModelId, modelInfoFor, selectedModelId),
		[liveModelIds, selectedModelId],
	)

	const open = (url: string) => void UiServiceClient.openUrl({ value: url }).catch(console.error)

	return (
		<div>
			{/* 入口下拉：国内（默认）/ 国际。值落 moonshotApiLine，请求侧与控制台链接共用同一判据 */}
			<div className="flex flex-col gap-1 mb-1">
				<span className="text-xs font-medium">{t("providers.moonshot.lineLabel")}</span>
				<select
					className="w-full text-xs rounded px-2 py-1.5 cursor-pointer"
					onChange={(e) => void handleFieldChange("moonshotApiLine", e.target.value)}
					style={{
						background: "var(--vscode-dropdown-background)",
						color: "var(--vscode-dropdown-foreground)",
						border: "1px solid var(--vscode-dropdown-border)",
					}}
					value={apiLine}>
					<option value="china">{t("providers.moonshot.lineChina")}</option>
					<option value="international">{t("providers.moonshot.lineInternational")}</option>
				</select>
				<p className="text-xs m-0" style={{ color: "var(--vscode-descriptionForeground)" }}>
					{t("providers.moonshot.lineHint")}
				</p>
				<p className="text-xs m-0" style={{ color: "var(--vscode-descriptionForeground)" }}>
					当前调用入口：{moonshotBaseUrlForLine(apiLine)}
				</p>
			</div>

			<ApiKeyField
				initialValue={apiConfiguration?.moonshotApiKey || ""}
				onChange={(value) => handleFieldChange("moonshotApiKey", value)}
				providerName="Kimi (Moonshot)"
				signupUrl={moonshotConsoleUrlForLine(apiLine)}
			/>

			{/* 入口按钮：控制台链接随入口切换；文档固定国内站（内容最全） */}
			<div className="flex flex-wrap items-center gap-2 mt-2">
				<Button onClick={() => open(moonshotConsoleUrlForLine(apiLine))} size="sm" variant="outline-primary">
					{t("providers.moonshot.consoleButton")}
				</Button>
				<Button onClick={() => open(MOONSHOT_DOCS_URL)} size="sm" variant="outline-primary">
					{t("providers.moonshot.docsButton")}
				</Button>
			</div>

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
									modelInfo: { plan: "planModeMoonshotModelInfo", act: "actModeMoonshotModelInfo" },
									// #52：设置页与快速切换双写同一份 per-provider 记忆
									providerModelIds: { plan: "planModeProviderModelIds", act: "actModeProviderModelIds" },
								},
								{
									modelId,
									modelInfo: models[modelId],
									providerModelIds: nextProviderModelIds(
										apiConfiguration,
										"moonshot",
										modelId,
										currentMode,
										planActSeparateModelsSetting,
									),
								},
								currentMode,
							)
						}}
						selectedModelId={selectedModelId}
					/>

					<div className="flex items-center justify-between mt-1">
						<span className="text-xs text-(--vscode-descriptionForeground)">
							{liveModelIds
								? t("providers.moonshot.syncOk", { count: liveModelIds.length })
								: apiKey
									? t("providers.moonshot.syncFail")
									: t("providers.moonshot.syncIdle")}
						</span>
						<button
							className="text-xs underline bg-transparent border-none cursor-pointer p-0"
							disabled={!apiKey || isRefreshing}
							onClick={() => void refreshModels(apiKey, apiLine)}
							style={{ color: "var(--vscode-textLink-foreground)", opacity: apiKey ? 1 : 0.5 }}
							type="button">
							{isRefreshing ? t("providers.moonshot.refreshing") : t("providers.moonshot.refresh")}
						</button>
					</div>

					{apiKey && syncError && (
						<div className="mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							<p className="text-xs m-0">同步失败原因：{syncError}</p>
							<p className="text-xs m-0 mt-1">
								若原因里是 401，先核对密钥与入口是否同一站：platform.kimi.com
								创建的密钥只能配国内站（api.moonshot.cn），国际站密钥要切到国际入口。
							</p>
						</div>
					)}

					<ModelInfoView isPopup={isPopup} modelInfo={selectedModelInfo} selectedModelId={selectedModelId} />

					{selectedModelInfo?.supportsReasoning && (
						<ReasoningEffortSelector
							allowedEfforts={["low", "high", "xhigh"]}
							currentMode={currentMode}
							defaultEffort="xhigh"
							description={t("providers.moonshot.reasoningDescription")}
							label={t("providers.moonshot.reasoningLabel")}
							labels={{ low: "低（low）", high: "高（high）", xhigh: "最大（max，官方默认）" }}
						/>
					)}

					{liveModelIds && selectedModelId && !resolveMoonshotModelId(selectedModelId) && (
						<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							{t("providers.moonshot.unknownModel")}
						</p>
					)}

					<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
						{t("providers.moonshot.priceNote")}
					</p>
				</>
			)}
		</div>
	)
}

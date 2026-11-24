import { type ModelInfo, resolveTencentTokenhubModelId, tencentTokenhubModels } from "@shared/api"
import { Mode } from "@shared/storage/types"
import {
	TENCENT_DEFAULT_API_LINE,
	TENCENT_DOCS_URL,
	type TencentApiLine,
	tencentBaseUrlForLine,
	tencentConsoleUrlForLine,
} from "@shared/tencent-request"
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

const BUILTIN_MODELS = tencentTokenhubModels as Record<string, ModelInfo>

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
	const knownId = resolveTencentTokenhubModelId(id)
	return (knownId && BUILTIN_MODELS[knownId]) || FALLBACK_MODEL_INFO
}

interface TencentTokenhubProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * 腾讯云 TokenHub（按量）配置（2026-11-24 新增，KB 08 #270）。
 *
 * 双入口下拉（广州 tokenhub.tencentmaas.com 默认 / 新加坡 tokenhub-intl，密钥不通用、
 * 不跨地域调用）——判据单一来源在 @shared/tencent-request，设置页显示、在线同步与请求侧
 * 共用同一份；模型清单以 `GET /v1/models` 在线同步并入内置清单（与 Kimi/DeepSeek/MiMo 同款）。
 * 与 Coding Plan（sk-sp- 专属 Key）是两个独立 provider，Key 官方明示不互通。
 */
export const TencentTokenhubProvider = ({ showModelOptions, isPopup, currentMode }: TencentTokenhubProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration, planActSeparateModelsSetting } = useExtensionState()
	const { handleFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	const apiKey = apiConfiguration?.tencentTokenhubApiKey || ""
	const apiLine = (apiConfiguration?.tencentTokenhubApiLine as TencentApiLine | undefined) ?? TENCENT_DEFAULT_API_LINE
	const [liveModelIds, setLiveModelIds] = useState<string[] | null>(null)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [syncError, setSyncError] = useState<string | null>(null)
	// #232 竞态守卫：每次发起或失效都自增一代；响应回来时只有仍是最新一代才允许写 state
	const requestIdRef = useRef(0)

	const refreshModels = useCallback(async (key: string, line: TencentApiLine) => {
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
				baseUrl: tencentBaseUrlForLine(line),
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

	// 输入 Key 后自动拉一次；防抖避免逐字符请求（与 Kimi/DeepSeek/MiMo 同款）
	useEffect(() => {
		if (!apiKey) {
			requestIdRef.current += 1
			setLiveModelIds(null)
			setSyncError(null)
			setIsRefreshing(false)
			return
		}
		const timer = setTimeout(() => void refreshModels(apiKey, apiLine), 800)
		return () => {
			clearTimeout(timer)
			requestIdRef.current += 1
		}
	}, [apiKey, apiLine, refreshModels])

	// 内置清单打底、在线清单并入（#62）：在线结果只加不换，避免内置在售款被同步结果抹掉
	const models = useMemo<Record<string, ModelInfo>>(
		() => mergeLiveModelIds(BUILTIN_MODELS, liveModelIds ?? [], resolveTencentTokenhubModelId, modelInfoFor, selectedModelId),
		[liveModelIds, selectedModelId],
	)

	const open = (url: string) => void UiServiceClient.openUrl({ value: url }).catch(console.error)

	return (
		<div>
			{/* 入口下拉：广州（默认）/ 新加坡。值落 tencentTokenhubApiLine，请求侧与控制台链接共用同一判据 */}
			<div className="flex flex-col gap-1 mb-1">
				<span className="text-xs font-medium">{t("providers.tencentTokenhub.lineLabel")}</span>
				<select
					className="w-full text-xs rounded px-2 py-1.5 cursor-pointer"
					onChange={(e) => void handleFieldChange("tencentTokenhubApiLine", e.target.value)}
					style={{
						background: "var(--vscode-dropdown-background)",
						color: "var(--vscode-dropdown-foreground)",
						border: "1px solid var(--vscode-dropdown-border)",
					}}
					value={apiLine}>
					<option value="china">{t("providers.tencentTokenhub.lineChina")}</option>
					<option value="intl">{t("providers.tencentTokenhub.lineIntl")}</option>
				</select>
				<p className="text-xs m-0" style={{ color: "var(--vscode-descriptionForeground)" }}>
					{t("providers.tencentTokenhub.lineHint")}
				</p>
				<p className="text-xs m-0" style={{ color: "var(--vscode-descriptionForeground)" }}>
					当前调用入口：{tencentBaseUrlForLine(apiLine)}
				</p>
			</div>

			<ApiKeyField
				initialValue={apiConfiguration?.tencentTokenhubApiKey || ""}
				onChange={(value) => handleFieldChange("tencentTokenhubApiKey", value)}
				providerName="腾讯云 TokenHub"
				signupUrl={tencentConsoleUrlForLine(apiLine)}
			/>

			<div className="flex flex-wrap items-center gap-2 mt-2">
				<Button onClick={() => open(tencentConsoleUrlForLine(apiLine))} size="sm" variant="outline-primary">
					{t("providers.tencentTokenhub.consoleButton")}
				</Button>
				<Button onClick={() => open(TENCENT_DOCS_URL)} size="sm" variant="outline-primary">
					{t("providers.tencentTokenhub.docsButton")}
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
									modelInfo: {
										plan: "planModeTencentTokenhubModelInfo",
										act: "actModeTencentTokenhubModelInfo",
									},
									// #52：设置页与快速切换双写同一份 per-provider 记忆
									providerModelIds: { plan: "planModeProviderModelIds", act: "actModeProviderModelIds" },
								},
								{
									modelId,
									modelInfo: models[modelId],
									providerModelIds: nextProviderModelIds(
										apiConfiguration,
										"tencent-tokenhub",
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
								? t("providers.tencentTokenhub.syncOk", { count: liveModelIds.length })
								: apiKey
									? t("providers.tencentTokenhub.syncFail")
									: t("providers.tencentTokenhub.syncIdle")}
						</span>
						<button
							className="text-xs underline bg-transparent border-none cursor-pointer p-0"
							disabled={!apiKey || isRefreshing}
							onClick={() => void refreshModels(apiKey, apiLine)}
							style={{ color: "var(--vscode-textLink-foreground)", opacity: apiKey ? 1 : 0.5 }}
							type="button">
							{isRefreshing ? t("providers.tencentTokenhub.refreshing") : t("providers.tencentTokenhub.refresh")}
						</button>
					</div>

					{apiKey && syncError && (
						<div className="mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							<p className="text-xs m-0">同步失败原因：{syncError}</p>
							<p className="text-xs m-0 mt-1">
								若原因里是
								401，先核对密钥与入口是否同一站：广州站密钥只能配广州入口，新加坡站密钥要切到新加坡入口； Coding
								Plan 的 sk-sp- 专属 Key 与按量 Key 不互通，要选「腾讯云 Coding Plan」条目。
							</p>
						</div>
					)}

					<ModelInfoView isPopup={isPopup} modelInfo={selectedModelInfo} selectedModelId={selectedModelId} />

					<ReasoningEffortSelector
						allowedEfforts={["none", "low", "medium", "high"]}
						currentMode={currentMode}
						// #273：官方混元 reasoning_effort 默认 high（/1823/132252），界面默认档必须与之一致；
						// 请求侧不变——未设置档位时不发送 reasoning_effort，由官方按 high 执行
						defaultEffort="high"
						description={t("providers.tencentTokenhub.reasoningDescription")}
						label={t("providers.tencentTokenhub.reasoningLabel")}
						labels={{
							none: "关闭（thinking: disabled）",
							low: "低（low）",
							medium: "中（medium）",
							high: "高（high，官方默认）",
						}}
						provider="tencent-tokenhub"
					/>

					{liveModelIds && selectedModelId && !resolveTencentTokenhubModelId(selectedModelId) && (
						<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							{t("providers.tencentTokenhub.unknownModel")}
						</p>
					)}

					<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
						{t("providers.tencentTokenhub.priceNote")}
					</p>
				</>
			)}
		</div>
	)
}

import { ModelInfo, mimoModels } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient, UiServiceClient } from "@/services/grpc-client"
import { ApiKeyField } from "../common/ApiKeyField"
import { ModelInfoView } from "../common/ModelInfoView"
import { ModelSelector } from "../common/ModelSelector"
import ReasoningEffortSelector from "../ReasoningEffortSelector"
import { normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

// 以下地址均已核对（2026-10）：/v1 为 OpenAI 兼容基址，其余为控制台/邀请/文档入口。
const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1"
const MIMO_CONSOLE_URL = "https://platform.xiaomimimo.com/console/balance"
const MIMO_SIGNUP_URL = "https://platform.xiaomimimo.com?ref=PTA7TX"
const MIMO_DOCS_URL = "https://mimo.mi.com/docs/zh-CN/quick-start/summary/welcome"
const INVITE_CODE = "PTA7TX"

const BUILTIN_MODELS = mimoModels as Record<string, ModelInfo>

/** API 返回了本地没有的模型时用的保守元数据 */
const FALLBACK_MODEL_INFO: ModelInfo = {
	contextWindow: 128_000,
	maxTokens: 8_000,
	supportsImages: false,
	supportsPromptCache: false,
	supportsReasoning: true,
}

interface MimoProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * 小米 MiMo 配置。模型列表以 `GET /v1/models` 为准（内置清单只做种子），
 * 拉取失败或未填 Key 时回落到内置清单。
 */
export const MimoProvider = ({ showModelOptions, isPopup, currentMode }: MimoProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	const apiKey = apiConfiguration?.mimoApiKey || ""
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
				baseUrl: MIMO_BASE_URL,
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

	const open = (url: string) => void UiServiceClient.openUrl({ value: url }).catch(console.error)

	return (
		<div>
			<ApiKeyField
				initialValue={apiConfiguration?.mimoApiKey || ""}
				onChange={(value) => handleFieldChange("mimoApiKey", value)}
				providerName="Xiaomi MiMo"
				signupUrl={MIMO_SIGNUP_URL}
			/>

			{/* 入口按钮：余额 / 注册登录 / 文档 */}
			<div className="flex flex-wrap items-center gap-2 mt-2">
				<Button onClick={() => open(MIMO_CONSOLE_URL)} size="sm" variant="outline-primary">
					打开 MiMo 开放平台（余额）
				</Button>
				<Button onClick={() => open(MIMO_SIGNUP_URL)} size="sm" variant="outline-primary">
					注册 / 登录
				</Button>
				<Button onClick={() => open(MIMO_DOCS_URL)} size="sm" variant="outline-primary">
					API 文档
				</Button>
			</div>
			<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
				注册时填写邀请码 {INVITE_CODE} 可获得 10 元试用赠金。
			</p>

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
									modelInfo: { plan: "planModeMimoModelInfo", act: "actModeMimoModelInfo" },
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
								? `已从 MiMo 同步 ${liveModelIds.length} 个模型`
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

					{selectedModelInfo?.supportsReasoning && (
						<ReasoningEffortSelector
							allowedEfforts={["none", "low", "medium", "high"]}
							currentMode={currentMode}
							defaultEffort="none"
							description="MiMo 的思维强度走 OpenAI 兼容的 reasoning_effort（low/medium/high）。若端点拒绝该参数，会自动去掉并重试（30 分钟内不再发送）。"
							label="思维强度（reasoning_effort）"
							labels={{
								low: "低（low）",
								medium: "中（medium）",
								high: "高（high）",
								none: "不指定（用服务端默认）",
							}}
						/>
					)}

					{liveModelIds && selectedModelId && !BUILTIN_MODELS[selectedModelId] && (
						<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							该模型不在内置清单中，上下文与输出上限按保守默认值处理。
						</p>
					)}

					<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
						未内置官方价格，费用以 MiMo 控制台计费为准。
					</p>
				</>
			)}
		</div>
	)
}

import { bigmodelModels, type ModelInfo, resolveBigmodelModelId } from "@shared/api"
import { BIGMODEL_BASE_URL, BIGMODEL_CONSOLE_URL, BIGMODEL_DOCS_URL, bigmodelThinkingCapability } from "@shared/bigmodel-request"
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
import { mergeLiveModelIds, nextProviderModelIds, normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

const BUILTIN_MODELS = bigmodelModels as Record<string, ModelInfo>

/** API 返回了本地没有的模型时用的保守元数据（不带价格：未知模型标错价 = 算错账） */
const FALLBACK_MODEL_INFO: ModelInfo = {
	contextWindow: 1_000_000,
	maxTokens: 128_000,
	supportsImages: false,
	supportsPromptCache: true,
}

/** 按小写命中内置清单；在线同步回来的新模型用保守元数据（不显示价格） */
function modelInfoFor(id: string): ModelInfo {
	const knownId = resolveBigmodelModelId(id)
	return (knownId && BUILTIN_MODELS[knownId]) || FALLBACK_MODEL_INFO
}

interface BigmodelProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * 智谱 BigModel 配置（计划任务 C；#50 在线同步 2026-10-28）。
 * 内置清单 14 款（5.x 平价四款 / 一维阶梯三款 / 长文款 / 免费六款）作底，填 Key 后
 * `GET /api/paas/v4/models` 在线同步（官方已有该端点，2026-10-28 探测确认，需 Bearer）；
 * 拉取失败静默回落内置清单。价格与阶梯口径见尾部文案与 @shared/bigmodelPricing。
 */
export const BigmodelProvider = ({ showModelOptions, isPopup, currentMode }: BigmodelProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration, planActSeparateModelsSetting } = useExtensionState()
	const { handleFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)
	// #81：思考控件按模型能力渲染（5.3 系强制思考、5.2 可关、其余不显示）
	const thinkingCapability = bigmodelThinkingCapability(selectedModelId)

	const apiKey = apiConfiguration?.bigmodelApiKey || ""
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
				baseUrl: BIGMODEL_BASE_URL,
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

	// 输入 Key 后自动拉一次；防抖避免逐字符请求（与 DeepSeek/MiMo 同款）
	useEffect(() => {
		if (!apiKey) {
			setLiveModelIds(null)
			return
		}
		const timer = setTimeout(() => void refreshModels(apiKey), 800)
		return () => clearTimeout(timer)
	}, [apiKey, refreshModels])

	// 内置清单打底、在线清单并入（#62）：`GET /api/paas/v4/models` 不含免费六款，
	// 同步一次就把它们从下拉框里抹掉，用户以为免费额度没了。
	const models = useMemo<Record<string, ModelInfo>>(
		() => mergeLiveModelIds(BUILTIN_MODELS, liveModelIds ?? [], resolveBigmodelModelId, modelInfoFor, selectedModelId),
		[liveModelIds, selectedModelId],
	)

	const open = (url: string) => void UiServiceClient.openUrl({ value: url }).catch(console.error)

	return (
		<div>
			<ApiKeyField
				initialValue={apiConfiguration?.bigmodelApiKey || ""}
				onChange={(value) => handleFieldChange("bigmodelApiKey", value)}
				providerName="智谱 BigModel"
				signupUrl={BIGMODEL_CONSOLE_URL}
			/>

			{/* 入口按钮：控制台 / 文档 */}
			<div className="flex flex-wrap items-center gap-2 mt-2">
				<Button onClick={() => open(BIGMODEL_CONSOLE_URL)} size="sm" variant="outline-primary">
					打开控制台（API Key）
				</Button>
				<Button onClick={() => open(BIGMODEL_DOCS_URL)} size="sm" variant="outline-primary">
					API 文档
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
									modelInfo: { plan: "planModeBigmodelModelInfo", act: "actModeBigmodelModelInfo" },
									// #52：设置页与快速切换双写同一份 per-provider 记忆
									providerModelIds: { plan: "planModeProviderModelIds", act: "actModeProviderModelIds" },
								},
								{
									modelId,
									modelInfo: models[modelId],
									providerModelIds: nextProviderModelIds(
										apiConfiguration,
										"bigmodel",
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
								? `已从智谱同步 ${liveModelIds.length} 个模型`
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

					{thinkingCapability.kind !== "unsupported" && (
						<ReasoningEffortSelector
							allowedEfforts={[...thinkingCapability.efforts]}
							currentMode={currentMode}
							defaultEffort={thinkingCapability.defaultEffort}
							description={
								thinkingCapability.kind === "forced"
									? "GLM-5.3 系强制思考、无法关闭；这里调的是官方 reasoning_effort（low / high / max，默认 max）。思考内容在 reasoning_content 流式返回，输出上限 128K 为「思考 + 回答」总长。"
									: "GLM-5.2 可用 thinking.type 开关，也可用 reasoning_effort 调档（medium 等同 high、xhigh 等同 max、none 等同关闭）。思考内容在 reasoning_content 流式返回。"
							}
							label="思维强度"
							labels={
								thinkingCapability.kind === "forced"
									? {
											low: "低（low）",
											high: "高（high）",
											xhigh: "最高（max，默认）",
										}
									: {
											low: "低（low）",
											medium: "中（medium）",
											high: "高（high）",
											xhigh: "最高（max）",
											none: "关闭（thinking: disabled）",
										}
							}
						/>
					)}

					<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
						价格为官方按量计费单价（元 / 百万 tokens）：输入分缓存命中 / 未命中两档，缓存写入限时免费。 GLM-5.1 /
						GLM-5 / GLM-5-Turbo 按「输入是否超过 32K」分两档计费，这里显示高档，实际费用按每次请求的真实用量精算。
						名称带「· 免费」的模型不扣费（旧一代模型，能力弱于 5.x）。GLM Coding Plan
						订阅与按量计费额度不互通，以控制台用量页为准。
					</p>
				</>
			)}
		</div>
	)
}

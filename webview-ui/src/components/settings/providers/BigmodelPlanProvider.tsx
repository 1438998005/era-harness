import { bigmodelPlanModels, type ModelInfo, resolveBigmodelPlanModelId } from "@shared/api"
import {
	BIGMODEL_PLAN_BASE_URL,
	BIGMODEL_PLAN_DOCS_URL,
	BIGMODEL_PLAN_PERSONAL_URL,
	BIGMODEL_PLAN_TEAM_URL,
	bigmodelThinkingCapability,
} from "@shared/bigmodel-request"
import { Mode } from "@shared/storage/types"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { UiServiceClient } from "@/services/grpc-client"
import { ApiKeyField } from "../common/ApiKeyField"
import { ModelInfoView } from "../common/ModelInfoView"
import { ModelSelector } from "../common/ModelSelector"
import ReasoningEffortSelector from "../ReasoningEffortSelector"
import { nextProviderModelIds, normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

const BUILTIN_MODELS = bigmodelPlanModels as Record<string, ModelInfo>

/** 未知模型（清单外的 id）用的保守元数据，不带价格 */
const FALLBACK_MODEL_INFO: ModelInfo = {
	contextWindow: 1_000_000,
	maxTokens: 128_000,
	supportsImages: false,
	supportsPromptCache: true,
}

function modelInfoFor(id: string): ModelInfo {
	const knownId = resolveBigmodelPlanModelId(id)
	return (knownId && BUILTIN_MODELS[knownId]) || FALLBACK_MODEL_INFO
}

interface BigmodelPlanProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * 智谱 GLM 套餐（GLM Coding Plan）配置。
 *
 * 与「智谱 BigModel」（按量）是**两个独立条目**，不是同一个条目里的入口下拉：
 * 官方明确「个人套餐 / 团队套餐 / 标准 API 三种 Key 互不通用」，额度也不互通，
 * 混在一个条目里会让「我花的是套餐还是余额」变得不可见。
 *
 * 与按量面板的三点差异：
 * 1. 端点固定 `BIGMODEL_PLAN_BASE_URL`（`/api/coding/paas/v4`），不提供在线模型同步
 *    （套餐端点通常不暴露 `/models`，硬拉只会得到一堆失败提示）；
 * 2. 模型清单与按量同源，但价格全部归零（套餐不按 token 计费）；
 * 3. 文案强调「Key 不通用」与「额度以套餐页为准」。
 */
export const BigmodelPlanProvider = ({ showModelOptions, isPopup, currentMode }: BigmodelPlanProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration, planActSeparateModelsSetting } = useExtensionState()
	const { handleFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)
	const thinkingCapability = bigmodelThinkingCapability(selectedModelId)

	// 清单是静态的：没有在线同步，所以直接用内置表；仍然按大小写归一命中一次，
	// 保证「用户手填的 GLM-5.3」也能显示正确元数据。
	const models = useMemo<Record<string, ModelInfo>>(() => {
		if (!selectedModelId || BUILTIN_MODELS[selectedModelId]) {
			return BUILTIN_MODELS
		}
		return { ...BUILTIN_MODELS, [selectedModelId]: modelInfoFor(selectedModelId) }
	}, [selectedModelId])

	const open = (url: string) => void UiServiceClient.openUrl({ value: url }).catch(console.error)

	return (
		<div>
			<ApiKeyField
				initialValue={apiConfiguration?.bigmodelPlanApiKey || ""}
				onChange={(value) => handleFieldChange("bigmodelPlanApiKey", value)}
				providerName="智谱 GLM 套餐（Coding Plan）"
				signupUrl={BIGMODEL_PLAN_PERSONAL_URL}
			/>

			<p className="text-xs m-0 mt-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
				这里要填<b>套餐 Key</b>（在「个人编程套餐 / 团队编程套餐」页里新建），不是按量付费的 API Key——官方明确
				<b>个人 / 团队 / 按量三种 Key 互不通用</b>，填错会直接报鉴权失败。端点固定为
				<code className="mx-1">{BIGMODEL_PLAN_BASE_URL}</code>。
			</p>

			<div className="flex flex-wrap items-center gap-2 mt-2">
				<Button onClick={() => open(BIGMODEL_PLAN_PERSONAL_URL)} size="sm" variant="outline-primary">
					个人套餐 Key
				</Button>
				<Button onClick={() => open(BIGMODEL_PLAN_TEAM_URL)} size="sm" variant="outline-primary">
					团队套餐 Key
				</Button>
				<Button onClick={() => open(BIGMODEL_PLAN_DOCS_URL)} size="sm" variant="outline-primary">
					套餐文档
				</Button>
			</div>

			{showModelOptions && (
				<>
					<ModelSelector
						billingHint="plan"
						label={t("settings.model")}
						models={models}
						onChange={(e: any) => {
							const modelId = e.target.value as string
							handleModeFieldsChange(
								{
									modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
									modelInfo: { plan: "planModeBigmodelPlanModelInfo", act: "actModeBigmodelPlanModelInfo" },
									providerModelIds: { plan: "planModeProviderModelIds", act: "actModeProviderModelIds" },
								},
								{
									modelId,
									modelInfo: models[modelId],
									providerModelIds: nextProviderModelIds(
										apiConfiguration,
										"bigmodel-plan",
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

					<div className="mt-1 text-xs text-(--vscode-descriptionForeground)">
						列表按 GLM
						全系列出（与按量入口同一份元数据）。套餐实际覆盖哪些模型以智谱套餐页为准；不在套餐内的模型会由服务端返回错误。
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
									? { low: "低（low）", high: "高（high）", xhigh: "最高（max，默认）" }
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
						套餐按订阅额度计费，<b>不按 token 扣费</b>：这里显示的价格一律为 0，用量统计里也不会累计金额，token
						数仍照实记录（上下文进度条要用）。额度余量与有效期以智谱控制台为准。
					</p>
				</>
			)}
		</div>
	)
}

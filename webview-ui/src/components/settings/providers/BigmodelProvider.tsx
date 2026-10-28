import { bigmodelModels, type ModelInfo } from "@shared/api"
import { BIGMODEL_CONSOLE_URL, BIGMODEL_DOCS_URL } from "@shared/bigmodel-request"
import { Mode } from "@shared/storage/types"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { UiServiceClient } from "@/services/grpc-client"
import { ApiKeyField } from "../common/ApiKeyField"
import { ModelInfoView } from "../common/ModelInfoView"
import { ModelSelector } from "../common/ModelSelector"
import ReasoningEffortSelector from "../ReasoningEffortSelector"
import { normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

interface BigmodelProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * 智谱 BigModel 配置（计划任务 C）。
 * 静态内置清单 14 款（5.x 平价四款 / 一维阶梯三款 / 长文款 / 免费六款），无 /v1/models 在线同步
 * （官方文档未见该端点，列入知识库 23 待验证）；价格与阶梯口径见尾部文案与 @shared/bigmodelPricing。
 */
export const BigmodelProvider = ({ showModelOptions, isPopup, currentMode }: BigmodelProviderProps) => {
	const { t } = useTranslation("settings")
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	const models = bigmodelModels as Record<string, ModelInfo>

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
								},
								{ modelId, modelInfo: models[modelId] },
								currentMode,
							)
						}}
						selectedModelId={selectedModelId}
					/>

					<ModelInfoView isPopup={isPopup} modelInfo={selectedModelInfo} selectedModelId={selectedModelId} />

					{selectedModelInfo?.supportsReasoning && (
						<ReasoningEffortSelector
							allowedEfforts={["high", "none"]}
							currentMode={currentMode}
							defaultEffort="high"
							description="官方参数是 thinking.type（enabled / disabled），与 MiMo 同构；思考内容在 reasoning_content 流式返回。输出上限 128K 为「思考 + 回答」总长。GLM 默认态以官方文档为准。"
							label="深度思考"
							labels={{
								high: "开启（官方默认）",
								none: "关闭（thinking: disabled）",
							}}
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

import { isChatCapableModelId, ModelInfo, mimoModels, resolveMimoModelId } from "@shared/api"
import { MIMO_CONSOLE_URL, MIMO_DOCS_URL, mimoBaseUrlForKey } from "@shared/mimo-request"
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
import { mergeLiveModelIds, normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

// 基址、控制台与文档入口取自 @shared/mimo-request（与扩展侧发请求同一份，避免漂移）。
// 只有邀请链接是带推广参数的入口，官方文档里没有，因此留在本地。
const MIMO_SIGNUP_URL = "https://platform.xiaomimimo.com?ref=PTA7TX"
const INVITE_CODE = "PTA7TX"

/** 按小写命中内置清单：在线同步回来的 id 大小写可能与清单不一致（如 MiMo-V2.6-Pro）。 */
function modelInfoFor(id: string): ModelInfo {
	const knownId = resolveMimoModelId(id)
	return (knownId && BUILTIN_MODELS[knownId]) || FALLBACK_MODEL_INFO
}

const BUILTIN_MODELS = mimoModels as Record<string, ModelInfo>

/**
 * API 返回了本地没有的模型时用的元数据。
 * 取官方对 v2.6 系的公开下限（1M 上下文 / 128K 输出 / 全模态 / 有缓存命中），
 * 因为目前清单里只有这一代模型；真出现不同代的模型时仍以在线同步与手填为准。
 */
const FALLBACK_MODEL_INFO: ModelInfo = {
	contextWindow: 1_000_000,
	maxTokens: 128_000,
	supportsImages: true,
	supportsPromptCache: true,
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
	// 同步失败的原因必须留痕：以前这里 catch 后什么都不说，用户看到"暂用内置清单"
	// 根本分不清是网络问题还是密钥被拒（401），只能去翻聊天里的裸 JSON。
	const [syncError, setSyncError] = useState<string | null>(null)
	// 被过滤掉的语音模型数量（ASR/TTS 走 /audio/*，不能用于聊天）。
	// 必须显示出来：静默藏掉用户"明明在控制台看到"的模型，比列出来更让人困惑。
	const [hiddenNonChat, setHiddenNonChat] = useState(0)

	const refreshModels = useCallback(async (key: string) => {
		if (!key) {
			setLiveModelIds(null)
			setSyncError(null)
			setHiddenNonChat(0)
			return
		}
		setIsRefreshing(true)
		try {
			const response = await ModelsServiceClient.refreshOpenAiModels({
				metadata: {},
				baseUrl: mimoBaseUrlForKey(key),
				apiKey: key,
			} as any)
			const all = (response?.values ?? []).filter((id): id is string => !!id)
			// /v1/models 回的是「这把 key 能访问的全部模型」，含 ASR/TTS。语音模型进聊天必然失败，
			// 所以只把对话模型放进下拉；过滤后为空则回落内置清单（否则下拉会空掉）。
			const chatIds = all.filter(isChatCapableModelId)
			setHiddenNonChat(all.length - chatIds.length)
			setLiveModelIds(chatIds.length > 0 ? chatIds : null)
			setSyncError(all.length > 0 ? null : "接口返回了 0 个模型（密钥有效，但账号下没有可用模型）")
		} catch (error) {
			// 离线或 Key 无效时不打断配置流程，但要把原因显示出来
			setLiveModelIds(null)
			setSyncError(error instanceof Error ? error.message : String(error))
			setHiddenNonChat(0)
		} finally {
			setIsRefreshing(false)
		}
	}, [])

	// 输入 Key 后自动拉一次；防抖避免逐字符请求
	useEffect(() => {
		if (!apiKey) {
			setLiveModelIds(null)
			setSyncError(null)
			setHiddenNonChat(0)
			return
		}
		const timer = setTimeout(() => void refreshModels(apiKey), 800)
		return () => clearTimeout(timer)
	}, [apiKey, refreshModels])

	const models = useMemo<Record<string, ModelInfo>>(() => {
		if (!liveModelIds) {
			return BUILTIN_MODELS
		}
		return mergeLiveModelIds(liveModelIds, resolveMimoModelId, modelInfoFor, selectedModelId)
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
								? `已从 MiMo 同步 ${liveModelIds.length} 个对话模型${
										hiddenNonChat > 0 ? `（另有 ${hiddenNonChat} 个语音模型不在此列）` : ""
									}`
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

					{apiKey && syncError && (
						<div className="mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							<p className="text-xs m-0">同步失败原因：{syncError}</p>
							<p className="text-xs m-0 mt-1">
								若原因里是 401，说明这把密钥被 MiMo
								服务端拒绝（不是插件的问题）：确认复制完整、末尾没有多余空格；Token Plan 密钥（tp- /
								ttp-）需要已订阅套餐，否则也会 401。
							</p>
						</div>
					)}

					<ModelInfoView isPopup={isPopup} modelInfo={selectedModelInfo} selectedModelId={selectedModelId} />

					{selectedModelInfo?.supportsReasoning && (
						<ReasoningEffortSelector
							allowedEfforts={["high", "none"]}
							currentMode={currentMode}
							defaultEffort="high"
							description="官方参数是 thinking.type（enabled / disabled），只有开关没有档位；三款 v2.6 默认开启。思考开启时 temperature 与 top_p 由服务端强制 1.0 / 0.95，传了也无效。输出上限 128K 是「思考 + 回答」的总长。"
							label="深度思考"
							labels={{
								high: "开启（官方默认）",
								none: "关闭（thinking: disabled）",
							}}
						/>
					)}

					{liveModelIds && selectedModelId && !resolveMimoModelId(selectedModelId) && (
						<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-editorWarning-foreground)" }}>
							该模型不在内置清单中，上下文与输出上限按 v2.6 系的公开下限处理，可在下方按需修正。
						</p>
					)}

					<p className="text-xs m-0 mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
						价格为官方按量计费单价（元 / 百万 tokens）：输入分缓存命中 / 未命中两档，缓存写入限时免费。使用 Token Plan
						密钥（tp- / ttp-）时按套餐扣费，这里的数字只是等价 token 价值；实际扣费以 MiMo 控制台用量页为准。
					</p>
				</>
			)}
		</div>
	)
}

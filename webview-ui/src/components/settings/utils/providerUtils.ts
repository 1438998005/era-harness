import {
	ApiConfiguration,
	ApiProvider,
	deepSeekDefaultModelId,
	deepSeekModels,
	getDeepSeekModelInfo,
	getMimoModelInfo,
	ModelInfo,
	mimoDefaultModelId,
	openAiModelInfoSaneDefaults,
	resolveCatalogModelId,
	resolveMimoModelId,
} from "@shared/api"
import { FREE_POOL } from "@shared/free-pools"
import { Mode } from "@shared/storage/types"

/**
 * Interface for normalized API configuration
 */
export interface NormalizedApiConfig {
	selectedProvider: ApiProvider
	selectedModelId: string
	selectedModelInfo: ModelInfo
}

/**
 * Normalizes API configuration to ensure consistent values
 */
export function normalizeApiConfiguration(
	apiConfiguration: ApiConfiguration | undefined,
	currentMode: Mode,
): NormalizedApiConfig {
	const provider =
		(currentMode === "plan" ? apiConfiguration?.planModeApiProvider : apiConfiguration?.actModeApiProvider) || "deepseek"

	const modelId = currentMode === "plan" ? apiConfiguration?.planModeApiModelId : apiConfiguration?.actModeApiModelId

	switch (provider) {
		case "free":
			// 免费模型：路由自动选模型，无用户可选模型 id。
			// 上下文窗口必须用真实值：openAiModelInfoSaneDefaults 的 128_000 是通用占位，
			// 会让 UI 把所有免费模型都显示成 128k（实际池内为 32k~1M）。
			// 后端从 FREE_POOL[0] 开始尝试，失败才 failover，所以取首候选的窗口。
			// 局限：failover 到后续候选后这里会偏大；真实值以环境详情为准（后端按 activeCandidate 计算）。
			return {
				selectedProvider: "free",
				selectedModelId: "",
				selectedModelInfo: {
					...openAiModelInfoSaneDefaults,
					contextWindow: FREE_POOL[0]?.contextWindow ?? openAiModelInfoSaneDefaults.contextWindow,
				},
			}
		case "deepseek": {
			// 大小写归一 + 未知 id 保留：与 MiMo 分支、扩展侧 getDeepSeekModelInfo 共用同一份规则，
			// 否则会出现「设置页显示 flash、扩展实际发 pro」。
			const selectedModelId = resolveCatalogModelId(deepSeekModels, modelId, deepSeekDefaultModelId)
			const deepSeekModelInfo =
				currentMode === "plan" ? apiConfiguration?.planModeDeepSeekModelInfo : apiConfiguration?.actModeDeepSeekModelInfo
			return {
				selectedProvider: provider,
				selectedModelId,
				selectedModelInfo: getDeepSeekModelInfo(selectedModelId, deepSeekModelInfo),
			}
		}
		case "mimo": {
			// 在线同步回来的 id 大小写不保证（如 MiMo-V2.6-Pro）：先归一再取元数据，
			// 否则 selectedModelId 会掉回默认 flash，而扩展侧实际发的是 pro。
			// 未知但非空的 id 要保留（官方可能新增模型），只有空值才落默认。
			const requestedModelId = modelId?.trim()
			const resolvedModelId = requestedModelId
				? (resolveMimoModelId(requestedModelId) ?? requestedModelId)
				: mimoDefaultModelId
			const mimoModelInfo =
				currentMode === "plan" ? apiConfiguration?.planModeMimoModelInfo : apiConfiguration?.actModeMimoModelInfo
			return {
				selectedProvider: provider,
				selectedModelId: resolvedModelId,
				selectedModelInfo: getMimoModelInfo(resolvedModelId, mimoModelInfo),
			}
		}
		case "openai":
			const openAiModelId =
				currentMode === "plan" ? apiConfiguration?.planModeOpenAiModelId : apiConfiguration?.actModeOpenAiModelId
			const openAiModelInfo =
				currentMode === "plan" ? apiConfiguration?.planModeOpenAiModelInfo : apiConfiguration?.actModeOpenAiModelInfo
			return {
				selectedProvider: provider,
				selectedModelId: openAiModelId || "",
				selectedModelInfo: openAiModelInfo || openAiModelInfoSaneDefaults,
			}
		default:
			// era harness：仅 DeepSeek 与 OpenAI 兼容两种 provider，其余一律按 OpenAI 兼容处理
			return {
				selectedProvider: provider,
				selectedModelId: modelId || "",
				selectedModelInfo: openAiModelInfoSaneDefaults,
			}
	}
}

/**
 * Gets mode-specific field values from API configuration
 * @param apiConfiguration The API configuration object
 * @param mode The current mode ("plan" or "act")
 * @returns Object containing mode-specific field values for clean destructuring
 *
 * era harness: 保留完整输出键形状以兼容既有消费方；仅 DeepSeek / OpenAI 兼容相关的值有效，
 * 其余 provider 字段恒为 undefined（其对应的配置字段已随减法剥离）。
 */
export function getModeSpecificFields(apiConfiguration: ApiConfiguration | undefined, mode: Mode) {
	if (!apiConfiguration) {
		return {
			// Core fields
			apiProvider: undefined,
			apiModelId: undefined,

			// Provider-specific model IDs
			openAiModelId: undefined,

			// Model info objects
			openAiModelInfo: undefined,
			deepSeekModelInfo: undefined,
			mimoModelInfo: undefined,

			// Other mode-specific fields
			thinkingBudgetTokens: undefined,
			reasoningEffort: undefined,
		}
	}

	return {
		// Core fields
		apiProvider: mode === "plan" ? apiConfiguration.planModeApiProvider : apiConfiguration.actModeApiProvider,
		apiModelId: mode === "plan" ? apiConfiguration.planModeApiModelId : apiConfiguration.actModeApiModelId,

		// Provider-specific model IDs (era harness: 仅 OpenAI 兼容保留)
		openAiModelId: mode === "plan" ? apiConfiguration.planModeOpenAiModelId : apiConfiguration.actModeOpenAiModelId,

		// Model info objects (era harness: 仅 OpenAI 兼容 / DeepSeek 保留)
		openAiModelInfo: mode === "plan" ? apiConfiguration.planModeOpenAiModelInfo : apiConfiguration.actModeOpenAiModelInfo,
		deepSeekModelInfo:
			mode === "plan" ? apiConfiguration.planModeDeepSeekModelInfo : apiConfiguration.actModeDeepSeekModelInfo,
		mimoModelInfo: mode === "plan" ? apiConfiguration.planModeMimoModelInfo : apiConfiguration.actModeMimoModelInfo,

		// Other mode-specific fields (thinking budget 随非目标 provider 已剥离)
		thinkingBudgetTokens: undefined,
		reasoningEffort: mode === "plan" ? apiConfiguration.planModeReasoningEffort : apiConfiguration.actModeReasoningEffort,
	}
}

/**
 * Synchronizes mode configurations by copying the source mode's settings to both modes
 * This is used when the "Use different models for Plan and Act modes" toggle is unchecked
 */
export async function syncModeConfigurations(
	apiConfiguration: ApiConfiguration | undefined,
	sourceMode: Mode,
	handleFieldsChange: (updates: Partial<ApiConfiguration>) => Promise<void>,
): Promise<void> {
	if (!apiConfiguration) {
		return
	}

	const sourceFields = getModeSpecificFields(apiConfiguration, sourceMode)
	const { apiProvider } = sourceFields

	if (!apiProvider) {
		return
	}

	// Build the complete update object with both plan and act mode fields
	const updates: Partial<ApiConfiguration> = {
		// Always sync common fields
		planModeApiProvider: sourceFields.apiProvider,
		actModeApiProvider: sourceFields.apiProvider,
		planModeReasoningEffort: sourceFields.reasoningEffort,
		actModeReasoningEffort: sourceFields.reasoningEffort,
	}

	// Handle provider-specific fields
	switch (apiProvider) {
		case "openai":
			updates.planModeOpenAiModelId = sourceFields.openAiModelId
			updates.actModeOpenAiModelId = sourceFields.openAiModelId
			updates.planModeOpenAiModelInfo = sourceFields.openAiModelInfo
			updates.actModeOpenAiModelInfo = sourceFields.openAiModelInfo
			break

		case "mimo":
			updates.planModeApiModelId = sourceFields.apiModelId
			updates.actModeApiModelId = sourceFields.apiModelId
			updates.planModeMimoModelInfo = sourceFields.mimoModelInfo
			updates.actModeMimoModelInfo = sourceFields.mimoModelInfo
			break

		default:
			updates.planModeApiModelId = sourceFields.apiModelId
			updates.actModeApiModelId = sourceFields.apiModelId
			break
	}

	// Make the atomic update
	await handleFieldsChange(updates)
}

/**
 * 把在线同步回来的模型 id（`GET /models`）合并成下拉清单。
 *
 * 键**必须**用规范 id：`DeepSeek-V4-Pro` 与内置清单里的 `deepseek-v4-pro` 是同一个模型，
 * 用原始 id 当键会让 `ModelSelector` 出现两行同一模型（它不做去重）。
 *
 * 抽成纯函数而不是在 DeepSeek / MiMo 两个组件里各写一遍：这正是本项目已复发多次的
 * 「同一规则写两遍必然有一遍漂移」。
 *
 * @param canonicalize 归一函数（`resolveDeepSeekModelId` / `resolveMimoModelId`）；
 *                     返回 undefined 表示清单里没有这个 id，原样保留（官方可能新增模型）
 * @param infoFor      按 id 取元数据
 * @param selectedModelId 当前选中的模型，必须始终在列表里，否则下拉框会显示空值
 */
export function mergeLiveModelIds(
	liveModelIds: string[],
	canonicalize: (id: string) => string | undefined,
	infoFor: (id: string) => ModelInfo,
	selectedModelId?: string,
): Record<string, ModelInfo> {
	const merged: Record<string, ModelInfo> = {}
	for (const id of liveModelIds) {
		const key = canonicalize(id) ?? id
		merged[key] = infoFor(key)
	}
	if (selectedModelId && !merged[selectedModelId]) {
		merged[selectedModelId] = infoFor(selectedModelId)
	}
	return merged
}

export { filterOpenRouterModelIds } from "@shared/utils/model-filters"

import {
	ApiConfiguration,
	ApiProvider,
	bigmodelDefaultModelId,
	bigmodelPlanDefaultModelId,
	deepSeekDefaultModelId,
	deepSeekModels,
	getBigmodelModelInfo,
	getBigmodelPlanModelInfo,
	getDeepSeekModelInfo,
	getMimoModelInfo,
	getMoonshotModelInfo,
	ModelInfo,
	mimoDefaultModelId,
	modelIdToWriteOnProviderSwitch,
	moonshotDefaultModelId,
	openAiModelInfoSaneDefaults,
	resolveBigmodelModelId,
	resolveBigmodelPlanModelId,
	resolveCatalogModelId,
	resolveMimoModelId,
	resolveMoonshotModelId,
} from "@shared/api"
import { FREE_POOL, OPENROUTER_FREE_ROUTER_CONTEXT_WINDOW } from "@shared/free-pools"
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

	const rawModelId = currentMode === "plan" ? apiConfiguration?.planModeApiModelId : apiConfiguration?.actModeApiModelId
	// 显示必须等于实际发送：历史遗留的「provider=deepseek + modelId=mimo-v2.6-pro」
	// 在 buildApiHandler 里会被同一函数纠正成默认档（否则请求必然 4xx）。
	// 这里先纠正，避免出现「界面显示小米模型、实际发 DeepSeek 默认档」这种更难查的错位。
	const modelId = modelIdToWriteOnProviderSwitch(provider, rawModelId) ?? rawModelId

	switch (provider) {
		case "free": {
			// 2026-11-08：第三路由模式优先于 pinned，窗口按虚拟路由器标称值（与 free.ts getModel 同口径）。
			if (apiConfiguration?.freeUseOpenRouterRouter === true) {
				return {
					selectedProvider: "free",
					selectedModelId: "",
					selectedModelInfo: {
						...openAiModelInfoSaneDefaults,
						contextWindow: OPENROUTER_FREE_ROUTER_CONTEXT_WINDOW,
					},
				}
			}
			// 免费模型：路由自动选模型，无用户可选模型 id。
			// 上下文窗口必须用真实值：openAiModelInfoSaneDefaults 的 128_000 是通用占位，
			// 会让 UI 把所有免费模型都显示成 128k（实际池内为 32k~1M）。
			// 自动路由下后端从 FREE_POOL[0] 开始尝试，失败才 failover，所以取首候选的窗口。
			// KB 08 #241 重排后池首是 Beam 1.0，#255 移除已下线的 Beam 后池首为 Qwen3.8 27B（窗口随之变化）；
			// 这里从池定义派生，池首换了自动联动，
			// ⛔ 不要把旧池首的窗口字面量写死回来。局限：failover 到后续候选后这里会偏大；
			// 真实值以环境详情为准（后端按 activeCandidate 计算）。
			// KB 08 #242：指定模型时取该候选的窗口（与 free.ts getModel() 同口径）；
			// 存的是真实上游 ID，⛔ 不能用 displayName/下标查找，#241 重排后仍指向同一模型。
			const pinnedId = apiConfiguration?.pinnedModelId?.trim()
			const windowCandidate = pinnedId ? FREE_POOL.find((c) => c.id === pinnedId) : undefined
			return {
				selectedProvider: "free",
				selectedModelId: "",
				selectedModelInfo: {
					...openAiModelInfoSaneDefaults,
					contextWindow: (windowCandidate ?? FREE_POOL[0])?.contextWindow ?? openAiModelInfoSaneDefaults.contextWindow,
				},
			}
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
		case "bigmodel": {
			// 与 MiMo 分支同构：小写归一 + 未知 id 保留，元数据走 getBigmodelModelInfo
			const requestedModelId = modelId?.trim()
			const resolvedModelId = requestedModelId
				? (resolveBigmodelModelId(requestedModelId) ?? requestedModelId)
				: bigmodelDefaultModelId
			const bigmodelModelInfo =
				currentMode === "plan" ? apiConfiguration?.planModeBigmodelModelInfo : apiConfiguration?.actModeBigmodelModelInfo
			return {
				selectedProvider: provider,
				selectedModelId: resolvedModelId,
				selectedModelInfo: getBigmodelModelInfo(resolvedModelId, bigmodelModelInfo),
			}
		}
		case "bigmodel-plan": {
			// 与 bigmodel 同构（共用一套 id 归一表），差别只在元数据来自套餐清单（价格全 0）
			const requestedModelId = modelId?.trim()
			const resolvedModelId = requestedModelId
				? (resolveBigmodelPlanModelId(requestedModelId) ?? requestedModelId)
				: bigmodelPlanDefaultModelId
			const planModelInfo =
				currentMode === "plan"
					? apiConfiguration?.planModeBigmodelPlanModelInfo
					: apiConfiguration?.actModeBigmodelPlanModelInfo
			return {
				selectedProvider: provider,
				selectedModelId: resolvedModelId,
				selectedModelInfo: getBigmodelPlanModelInfo(resolvedModelId, planModelInfo),
			}
		}
		case "moonshot": {
			// 与 MiMo/bigmodel 分支同构：小写归一 + 未知 id 保留，元数据走 getMoonshotModelInfo
			const requestedModelId = modelId?.trim()
			const resolvedModelId = requestedModelId
				? (resolveMoonshotModelId(requestedModelId) ?? requestedModelId)
				: moonshotDefaultModelId
			const moonshotModelInfo =
				currentMode === "plan" ? apiConfiguration?.planModeMoonshotModelInfo : apiConfiguration?.actModeMoonshotModelInfo
			return {
				selectedProvider: provider,
				selectedModelId: resolvedModelId,
				selectedModelInfo: getMoonshotModelInfo(resolvedModelId, moonshotModelInfo),
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
			bigmodelModelInfo: undefined,
			bigmodelPlanModelInfo: undefined,
			moonshotModelInfo: undefined,

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
		bigmodelModelInfo:
			mode === "plan" ? apiConfiguration.planModeBigmodelModelInfo : apiConfiguration.actModeBigmodelModelInfo,
		bigmodelPlanModelInfo:
			mode === "plan" ? apiConfiguration.planModeBigmodelPlanModelInfo : apiConfiguration.actModeBigmodelPlanModelInfo,
		moonshotModelInfo:
			mode === "plan" ? apiConfiguration.planModeMoonshotModelInfo : apiConfiguration.actModeMoonshotModelInfo,

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

		case "bigmodel":
			updates.planModeApiModelId = sourceFields.apiModelId
			updates.actModeApiModelId = sourceFields.apiModelId
			updates.planModeBigmodelModelInfo = sourceFields.bigmodelModelInfo
			updates.actModeBigmodelModelInfo = sourceFields.bigmodelModelInfo
			break

		case "bigmodel-plan":
			updates.planModeApiModelId = sourceFields.apiModelId
			updates.actModeApiModelId = sourceFields.apiModelId
			updates.planModeBigmodelPlanModelInfo = sourceFields.bigmodelPlanModelInfo
			updates.actModeBigmodelPlanModelInfo = sourceFields.bigmodelPlanModelInfo
			break

		case "moonshot":
			updates.planModeApiModelId = sourceFields.apiModelId
			updates.actModeApiModelId = sourceFields.apiModelId
			updates.planModeMoonshotModelInfo = sourceFields.moonshotModelInfo
			updates.actModeMoonshotModelInfo = sourceFields.moonshotModelInfo
			break

		default:
			updates.planModeApiModelId = sourceFields.apiModelId
			updates.actModeApiModelId = sourceFields.apiModelId
			break
	}

	// #52：模型记忆随模式同步一起对齐（联动后两张 map 保持一致，避免切回时两侧恢复出不同的模型）
	const sourceMap = sourceMode === "plan" ? apiConfiguration.planModeProviderModelIds : apiConfiguration.actModeProviderModelIds
	if (sourceMap) {
		updates.planModeProviderModelIds = { ...sourceMap }
		updates.actModeProviderModelIds = { ...sourceMap }
	}

	// Make the atomic update
	await handleFieldsChange(updates)
}

/**
 * 把在线同步回来的模型 id（`GET /models`）并进内置清单。
 *
 * 两条规则，都是踩过坑才写下来的：
 *
 * 1. **内置清单是底座，在线清单只加不换**（#62）。`GET /models` 只回 id，而且不保证把
 *    全部可用模型都列出来——智谱的免费六款在端点里根本不存在，BigModel 填了 Key 同步一次，
 *    免费款就从下拉框里整个消失，用户以为免费额度没了。反过来「在线清单为空就回落内置」
 *    也救不了：只要同步成功过一次，就再也回不去。
 * 2. **键必须用规范 id**。`DeepSeek-V4-Pro` 与内置清单里的 `deepseek-v4-pro` 是同一个模型，
 *    用原始 id 当键会让 `ModelSelector` 出现两行同一模型（它不做去重）。
 *
 * 抽成纯函数而不是在 DeepSeek / MiMo / BigModel 三个组件里各写一遍：这正是本项目已复发多次的
 * 「同一规则写三遍必然有两遍漂移」。
 *
 * @param builtins     内置清单（同时决定下拉框的排列顺序：按档位排好的，比接口返回顺序有意义）
 * @param liveModelIds 在线同步回来的 id
 * @param canonicalize 归一函数（`resolveDeepSeekModelId` / `resolveMimoModelId` / `resolveBigmodelModelId`）；
 *                     返回 undefined 表示清单里没有这个 id，原样保留（官方可能新增模型）
 * @param infoFor      按 id 取元数据
 * @param selectedModelId 当前选中的模型，必须始终在列表里，否则下拉框会显示空值
 */
export function mergeLiveModelIds(
	builtins: Record<string, ModelInfo>,
	liveModelIds: readonly string[],
	canonicalize: (id: string) => string | undefined,
	infoFor: (id: string) => ModelInfo,
	selectedModelId?: string,
): Record<string, ModelInfo> {
	const merged: Record<string, ModelInfo> = { ...builtins }
	for (const id of liveModelIds) {
		const key = canonicalize(id) ?? id
		// 已在内置清单里的不覆盖：接口只给 id，内置清单里的价格/上下文才是准的
		if (!merged[key]) {
			merged[key] = infoFor(key)
		}
	}
	if (selectedModelId && !merged[selectedModelId]) {
		merged[selectedModelId] = infoFor(selectedModelId)
	}
	return merged
}

/**
 * 下拉选项的计费上下文（#90）。
 *
 * 默认 `price` = 按量计费，按价格派生后缀；`plan` = 套餐内，价格字段恒为 0 但**不代表免费**，
 * 尾缀改写成「套餐内」。两者共用同一函数而不是在套餐页另写一份，避免「同一规则写两遍必然漂移」。
 */
export type ModelOptionBillingHint = "price" | "plan"

/**
 * 下拉选项文案：免费款尾缀「· 免费」（#55，2026-10-28 用户建议「扫描定价，全 0 就打免费标记」）。
 *
 * 目录里 `name` 虽带「免费」，但下拉渲染的是模型 id，name 进不来——所以按**定价派生**：
 * 至少两档价已知且全部为 0 即视为免费。静态目录与 #50 在线同步回来的 id 走同一份判断，
 * 不依赖 name 字符串；DeepSeek 这类「输入 0 但缓存价非 0」的模型不会被误标。
 *
 * #90：套餐页的模型价格全是 0（用量页依赖这个 0，不能改数据），但套餐**本身是付费套餐**，
 * 标成「免费」就是错的。所以计费上下文由调用方显式传入（`billingHint="plan"`），
 * 只改文案不改价格派生规则。
 */
export function modelOptionLabel(
	models: Record<string, ModelInfo>,
	modelId: string,
	billingHint: ModelOptionBillingHint = "price",
): string {
	const info = models[modelId]
	if (!info) {
		return modelId
	}
	if (billingHint === "plan") {
		return `${modelId} · 套餐内`
	}
	const knownPrices = [info.inputPrice, info.outputPrice, info.cacheReadsPrice, info.cacheWritesPrice].filter(
		(price) => price !== undefined,
	)
	const isFree = knownPrices.length >= 2 && knownPrices.every((price) => price === 0)
	return isFree ? `${modelId} · 免费` : modelId
}

/**
 * #52：设置页选模型时同步更新的 per-provider 记忆表。
 * 快速切换与设置页必须**双写同一份记忆**，否则设置里改完模型 → 快速切换切走再切回，
 * 恢复的是旧记忆（#52 的原始抱怨）。模式联动（不分开）时两张 map 合并保持同一份
 *（与 modelId 槽位「联动即同值」的语义一致）；分开时只动当前模式的 map。
 */
export function nextProviderModelIds(
	apiConfiguration: ApiConfiguration | undefined,
	provider: string,
	modelId: string,
	currentMode: Mode,
	planActSeparate: boolean | undefined,
): Record<string, string> {
	if (planActSeparate) {
		const currentMap =
			currentMode === "plan" ? apiConfiguration?.planModeProviderModelIds : apiConfiguration?.actModeProviderModelIds
		return { ...(currentMap ?? {}), [provider]: modelId }
	}
	return {
		...(apiConfiguration?.planModeProviderModelIds ?? {}),
		...(apiConfiguration?.actModeProviderModelIds ?? {}),
		[provider]: modelId,
	}
}

export { filterOpenRouterModelIds } from "@shared/utils/model-filters"

import type { ApiConfiguration, ApiProvider, ModelInfo } from "./api"
import { modelIdToWriteOnProviderSwitch } from "./api"
import type { Mode } from "./storage/types"

/**
 * 「提示词增强 / 子代理」独立模型配置（2026-11-04 建立；2026-11-05 KB 08 #237 修订）。
 *
 * 设计约束（为什么是纯函数 + 平铺字段）：
 * - 判据单源：未配置回落、跨厂商配置槽、模型 id 归属纠偏、agent YAML 覆盖优先级，
 *   全部收在这里。消费点（enhancePrompt / SubagentBuilder）只做接线，判据写两遍必然漂移。
 * - 未配置 = 零行为变化：`resolveAuxiliaryApiConfiguration` 返回 undefined，消费点走主配置，
 *   存量用户与未配置用户完全不受影响。
 * - 归属纠偏复用既有判据：辅助配置改了 provider 没改 modelId 时，别家模型 id 会打到错端点
 *   （KB 18 §18.11 的 402 坑）——这里直接调 `modelIdToWriteOnProviderSwitch`，与设置页、
 *   buildApiHandler 前置闸共用同一份规则，不另写一份。
 *
 * ⚠️ #237 修订（用户裁定，推翻 2026-11-04 的「各一套完整独立配置」设计前提）：
 * 两套辅助配置**只保留「选 provider + 选模型 / ModelInfo」**。密钥、思维强度、Kimi 入口
 * 一律跟随所选 provider 对应的主 API 配置：子代理选 DeepSeek 就用主 deepSeekApiKey 与
 * 「DeepSeek 页设的那一档思维强度」，哪怕当前主模型是别家（用户举例口径）；提示词增强
 * 同样收窄。旧字段（*ApiKey / *ReasoningEffort / *MoonshotApiLine）保留存储与清空清单，
 * 但解析、请求配置、诊断摘要、UI 四处一律不读——见 extractAuxiliaryOverride 的屏蔽注释。
 */

/** 辅助配置支持的 provider：五家预设 + 免费池。OpenAI 兼容需要自定义 baseUrl，暂不纳入。 */
export const AUXILIARY_SUPPORTED_PROVIDERS = [
	"deepseek",
	"mimo",
	"bigmodel",
	"bigmodel-plan",
	"moonshot",
	"free",
] as const satisfies readonly ApiProvider[]

export function isAuxiliarySupportedProvider(provider: string | undefined): provider is ApiProvider {
	return (AUXILIARY_SUPPORTED_PROVIDERS as readonly string[]).includes(provider ?? "")
}

/**
 * 一套辅助配置在 `ApiConfiguration` 里的全部平铺字段名（#230：清空判据单源）。
 *
 * 为什么单独成清单：`StateManager.setApiConfiguration()` 会跳过 `undefined` 值——这是保护
 * `{...secrets, ...settings}` 读回合并顺序的正确设计（见 #219），但意味着 UI 把「清空」
 * 编码成 `undefined` 时，存储层什么都不会删，旧密钥 / 旧模型 id 会永久残留。
 * 因此清空必须走**显式删除通道**：host 侧用本清单算出要删的 key，再调
 * `StateManager.clearApiConfigurationFields()`。webview 侧构造「清空更新对象」也复用本清单，
 * 避免两边各写一份 6 个字段名后漂移。
 */
export const AUXILIARY_CONFIG_KEYS = {
	enhance: [
		"enhanceApiProvider",
		"enhanceApiKey",
		"enhanceApiModelId",
		"enhanceModelInfo",
		"enhanceReasoningEffort",
		"enhanceMoonshotApiLine",
	],
	subagent: [
		"subagentApiProvider",
		"subagentApiKey",
		"subagentApiModelId",
		"subagentModelInfo",
		"subagentReasoningEffort",
		"subagentMoonshotApiLine",
	],
} as const satisfies Record<"enhance" | "subagent", readonly (keyof ApiConfiguration)[]>

export const AUXILIARY_PREFIXES = ["enhance", "subagent"] as const

/**
 * 从一份**完整的** ApiConfiguration 算出应显式删除的辅助字段（#230）。
 *
 * 判据（设置页写入路径恒发完整配置，见 `useApiConfigurationHandlers.ts` 的
 * `{...apiConfiguration, ...updates}` + `convertApiConfigurationToProto`）：
 * - provider 未设置（含空串）→ 用户选了「跟随主模型」，整组 6 个字段全部删除；
 *   否则只删「本次值为空」的单字段（模型下拉回默认档、思考强度留空、密钥清空等）。
 * - 字符串空串与 undefined 等价：proto `create()` 里未设置的 optional string 是 undefined，
 *   但 UI 清空输入框常给出 `""`，两者都应删掉，避免磁盘留空串、cache 与磁盘不一致。
 *
 * 只在本函数里做「空 = 删除」的解释，绝不改 `setApiConfiguration` 的 undefined 跳过语义。
 */
export function auxiliaryFieldsToClear(config: Partial<ApiConfiguration> | undefined): (keyof ApiConfiguration)[] {
	if (!config) {
		return []
	}
	const result: (keyof ApiConfiguration)[] = []
	for (const prefix of AUXILIARY_PREFIXES) {
		const keys = AUXILIARY_CONFIG_KEYS[prefix]
		const providerKey = `${prefix}ApiProvider` as keyof ApiConfiguration
		const providerValue = config[providerKey]
		const providerCleared = providerValue === undefined || providerValue === ""
		if (providerCleared) {
			result.push(...keys)
			continue
		}
		for (const key of keys) {
			const value = config[key]
			if (value === undefined || value === "") {
				result.push(key)
			}
		}
	}
	return result
}

/** provider → 密钥槽位（buildApiHandler 按 provider 读固定字段，主配置密钥存在这里）。 */
const PROVIDER_SECRET_KEY: Partial<Record<ApiProvider, keyof ApiConfiguration>> = {
	deepseek: "deepSeekApiKey",
	mimo: "mimoApiKey",
	bigmodel: "bigmodelApiKey",
	"bigmodel-plan": "bigmodelPlanApiKey",
	moonshot: "moonshotApiKey",
}

/**
 * KB 08 #237：provider → **该家自己的**思维强度槽（全局单档，不分 plan/act）。
 *
 * 与 PROVIDER_SECRET_KEY 同族写法的单源映射：设置页各家控件写、请求侧
 * `buildApiHandler` 按当前 apiProvider 查、元测试按本表派生期望值，三处共用一份。
 * ⛔ 不要另写「语义不同的第二份」映射（#219/#230 的跨层漂移就是这么来的）。
 * free / openai 兼容无条目：free handler 不读思维强度，openai 兼容仍用全局 mode 槽。
 */
export const PROVIDER_REASONING_EFFORT_KEY: Partial<Record<ApiProvider, keyof ApiConfiguration>> = {
	deepseek: "deepSeekReasoningEffort",
	mimo: "mimoReasoningEffort",
	bigmodel: "bigmodelReasoningEffort",
	"bigmodel-plan": "bigmodelPlanReasoningEffort",
	moonshot: "moonshotReasoningEffort",
}

/**
 * KB 08 #237：按**本次请求的 provider** 读思维强度，纯函数单源（设置页写、请求侧读、测试断言
 * 三处共用）。旧写法七个分支统一读全局 planMode/actModeReasoningEffort，全局只有两槽，谁最后
 * 在主配置页改了档所有 provider 都跟着变；用户举例要求「子代理用 DeepSeek 就读 DeepSeek 页
 * 设的那一档，哪怕当前主模型是别家」。
 *
 * 辅助模型 resolve 出的 provider 与主模型不同时，本函数自然读到对应档；存量用户没设新槽、
 * 或 free / openai 兼容等无槽 provider，回落到全局 mode 槽，行为零变化。
 */
export function resolveReasoningEffort(
	apiProvider: string | undefined,
	config: ApiConfiguration,
	mode: Mode,
): string | undefined {
	const modeEffort = mode === "plan" ? config.planModeReasoningEffort : config.actModeReasoningEffort
	const effortKey = PROVIDER_REASONING_EFFORT_KEY[apiProvider as ApiProvider]
	if (!effortKey) {
		return modeEffort
	}
	return (config[effortKey] as string | undefined) ?? modeEffort
}

/** provider → per-mode ModelInfo 槽位（同 planModeMimoModelInfo 范式，plan/act 成对）。 */
const PROVIDER_MODEL_INFO_KEY: Partial<Record<ApiProvider, { plan: keyof ApiConfiguration; act: keyof ApiConfiguration }>> = {
	deepseek: { plan: "planModeDeepSeekModelInfo", act: "actModeDeepSeekModelInfo" },
	mimo: { plan: "planModeMimoModelInfo", act: "actModeMimoModelInfo" },
	bigmodel: { plan: "planModeBigmodelModelInfo", act: "actModeBigmodelModelInfo" },
	"bigmodel-plan": { plan: "planModeBigmodelPlanModelInfo", act: "actModeBigmodelPlanModelInfo" },
	moonshot: { plan: "planModeMoonshotModelInfo", act: "actModeMoonshotModelInfo" },
}

/** 一套辅助配置的值包（从 ApiConfiguration 平铺字段抽取，见 extractAuxiliaryOverride）。 */
export interface AuxiliaryModelOverride {
	provider?: string
	modelId?: string
	modelInfo?: ModelInfo
	/** @deprecated KB 08 #237 起彻底不读，保留形状仅为兼容既有调用点；恒为 undefined。 */
	apiKey?: string
	/** @deprecated KB 08 #237 起彻底不读，保留形状仅为兼容既有调用点；恒为 undefined。 */
	reasoningEffort?: string
	/** @deprecated KB 08 #237 起彻底不读（Kimi 入口跟随主 moonshotApiLine）；恒为 undefined。 */
	moonshotApiLine?: string
}

/**
 * 从平铺配置字段抽一套辅助配置值包（prefix 为 "enhance" / "subagent"）。
 *
 * ⚠️ KB 08 #237：旧独立密钥 / 独立思维强度 / 独立 Kimi 入口**一律不抽取**（恒 undefined），
 * 「不读」从解析层就钉死，下游 resolve / 请求配置 / 诊断摘要没有机会误用旧值。字段名仍留在
 * AUXILIARY_CONFIG_KEYS、SECRETS_KEYS 与 proto 里，只为兼容存量磁盘值与显式清空通道
 * （不删字段号、不删号复用），见元测试。
 */
export function extractAuxiliaryOverride(config: ApiConfiguration, prefix: "enhance" | "subagent"): AuxiliaryModelOverride {
	return {
		provider: config[`${prefix}ApiProvider` as keyof ApiConfiguration] as string | undefined,
		modelId: config[`${prefix}ApiModelId` as keyof ApiConfiguration] as string | undefined,
		modelInfo: config[`${prefix}ModelInfo` as keyof ApiConfiguration] as ModelInfo | undefined,
		apiKey: undefined,
		reasoningEffort: undefined,
		moonshotApiLine: undefined,
	}
}

/**
 * 该辅助配置是否「已配置」：KB 08 #237 起**只要显式选了受支持的 provider**。
 *
 * 旧判据还要求独立密钥，理由写在 2026-11-04 的注释里：「拿主配置密钥打辅助模型是半配置
 * 状态，宁可不生效也不静默混用两家的账」。这条设计前提已被 #237 用户裁定推翻：两套辅助
 * 配置统一跟随所选 provider 对应的主 API 配置，密钥与思维强度都不再单独填。若仍要求独立
 * key，用户「只选 provider」时功能会静默失效——这正是本次验收要专防的形状。
 * free 仍零配置可用；子代理的免费池门控见 resolveEffectiveSubagentProvider（#94/#223）。
 */
export function isAuxiliaryConfigured(aux: AuxiliaryModelOverride | undefined): boolean {
	return isAuxiliarySupportedProvider(aux?.provider)
}

/**
 * 解析辅助配置为一份完整的 ApiConfiguration（交给 buildApiHandler）。
 *
 * - 未配置 → undefined（消费点走主配置，零行为变化）；
 * - provider / 模型由辅助配置决定（mode 恒为调用方语义，辅助配置不分 plan/act）；
 * - KB 08 #237：密钥、思维强度、Kimi 入口**全部沿用 base 主配置**——不再用辅助的独立值。
 *   思维强度由 buildApiHandler 按解析出的 apiProvider 查各家自己的槽，因此「主模型是
 *   Moonshot、子代理选 DeepSeek」读的是 DeepSeek 档；把主模型再切到别家也不变。
 * - modelId 优先级：agent YAML 显式覆盖 > 辅助配置所选（过归属纠偏；无需纠偏或 free 无
 *   内置清单时保留原值）> 两者皆空时**不写该字段**、保留 base 的主配置模型 id（#235①
 *   口径修正：兜底不是「读主配置 id 再写入」，而是「不写 = 留 base 值」，由归属闸兜底；
 *   保留 yaml 覆盖能力，不回归 #94/#112 的既有语义）；
 * - per-mode ModelInfo 仍写进目标 provider 的槽位（辅助 ModelInfo 保持独立，按推荐收敛）。
 *
 * @param aux          辅助配置值包
 * @param base         主配置（回落、主配置密钥 / 思维强度 / 入口、当前模型 id 的来源）
 * @param mode         调用方语义（enhance 恒 act；子代理跟父任务 mode）
 * @param yamlModelId  agent YAML 显式模型覆盖（仅子代理有，最高优先级）
 */
export function resolveAuxiliaryApiConfiguration(
	aux: AuxiliaryModelOverride | undefined,
	base: ApiConfiguration,
	// 辅助配置不分 plan/act，mode 仅是调用方语义占位（保持签名稳定，子代理跟父任务传值）
	_mode: Mode,
	yamlModelId?: string,
): ApiConfiguration | undefined {
	if (!isAuxiliaryConfigured(aux)) {
		return undefined
	}
	const auxProvider = aux!.provider as ApiProvider

	// modelId 三级优先级。辅助所选先过归属纠偏（改了 provider 没改 id → 落该家默认档，
	// 与 buildApiHandler 前置闸同一判据）；yaml 覆盖最后套用（沿用 SubagentBuilder.applyModelOverride）。
	const correctedModelId = modelIdToWriteOnProviderSwitch(auxProvider, aux!.modelId)
	const resolvedModelId = (yamlModelId?.trim() || correctedModelId) ?? aux!.modelId

	const resolved: ApiConfiguration = {
		...base,
		ulid: base.ulid,
		planModeApiProvider: auxProvider,
		actModeApiProvider: auxProvider,
		// KB 08 #237：不再覆盖 planModeReasoningEffort / actModeReasoningEffort。
		// 覆盖成「辅助那一档」会让请求侧读不到各家自己的槽，正是用户举例要修的形状；
		// 现在交给 buildApiHandler 按 apiProvider 查 PROVIDER_REASONING_EFFORT_KEY。
		// 旧独立凭证也不进这份请求配置：两套辅助一律用主配置密钥。
		enhanceApiKey: undefined,
		subagentApiKey: undefined,
	}

	// 密钥：付费 provider 直接沿用 {...base} 里主配置的目标槽（槽位表 PROVIDER_SECRET_KEY
	// 仍是单源），不再写 aux.apiKey。free 无密钥且必须清空主配置付费凭证与 Kimi 入口（#235②）。
	const secretKey = PROVIDER_SECRET_KEY[auxProvider]
	if (!secretKey) {
		// auxProvider=free 是 PROVIDER_SECRET_KEY 无条目的唯一受支持 provider；{...base} 会把
		// 主配置的付费密钥与 Kimi 入口残留进请求配置——free 请求本不该带任何主配置凭证
		// （泄漏面，也防止将来有代码误读这些槽位），显式清空。
		// modelId 不清：free 无内置清单、resolvedModelId 为空时保留 base 值是「跟随主模型」
		// 的既定语义（见下方 resolvedModelId 分支）。付费辅助不受影响。
		for (const key of Object.values(PROVIDER_SECRET_KEY)) {
			;(resolved as Record<string, unknown>)[key] = undefined
		}
		resolved.moonshotApiLine = undefined
	}

	// per-mode ModelInfo 写进目标 provider 的槽位（mode 两边都写：辅助配置不分 plan/act）
	const modelInfoKeys = PROVIDER_MODEL_INFO_KEY[auxProvider]
	if (modelInfoKeys) {
		;(resolved as Record<string, unknown>)[modelInfoKeys.plan] = aux!.modelInfo
		;(resolved as Record<string, unknown>)[modelInfoKeys.act] = aux!.modelInfo
	}

	// 模型 id 双 mode 同值写入（辅助配置不分 plan/act；只写一个 mode 会让注释与代码不符，
	// 且将来若有调用方误用另一 mode，会拿主配置残留的别家 id 去打本家端点）。
	// resolvedModelId 为空时不写：保留 base 值，由 buildApiHandler 的归属闸兜底。
	if (resolvedModelId) {
		resolved.planModeApiModelId = resolvedModelId
		resolved.actModeApiModelId = resolvedModelId
	}

	// KB 08 #237：Kimi 双入口跟随主 moonshotApiLine（{...base} 原样保留），不再由辅助配置
	// 单独覆盖——否则会出现「密钥跟随主配置、入口却还是辅助旧值」的半配置（两站密钥不互通）。

	return resolved
}

/**
 * 子代理门控（#94「免费模型禁止子代理」）用的**实际生效 provider**。
 *
 * 不能只看主配置：辅助配置生效时子代理用的是辅助 provider。典型的绕过形状是
 * 主配置 MiMo + 子代理辅助配置选 free —— 按主配置判定会放行，结果免费池被拿来跑子代理。
 * 反过来主 free + 辅助付费时也不该被主配置误杀。判据仍单源走
 * resolveAuxiliaryApiConfiguration，两处门控（系统提示词 / 工具执行）共用本函数。
 */
export function resolveEffectiveSubagentProvider(config: ApiConfiguration, mode: Mode): string | undefined {
	const resolved = resolveAuxiliaryApiConfiguration(extractAuxiliaryOverride(config, "subagent"), config, mode)
	const source = resolved ?? config
	return (mode === "plan" ? source.planModeApiProvider : source.actModeApiProvider) as string | undefined
}

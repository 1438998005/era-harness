import { AutoApprovalSettings, DEFAULT_AUTO_APPROVAL_SETTINGS } from "@shared/AutoApprovalSettings"
import type { ApiConfiguration } from "@shared/api"
import { ApiProvider, DEFAULT_API_PROVIDER, ModelInfo, OpenAiCompatibleModelInfo } from "@shared/api"
import { ClineRulesToggles } from "@shared/cline-rules"
import { DEFAULT_FOCUS_CHAIN_SETTINGS, FocusChainSettings } from "@shared/FocusChainSettings"
import { HistoryItem } from "@shared/HistoryItem"
import { DEFAULT_MCP_DISPLAY_MODE, McpDisplayMode } from "@shared/McpDisplayMode"
import { WorkspaceRoot } from "@shared/multi-root/types"
import { GlobalInstructionsFile } from "@shared/remote-config/schema"
import { Mode } from "@shared/storage/types"
import { TelemetrySetting } from "@shared/TelemetrySetting"
import { UserInfo } from "@shared/UserInfo"
import { type BlobStoreSettings } from "./types"

// ============================================================================
// SINGLE SOURCE OF TRUTH FOR STORAGE KEYS
//
// Property definitions with types, default values, and metadata
// NOTE: When adding a new field, the scripts/generate-state-proto.mjs will be
// executed automatically to regenerate the proto/cline/state.proto file with the
// new fields once the file is staged and committed.
// ============================================================================

/**
 * Defines the shape of a field definition. Each field must have a `default` value,
 * and optionally can have `isAsync`, `isComputed`, or `transform` metadata.
 *
 * The type casting on `default` (e.g., `true as boolean`) is necessary because
 * TypeScript would otherwise infer the literal type (`true`) instead of the
 * wider type (`boolean`). This ensures the generated interfaces allow any
 * value of that type, not just the default literal.
 */
type FieldDefinition<T> = {
	default: T // The default value for the field with proper type casting using as (e.g., `true as boolean | undefined`)
	isAsync?: boolean
	isComputed?: boolean
	transform?: (value: any) => T
}

type FieldDefinitions = Record<string, FieldDefinition<any>>

export type ConfiguredAPIKeys = Partial<Record<ApiProvider, boolean>>
const REMOTE_CONFIG_EXTRA_FIELDS = {
	remoteConfiguredProviders: { default: [] as ApiProvider[] },
	allowedMCPServers: { default: [] as Array<{ id: string }> },
	remoteMCPServers: { default: undefined as Array<{ name: string; url: string; alwaysEnabled?: boolean }> | undefined },
	previousRemoteMCPServers: { default: undefined as Array<{ name: string; url: string }> | undefined },
	remoteGlobalRules: { default: undefined as GlobalInstructionsFile[] | undefined },
	remoteGlobalWorkflows: { default: undefined as GlobalInstructionsFile[] | undefined },
	remoteGlobalSkills: { default: undefined as GlobalInstructionsFile[] | undefined },
	blockPersonalRemoteMCPServers: { default: false as boolean },
	openTelemetryOtlpHeaders: { default: undefined as Record<string, string> | undefined },
	otlpMetricsHeaders: { default: undefined as Record<string, string> | undefined },
	otlpLogsHeaders: { default: undefined as Record<string, string> | undefined },
	blobStoreConfig: { default: undefined as BlobStoreSettings | undefined },
	configuredApiKeys: { default: {} as ConfiguredAPIKeys | undefined },
} satisfies FieldDefinitions

const GLOBAL_STATE_FIELDS = {
	clineVersion: { default: undefined as string | undefined },
	"cline.generatedMachineId": { default: undefined as string | undefined }, // Note, distinctId reads/writes this directly from/to StorageContext before StateManager is initialized.
	lastShownAnnouncementId: { default: undefined as string | undefined },
	taskHistory: { default: [] as HistoryItem[], isAsync: true },
	userInfo: { default: undefined as UserInfo | undefined },
	favoritedModelIds: { default: [] as string[] },
	mcpMarketplaceEnabled: { default: true as boolean },
	mcpResponsesCollapsed: { default: false as boolean },
	terminalReuseEnabled: { default: true as boolean },
	vscodeTerminalExecutionMode: {
		default: "vscodeTerminal" as "vscodeTerminal" | "backgroundExec",
	},
	isNewUser: { default: true as boolean },
	welcomeViewCompleted: { default: undefined as boolean | undefined },
	mcpDisplayMode: { default: DEFAULT_MCP_DISPLAY_MODE as McpDisplayMode },
	workspaceRoots: { default: undefined as WorkspaceRoot[] | undefined },
	primaryRootIndex: { default: 0 as number },
	multiRootEnabled: { default: true as boolean },
	lastDismissedInfoBannerVersion: { default: 0 as number },
	lastDismissedModelBannerVersion: { default: 0 as number },
	lastDismissedCliBannerVersion: { default: 0 as number },
	// era harness：默认关原生工具调用。本 fork 仅保留 DeepSeek + 自定义 OpenAI 兼容两类 provider，
	// 许多第三方端点不返回结构化 tool_calls（会把工具调用吐成正文文本），强开 native 会导致参数解析为空→重试→中断。
	// 默认走 XML 提示（parseAssistantMessageV2 能稳定解析）；确认端点支持原生函数调用的用户可在「功能设置」手动开启。
	nativeToolCallEnabled: { default: false as boolean },
	remoteRulesToggles: { default: {} as ClineRulesToggles },
	remoteWorkflowToggles: { default: {} as ClineRulesToggles },
	remoteSkillsToggles: { default: {} as ClineRulesToggles },
	dismissedBanners: { default: [] as Array<{ bannerId: string; dismissedAt: number }> },
	// Path to worktree that should auto-open Cline sidebar when launched
	worktreeAutoOpenPath: { default: undefined as string | undefined },
} satisfies FieldDefinitions

// Fields that map directly to ApiHandlerOptions in @shared/api.ts
// era harness: 仅保留 DeepSeek + OpenAI 兼容两个 provider 所需字段，其余 provider 键已剥离。
const API_HANDLER_SETTINGS_FIELDS = {
	// Global configuration (not mode-specific)
	openAiBaseUrl: { default: undefined as string | undefined },
	requestTimeoutMs: { default: undefined as number | undefined },
	enableParallelToolCalling: { default: true as boolean },
	// era harness：免费池隐私开关。true = 仅路由到不收集提示词的渠道（排除 Kilo 明文收集，仅剩 OVH；渠道标记见 free-pools.ts LANE_META）
	freeExcludeCollecting: { default: false as boolean },
	// 2026-11-08：设置页第三个并列路由选项（自动路由 / 指定模型 / OpenRouter 免费路由）。
	// false = 走 FREE_POOL 自动路由或 pinned；true = 固定单候选 openrouter/free（不经池、不回落）。
	// ⚠️ 普通设置字段，绝不进 SECRETS_KEYS（会被 undefined 覆盖 / 语义错位）；false 是有效值，
	// 也不进 CLEARABLE_ON_EMPTY_KEYS（否则写 false 会被当成「清空」删掉）。
	freeUseOpenRouterRouter: { default: false as boolean },
	// KB 08 #237（2026-11-05 用户裁定）：思维强度按 provider 各存各的，不再只存全局 plan/act 两槽。
	// 子代理 / 提示词增强选 DeepSeek 时读「DeepSeek 那一页设的档」，哪怕当前主模型是别家；
	// 反过来主模型是 DeepSeek、辅助选 Moonshot 也不会误读 DeepSeek 档。映射单源见
	// @shared/aux-model 的 PROVIDER_REASONING_EFFORT_KEY，请求侧按 apiProvider 查表读取。
	// 存量用户没设新槽时回落全局 planMode/actModeReasoningEffort，行为零变化（不迁移、不删旧槽）。
	deepSeekReasoningEffort: { default: undefined as string | undefined },
	mimoReasoningEffort: { default: undefined as string | undefined },
	bigmodelReasoningEffort: { default: undefined as string | undefined },
	bigmodelPlanReasoningEffort: { default: undefined as string | undefined },
	moonshotReasoningEffort: { default: undefined as string | undefined },
	// KB 08 #242：免费模型池「指定模型」。存**真实上游模型 ID**（不是 displayName、不是数组
	// 下标），全局一份不分 plan/act；#241 池序重排后仍能指向同一个模型。清空 = 回到自动路由。
	pinnedModelId: { default: undefined as string | undefined },

	// Plan mode configurations
	planModeApiModelId: { default: undefined as string | undefined },
	planModeReasoningEffort: { default: undefined as string | undefined },
	planModeOpenAiModelId: { default: undefined as string | undefined },
	planModeOpenAiModelInfo: { default: undefined as OpenAiCompatibleModelInfo | undefined },
	planModeDeepSeekModelInfo: { default: undefined as ModelInfo | undefined },
	planModeMimoModelInfo: { default: undefined as ModelInfo | undefined },
	planModeBigmodelModelInfo: { default: undefined as ModelInfo | undefined },
	planModeBigmodelPlanModelInfo: { default: undefined as ModelInfo | undefined },
	planModeMoonshotModelInfo: { default: undefined as ModelInfo | undefined },
	// #52（2026-10-28）：per-provider 模型记忆。deepseek/mimo/bigmodel 共用 planModeApiModelId
	// 一个槽位，快速切换切走再切回就被覆盖成默认档——按 provider 各记一份，读侧仍过归属校验
	//（记忆 id 不属本家清单 → 兑底默认档，KB 18 §18.11 教训不得绕过）。
	planModeProviderModelIds: { default: {} as Record<string, string> },

	// Act mode configurations
	actModeApiModelId: { default: undefined as string | undefined },
	actModeReasoningEffort: { default: undefined as string | undefined },
	actModeOpenAiModelId: { default: undefined as string | undefined },
	actModeOpenAiModelInfo: { default: undefined as OpenAiCompatibleModelInfo | undefined },
	actModeDeepSeekModelInfo: { default: undefined as ModelInfo | undefined },
	actModeMimoModelInfo: { default: undefined as ModelInfo | undefined },
	actModeBigmodelModelInfo: { default: undefined as ModelInfo | undefined },
	actModeBigmodelPlanModelInfo: { default: undefined as ModelInfo | undefined },
	actModeMoonshotModelInfo: { default: undefined as ModelInfo | undefined },
	actModeProviderModelIds: { default: {} as Record<string, string> },

	// Model-specific settings
	planModeApiProvider: { default: DEFAULT_API_PROVIDER as ApiProvider },
	actModeApiProvider: { default: DEFAULT_API_PROVIDER as ApiProvider },
	// Kimi (Moonshot) 双入口：china（api.moonshot.cn，默认）/ international（api.moonshot.ai）。
	// 判据单一来源在 @shared/moonshot-request（设置页下拉与请求侧共用，知识库 18 §18.11 防漂移）。
	moonshotApiLine: { default: undefined as string | undefined },

	// 「提示词增强 / 子代理」独立模型配置（2026-11-04 建立；2026-11-05 KB 08 #237 修订）。
	// 平铺而不是嵌套 message：与 planMode*/actMode* 范式同构，state.proto 生成器与转换层都不用
	// 处理新形状。未配置（无 provider）时两个功能回落主配置，行为零变化。
	// ⚠️ #237 用户裁定后这两套**只保留「选 provider + 选模型 / ModelInfo」**：密钥与思维强度
	// 一律跟随所选 provider 对应的主 API 配置，Kimi 入口跟随主 moonshotApiLine。下面这些旧的
	// *ApiKey / *ReasoningEffort / *MoonshotApiLine 字段仍留在存储与清空清单里（兼容旧数据、
	// 不删 proto 字段号、不动 aux-clear.spec.ts 的 6/6/12 断言），但解析 / 请求 / 诊断 /
	// UI 四处一律不再读取，见 @shared/aux-model 的屏蔽注释与元测试。
	// ⛔ 两个 *ApiKey **只能**登记在 SECRETS_KEYS（见本文件下方注释）：若同时登记在这里，
	// constructApiConfigurationFromCache 的 {...secrets, ...settings} 会用 settings 里的
	// undefined 把 secrets 里的真实密钥覆盖掉，辅助配置永远读不到密钥（2026-11-04 实测）。
	enhanceApiProvider: { default: undefined as ApiProvider | undefined },
	enhanceApiModelId: { default: undefined as string | undefined },
	enhanceModelInfo: { default: undefined as ModelInfo | undefined },
	enhanceReasoningEffort: { default: undefined as string | undefined },
	enhanceMoonshotApiLine: { default: undefined as string | undefined },
	subagentApiProvider: { default: undefined as ApiProvider | undefined },
	subagentApiModelId: { default: undefined as string | undefined },
	subagentModelInfo: { default: undefined as ModelInfo | undefined },
	subagentReasoningEffort: { default: undefined as string | undefined },
	subagentMoonshotApiLine: { default: undefined as string | undefined },
} satisfies FieldDefinitions

const USER_SETTINGS_FIELDS = {
	// Settings that are NOT part of ApiHandlerOptions
	autoApprovalSettings: {
		default: DEFAULT_AUTO_APPROVAL_SETTINGS as AutoApprovalSettings,
	},
	globalClineRulesToggles: { default: {} as ClineRulesToggles },
	globalWorkflowToggles: { default: {} as ClineRulesToggles },
	globalSkillsToggles: { default: {} as Record<string, boolean> },
	// 默认关闭遥测。注意：批次 2 起 Provider 已换成 no-op 实现，即使设置为 enabled 也不外发
	// （SUBTRACTION-PLAN.md §2a）；此项仅保留给上游设置页兼容。
	telemetrySetting: { default: "disabled" as TelemetrySetting },
	planActSeparateModelsSetting: { default: false as boolean, isComputed: true },
	enableCheckpointsSetting: { default: false as boolean },
	shellIntegrationTimeout: { default: 4000 as number },
	defaultTerminalProfile: { default: "default" as string },
	terminalOutputLineLimit: { default: 500 as number },
	maxConsecutiveMistakes: { default: 3 as number },
	strictPlanModeEnabled: { default: false as boolean },
	// #137（2026-11-01 用户裁定）：hooks 默认关——脚本被发现即执行、无确认，
	// 对「下载 mod 包解进工程再打开」的用户是供应链执行面（与 enableCheckpointsSetting
	// 默认关同一先例）。getHooksEnabledSafe 的 ?? false 只兜「存量无值」，新装默认在这里。
	hooksEnabled: { default: false as boolean },
	yoloModeToggled: { default: false as boolean },
	autoApproveAllToggled: { default: false as boolean },
	// 08 #176（2026-11-02 用户裁定）：自动压缩默认开——默认关时长对话走的是
	// quarter/half 程序化截断（直接把历史砍掉），而不是摘要式压缩；用户不会自己去开。
	// 显式关过的存量用户不受影响：state-helpers 只在值为 undefined 时套这里的默认。
	useAutoCondense: { default: true as boolean },
	subagentsEnabled: { default: false as boolean },
	clineWebToolsEnabled: { default: true as boolean },
	worktreesEnabled: { default: false as boolean },
	preferredLanguage: { default: "Simplified Chinese - 简体中文" as string },
	mode: { default: "act" as Mode },
	focusChainSettings: { default: DEFAULT_FOCUS_CHAIN_SETTINGS as FocusChainSettings },
	customPrompt: { default: undefined as "compact" | undefined },
	backgroundEditEnabled: { default: false as boolean },
	optOutOfRemoteConfig: { default: false as boolean },
	doubleCheckCompletionEnabled: { default: false as boolean },
	lazyTeammateModeEnabled: { default: false as boolean },
	showFeatureTips: { default: true as boolean },

	// OpenTelemetry configuration
	openTelemetryEnabled: { default: true as boolean },
	openTelemetryMetricsExporter: { default: undefined as string | undefined },
	openTelemetryLogsExporter: { default: undefined as string | undefined },
	openTelemetryOtlpProtocol: { default: "http/json" as string | undefined },
	openTelemetryOtlpEndpoint: { default: "http://localhost:4318" as string | undefined },
	openTelemetryOtlpMetricsProtocol: { default: undefined as string | undefined },
	openTelemetryOtlpMetricsEndpoint: { default: undefined as string | undefined },
	openTelemetryOtlpLogsProtocol: { default: undefined as string | undefined },
	openTelemetryOtlpLogsEndpoint: { default: undefined as string | undefined },
	openTelemetryMetricExportInterval: { default: 60000 as number | undefined },
	openTelemetryOtlpInsecure: { default: false as boolean | undefined },
	openTelemetryLogBatchSize: { default: 512 as number | undefined },
	openTelemetryLogBatchTimeout: { default: 5000 as number | undefined },
	openTelemetryLogMaxQueueSize: { default: 2048 as number | undefined },
} satisfies FieldDefinitions

const SETTINGS_FIELDS = { ...API_HANDLER_SETTINGS_FIELDS, ...USER_SETTINGS_FIELDS }
const GLOBAL_STATE_AND_SETTINGS_FIELDS = { ...GLOBAL_STATE_FIELDS, ...SETTINGS_FIELDS }

// ============================================================================
// SECRET KEYS AND LOCAL STATE - Static definitions
// ============================================================================

// Secret keys used in Api Configuration
// era harness: 仅保留 DeepSeek / OpenAI 兼容 / OVH AI Endpoints 所需的密钥 + MCP OAuth 密钥。
const SECRETS_KEYS = [
	"apiKey",
	"openAiApiKey",
	"deepSeekApiKey",
	"mimoApiKey",
	"bigmodelApiKey",
	// 智谱 GLM 套餐（Coding Plan）：与按量 Key 互不通用，必须单独存
	"bigmodelPlanApiKey",
	// Kimi (Moonshot)：国内站（platform.kimi.com）与国际站密钥不互通，但同一个 key 值槽位
	// 足够——入口由 moonshotApiLine 决定，换入口必须换 key，不存在两把 key 并存的场景
	"moonshotApiKey",
	// 「提示词增强 / 子代理」旧独立凭证（KB 08 #237 起**保留但不读**）。
	// 只在这里注册，绝不能同时进 API_HANDLER_SETTINGS_FIELDS：setApiConfiguration 按
	// isSecretKey 优先写 secretsCache，而 constructApiConfigurationFromCache 是
	// {...secrets, ...settings} —— 同名 settings 键（undefined）会把密钥覆盖成空，
	// 导致两套辅助配置静默失效（2026-11-04 审查实测：read-back enhanceApiKey: undefined）。
	// #237 后辅助模型统一用所选 provider 的主配置密钥；这里保留两个 key 仅为让存量磁盘值
	// 仍能被 aux-clear 的显式删除通道清掉，绝不删号复用（proto 字段号一并保留）。
	"enhanceApiKey",
	"subagentApiKey",
	"ovhAiEndpointsApiKey", // OVHcloud AI Endpoints 可选 Key（免费模型第三渠道；留空走匿名 2rpm）
	"openai-codex-oauth-credentials", // integrations/openai-codex 仍在（批次 3 才删），需其 OAuth 密钥位
	"mcpOAuthSecrets",
] as const

// WARNING, these are not ALL of the local state keys in practice. For example, FileContextTracker
// uses dynamic keys like pendingFileContextWarning_${taskId}.
export const LocalStateKeys = [
	"localClineRulesToggles",
	"localCursorRulesToggles",
	"localWindsurfRulesToggles",
	"localAgentsRulesToggles",
	"localSkillsToggles",
	"workflowToggles",
] as const

// ============================================================================
// GENERATED TYPES - Auto-generated from property definitions
// ============================================================================

type ExtractDefault<T> = T extends { default: infer U } ? U : never
type BuildInterface<T extends Record<string, { default: any }>> = { [K in keyof T]: ExtractDefault<T[K]> }

export type GlobalState = BuildInterface<typeof GLOBAL_STATE_FIELDS>
export type Settings = BuildInterface<typeof SETTINGS_FIELDS>
type RemoteConfigExtra = BuildInterface<typeof REMOTE_CONFIG_EXTRA_FIELDS>
export type ApiHandlerOptionSettings = BuildInterface<typeof API_HANDLER_SETTINGS_FIELDS>
export type ApiHandlerSettings = ApiHandlerOptionSettings & Secrets
export type GlobalStateAndSettings = GlobalState & Settings
export type RemoteConfigFields = GlobalStateAndSettings & RemoteConfigExtra

// ============================================================================
// TYPE ALIASES
// ============================================================================

export type Secrets = { [K in (typeof SecretKeys)[number]]: string | undefined }
export type LocalState = { [K in (typeof LocalStateKeys)[number]]: ClineRulesToggles }
export type SecretKey = (typeof SecretKeys)[number]
export type GlobalStateKey = keyof GlobalState
export type LocalStateKey = keyof LocalState
export type SettingsKey = keyof Settings
export type GlobalStateAndSettingsKey = keyof GlobalStateAndSettings

// ============================================================================
// GENERATED KEYS AND LOOKUP SETS - Auto-generated from property definitions
// ============================================================================

const GlobalStateKeys = new Set(Object.keys(GLOBAL_STATE_FIELDS))
const SettingsKeysSet = new Set(Object.keys(SETTINGS_FIELDS))
const GlobalStateAndSettingsKeySet = new Set(Object.keys(GLOBAL_STATE_AND_SETTINGS_FIELDS))
const ApiHandlerSettingsKeysSet = new Set(Object.keys(API_HANDLER_SETTINGS_FIELDS))

export const SecretKeys = Array.from(SECRETS_KEYS)
export const SettingsKeys = Array.from(SettingsKeysSet) as (keyof Settings)[]
export const ApiHandlerSettingsKeys = Array.from(ApiHandlerSettingsKeysSet) as (keyof ApiHandlerOptionSettings)[]
export const GlobalStateAndSettingKeys = Array.from(GlobalStateAndSettingsKeySet) as GlobalStateAndSettingsKey[]

/**
 * 按 StateManager.constructApiConfigurationFromCache 的顺序合并两份缓存（#235③ 判据单源）。
 *
 * ⛔ 顺序固定为 `{...secrets, ...settings}`：settings（globalState）覆盖 secrets。
 * SecretKeys 与 API_HANDLER_SETTINGS_FIELDS 必须无交集——同名键会让 settings 里的
 * undefined 把 secrets 里的真实密钥覆盖掉，辅助配置静默失效（2026-11-04 实测）。
 * 交集判据见 review-bugfix.spec.ts 的第一个用例；StateManager 与该 spec 共用本函数，
 * 不再各写一份 spread（手工模拟与真实链路必然漂移）。
 */
export function mergeApiConfigurationCaches(secrets: Secrets, settings: ApiHandlerOptionSettings): ApiConfiguration {
	return { ...secrets, ...settings }
}

// GENERATED DEFAULTS - Auto-generated from property definitions
// ============================================================================

export const GLOBAL_STATE_DEFAULTS = extractDefaults(GLOBAL_STATE_FIELDS)
export const SETTINGS_DEFAULTS = extractDefaults(SETTINGS_FIELDS)
export const SETTINGS_TRANSFORMS = extractTransforms(SETTINGS_FIELDS)
export const ASYNC_PROPERTIES = extractMetadata({ ...GLOBAL_STATE_FIELDS, ...SETTINGS_FIELDS }, "isAsync")
export const COMPUTED_PROPERTIES = extractMetadata({ ...GLOBAL_STATE_FIELDS, ...SETTINGS_FIELDS }, "isComputed")

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const isGlobalStateKey = (key: string): key is GlobalStateKey => GlobalStateKeys.has(key)
export const isSettingsKey = (key: string): key is SettingsKey => SettingsKeysSet.has(key)
export const isSecretKey = (key: string): key is SecretKey => new Set(SECRETS_KEYS).has(key as SecretKey)
export const isLocalStateKey = (key: string): key is LocalStateKey => new Set(LocalStateKeys).has(key as LocalStateKey)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const isAsyncProperty = (key: string): boolean => ASYNC_PROPERTIES.has(key)
export const isComputedProperty = (key: string): boolean => COMPUTED_PROPERTIES.has(key)

export const getDefaultValue = <K extends GlobalStateAndSettingsKey>(key: K): GlobalStateAndSettings[K] | undefined => {
	return ((GLOBAL_STATE_DEFAULTS as any)[key] ?? (SETTINGS_DEFAULTS as any)[key]) as GlobalStateAndSettings[K] | undefined
}

export const hasTransform = (key: string): boolean => key in SETTINGS_TRANSFORMS
export const applyTransform = <T>(key: string, value: T): T => {
	const transform = SETTINGS_TRANSFORMS[key]
	return transform ? transform(value) : value
}

function extractDefaults<T extends Record<string, any>>(props: T): Partial<BuildInterface<T>> {
	return Object.fromEntries(
		Object.entries(props)
			.map(([key, prop]) => [key, prop.default])
			.filter(([_, value]) => value !== undefined),
	) as Partial<BuildInterface<T>>
}

function extractTransforms<T extends Record<string, any>>(props: T): Record<string, (value: any) => any> {
	return Object.fromEntries(
		Object.entries(props)
			.filter(([_, prop]) => "transform" in prop && prop.transform !== undefined)
			.map(([key, prop]) => [key, prop.transform]),
	)
}

function extractMetadata<T extends Record<string, any>>(props: T, field: string): Set<string> {
	return new Set(
		Object.entries(props)
			.filter(([_, prop]) => field in prop && prop[field] === true)
			.map(([key]) => key),
	)
}

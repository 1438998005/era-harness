import { synchronizeRemoteRuleToggles } from "@core/context/instructions/user-instructions/rule-helpers"
import { parseRemoteSkillEntries } from "@core/context/instructions/user-instructions/skills"
import type { RemoteConfig, S3AccessKeySettings } from "@shared/remote-config/schema"
import { ConfiguredAPIKeys, GlobalStateAndSettings, RemoteConfigFields } from "@shared/storage/state-keys"
import { getDistinctId } from "@/services/logging/distinctId"
import { type McpHub } from "@/services/mcp/McpHub"
import { ApiProvider } from "@/shared/api"
import { Logger } from "@/shared/services/Logger"
import { syncWorker } from "@/shared/services/worker/sync"
import { BlobStoreSettings } from "@/shared/storage"
import { StateManager } from "../StateManager"

function accessSettingsToBlobStorage(type: BlobStoreSettings["adapterType"], settings: S3AccessKeySettings): BlobStoreSettings {
	return {
		adapterType: type,
		accessKeyId: settings.accessKeyId,
		secretAccessKey: settings.secretAccessKey,
		region: settings.region,
		bucket: settings.bucket,
		endpoint: settings.endpoint,
		accountId: settings.accountId,
		intervalMs: settings.intervalMs,
		maxRetries: settings.maxRetries,
		batchSize: settings.batchSize,
		maxQueueSize: settings.maxQueueSize,
		maxFailedAgeMs: settings.maxFailedAgeMs,
		backfillEnabled: settings.backfillEnabled,
	}
}

/**
 * Transforms RemoteConfig schema to RemoteConfigFields shape
 * @param remoteConfig The remote configuration object
 * @returns Partial<RemoteConfigFields> containing only the fields present in remote config
 */
export function transformRemoteConfigToStateShape(remoteConfig: RemoteConfig): Partial<RemoteConfigFields> {
	const transformed: Partial<RemoteConfigFields> = {}

	// Map top-level settings
	if (remoteConfig.telemetryEnabled !== undefined) {
		transformed.telemetrySetting = remoteConfig.telemetryEnabled ? "enabled" : "disabled"
	}
	if (remoteConfig.mcpMarketplaceEnabled !== undefined) {
		transformed.mcpMarketplaceEnabled = remoteConfig.mcpMarketplaceEnabled
	}
	if (remoteConfig.allowedMCPServers !== undefined) {
		transformed.allowedMCPServers = remoteConfig.allowedMCPServers
	}
	if (remoteConfig.blockPersonalRemoteMCPServers !== undefined) {
		transformed.blockPersonalRemoteMCPServers = remoteConfig.blockPersonalRemoteMCPServers
	}
	if (remoteConfig.remoteMCPServers !== undefined) {
		transformed.remoteMCPServers = remoteConfig.remoteMCPServers
	}
	if (remoteConfig.yoloModeAllowed !== undefined) {
		// only set the yoloModeToggled field if yolo mode is not allowed. Otherwise, we let the user toggle it.
		if (remoteConfig.yoloModeAllowed === false) {
			transformed.yoloModeToggled = false
		}
	}

	// Map OpenTelemetry settings
	if (remoteConfig.openTelemetryEnabled !== undefined) {
		transformed.openTelemetryEnabled = remoteConfig.openTelemetryEnabled
	}
	if (remoteConfig.openTelemetryMetricsExporter !== undefined) {
		transformed.openTelemetryMetricsExporter = remoteConfig.openTelemetryMetricsExporter
	}
	if (remoteConfig.openTelemetryLogsExporter !== undefined) {
		transformed.openTelemetryLogsExporter = remoteConfig.openTelemetryLogsExporter
	}
	if (remoteConfig.openTelemetryOtlpProtocol !== undefined) {
		transformed.openTelemetryOtlpProtocol = remoteConfig.openTelemetryOtlpProtocol
	}
	if (remoteConfig.openTelemetryOtlpEndpoint !== undefined) {
		transformed.openTelemetryOtlpEndpoint = remoteConfig.openTelemetryOtlpEndpoint
	}
	if (remoteConfig.openTelemetryOtlpMetricsProtocol !== undefined) {
		transformed.openTelemetryOtlpMetricsProtocol = remoteConfig.openTelemetryOtlpMetricsProtocol
	}
	if (remoteConfig.openTelemetryOtlpMetricsEndpoint !== undefined) {
		transformed.openTelemetryOtlpMetricsEndpoint = remoteConfig.openTelemetryOtlpMetricsEndpoint
	}
	if (remoteConfig.openTelemetryOtlpLogsProtocol !== undefined) {
		transformed.openTelemetryOtlpLogsProtocol = remoteConfig.openTelemetryOtlpLogsProtocol
	}
	if (remoteConfig.openTelemetryOtlpLogsEndpoint !== undefined) {
		transformed.openTelemetryOtlpLogsEndpoint = remoteConfig.openTelemetryOtlpLogsEndpoint
	}
	if (remoteConfig.openTelemetryMetricExportInterval !== undefined) {
		transformed.openTelemetryMetricExportInterval = remoteConfig.openTelemetryMetricExportInterval
	}
	if (remoteConfig.openTelemetryOtlpInsecure !== undefined) {
		transformed.openTelemetryOtlpInsecure = remoteConfig.openTelemetryOtlpInsecure
	}
	if (remoteConfig.openTelemetryLogBatchSize !== undefined) {
		transformed.openTelemetryLogBatchSize = remoteConfig.openTelemetryLogBatchSize
	}
	if (remoteConfig.openTelemetryLogBatchTimeout !== undefined) {
		transformed.openTelemetryLogBatchTimeout = remoteConfig.openTelemetryLogBatchTimeout
	}
	if (remoteConfig.openTelemetryLogMaxQueueSize !== undefined) {
		transformed.openTelemetryLogMaxQueueSize = remoteConfig.openTelemetryLogMaxQueueSize
	}
	if (remoteConfig.openTelemetryOtlpHeaders !== undefined) {
		transformed.openTelemetryOtlpHeaders = remoteConfig.openTelemetryOtlpHeaders
	}
	if (remoteConfig.openTelemetryOtlpMetricsHeaders !== undefined) {
		transformed.otlpMetricsHeaders = remoteConfig.openTelemetryOtlpMetricsHeaders
	}
	if (remoteConfig.openTelemetryOtlpLogsHeaders !== undefined) {
		transformed.otlpLogsHeaders = remoteConfig.openTelemetryOtlpLogsHeaders
	}

	// Map provider settings
	const providers: ApiProvider[] = []

	// Map OpenAiCompatible provider settings
	const openAiSettings = remoteConfig.providerSettings?.OpenAiCompatible
	if (openAiSettings) {
		transformed.planModeApiProvider = "openai"
		transformed.actModeApiProvider = "openai"
		providers.push("openai")

		if (openAiSettings.openAiBaseUrl !== undefined) {
			transformed.openAiBaseUrl = openAiSettings.openAiBaseUrl
		}
	}

	// era harness: 其余 provider（bedrock/cline/litellm/vertex/anthropic）已从远端配置映射剥离

	// This line needs to stay here, it is order dependent on the above code checking the configured providers
	if (providers.length > 0) {
		transformed.remoteConfiguredProviders = providers
	}

	// Map global rules, workflows, and skills
	if (remoteConfig.globalRules !== undefined) {
		transformed.remoteGlobalRules = remoteConfig.globalRules
	}
	if (remoteConfig.globalWorkflows !== undefined) {
		transformed.remoteGlobalWorkflows = remoteConfig.globalWorkflows
	}
	if (remoteConfig.globalSkills !== undefined) {
		transformed.remoteGlobalSkills = remoteConfig.globalSkills
	}

	if (remoteConfig.enterpriseTelemetry?.promptUploading) {
		const promptUplaoding = remoteConfig.enterpriseTelemetry.promptUploading
		if (promptUplaoding.type === "s3_access_keys" && promptUplaoding.s3AccessSettings) {
			transformed.blobStoreConfig = accessSettingsToBlobStorage("s3", promptUplaoding.s3AccessSettings)
		} else if (promptUplaoding.type === "r2_access_keys" && promptUplaoding.r2AccessSettings) {
			transformed.blobStoreConfig = accessSettingsToBlobStorage("r2", promptUplaoding.r2AccessSettings)
		} else if (promptUplaoding.type === "azure_access_keys" && promptUplaoding.azureAccessSettings) {
			transformed.blobStoreConfig = accessSettingsToBlobStorage("azure", promptUplaoding.azureAccessSettings)
		}
	}

	return transformed
}

async function applyRemoteSyncQueueConfig(transformed: Partial<RemoteConfigFields>) {
	try {
		const blobStoreConfig = transformed.blobStoreConfig
		if (!blobStoreConfig) {
			return
		}

		syncWorker().init({ ...blobStoreConfig, userDistinctId: getDistinctId() })
	} catch (err) {
		Logger.error("[REMOTE CONFIG DEBUG] Failed to apply remote sync queue config", err)
	}
}

export function clearRemoteConfig() {
	try {
		const stateManager = StateManager.get()

		stateManager.clearRemoteConfig()
		// the remote config cline rules toggle state is stored in global state
		stateManager.setGlobalState("remoteRulesToggles", {})
		stateManager.setGlobalState("remoteWorkflowToggles", {})
		stateManager.setGlobalState("remoteSkillsToggles", {})

		// era harness: 无 LiteLLM 远程密钥，跳过 setSecret 清理
	} catch (err) {
		Logger.error("[REMOTE CONFIG] Failed to clear remote config", err)
	}
}

/**
 * Applies remote config to the StateManager's remote config cache
 * @param remoteConfig The remote configuration object to apply
 * @param mcpHub McpHub instance to prevent watcher triggers during sync
 */
export async function applyRemoteConfig(
	remoteConfig: RemoteConfig,
	configuredKeys: ConfiguredAPIKeys,
	mcpHub: McpHub,
): Promise<void> {
	const stateManager = StateManager.get()
	// If no remote config provided, clear the cache and relevant state
	if (!remoteConfig) {
		clearRemoteConfig()
		return
	}

	// Save previousRemoteMCPServers before clearing cache, this is needed for next sync to detect removals)
	const previousRemoteMCPServers = stateManager.getRemoteConfigSettings().previousRemoteMCPServers

	// Transform remote config to state shape
	// These are then set to the remote config cache in the StateManager
	// We need to ensure the cache is checked for new fields
	const transformed = transformRemoteConfigToStateShape(remoteConfig)

	// Synchronize toggle state
	const currentRuleToggles = stateManager.getGlobalStateKey("remoteRulesToggles") || {}
	const currentWorkflowToggles = stateManager.getGlobalStateKey("remoteWorkflowToggles") || {}

	const syncedRuleToggles = synchronizeRemoteRuleToggles(remoteConfig.globalRules || [], currentRuleToggles)
	const syncedWorkflowToggles = synchronizeRemoteRuleToggles(remoteConfig.globalWorkflows || [], currentWorkflowToggles)

	// Remote skills use shared validation (entry.name must match frontmatter.name)
	const currentSkillToggles = stateManager.getGlobalStateKey("remoteSkillsToggles") || {}
	const validatedSkillEntries = parseRemoteSkillEntries(remoteConfig.globalSkills || [])
	const syncedSkillToggles = synchronizeRemoteRuleToggles(validatedSkillEntries, currentSkillToggles)

	// Enforce alwaysEnabled: override any stale false toggles for skills the admin has locked on.
	// This ensures the toggle store is the single source of truth — both the UI and handler agree.
	for (const entry of validatedSkillEntries) {
		if (entry.alwaysEnabled && syncedSkillToggles[entry.name] === false) {
			syncedSkillToggles[entry.name] = true
		}
	}

	stateManager.setGlobalState("remoteRulesToggles", syncedRuleToggles)
	stateManager.setGlobalState("remoteWorkflowToggles", syncedWorkflowToggles)
	stateManager.setGlobalState("remoteSkillsToggles", syncedSkillToggles)

	// If the existing configured provider is valid, don't update it
	const apiConfiguration = stateManager.getApiConfiguration()
	if (isProviderValid(apiConfiguration.actModeApiProvider, transformed)) {
		transformed.actModeApiProvider = apiConfiguration.actModeApiProvider
	}
	if (isProviderValid(apiConfiguration.planModeApiProvider, transformed)) {
		transformed.planModeApiProvider = apiConfiguration.planModeApiProvider
	}

	// Build the full new cache and swap atomically to avoid a window where
	// concurrent readers (e.g., UseSkillToolHandler) see an empty cache.
	const newCache: Partial<RemoteConfigFields> = { ...transformed, configuredApiKeys: configuredKeys }
	if (previousRemoteMCPServers !== undefined) {
		newCache.previousRemoteMCPServers = previousRemoteMCPServers
	}
	stateManager.replaceRemoteConfig(newCache)

	applyRemoteSyncQueueConfig(transformed)

	// era harness 减法：不再从 cline.bot 同步远端 MCP 服务器列表，也不再应用远端 OTEL 配置。
	// MCP 服务器完全由本地 mcp_settings.json 管理。
}

const isProviderValid = (provider?: ApiProvider, remoteConfig?: Partial<RemoteConfigFields>) => {
	const remoteConfiguredProviders =
		remoteConfig?.remoteConfiguredProviders ?? StateManager.get().getRemoteConfigSettings().remoteConfiguredProviders
	if (!remoteConfiguredProviders || !remoteConfiguredProviders.length) {
		return true
	}

	return provider && remoteConfiguredProviders.includes(provider)
}

/**
 * Receives a config and returns the subset of fields that can be overriden in the cache
 */
export function filterAllowedRemoteConfigFields(config: Partial<GlobalStateAndSettings>): Partial<GlobalStateAndSettings> {
	const updatedFields: Partial<GlobalStateAndSettings> = {}

	const actModeApiProvider = config.actModeApiProvider
	if (isProviderValid(actModeApiProvider)) {
		updatedFields.actModeApiProvider = actModeApiProvider
	}

	const planModeApiProvider = config.planModeApiProvider
	if (isProviderValid(planModeApiProvider)) {
		updatedFields.planModeApiProvider = planModeApiProvider
	}

	return updatedFields
}

const canDisableRemoteConfig = (_orgId: string) => {
	// era harness 减法：远端配置与组织体系已移除，无 admin/owner 概念
	return false
}

export const isRemoteConfigEnabled = (orgId: string) => {
	const stateManager = StateManager.get()
	const hasOptedOut = stateManager.getGlobalSettingsKey("optOutOfRemoteConfig")

	const isDisabled = hasOptedOut && canDisableRemoteConfig(orgId)

	return !isDisabled
}

import type { ApiConfiguration, ApiProvider } from "@shared/api"
import PROVIDERS from "@shared/providers/providers.json"
import type { RemoteConfigFields } from "@shared/storage/state-keys"

/**
 * Returns a list of API providers that are configured (have required credentials/settings)
 * Based on validation logic from validate.ts
 *
 * era harness: 仅保留 DeepSeek 与 OpenAI 兼容两种 provider，其余设定已随减法剥离。
 */
export function getConfiguredProviders(
	remoteConfig: Partial<RemoteConfigFields> | undefined,
	apiConfiguration: ApiConfiguration | undefined,
): ApiProvider[] {
	if (remoteConfig?.remoteConfiguredProviders?.length) {
		return remoteConfig.remoteConfiguredProviders
	}

	const configured: ApiProvider[] = []

	if (!apiConfiguration) {
		return configured
	}

	// DeepSeek - requires API key
	if (apiConfiguration.deepSeekApiKey) {
		configured.push("deepseek")
	}

	// Xiaomi MiMo - requires API key
	if (apiConfiguration.mimoApiKey) {
		configured.push("mimo")
	}

	// 智谱 BigModel（按量）- requires API key（此前漏判：填了 Key 也不被认作"已配置"）
	if (apiConfiguration.bigmodelApiKey) {
		configured.push("bigmodel")
	}

	// 智谱 GLM 套餐（Coding Plan）- 独立的套餐 Key，与按量互不通用
	if (apiConfiguration.bigmodelPlanApiKey) {
		configured.push("bigmodel-plan")
	}

	// OpenAI Compatible - requires base URL and API key, OR has model configured
	if (
		(apiConfiguration.openAiBaseUrl && apiConfiguration.openAiApiKey) ||
		apiConfiguration.planModeOpenAiModelId ||
		apiConfiguration.actModeOpenAiModelId
	) {
		configured.push("openai")
	}

	return configured
}

/**
 * Get provider display label from provider value
 * Uses the canonical providers.json as source of truth
 */
export function getProviderLabel(provider: ApiProvider): string {
	const providerEntry = PROVIDERS.list.find((p) => p.value === provider)
	return providerEntry?.label || provider
}

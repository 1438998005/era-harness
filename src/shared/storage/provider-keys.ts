// era harness 减法：仅保留 DeepSeek 与 OpenAI 兼容两种 provider 的模型 ID 键映射。
// 原 ProviderToApiKeyMap / ProviderDefaultModelMap 随其余 provider 一并移除（全仓无引用）。

import { SettingsKey } from "@shared/storage/state-keys"
import { ApiProvider } from "../api"

const ProviderKeyMap: Partial<Record<ApiProvider, string>> = {
	openai: "OpenAiModelId",
} as const

/**
 * Get the provider-specific model ID key for a given provider and mode.
 * era harness 中只有 OpenAI 兼容端点有独立键，其余（含 DeepSeek）用通用 apiModelId。
 */
export function getProviderModelIdKey(provider: ApiProvider, mode: "act" | "plan"): SettingsKey {
	const keySuffix = ProviderKeyMap[provider]
	if (keySuffix) {
		// E.g. actModeOpenAiModelId, planModeOpenAiModelId
		return `${mode}Mode${keySuffix}` as SettingsKey
	}

	return `${mode}ModeApiModelId`
}

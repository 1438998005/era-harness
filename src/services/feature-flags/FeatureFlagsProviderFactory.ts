import { Logger } from "@/shared/services/Logger"
import type { FeatureFlagsAndPayloads, IFeatureFlagsProvider } from "./providers/IFeatureFlagsProvider"

/**
 * era harness 减法：特性开关只保留本地 no-op 实现（恒返回空集），
 * 不再从 PostHog 拉取远端开关。
 */
export type FeatureFlagsProviderType = "no-op"

/**
 * Configuration for feature flags providers
 */
export interface FeatureFlagsProviderConfig {
	type: FeatureFlagsProviderType
}

/**
 * Factory class for creating feature flags providers
 */
export class FeatureFlagsProviderFactory {
	public static createProvider(_config?: FeatureFlagsProviderConfig): IFeatureFlagsProvider {
		return new NoOpFeatureFlagsProvider()
	}

	public static getDefaultConfig(): FeatureFlagsProviderConfig {
		return { type: "no-op" }
	}
}

/**
 * No-operation feature flags provider: 所有 flag 视为未开启。
 */
class NoOpFeatureFlagsProvider implements IFeatureFlagsProvider {
	async getAllFlagsAndPayloads(_: { flagKeys?: string[] }): Promise<FeatureFlagsAndPayloads | undefined> {
		return {}
	}

	public isEnabled(): boolean {
		return false
	}

	public getSettings() {
		return {
			enabled: false,
			timeout: 1000,
		}
	}

	public async dispose(): Promise<void> {
		Logger.info("[NoOpFeatureFlagsProvider] Disposing")
	}
}

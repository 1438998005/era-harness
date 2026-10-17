import { Logger } from "@/shared/services/Logger"
import { ClineError } from "./ClineError"
import { IErrorProvider } from "./providers/IErrorProvider"

/**
 * era harness 减法：错误只落本地日志，不再外联 PostHog。
 */
export type ErrorProviderType = "no-op"

/**
 * Configuration for error providers
 */
export interface ErrorProviderConfig {
	type: ErrorProviderType
}

/**
 * Factory class for creating error providers.
 * era harness 只保留本地 no-op 实现（错误写入扩展日志，不上报）。
 */
export class ErrorProviderFactory {
	public static async createProvider(_config?: ErrorProviderConfig): Promise<IErrorProvider> {
		return new NoOpErrorProvider()
	}

	public static getDefaultConfig(): ErrorProviderConfig {
		return { type: "no-op" }
	}
}

/**
 * No-operation error provider: 错误写入本地 Logger，不产生任何网络请求。
 */
class NoOpErrorProvider implements IErrorProvider {
	async captureException(error: Error | ClineError, properties?: Record<string, unknown>): Promise<void> {
		Logger.error("[NoOpErrorProvider] captureException called", { error: error.message || String(error), properties })
	}

	public logException(error: Error | ClineError, _properties?: Record<string, unknown>): void {
		// Use Logger.error directly to avoid potential infinite recursion through Logger
		Logger.error("[NoOpErrorProvider]", error.message || String(error))
	}

	public logMessage(
		message: string,
		level?: "error" | "warning" | "log" | "debug" | "info",
		properties?: Record<string, unknown>,
	): void {
		Logger.log("[NoOpErrorProvider]", { message, level, properties })
	}

	public isEnabled(): boolean {
		return true
	}

	public getSettings() {
		return {
			enabled: true,
			hostEnabled: true,
			level: "all" as const,
		}
	}

	public async dispose(): Promise<void> {
		Logger.info("[NoOpErrorProvider] Disposing")
	}
}

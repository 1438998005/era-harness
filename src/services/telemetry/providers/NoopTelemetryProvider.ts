import type { UserInfo } from "@/shared/UserInfo"
import type { ITelemetryProvider, TelemetryProperties, TelemetrySettings } from "./ITelemetryProvider"

/**
 * era harness 减法：本地 no-op 遥测 provider。
 *
 * 保留 ITelemetryProvider 接口（全部调用点零改动），但不上报任何数据：
 * PostHog / OpenTelemetry 整套外联实现已删除。
 */
export class NoopTelemetryProvider implements ITelemetryProvider {
	readonly name = "NoopTelemetryProvider"

	log(_event: string, _properties?: TelemetryProperties): void {
		// no-op：不发送任何事件
	}

	logRequired(_event: string, _properties?: TelemetryProperties): void {
		// no-op
	}

	identifyUser(_userInfo: UserInfo, _properties?: TelemetryProperties): void {
		// no-op：不关联任何用户身份
	}

	isEnabled(): boolean {
		return false
	}

	getSettings(): TelemetrySettings {
		return { hostEnabled: false, level: "off" }
	}

	recordCounter(
		_name: string,
		_value: number,
		_attributes?: TelemetryProperties,
		_description?: string,
		_required?: boolean,
	): void {
		// no-op
	}

	recordHistogram(
		_name: string,
		_value: number,
		_attributes?: TelemetryProperties,
		_description?: string,
		_required?: boolean,
	): void {
		// no-op
	}

	recordGauge(
		_name: string,
		_value: number | null,
		_attributes?: TelemetryProperties,
		_description?: string,
		_required?: boolean,
	): void {
		// no-op
	}

	async forceFlush(): Promise<void> {
		// no-op
	}

	async dispose(): Promise<void> {
		// no-op
	}
}

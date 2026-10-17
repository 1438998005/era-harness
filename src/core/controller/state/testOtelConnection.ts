import { EmptyRequest } from "@shared/proto/cline/common"
import { TestConnectionResult } from "@shared/proto/cline/state"
import { Controller } from ".."

/**
 * era harness 减法：OpenTelemetry 遥测已整体移除，此 RPC 仅保留协议兼容，
 * 恒定返回失败（设置界面中的 OTEL 配置项将在 webview 清理批次一并删除）。
 */
export async function testOtelConnection(_controller: Controller, _: EmptyRequest): Promise<TestConnectionResult> {
	return TestConnectionResult.create({
		success: false,
		error: "OpenTelemetry 遥测已在 era harness 本地版中移除",
	})
}

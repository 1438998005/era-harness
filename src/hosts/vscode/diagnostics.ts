/**
 * 诊断入口的命令实现（工作流 B3）：
 * - `eraHarness.openDiagnosticsFolder`：打开 `<globalStorage>/diagnostics`
 * - `eraHarness.exportDiagnostics`：导出单文件诊断包（环境 + 脱敏设置 + 最近审计）
 *
 * 只做 IO 与提示，审计内容的脱敏在 core/logging/audit-log-format.ts 统一负责。
 */
import fs from "node:fs/promises"
import os from "node:os"
import * as vscode from "vscode"
import { exportDiagnostics, getDiagnosticsDir } from "@/core/logging/auditLog"
import { StateManager } from "@/core/storage/StateManager"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { ShowMessageType } from "@/shared/proto/index.host"
import { Logger } from "@/shared/services/Logger"

/** 打开诊断目录（不存在就先建）。 */
export async function openDiagnosticsFolder(): Promise<void> {
	const dir = getDiagnosticsDir()
	await fs.mkdir(dir, { recursive: true })
	await vscode.env.openExternal(vscode.Uri.file(dir))
}

/**
 * 设置摘要：只写「是什么 / 有没有」，绝不写密钥值。
 * 任何一步取不到就跳过该项——诊断包宁可少写，也不能因为读设置失败而导不出来。
 */
function collectSettingsSummary(): Record<string, string> {
	try {
		const stateManager = StateManager.get()
		const api = stateManager.getApiConfiguration()
		const mode = stateManager.getGlobalSettingsKey("mode")
		const isPlan = mode === "plan"

		const provider = isPlan ? api.planModeApiProvider : api.actModeApiProvider
		const modelId =
			(isPlan ? api.planModeApiModelId : api.actModeApiModelId) ??
			(isPlan ? api.planModeOpenAiModelId : api.actModeOpenAiModelId) ??
			"(未设置)"
		const effort = (isPlan ? api.planModeReasoningEffort : api.actModeReasoningEffort) ?? "(默认)"
		const modelInfo = isPlan ? api.planModeOpenAiModelInfo : api.actModeOpenAiModelInfo

		const summary: Record<string, string> = {
			mode: String(mode),
			provider: String(provider ?? "unknown"),
			model: String(modelId),
			reasoningEffort: String(effort),
			temperature: modelInfo?.temperature !== undefined ? String(modelInfo.temperature) : "(默认)",
			openAiBaseUrl: api.openAiBaseUrl || "(默认)",
		}

		const secretKeys = ["openAiApiKey", "deepSeekApiKey", "ovhAiEndpointsApiKey", "apiKey"] as const
		for (const key of secretKeys) {
			try {
				summary[`${key}(是否有值)`] = stateManager.getSecretKey(key) ? "已设置" : "未设置"
			} catch {
				// 忽略单个密钥读取失败
			}
		}

		return summary
	} catch {
		return {}
	}
}

/** 导出诊断包并提示用户位置。 */
export async function exportDiagnosticsPackage(): Promise<void> {
	try {
		const result = await exportDiagnostics({
			extensionVersion: ExtensionRegistryInfo.version,
			platform: `${os.platform()} ${os.release()} (${os.arch()})`,
			vscodeVersion: vscode.version,
			settings: collectSettingsSummary(),
		})

		const answer = await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: `诊断包已生成：${result.filePath}（含最近 ${result.auditLineCount} 条操作记录，不含密钥）。`,
			options: { items: ["在资源管理器中显示"] },
		})
		if (answer.selectedOption === "在资源管理器中显示") {
			await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(result.filePath))
		}
	} catch (error) {
		Logger.error("[diagnostics] 导出诊断包失败：", error)
		await HostProvider.window.showMessage({
			type: ShowMessageType.ERROR,
			message: `导出诊断包失败：${error instanceof Error ? error.message : String(error)}`,
		})
	}
}

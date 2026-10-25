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
import { mimoBaseUrlForKey } from "@/shared/mimo-request"
import { ShowMessageType } from "@/shared/proto/index.host"
import { Logger } from "@/shared/services/Logger"
import { createOpenInOsDeps, openFolderInOs } from "./open-in-os"

/**
 * 打开诊断目录（不存在就先建）。
 *
 * 打开方式不直接用 `vscode.env.openExternal`：它在 Windows 上打开目录会失败且
 * 只 resolve(false)（详见 open-in-os.ts 顶部）。这里只负责「建目录 + 把失败如实告诉用户」。
 */
export async function openDiagnosticsFolder(): Promise<void> {
	const dir = getDiagnosticsDir()
	await fs.mkdir(dir, { recursive: true })

	const failure = await openFolderInOs(
		dir,
		// vscode 返回的是 Thenable 不是 Promise，这里包一层再交给判定
		createOpenInOsDeps(async (target) => await vscode.env.openExternal(vscode.Uri.file(target))),
	)
	if (!failure) {
		return
	}

	// 打不开也得把路径交出去：用户至少能自己粘到资源管理器地址栏，
	// 而不是像 3.91.3 那样只看到一个裸的「打开外部程序时出错」。
	Logger.error(`[diagnostics] 打开诊断目录失败（${failure}）：${dir}`)
	const answer = await HostProvider.window.showMessage({
		type: ShowMessageType.ERROR,
		message: `打不开诊断目录：${failure}。路径：${dir}`,
		options: { items: ["复制路径"] },
	})
	if (answer.selectedOption === "复制路径") {
		await vscode.env.clipboard.writeText(dir)
	}
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

		// D5（2026-10-25）：补各 provider 的**生效** baseUrl——方言表现强依赖请求路径
		// （08 #46：同一模型 id 在不同端点方言不同），只有 openAiBaseUrl 一个字段分不清
		// 「DS 官方端点」与「第三方兼容端点」的差异。只输出 URL，不碰任何密钥值。
		summary.deepSeekBaseUrl = "https://api.deepseek.com/v1（内置，不受 openAiBaseUrl 影响）"
		summary.freePool = "内置免费池（OVH+Kilo 车道，忽略自定义模型 id 与 baseUrl）"
		try {
			// MiMo 按密钥前缀选基址（实时 API / Token Plan）；无密钥时按默认基址标注
			const mimoKey = stateManager.getSecretKey("mimoApiKey")
			summary.mimoBaseUrl = `${mimoBaseUrlForKey(mimoKey)}（按密钥前缀推导）`
		} catch {
			// 忽略单个基址读取失败
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

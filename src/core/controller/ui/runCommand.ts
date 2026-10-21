import type { StringRequest } from "@shared/proto/cline/common"
import { Empty } from "@shared/proto/cline/common"
import * as vscode from "vscode"
import { Logger } from "@/shared/services/Logger"
import type { Controller } from "../index"

/**
 * Webview 按钮 → 扩展命令的唯一通道。
 *
 * 刻意不做「通用 executeCommand」：只放行设置页真正需要的命令，避免 webview 拿到任意命令执行权。
 * 新增命令时同时改这里与调用方（gate「命令注册一致性」只查声明⇄注册，不查白名单）。
 */
const ALLOWED_COMMANDS = new Set<string>([
	"eraHarness.erabasic.yieldToSasami",
	"eraHarness.erabasic.reclaimFiles",
	"era-harness.updateGame",
	"era-harness.checkForUpdates",
])

/**
 * Runs an allowlisted extension command from the webview.
 * @param controller The controller instance
 * @param request The command id to run
 * @returns Empty response
 */
export async function runCommand(_controller: Controller, request: StringRequest): Promise<Empty> {
	const command = request.value?.trim()
	if (!command || !ALLOWED_COMMANDS.has(command)) {
		Logger.error(`[runCommand] 拒绝执行未在允许列表里的命令：${command ?? "(空)"}`)
		throw new Error(`命令不在允许列表里：${command || "(空)"}`)
	}
	Logger.log(`[runCommand] ${command}`)
	await vscode.commands.executeCommand(command)
	return Empty.create({})
}

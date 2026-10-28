/**
 * 「eraTW 更新中心」面板宿主（F5，计划任务 D）。
 *
 * 设计是**增量旁路**：确认与执行仍走既有的模态框 + withProgress 流（安全闸门不变，
 * AI 依旧碰不到确认按钮），面板只做三件事——
 *   1. 镜像事件流（阶段 / 进度 / 当前文件）；
 *   2. 提供取消按钮（扩展侧在下一个事件边界安全停下，写入阶段的取消走整体回滚）；
 *   3. 展示结果（标题 / 明细 / 备份位置 / 合并与保留计数）。
 *
 * 面板加载失败（产物缺失等）绝不影响更新本身：createUpdatePanel 返回 null，
 * 调用方降级为纯通知——这正是「可视化」与「能更新」两件事的优先级。
 */

import fs from "node:fs/promises"
import type { UpdateEvent } from "@core/update/service"
import { Logger } from "@shared/services/Logger"
import * as vscode from "vscode"
import { ExtensionRegistryInfo } from "@/registry"

export interface UpdatePanelHandle {
	/** 推送事件 / 结果给面板；面板已关闭时静默丢弃 */
	post(payload: Record<string, unknown>): void
	/** 用户点了取消；调用方在下一个事件边界抛错安全停下 */
	readonly cancelled: boolean
	/**
	 * 结果态动作（#61）：面板结果态的「撤销这次更新 / 打开备份目录」按钮回调。
	 * 结果出来后由调用方按状态赋值；未赋值时面板点击静默忽略。
	 */
	readonly handlers: {
		undo?: () => void
		openBackup?: () => void
	}
	/** 推送最终结果（面板转为结果态，不自动关闭） */
	finish(input: {
		title: string
		lines: string[]
		backupDir?: string | null
		merged?: number
		kept?: number
		/** 仅 status==="applied" 时为 true：面板据此决定是否显示撤销按钮 */
		canUndo?: boolean
	}): void
	dispose(): void
}

export async function createUpdatePanel(rootLabel: string): Promise<UpdatePanelHandle | null> {
	try {
		const extension = vscode.extensions.getExtension(ExtensionRegistryInfo.id)
		if (!extension) {
			return null
		}
		const buildRoot = vscode.Uri.joinPath(extension.extensionUri, "webview-ui", "build")
		const htmlRaw = await fs.readFile(vscode.Uri.joinPath(buildRoot, "update-center.html").fsPath, "utf8")

		const panel = vscode.window.createWebviewPanel(
			"eraTWUpdateCenter",
			`eraTW 更新中心（${rootLabel}）`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [buildRoot],
			},
		)

		const resourceRoot = panel.webview.asWebviewUri(buildRoot).toString()
		panel.webview.html = htmlRaw
			.replace(/(src|href)="\.\/(.*?)"/g, (_match, attr: string, rel: string) => `${attr}="${resourceRoot}/${rel}"`)
			.replace(/__CSP_SOURCE__/g, panel.webview.cspSource)

		let cancelled = false
		const handlers: UpdatePanelHandle["handlers"] = {}
		panel.webview.onDidReceiveMessage((msg: unknown) => {
			const type = (msg as { type?: string })?.type
			if (type === "cancel") {
				cancelled = true
				return
			}
			if (type === "undo") {
				handlers.undo?.()
				return
			}
			if (type === "openBackup") {
				handlers.openBackup?.()
			}
		})

		return {
			post(payload: Record<string, unknown>): void {
				void Promise.resolve(panel.webview.postMessage(payload)).catch(() => {})
			},
			get cancelled(): boolean {
				return cancelled
			},
			handlers,
			finish(input: {
				title: string
				lines: string[]
				backupDir?: string | null
				merged?: number
				kept?: number
				canUndo?: boolean
			}): void {
				void Promise.resolve(panel.webview.postMessage({ type: "result", ...input })).catch(() => {})
			},
			dispose(): void {
				panel.dispose()
			},
		}
	} catch (error) {
		Logger.warn(`[update] 更新中心面板加载失败，降级为纯通知：${error instanceof Error ? error.message : error}`)
		return null
	}
}

/** 把 UpdateEvent 转成面板消息（阶段码翻译回人话的映射表与 updateGame.ts 同源需求，这里独立一份小表） */
export function panelEventPayload(event: UpdateEvent): Record<string, unknown> {
	return { type: "event", stage: event.stage, message: event.message, progress: event.progress }
}

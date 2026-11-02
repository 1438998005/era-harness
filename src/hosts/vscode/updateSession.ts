/**
 * 更新会话的宿主侧登记（08 #179）。
 *
 * 两件事：
 * 1. 把「正在跑的那场更新合并对话」的 taskId 记下来——内存 + 落盘 sidecar
 *    （`<gameRoot>/.era-harness/update-session.json`，与 `update-state.json` 同目录，
 *    该目录本来就被更新扫描排除）；
 * 2. 提供「回到更新现场」命令：任务还活着就只聚焦侧栏，**绝不** `initTask`（会 abort 掉它）。
 *
 * 重载窗口后内存态丢失 → 状态栏项不显示；此时命令读 sidecar，如实告诉用户「上次更新已中断」，
 * 不假装能续。
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { sendChatButtonClickedEvent } from "@core/controller/ui/subscribeToChatButtonClicked"
import { Logger } from "@shared/services/Logger"
import { decideUpdateReturn, parseUpdateSessionRecord, type UpdateSessionRecord } from "@shared/updateSession"
import * as vscode from "vscode"
import type { Controller } from "@/core/controller"
import { ExtensionRegistryInfo } from "@/registry"

const STATE_DIR = ".era-harness"
const SESSION_FILE = "update-session.json"

/** 只反映「当前进程里还活着」的那一场更新；重载后为 undefined */
let active: UpdateSessionRecord | undefined
let statusItem: vscode.StatusBarItem | undefined

function sessionPath(root: string): string {
	// 游戏根常常是工作区里的子目录（`<workspace>/eratw-sub-modding-main`）。sidecar 必须落在
	// **工作区根**下，重载后才能靠「扫 workspaceFolders」找到；直接写进游戏根会找不到。
	const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(root))
	const base = folder?.uri.fsPath ?? root
	return path.join(base, STATE_DIR, SESSION_FILE)
}

function ensureStatusItem(): vscode.StatusBarItem {
	if (!statusItem) {
		statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
		statusItem.text = "$(sync~spin) 更新进行中"
		statusItem.tooltip = "点这里回到进行中的更新对话"
		statusItem.command = ExtensionRegistryInfo.commands.ReturnToUpdate
	}
	return statusItem
}

/** 合并对话开起来之后调用（`mergeTask.ts`） */
export async function beginUpdateSession(input: { taskId: string; root: string }): Promise<void> {
	active = { taskId: input.taskId, root: input.root, startedAt: new Date().toISOString() }
	ensureStatusItem().show()
	try {
		const file = sessionPath(input.root)
		await fs.mkdir(path.dirname(file), { recursive: true })
		await fs.writeFile(file, JSON.stringify(active, null, 2), "utf8")
	} catch (error) {
		// 落盘失败只影响「重载后能不能诚实告知」，不能影响更新本身
		Logger.warn(`[update] 更新会话落盘失败（不影响更新）：${error}`)
	}
}

/** 合并对话结束时调用；传 taskId 时只清自己那条，避免误清后来的一场 */
export async function endUpdateSession(taskId?: string): Promise<void> {
	if (taskId && active && active.taskId !== taskId) {
		return
	}
	const root = active?.root
	active = undefined
	statusItem?.hide()
	if (!root) {
		return
	}
	try {
		await fs.rm(sessionPath(root), { force: true })
	} catch {
		// 删不掉就留着；下次开始更新会覆盖
	}
}

export function getActiveUpdateSession(): UpdateSessionRecord | undefined {
	return active
}

/** 内存优先；否则扫各工作区根下的 sidecar（用于重载后的诚实告知） */
export async function readUpdateSession(): Promise<UpdateSessionRecord | undefined> {
	if (active) {
		return active
	}
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		try {
			const raw = JSON.parse(await fs.readFile(sessionPath(folder.uri.fsPath), "utf8")) as unknown
			const record = parseUpdateSessionRecord(raw)
			if (record) {
				return record
			}
		} catch {
			// 没有就继续看下一个根
		}
	}
	return undefined
}

/**
 * 命令入口：`era-harness.returnToUpdate`。
 *
 * 状态栏项与命令面板共用这一条。三种非空结果都要说人话，且**不重置任何任务状态**。
 */
export async function returnToUpdateCommand(controller?: Controller): Promise<void> {
	const record = await readUpdateSession()
	if (!record) {
		await vscode.window.showInformationMessage("现在没有进行中的更新。")
		return
	}

	const historyIds = (controller?.stateManager.getGlobalStateKey("taskHistory") ?? []).map((item) => item.id)
	const action = decideUpdateReturn({
		record,
		currentTaskId: controller?.task?.taskId,
		historyIds,
	})

	if (action === "focus") {
		await focusSidebar()
		return
	}

	if (action === "interrupted") {
		await vscode.window.showInformationMessage(
			"上次更新对话已中断（重载窗口会结束对话）。可以在任务历史里找到它，或重新发起更新。",
		)
		return
	}

	// resume：恢复那场对话会 abort 当前任务，必须先问
	const choice = await vscode.window.showWarningMessage(
		"要切回那场更新对话吗？",
		{ modal: true, detail: "当前正在进行的对话会被收起（任务中止）。" },
		"切回去",
		"取消",
	)
	if (choice !== "切回去") {
		return
	}
	try {
		await controller?.reinitExistingTaskFromId(record.taskId)
		await sendChatButtonClickedEvent()
		await focusSidebar()
	} catch (error) {
		await vscode.window.showErrorMessage(`没能切回更新对话：${error instanceof Error ? error.message : String(error)}`)
	}
}

async function focusSidebar(): Promise<void> {
	try {
		await vscode.commands.executeCommand(`${ExtensionRegistryInfo.views.Sidebar}.focus`)
	} catch (error) {
		Logger.warn(`[update] 聚焦侧栏失败：${error}`)
	}
}

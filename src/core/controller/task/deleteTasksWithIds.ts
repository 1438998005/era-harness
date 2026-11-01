import { Empty, StringArrayRequest } from "@shared/proto/cline/common"
import fs from "fs/promises"
import { HostProvider } from "@/hosts/host-provider"
import { ShowMessageType } from "@/shared/proto/host/window"
import { Logger } from "@/shared/services/Logger"
import { Controller } from ".."

/**
 * Deletes tasks with the specified IDs
 * @param controller The controller instance
 * @param request The request containing an array of task IDs to delete
 * @returns Empty response
 * @throws Error if operation fails
 */
export async function deleteTasksWithIds(controller: Controller, request: StringArrayRequest): Promise<Empty> {
	if (!request.value || request.value.length === 0) {
		throw new Error("Missing task IDs")
	}

	const taskCount = request.value.length
	const message =
		taskCount === 1
			? "确定要删除这条对话记录吗？删除后无法恢复。"
			: `确定要删除这 ${taskCount} 条对话记录吗？删除后无法恢复。`

	const confirmLabel = "删除"
	const userChoice = await HostProvider.window.showMessage({
		type: ShowMessageType.WARNING,
		message,
		options: { modal: true, items: [confirmLabel] },
	})

	if (userChoice.selectedOption !== confirmLabel) {
		return Empty.create()
	}

	for (const id of request.value) {
		await deleteTaskWithId(controller, id)
	}

	return Empty.create()
}

/**
 * Deletes a single task with the specified ID
 * @param controller The controller instance
 * @param id The task ID to delete
 */
async function deleteTaskWithId(controller: Controller, id: string): Promise<void> {
	try {
		// Clear current task if it matches the ID being deleted
		if (id === controller.task?.taskId) {
			await controller.clearTask()
			Logger.debug("cleared task")
		}

		// Get task file paths
		const { taskDirPath, apiConversationHistoryFilePath, uiMessagesFilePath, contextHistoryFilePath, taskMetadataFilePath } =
			await controller.getTaskWithId(id)

		// Remove task from state
		await controller.deleteTaskFromState(id)

		// Delete the task files
		for (const filePath of [
			apiConversationHistoryFilePath,
			uiMessagesFilePath,
			contextHistoryFilePath,
			taskMetadataFilePath,
		]) {
			await fs.rm(filePath, { force: true })
		}

		// Remove empty task directory
		try {
			await fs.rmdir(taskDirPath) // succeeds if the dir is empty
		} catch (error) {
			Logger.debug("Could not remove task directory (may not be empty):", error)
		}

		// #170：原来「本窗口历史删光就 rm 全局 tasks/checkpoints 目录」——这两个
		// 目录是跨窗口共享的（StateManager 是每窗口独立缓存），窗口 A 删光自己可见
		// 的历史时，窗口 B 正在跑的任务的数据和影子 git 会被整体删掉。per-task 的
		// 文件清理上面已经完成；全量清理只走 deleteAllTaskHistory 的显式动作
		// （且已收敛到本窗口范围），这里不再做任何全局 rm。
	} catch (error) {
		Logger.debug(`Error deleting task ${id}:`, error)
		throw error // Re-throw to let caller handle the error
	}

	// Update webview state
	await controller.postStateToWebview()
}

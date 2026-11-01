import { DeleteAllTaskHistoryCount } from "@shared/proto/cline/task"
import fs from "fs/promises"
import path from "path"
import { HostProvider } from "@/hosts/host-provider"
import { hashWorkingDir } from "@/integrations/checkpoints/CheckpointUtils"
import { ShowMessageRequest, ShowMessageType } from "@/shared/proto/host/window"
import { Logger } from "@/shared/services/Logger"
import { fileExistsAtPath } from "../../../utils/fs"
import { Controller } from ".."

/**
 * Deletes all task history, with an option to preserve favorites
 * @param controller The controller instance
 * @param request Request with option to preserve favorites
 * @returns Results with count of deleted tasks
 */
export async function deleteAllTaskHistory(controller: Controller): Promise<DeleteAllTaskHistoryCount> {
	try {
		// Clear current task first
		await controller.clearTask()

		// Get existing task history
		const taskHistory = controller.stateManager.getGlobalStateKey("taskHistory")
		const totalTasks = taskHistory.length

		const userChoice = (
			await HostProvider.window.showMessage(
				ShowMessageRequest.create({
					type: ShowMessageType.WARNING,
					message: "What would you like to delete?",
					options: {
						modal: true,
						items: ["Delete All Except Favorites", "Delete Everything"],
					},
				}),
			)
		).selectedOption

		// Default VS Code Cancel button returns `undefined` - don't delete anything
		if (userChoice === undefined) {
			return DeleteAllTaskHistoryCount.create({
				tasksDeleted: 0,
			})
		}

		// If preserving favorites, filter out non-favorites
		if (userChoice === "Delete All Except Favorites") {
			const favoritedTasks = taskHistory.filter((task) => task.isFavorited === true)

			// If there are favorited tasks, update state
			if (favoritedTasks.length > 0) {
				controller.stateManager.setGlobalState("taskHistory", favoritedTasks)

				// Delete non-favorited task directories
				const preserveTaskIds = favoritedTasks.map((task) => task.id)
				await cleanupTaskFiles(preserveTaskIds)

				// Update webview
				try {
					await controller.postStateToWebview()
				} catch (webviewErr) {
					Logger.error("Error posting to webview:", webviewErr)
				}

				return DeleteAllTaskHistoryCount.create({
					tasksDeleted: totalTasks - favoritedTasks.length,
				})
			} else {
				// No favorited tasks found - show warning and ask user what to do
				const answer = (
					await HostProvider.window.showMessage({
						type: ShowMessageType.WARNING,
						message: "No favorited tasks found. Would you like to delete all tasks anyway?",
						options: {
							modal: true,
							items: ["Delete All Tasks"],
						},
					})
				).selectedOption

				// User cancelled - don't delete anything
				if (answer === undefined) {
					return DeleteAllTaskHistoryCount.create({
						tasksDeleted: 0,
					})
				}
				// If user chose "Delete All Tasks", fall through to the `delete everything` section below
			}
		}

		// Delete everything (not preserving favorites)
		// #170：先快照本窗口的 task id——state 清空之后就查不到了。
		const taskIds = taskHistory.map((task) => task.id)
		controller.stateManager.setGlobalState("taskHistory", [])

		try {
			// #170：原来直接 rm 全局 tasks/ 目录——globalStorage 跨窗口共享，别的
			// 窗口正在跑的任务数据会被一并删掉。只删本窗口 taskHistory 里出现过的 id。
			const taskDirPath = path.join(HostProvider.get().globalStorageFsPath, "tasks")
			for (const id of taskIds) {
				const taskDir = path.join(taskDirPath, id)
				if (await fileExistsAtPath(taskDir)) {
					await fs.rm(taskDir, { recursive: true, force: true })
				}
			}

			// #170：checkpoints 同理收敛——按本工作区 hash 删（与 CheckpointTracker
			// 初始化时的 workingDir/hash 同源：getWorkspacePaths()[0]），别的窗口、
			// 别的工程的影子 git 不动。
			const workspacePaths = await HostProvider.workspace.getWorkspacePaths({})
			const firstWorkspacePath = workspacePaths.paths[0]
			if (firstWorkspacePath) {
				const cwdHash = hashWorkingDir(firstWorkspacePath)
				const workspaceCheckpointsDir = path.join(HostProvider.get().globalStorageFsPath, "checkpoints", cwdHash)
				if (await fileExistsAtPath(workspaceCheckpointsDir)) {
					await fs.rm(workspaceCheckpointsDir, { recursive: true, force: true })
				}
			}
		} catch (error) {
			HostProvider.window.showMessage({
				type: ShowMessageType.ERROR,
				message: `Encountered error while deleting task history, there may be some files left behind. Error: ${error instanceof Error ? error.message : String(error)}`,
			})
		}

		// Update webview
		try {
			await controller.postStateToWebview()
		} catch (webviewErr) {
			Logger.error("Error posting to webview:", webviewErr)
		}

		return DeleteAllTaskHistoryCount.create({
			tasksDeleted: totalTasks,
		})
	} catch (error) {
		Logger.error("Error in deleteAllTaskHistory:", error)
		throw error
	}
}

/**
 * Helper function to cleanup task files while preserving specified tasks
 */
async function cleanupTaskFiles(preserveTaskIds: string[]) {
	const taskDirPath = path.join(HostProvider.get().globalStorageFsPath, "tasks")

	try {
		if (await fileExistsAtPath(taskDirPath)) {
			const taskDirs = await fs.readdir(taskDirPath)
			Logger.debug(`[cleanupTaskFiles] Found ${taskDirs.length} task directories`)

			// Delete only non-preserved task directories
			for (const dir of taskDirs) {
				if (!preserveTaskIds.includes(dir)) {
					// Task dir path is not workspace specific
					await fs.rm(path.join(taskDirPath, dir), {
						recursive: true,
						force: true,
					})
				}
			}
		}
	} catch (error) {
		Logger.error("Error cleaning up task files:", error)
	}

	return true
}

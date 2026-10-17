import type { WorkspaceRoot } from "@shared/multi-root/types"
import { HostProvider } from "@/hosts/host-provider"
import { telemetryService } from "@/services/telemetry"
import type { HistoryItem } from "@/shared/HistoryItem"
import { ShowMessageType } from "@/shared/proto/host/window"
import { Logger } from "@/shared/services/Logger"
import { getCwd } from "@/utils/path"
import { StateManager } from "../storage/StateManager"
import { isMultiRootEnabled } from "./multi-root-utils"
import { WorkspaceRootManager } from "./WorkspaceRootManager"

type DetectRoots = () => Promise<WorkspaceRoot[]>

/**
 * Initializes and persists the WorkspaceRootManager (multi-root or single-root),
 * emits telemetry, and handles fallback on error.
 *
 * The caller injects detectRoots to avoid tight coupling to Controller.
 */
export async function setupWorkspaceManager({
	stateManager,
	detectRoots,
}: {
	stateManager: StateManager
	historyItem?: HistoryItem
	detectRoots: DetectRoots
}): Promise<WorkspaceRootManager> {
	// 没有打开文件夹时 cwd 为空 —— 不再退回桌面目录，直接按「无工作区」处理
	const cwd = await getCwd("")
	const startTime = performance.now()
	const multiRootEnabled = isMultiRootEnabled(stateManager)
	try {
		let manager: WorkspaceRootManager
		// Multi-root mode condition - requires both feature flag and user setting to be enabled
		if (multiRootEnabled) {
			// Multi-root: detect workspace folders
			const roots = await detectRoots()
			manager = new WorkspaceRootManager(roots, 0)
			Logger.log(`[WorkspaceManager] Multi-root mode: ${roots.length} roots detected`)

			// Telemetry
			telemetryService.captureWorkspaceInitialized(
				roots.length,
				roots.map((r) => r.vcs.toString()),
				performance.now() - startTime,
				true,
			)

			// Persist
			stateManager.setGlobalState("workspaceRoots", manager.getRoots())
			stateManager.setGlobalState("primaryRootIndex", manager.getPrimaryIndex())
			return manager
		}

		// Single-root mode code for when we actually start using workspacerootmanager
		// if (historyItem) {
		// 	const savedRoots = stateManager.getWorkspaceRoots()
		// 	if (savedRoots && savedRoots.length > 0) {
		// 		const primaryIndex = stateManager.getPrimaryRootIndex()
		// 		manager = new WorkspaceRootManager(savedRoots, primaryIndex)
		// 		Logger.log(`[WorkspaceManager] Restored ${savedRoots.length} roots from state`)
		// 		telemetryService.captureWorkspaceInitialized(
		// 			savedRoots.length,
		// 			savedRoots.map((r) => r.vcs.toString()),
		// 			performance.now() - startTime,
		// 			false,
		// 		)
		// 	} else {
		// 		manager = await WorkspaceRootManager.fromLegacyCwd(cwd)
		// 		telemetryService.captureWorkspaceInitialized(
		// 			1,
		// 			[manager.getRoots()[0].vcs.toString()],
		// 			performance.now() - startTime,
		// 			false,
		// 		)
		// 	}
		// }

		if (!cwd) {
			// 未打开文件夹：不伪造工作区根，避免模型在用户不知情的目录里读写
			stateManager.setGlobalState("workspaceRoots", [])
			stateManager.setGlobalState("primaryRootIndex", 0)
			Logger.log("[WorkspaceManager] No workspace folder opened")
			return new WorkspaceRootManager([], 0)
		}

		manager = await WorkspaceRootManager.fromLegacyCwd(cwd)
		telemetryService.captureWorkspaceInitialized(
			1,
			[manager.getRoots()[0].vcs.toString()],
			performance.now() - startTime,
			false,
		)

		Logger.log(`[WorkspaceManager] Single-root mode: ${cwd}`)
		const roots = manager.getRoots()
		stateManager.setGlobalState("workspaceRoots", roots)
		stateManager.setGlobalState("primaryRootIndex", manager.getPrimaryIndex())
		return manager
	} catch (error) {
		// Telemetry + graceful fallback to single-root from cwd
		const workspaceCount = (await HostProvider.workspace.getWorkspacePaths({})).paths?.length
		telemetryService.captureWorkspaceInitError(error as Error, true, workspaceCount)

		Logger.error("[WorkspaceManager] Initialization failed:", error)
		if (!cwd) {
			stateManager.setGlobalState("workspaceRoots", [])
			stateManager.setGlobalState("primaryRootIndex", 0)
			return new WorkspaceRootManager([], 0)
		}
		const manager = await WorkspaceRootManager.fromLegacyCwd(cwd)
		const roots = manager.getRoots()
		stateManager.setGlobalState("workspaceRoots", roots)
		stateManager.setGlobalState("primaryRootIndex", manager.getPrimaryIndex())

		HostProvider.window.showMessage({
			type: ShowMessageType.WARNING,
			message: "工作区初始化失败，已退回单文件夹模式。",
		})
		return manager
	}
}

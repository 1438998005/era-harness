import { Empty } from "@shared/proto/cline/common"
import { AutoApprovalSettingsRequest } from "@shared/proto/cline/state"
import { Logger } from "@shared/services/Logger"
import { Controller } from ".."

/**
 * Updates the auto approval settings
 * @param controller The controller instance
 * @param request The auto approval settings request
 * @returns Empty response
 */
export async function updateAutoApprovalSettings(controller: Controller, request: AutoApprovalSettingsRequest): Promise<Empty> {
	const currentSettings = (await controller.getStateToPostToWebview()).autoApprovalSettings
	const incomingVersion = request.version
	const currentVersion = currentSettings?.version ?? 1

	// Only update if incoming version is higher
	if (incomingVersion > currentVersion) {
		// Merge with current settings to preserve unspecified fields
		const settings = {
			...currentSettings,
			...(request.version !== undefined && { version: request.version }),
			...(request.enableNotifications !== undefined && {
				enableNotifications: request.enableNotifications,
			}),
			actions: {
				...currentSettings.actions,
				...(request.actions
					? Object.fromEntries(Object.entries(request.actions).filter(([_, v]) => v !== undefined))
					: {}),
			},
		}

		controller.stateManager.setGlobalState("autoApprovalSettings", settings)

		await controller.postStateToWebview()
	} else {
		// 版本不高于当前：说明这份请求来自过期的界面状态（另一个窗口还停在旧版本）。
		// 以前这里静默丢弃，但 webview 已经把勾选框画成了新值——用户以为保存了，实际后端没变。
		// 把真实状态推回去，让界面回弹到后端的事实；同时留一行日志，别让排查扑空。
		Logger.warn(`[autoApproval] 忽略过期设置：incoming=${incomingVersion} current=${currentVersion}`)
		await controller.postStateToWebview()
	}

	return Empty.create()
}

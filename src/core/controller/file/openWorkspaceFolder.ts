import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { HostProvider } from "@/hosts/host-provider"
import { Logger } from "@/shared/services/Logger"
import { Controller } from ".."

/**
 * 弹出系统文件夹选择器，把选中的目录打开为工作区。
 *
 * era harness 只读写用户打开的文件夹，所以「尚未打开工作区」提示条需要一个
 * 能直接动手的入口，而不是只让用户自己去找菜单。
 */
export async function openWorkspaceFolder(_controller: Controller, _request: EmptyRequest): Promise<Empty> {
	try {
		const selected = await HostProvider.window.showOpenDialogue({
			canSelectMany: false,
			openLabel: "打开为工作区",
		})
		const folder = selected.paths?.[0]
		if (!folder) {
			return Empty.create()
		}
		await HostProvider.workspace.openFolder({ path: folder, newWindow: false })
	} catch (error) {
		Logger.error("Failed to open workspace folder:", error)
	}
	return Empty.create()
}

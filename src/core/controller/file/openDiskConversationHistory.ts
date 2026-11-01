import { openFile as openFileIntegration } from "@integrations/misc/open-file"
import { Empty, StringRequest } from "@shared/proto/cline/common"
import path from "path"
import { HostProvider } from "@/hosts/host-provider"
import { Controller } from ".."

/**
 * 任务号形状白名单（#136）：request.value 来自 webview，直接拼进 globalStorage
 * 路径，`../` 能逃出 tasks 目录。任务号是 ULID/uuid 形状，只放行字母数字与连字符。
 */
const TASK_ID_PATTERN = /^[\w-]+$/

/**
 * Opens a file in the editor
 * @param controller The controller instance
 * @param request The request message containing the file path in the 'value' field
 * @returns Empty response
 */
export async function openDiskConversationHistory(_controller: Controller, request: StringRequest): Promise<Empty> {
	if (!request.value || !TASK_ID_PATTERN.test(request.value)) {
		return Empty.create()
	}
	const globalStoragePath = HostProvider.get().globalStorageFsPath
	const taskConversationHistoryPath = path.join(globalStoragePath, "tasks", request.value, "api_conversation_history.json")
	openFileIntegration(taskConversationHistoryPath)
	return Empty.create()
}

import type { Controller } from "@/core/controller"
import { Logger } from "@/shared/services/Logger"

/**
 * era harness 减法：远端配置（cline.bot remote config）已整体移除。
 *
 * 上游行为：带认证 token 每小时轮询 API，拉取全局规则 / 工作流 / skills /
 * API key / 遥测配置 / MCP 服务器列表。本地版这些配置全部来自本地文件与设置项，
 * 因此该函数保留签名但不再产生任何网络请求（调用点零改动）。
 */
export async function fetchRemoteConfig(_controller: Controller): Promise<void> {
	Logger.debug("[RemoteConfig] 远端配置拉取已在 era harness 本地版中移除")
}

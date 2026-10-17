import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { Logger } from "@/shared/services/Logger"
import { Controller } from ".."

/**
 * era harness 减法：Hicap（dashboard.hicap.ai）账号登录已移除。
 * RPC 保留仅为协议兼容；provider 与设置界面将在批次 3/4 一并删除。
 */
export async function hicapAuthClicked(_: Controller, __: EmptyRequest): Promise<Empty> {
	Logger.warn("hicapAuthClicked: Hicap 登录已在 era harness 本地版中移除")
	return {}
}

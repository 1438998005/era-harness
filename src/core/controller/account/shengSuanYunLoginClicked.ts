import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { Logger } from "@/shared/services/Logger"
import { Controller } from ".."

/**
 * era harness 减法：胜算云（router.shengsuanyun.com）账号登录已移除。
 * RPC 保留仅为协议兼容；provider 与设置界面将在批次 3/4 一并删除。
 */
export async function shengSuanYunLoginClicked(_: Controller, __: EmptyRequest): Promise<Empty> {
	Logger.warn("shengSuanYunLoginClicked: 胜算云登录已在 era harness 本地版中移除")
	return {}
}

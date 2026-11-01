/**
 * 命令闸的单一入口（#134）。
 *
 * 为什么抽出来：三道闸（CLINE_COMMAND_PERMISSIONS / clineignore / 子代理只读）
 * 原来只存在于 ExecuteCommandToolHandler，而 attempt_completion 携带的 command
 * 走 `config.callbacks.executeCommandTool` 直达 CommandExecutor（下游零校验），
 * 完全不经过 handler——yolo 下静默执行，用户配置的拒绝策略被跨通道旁路。
 * 两条命令通道必须共用同一套闸，否则判据必然漂移（#94/#113 的教训）。
 *
 * 可测性说明：本模块 import formatResponse（经 responses.ts 传递依赖
 * ClineIgnoreController → vscode），进不了默认 SPECS 的运行时——接线正确性由
 * subagent-command-guard.spec 的源码级顺序断言锁住（与 #101 的 wiring spec 同款）。
 */

import { formatResponse } from "@core/prompts/responses"
import type { ToolResponse } from "../task"
import type { TaskConfig } from "../task/tools/types/TaskConfig"
import { isSubagentCommandAllowed } from "./SubagentCommandGuard"

/**
 * 依次执行三道命令闸；返回 `undefined` 表示放行，返回 ToolResponse 表示拒绝
 * （调用方直接 `return` 它，不要继续执行命令）。
 *
 * 文案与 ExecuteCommandToolHandler 原实现逐字一致——两个通道的用户可见行为必须相同。
 */
export async function runCommandGates(config: TaskConfig, command: string): Promise<ToolResponse | undefined> {
	// 1. CLINE_COMMAND_PERMISSIONS（环境变量配置的 allow/deny 白名单）
	const permissionResult = config.services.commandPermissionController.validateCommand(command)
	if (!permissionResult.allowed) {
		let errorMessage: string
		if (permissionResult.failedSegment) {
			errorMessage =
				`Command "${command}" was denied by CLINE_COMMAND_PERMISSIONS. ` +
				`Segment "${permissionResult.failedSegment}" ${permissionResult.reason}.`
		} else {
			const matchedPattern = permissionResult.matchedPattern ? ` (matched pattern: ${permissionResult.matchedPattern})` : ""
			errorMessage =
				`Command "${command}" was denied by CLINE_COMMAND_PERMISSIONS. ` +
				`Reason: ${permissionResult.reason}${matchedPattern}`
		}
		if (!config.isSubagentExecution) {
			await config.callbacks.say("command_permission_denied", errorMessage)
		}
		return formatResponse.toolError(formatResponse.permissionDeniedError(errorMessage))
	}

	// 2. clineignore：命令不得触碰被 ignore 的文件
	const ignoredFileAttemptedToAccess = config.services.clineIgnoreController.validateCommand(command)
	if (ignoredFileAttemptedToAccess) {
		if (!config.isSubagentExecution) {
			await config.callbacks.say("clineignore_error", ignoredFileAttemptedToAccess)
		}
		return formatResponse.toolError(formatResponse.clineIgnoreError(ignoredFileAttemptedToAccess))
	}

	// 3. 子代理只读闸（#112）：子代理没有审批通道（ToolResultUtils 直接放行、
	// 调用方的 auto-approve 分支在 isSubagentExecution 时短路），shell 能力必须
	// 硬收敛到只读集合，不能靠提示词那句 "Only use ... readonly"。
	if (config.isSubagentExecution) {
		const verdict = isSubagentCommandAllowed(command)
		if (!verdict.allowed) {
			return formatResponse.toolError(
				`子代理只允许执行只读命令。命令 "${command}" 被拒绝：${verdict.reason}` +
					(verdict.segment ? `（片段：${verdict.segment}）` : "") +
					"。需要写操作请回到主对话执行。",
			)
		}
	}

	return undefined
}

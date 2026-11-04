import type Anthropic from "@anthropic-ai/sdk"
import type { ToolUse } from "@core/assistant-message"
import { getHookModelContext } from "@core/hooks/hook-model-context"
import { getHooksEnabledSafe } from "@core/hooks/hooks-utils"
import * as NotificationHook from "@core/hooks/notification-hook"
import { notifyKnowledgeBaseBuildFinished } from "@core/knowledge/knowledgeBaseBuildTracker"
import { maybeSuggestKnowledgeBaseIncrement } from "@core/knowledge/knowledgeBaseHint"
import { runCommandGates } from "@core/permissions/commandGates"
import { formatResponse } from "@core/prompts/responses"
import { processFilesIntoText } from "@integrations/misc/extract-text"
import { showSystemNotification } from "@integrations/notifications"
import { telemetryService } from "@services/telemetry"
import { findLastIndex } from "@shared/array"
import { COMPLETION_RESULT_CHANGES_FLAG } from "@shared/ExtensionMessage"
import { Logger } from "@shared/services/Logger"
import { ClineDefaultTool } from "@shared/tools"
import { isAskPromiseIgnoredError, shouldSkipDuplicateCompletionResult } from "../../ask-race"
import type { ToolResponse } from "../../index"
import { showNotificationForApproval } from "../../utils"
import { buildUserFeedbackContent } from "../../utils/buildUserFeedbackContent"
import type { IPartialBlockHandler, IToolHandler } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { getTaskCompletionTelemetry } from "../utils"
import { ToolResultUtils } from "../utils/ToolResultUtils"

const TASK_PREVIEW_MAX_CHARS = 8000

function getInitialTaskPreview(config: TaskConfig): string | undefined {
	const firstTaskMessage = config.messageState
		.getClineMessages()
		.find((message) => message.say === "task")
		?.text?.trim()
	if (!firstTaskMessage) {
		return undefined
	}
	if (firstTaskMessage.length <= TASK_PREVIEW_MAX_CHARS) {
		return firstTaskMessage
	}
	return `${firstTaskMessage.slice(0, TASK_PREVIEW_MAX_CHARS)}\n...[truncated]`
}

export class AttemptCompletionHandler implements IToolHandler, IPartialBlockHandler {
	readonly name = ClineDefaultTool.ATTEMPT

	getDescription(block: ToolUse): string {
		return `[${block.name}]`
	}

	/**
	 * Handle partial block streaming for attempt_completion
	 */
	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const result = uiHelpers.removeClosingTag(block, "result", block.params.result)
		if (result) {
			await uiHelpers.say("completion_result", result, undefined, undefined, block.partial)
		}
		// We will handle command in the final execution step
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const result: string | undefined = block.params.result
		const command: string | undefined = block.params.command

		// Validate required parameters
		if (!result) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "result")
		}

		config.taskState.consecutiveMistakeCount = 0

		// Double-check completion: reject attempt_completion calls that haven't been re-verified
		if (config.doubleCheckCompletionEnabled && !config.taskState.doubleCheckCompletionPending) {
			config.taskState.doubleCheckCompletionPending = true
			// Remove the partial completion_result message that was shown during streaming
			await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "completion_result")

			const taskPreview = getInitialTaskPreview(config)
			const taskSection = taskPreview ? `\n\n<initial_task>\n${taskPreview}\n</initial_task>` : ""

			// 这是流程控制（要求模型再核对一遍），不是工具失败：用普通 tool result 返回。
			// 用 toolError 会让 doubleCheckCompletionEnabled 一开就在审计里稳定出现 error。
			return (
				"Before completing, re-verify your work against the original task requirements. Check that:\n" +
				"1. All requested changes have been made\n" +
				"2. No steps were skipped or partially completed\n" +
				"3. Edge cases and error handling are addressed\n" +
				"4. The solution matches what was asked for, not just what was convenient\n" +
				"5. Output files contain exactly what was specified--no extra columns, fields, debug output, or commentary\n" +
				"6. If the task specifies numerical thresholds or accuracy targets, verify your result meets the criteria. If close but not passing, iterate rather than declaring completion" +
				taskSection +
				"\n\nIf everything checks out, call attempt_completion again with your final result."
			)
		}
		// Reset so the next attempt_completion pair triggers double-check again
		config.taskState.doubleCheckCompletionPending = false

		// Run PreToolUse hook before execution
		try {
			const { ToolHookUtils } = await import("../utils/ToolHookUtils")
			await ToolHookUtils.runPreToolUseIfEnabled(config, block)
		} catch (error) {
			const { PreToolUseHookCancellationError } = await import("@core/hooks/PreToolUseHookCancellationError")
			if (error instanceof PreToolUseHookCancellationError) {
				return formatResponse.toolDenied()
			}
			throw error
		}

		// Show notification if enabled
		if (config.autoApprovalSettings.enableNotifications) {
			showSystemNotification({
				subtitle: "Task Completed",
				message: result.replace(/\n/g, " "),
			})
		}

		const addNewChangesFlagToLastCompletionResultMessage = async () => {
			// Add newchanges flag if there are new changes to the workspace
			const hasNewChanges = await config.callbacks.doesLatestTaskCompletionHaveNewChanges()
			const clineMessages = config.messageState.getClineMessages()

			const lastCompletionResultMessageIndex = findLastIndex(clineMessages, (m: any) => m.say === "completion_result")
			const lastCompletionResultMessage =
				lastCompletionResultMessageIndex !== -1 ? clineMessages[lastCompletionResultMessageIndex] : undefined
			if (
				lastCompletionResultMessage &&
				lastCompletionResultMessageIndex !== -1 &&
				hasNewChanges &&
				!lastCompletionResultMessage.text?.endsWith(COMPLETION_RESULT_CHANGES_FLAG)
			) {
				await config.messageState.updateClineMessage(lastCompletionResultMessageIndex, {
					text: lastCompletionResultMessage.text + COMPLETION_RESULT_CHANGES_FLAG,
				})
			}
		}

		// Remove any partial completion_result message that may exist
		// Search backwards since other messages may have been inserted after the partial
		const clineMessages = config.messageState.getClineMessages()
		const partialCompletionIndex = findLastIndex(
			clineMessages,
			(m) => m.partial === true && m.type === "say" && m.say === "completion_result",
		)
		if (partialCompletionIndex !== -1) {
			const updatedMessages = [
				...clineMessages.slice(0, partialCompletionIndex),
				...clineMessages.slice(partialCompletionIndex + 1),
			]
			config.messageState.setClineMessages(updatedMessages)
			await config.messageState.saveClineMessagesAndUpdateHistory()
		}

		let commandResult: any
		const lastMessage = config.messageState.getClineMessages().at(-1)

		if (command) {
			// #134：attempt_completion 携带的 command 此前绕过全部命令闸（三道闸只在
			// ExecuteCommandToolHandler 里，本 handler 直接调 executeCommandTool，下游
			// CommandExecutor 零校验），yolo 下静默执行。现在与 execute_command 共用
			// 同一套闸；拒绝时在发出 completion_result 之前就返回，不进审批/执行。
			const deniedResponse = await runCommandGates(config, command)
			if (deniedResponse) {
				return deniedResponse
			}

			// 08 #202：ask 竞态重试时结论已发过，不得再发一份 completion_result。
			// 判重只认「被作废的完成询问 + 尚无用户反馈」，不能用整段历史里有没有结论——
			// 用户给反馈继续任务时旧结论还在，会把新一轮结论整个吃掉。
			if (
				lastMessage &&
				lastMessage.ask !== "command" &&
				!shouldSkipDuplicateCompletionResult(config.messageState.getClineMessages())
			) {
				// haven't sent a command message yet so first send completion_result then command
				const completionMessageTs = await config.callbacks.say("completion_result", result, undefined, undefined, false)
				await config.callbacks.saveCheckpoint(true, completionMessageTs)
				await addNewChangesFlagToLastCompletionResultMessage()
				telemetryService.captureTaskCompleted(config.ulid, getTaskCompletionTelemetry(config))
			} else {
				// we already sent a command message, meaning the complete completion message has also been sent
				await config.callbacks.saveCheckpoint(true)
			}

			// Attempt completion is a special tool where we want to update the focus chain list before the user provides response
			if (!block.partial && config.focusChainSettings.enabled) {
				await config.callbacks.updateFCListFromToolResponse(block.params.task_progress)
			}

			// Check if command should be auto-approved
			// attempt_completion commands don't have requires_approval param, so we treat them as safe commands
			const autoApproveResult = config.autoApprover?.shouldAutoApproveTool(ClineDefaultTool.BASH)
			const autoApproveSafe = Array.isArray(autoApproveResult) ? autoApproveResult[0] : autoApproveResult

			if (autoApproveSafe) {
				// Auto-approve flow - show command as 'say' instead of 'ask'
				await config.callbacks.removeLastPartialMessageIfExistsWithType("ask", "command")
				await config.callbacks.say("command", command, undefined, undefined, false)
			} else {
				// Manual approval flow - need to ask for approval
				showNotificationForApproval(
					`Cline wants to execute a command: ${command}`,
					config.autoApprovalSettings.enableNotifications,
				)

				const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("command", command, config)
				if (!didApprove) {
					return formatResponse.toolDenied()
				}
			}

			// Execute the command
			const [userRejected, execCommandResult] = await config.callbacks.executeCommandTool(command!, undefined) // no timeout for attempt_completion command

			if (userRejected) {
				config.taskState.didRejectTool = true
				return execCommandResult
			}
			// user didn't reject, but the command may have output
			commandResult = execCommandResult
		} else if (!shouldSkipDuplicateCompletionResult(config.messageState.getClineMessages())) {
			// Send the complete completion_result message (partial was already removed above)
			// 08 #202：仅竞态重试时不再重复发结论、存 checkpoint、记完成遥测（图 1 两份「任务已完成」的根因）。
			const completionMessageTs = await config.callbacks.say("completion_result", result, undefined, undefined, false)
			await config.callbacks.saveCheckpoint(true, completionMessageTs)
			await addNewChangesFlagToLastCompletionResultMessage()
			telemetryService.captureTaskCompleted(config.ulid, getTaskCompletionTelemetry(config))
		}

		// 建库任务完成：把 kb.json.build 置 ready；非建库任务 no-op。
		// 放在 completion_result 之后、等待用户反馈之前，避免用户点「新任务」时来不及落盘。
		try {
			await notifyKnowledgeBaseBuildFinished(config.taskId)
		} catch (error) {
			Logger.warn(`[knowledge-base] 完成状态写入失败（已忽略）：${error}`)
		}

		// 续写的发现入口：本任务真读过工程文件、且工作区里有可用的库时，
		// 提一句「可以去点续写」。不产生模型调用，每任务最多一次。
		try {
			await maybeSuggestKnowledgeBaseIncrement(config)
		} catch (error) {
			Logger.warn(`[knowledge-base] 续写提示失败（已忽略）：${error}`)
		}

		// we already sent completion_result says, an empty string asks relinquishes control over button and field
		// in case last command was interactive and in partial state, the UI is expecting an ask response. This ends the command ask response, freeing up the UI to proceed with the completion ask.
		if (config.messageState.getClineMessages().at(-1)?.ask === "command_output") {
			await config.callbacks.say("command_output", "")
		}

		if (!block.partial && config.focusChainSettings.enabled) {
			await config.callbacks.updateFCListFromToolResponse(block.params.task_progress)
		}

		// Run TaskComplete hook BEFORE presenting the "Start New Task" button
		// At this point we know: task is complete, checkpoint saved, result shown to user
		await this.runTaskCompleteHook(config, block)
		await NotificationHook.emitTaskCompleteNotification(
			{
				messageStateHandler: config.messageState,
				taskId: config.taskId,
				hooksEnabled: getHooksEnabledSafe(config.services.stateManager.getGlobalSettingsKey("hooksEnabled")),
				model: getHookModelContext(config.api, config.services.stateManager),
			},
			{ message: result },
		)

		const prefix = "[attempt_completion] Result: Done"
		// 08 #202：完成询问若被内部旁路消息挤掉，结论已经发给用户，按已完成静默收尾：
		// 不显示红字 say:error、不把内部错误当 toolError 回灌模型（否则多烧一轮并重试出第二份结论）。
		const completionAsk = await (async () => {
			try {
				return await config.callbacks.ask("completion_result", "", false)
			} catch (error) {
				if (isAskPromiseIgnoredError(error)) {
					Logger.warn(`[attempt_completion] 完成询问被内部消息挤掉，按已完成收尾：${error.message}`)
					return undefined
				}
				throw error
			}
		})()
		if (!completionAsk) {
			return prefix
		}
		const { response, text, images, files: completionFiles } = completionAsk
		if (response === "yesButtonClicked") {
			return prefix // signals to recursive loop to stop (for now this never happens since yesButtonClicked will trigger a new task)
		}

		await config.callbacks.say("user_feedback", text ?? "", images, completionFiles)

		// Run UserPromptSubmit hook when user provides post-completion feedback
		let hookContextModification: string | undefined
		if (text || (images && images.length > 0) || (completionFiles && completionFiles.length > 0)) {
			const userContentForHook = await buildUserFeedbackContent(text, images, completionFiles)

			const hookResult = await config.callbacks.runUserPromptSubmitHook(userContentForHook, "feedback")

			if (hookResult.cancel === true) {
				return formatResponse.toolDenied()
			}

			// Capture hook context modification to add to tool results
			hookContextModification = hookResult.contextModification
		}

		const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
		if (commandResult) {
			if (typeof commandResult === "string") {
				toolResults.push({
					type: "text",
					text: commandResult,
				})
			} else if (Array.isArray(commandResult)) {
				toolResults.push(...commandResult)
			}
		}

		if (text) {
			toolResults.push(
				{
					type: "text",
					text: "The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.",
				},
				{
					type: "text",
					text: `<feedback>\n${text}\n</feedback>`,
				},
			)
		}

		// Add hook context modification if provided
		if (hookContextModification) {
			toolResults.push({
				type: "text" as const,
				text: `<hook_context source="UserPromptSubmit">\n${hookContextModification}\n</hook_context>`,
			})
		}

		const fileContentString = completionFiles?.length ? await processFilesIntoText(completionFiles) : ""
		if (fileContentString) {
			toolResults.push({
				type: "text" as const,
				text: fileContentString,
			})
		}

		if (images && images.length > 0) {
			toolResults.push(...formatResponse.imageBlocks(images))
		}

		// Return the tool results as a complex response
		return [
			{
				type: "text" as const,
				text: prefix,
			},
			...toolResults,
		]
	}

	/**
	 * Runs the TaskComplete hook after user confirms task completion.
	 * This is a non-cancellable, observation-only hook similar to TaskCancel.
	 * Errors are logged but do not affect task completion.
	 */
	private async runTaskCompleteHook(config: TaskConfig, block: ToolUse): Promise<void> {
		const hooksEnabled = getHooksEnabledSafe(config.services.stateManager.getGlobalSettingsKey("hooksEnabled"))
		if (!hooksEnabled) {
			return
		}

		try {
			const { executeHook } = await import("@core/hooks/hook-executor")

			await executeHook({
				hookName: "TaskComplete",
				hookInput: {
					taskComplete: {
						taskMetadata: {
							taskId: config.taskId,
							ulid: config.ulid,
							result: block.params.result || "",
							command: block.params.command || "",
						},
					},
				},
				isCancellable: false, // Non-cancellable - task is already complete
				say: config.callbacks.say,
				setActiveHookExecution: undefined, // Explicitly undefined for non-cancellable hooks
				clearActiveHookExecution: undefined, // Explicitly undefined for non-cancellable hooks
				messageStateHandler: config.messageState,
				taskId: config.taskId,
				hooksEnabled,
				model: getHookModelContext(config.api, config.services.stateManager),
			})
		} catch (error) {
			// TaskComplete hook failed - non-fatal, just log
			Logger.error("[TaskComplete Hook] Failed (non-fatal):", error)
		}
	}
}

import { Empty } from "@shared/proto/cline/common"
import { PlanActMode, UpdateTaskSettingsRequest } from "@shared/proto/cline/state"
import { convertProtoToApiProvider } from "@shared/proto-conversions/models/api-configuration-conversion"
import { Mode } from "@/shared/storage/types"
import { Controller } from ".."
import { normalizeOpenaiReasoningEffort } from "./reasoningEffort"

/**
 * Updates task-specific settings for the current task
 * @param controller The controller instance
 * @param request The request containing the task settings to update
 * @returns An empty response
 */
export async function updateTaskSettings(controller: Controller, request: UpdateTaskSettingsRequest): Promise<Empty> {
	const convertPlanActMode = (mode: PlanActMode): Mode => {
		return mode === PlanActMode.PLAN ? "plan" : "act"
	}

	try {
		// Get taskId from request first, otherwise fall back to current task
		let taskId: string
		if (request.taskId) {
			taskId = request.taskId
		} else {
			// Use current task if no taskId is provided
			if (!controller.task) {
				throw new Error("No active task to update settings for")
			}
			taskId = controller.task.taskId
		}

		if (request.settings) {
			// Extract all special case fields that need dedicated handlers
			const {
				// Fields requiring conversion
				autoApprovalSettings,
				planModeReasoningEffort,
				actModeReasoningEffort,
				mode,
				customPrompt,
				planModeApiProvider,
				actModeApiProvider,
				...simpleSettings
			} = request.settings

			// Batch update for simple pass-through fields
			const filteredSettings: any = Object.fromEntries(
				Object.entries(simpleSettings).filter(([key, value]) => key !== "openaiReasoningEffort" && value !== undefined),
			)

			controller.stateManager.setTaskSettingsBatch(taskId, filteredSettings)

			// Handle fields requiring type conversion from generated protobuf types to application types
			if (autoApprovalSettings) {
				// Merge with current settings to preserve unspecified fields
				const currentAutoApprovalSettings = controller.stateManager.getGlobalSettingsKey("autoApprovalSettings")
				const mergedSettings = {
					...currentAutoApprovalSettings,
					...(autoApprovalSettings.version !== undefined && {
						version: autoApprovalSettings.version,
					}),
					...(autoApprovalSettings.enableNotifications !== undefined && {
						enableNotifications: autoApprovalSettings.enableNotifications,
					}),
					actions: {
						...currentAutoApprovalSettings.actions,
						...(autoApprovalSettings.actions
							? Object.fromEntries(Object.entries(autoApprovalSettings.actions).filter(([_, v]) => v !== undefined))
							: {}),
					},
				}
				controller.stateManager.setTaskSettings(taskId, "autoApprovalSettings", mergedSettings)
			}

			if (planModeReasoningEffort !== undefined) {
				const converted = normalizeOpenaiReasoningEffort(planModeReasoningEffort)
				controller.stateManager.setTaskSettings(taskId, "planModeReasoningEffort", converted)
			}

			if (actModeReasoningEffort !== undefined) {
				const converted = normalizeOpenaiReasoningEffort(actModeReasoningEffort)
				controller.stateManager.setTaskSettings(taskId, "actModeReasoningEffort", converted)
			}

			if (mode !== undefined) {
				const converted = convertPlanActMode(mode)
				controller.stateManager.setTaskSettings(taskId, "mode", converted)
			}

			if (customPrompt === "compact") {
				controller.stateManager.setTaskSettings(taskId, "customPrompt", "compact")
			}

			if (planModeApiProvider !== undefined) {
				const converted = convertProtoToApiProvider(planModeApiProvider)
				controller.stateManager.setTaskSettings(taskId, "planModeApiProvider", converted)
			}

			if (actModeApiProvider !== undefined) {
				const converted = convertProtoToApiProvider(actModeApiProvider)
				controller.stateManager.setTaskSettings(taskId, "actModeApiProvider", converted)
			}
		}

		// Post updated state to webview
		await controller.postStateToWebview()

		return Empty.create()
	} catch (error) {
		throw error
	}
}

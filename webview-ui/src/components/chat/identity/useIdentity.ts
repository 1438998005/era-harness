import { AutoApprovalSettings } from "@shared/AutoApprovalSettings"
import { useCallback, useEffect, useRef, useState } from "react"
import { updateAutoApproveSettings } from "@/components/chat/auto-approve-menu/AutoApproveSettingsAPI"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { getIdentityMode, IdentityMode, readAskOnNew, readStoredIdentityMode, storeAskOnNew, storeIdentityMode } from "./identity"

const ALL_ACTIONS_ON: AutoApprovalSettings["actions"] = {
	readFiles: true,
	readFilesExternally: true,
	editFiles: true,
	editFilesExternally: true,
	executeSafeCommands: true,
	executeAllCommands: true,
	useBrowser: true,
	useMcp: true,
}

/**
 * 身份状态：当前模式、选择弹窗开关、「新对话是否询问」开关。
 *
 * messageCount 用于判断是否是新对话：归零即视为新会话，
 * 此时按用户偏好自动弹出一次身份选择。
 */
export function useIdentity(messageCount: number, didHydrate: boolean) {
	const { autoApprovalSettings } = useExtensionState()
	const [mode, setMode] = useState<IdentityMode>(() => readStoredIdentityMode())
	const [isPickerOpen, setPickerOpen] = useState(false)
	const [askOnNew, setAskOnNew] = useState<boolean>(() => readAskOnNew())

	const askedForCurrentTask = useRef(false)
	const previousActionsRef = useRef<AutoApprovalSettings["actions"] | null>(null)

	// 新对话（消息归零）时询问一次；已有对话不打扰。
	// 必须等状态水合完成再判断，否则恢复旧任务时 messageCount 会先短暂为 0 而误弹。
	useEffect(() => {
		if (!didHydrate) {
			return
		}
		if (messageCount > 0) {
			askedForCurrentTask.current = false
			return
		}
		if (askedForCurrentTask.current) {
			return
		}
		askedForCurrentTask.current = true
		if (askOnNew) {
			setPickerOpen(true)
		}
	}, [messageCount, askOnNew, didHydrate])

	const selectMode = useCallback(
		async (next: IdentityMode) => {
			setMode(next)
			storeIdentityMode(next)

			const def = getIdentityMode(next)
			try {
				if (def.autoApproveAll) {
					if (!previousActionsRef.current) {
						previousActionsRef.current = autoApprovalSettings.actions
					}
					await updateAutoApproveSettings({
						...autoApprovalSettings,
						version: (autoApprovalSettings.version ?? 1) + 1,
						actions: ALL_ACTIONS_ON,
					})
				} else if (previousActionsRef.current) {
					// 从「权限全开」切回其他身份，恢复切换前的批准档位
					await updateAutoApproveSettings({
						...autoApprovalSettings,
						version: (autoApprovalSettings.version ?? 1) + 1,
						actions: previousActionsRef.current,
					})
					previousActionsRef.current = null
				}
			} catch (error) {
				console.error("Failed to apply identity permission preset:", error)
			}

			setPickerOpen(false)
		},
		[autoApprovalSettings],
	)

	const toggleAskOnNew = useCallback((value: boolean) => {
		setAskOnNew(value)
		storeAskOnNew(value)
	}, [])

	return {
		mode,
		modeDef: getIdentityMode(mode),
		selectMode,
		isPickerOpen,
		openPicker: () => setPickerOpen(true),
		closePicker: () => setPickerOpen(false),
		askOnNew,
		toggleAskOnNew,
	}
}

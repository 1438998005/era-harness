import { useExtensionState } from "../context/ExtensionStateContext"

/**
 * era harness 本地版：无远端特性开关（PostHog 已移除），所有 flag 恒为 false。
 */
export const useHasFeatureFlag = (_flagName: string): boolean => {
	// 保留 useExtensionState 调用以维持 hook 顺序与既有调用约定
	useExtensionState()
	return false
}

/**
 * Computes the effective hooks-enabled state from persisted user setting.
 *
 * NOTE: This is the single choke point used by runtime and UI state shaping.
 */
export function getHooksEnabledSafe(userSetting: boolean | undefined): boolean {
	// #137（2026-11-01 用户裁定）：默认改为关。hooks 脚本（工作区 .clinerules/hooks/
	// 与系统级 ~/Documents/Cline/Hooks/）被发现即执行、无确认弹窗，对「把下载来的
	// mod 包解进工程再打开」的目标用户是供应链执行面；需要的人可在设置里显式打开。
	return userSetting ?? false
}

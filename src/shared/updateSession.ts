/**
 * 「回到进行中的更新」的纯逻辑（08 #179）。
 *
 * 背景：更新 eraTW 的 AI 合并在**侧栏对话**里跑（`mergeTask.ts` 的 `controller.initTask`），
 * 没有独立面板。用户误关对话 / 切走 / 关侧栏之后没有任何入口能回去，只能翻任务历史或重跑一遍。
 *
 * 本文件只回答「点这个入口应该做什么」，不碰 vscode（便于单测）：
 * - `focus`       任务还活着，只需要把侧栏拉出来；
 * - `resume`      任务在历史里但当前不是它，需要恢复那场对话；
 * - `interrupted` 记录还在、历史里也没有（多半是窗口重载把任务弄死了），只能诚实告知；
 * - `none`        没有记录。
 */

export interface UpdateSessionRecord {
	taskId: string
	root: string
	startedAt: string
}

export type UpdateReturnAction = "focus" | "resume" | "interrupted" | "none"

/**
 * 决定入口行为。
 *
 * ⚠️ `focus` 与 `resume` 的区别是硬要求：任务还活着时**绝不能**走 `initTask`——
 * 那会 abort 掉正在跑的合并对话，等于用户点「回去」把更新弄死了。
 */
export function decideUpdateReturn(input: {
	record?: UpdateSessionRecord
	currentTaskId?: string
	historyIds: string[]
}): UpdateReturnAction {
	const { record, currentTaskId, historyIds } = input
	if (!record?.taskId) {
		return "none"
	}
	if (currentTaskId && record.taskId === currentTaskId) {
		return "focus"
	}
	if (historyIds.includes(record.taskId)) {
		return "resume"
	}
	return "interrupted"
}

/** 读盘后的形状校验：sidecar 是普通 JSON，不能假设它没被手改过 */
export function parseUpdateSessionRecord(raw: unknown): UpdateSessionRecord | undefined {
	if (!raw || typeof raw !== "object") {
		return undefined
	}
	const record = raw as Partial<UpdateSessionRecord>
	if (typeof record.taskId !== "string" || record.taskId.length === 0) {
		return undefined
	}
	if (typeof record.root !== "string" || record.root.length === 0) {
		return undefined
	}
	return {
		taskId: record.taskId,
		root: record.root,
		startedAt: typeof record.startedAt === "string" ? record.startedAt : "",
	}
}

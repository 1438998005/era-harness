/**
 * KB 08 #247：连续同因流式失败的**跨实例**状态（host 侧，进程内）。
 *
 * 为什么不能放 `TaskState`：`src/core/controller/index.ts` 的
 * `reinitExistingTaskFromId()` 会 `initTask(...)` **重建 Task 实例**，用户每点一次
 * 「重试」就是一个新实例、新的 `new TaskState()`。把计数写成实例字段，28 次重试
 * 就永远是 1，正是任务 `1793967201589` 里看不到累计提示的原因。
 *
 * 这里刻意做成模块级 Map（按 taskId 索引）而不是塞进 Task/Controller 字段：
 * ① Controller 与 Task 都跨实例存活的是「模块」，不是对象；
 * ② 纯函数与状态分离，`@shared/stream-error-streak` 保持零副作用、可单测；
 * ③ `exportDiagnostics()` 与 `error_retry` 载荷随时能 peek 到最新值。
 *
 * ⛔ 边界（用户裁定「N=3，只提示不退避」）：本模块只记数，不含退避、不含阻断、
 * 不含自动切换模型、不含清 `pinnedModelId`；成功请求会把连续计数归零。
 */

import { advanceStreamErrorStreak, normalizeStreamErrorSignature, type StreamErrorStreakState } from "@shared/stream-error-streak"

/** 最多跟踪的任务数，防止长会话里 Map 无界增长；超出时丢最早插入的那个。 */
const MAX_TRACKED_TASKS = 64

const byTask = new Map<string, StreamErrorStreakState>()

/**
 * 记一次流式失败，返回推进后的状态。
 * 错误签名不同（如 429 换成「空响应」）就从 1 重新数，不共用计数。
 */
export function recordStreamError(taskId: string, message: string | undefined): StreamErrorStreakState {
	const state = advanceStreamErrorStreak(byTask.get(taskId), normalizeStreamErrorSignature(message))
	// 先删再 set，让活跃任务排到 Map 末尾，淘汰时不会把仍在重试的任务踢掉。
	byTask.delete(taskId)
	byTask.set(taskId, state)
	if (byTask.size > MAX_TRACKED_TASKS) {
		const oldest = byTask.keys().next().value
		if (oldest !== undefined) byTask.delete(oldest)
	}
	return state
}

/** 读取当前连续失败状态；`error_retry` 载荷据此生成升级字段。 */
export function peekStreamErrorStreak(taskId: string): StreamErrorStreakState | undefined {
	return byTask.get(taskId)
}

/** 一次请求成功产出后归零——「连续」只对连续失败成立。 */
export function resetStreamErrorStreak(taskId: string): void {
	byTask.delete(taskId)
}

/** 仅供测试隔离用例，生产不调用。 */
export function clearStreamErrorStreaks(): void {
	byTask.clear()
}

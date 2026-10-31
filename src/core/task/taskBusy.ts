/**
 * 「现在能不能开一场新对话」的判据（#99）。
 *
 * 为什么不能只看 `isStreaming`：等待批准 / 提问时流已经暂停，`isStreaming` 为 false，
 * 但 `initTask()` 仍会 `clearTask()` 把那个对话中止掉（#93）。
 *
 * 为什么不能直接把 `pendingAsk` 一律算忙：任务**跑完之后**会停在
 * `ask("completion_result", ...)` 上等用户点收尾按钮，这个 ask 只有用户点按钮
 * （`startNewTask → clearTask → abortTask`）才会消失，不经过 `handleWebviewAskResponse`。
 * 于是「建库刚跑完 → 点续写」会被弹回「现在有一个对话正在跑」——正是 3.95.1 的验收点被
 * 打掉的那个 bug（#99）。
 *
 * 判据：`pendingAsk` 只有在「等用户回答」时才算忙；等用户点收尾按钮的终态 ask 不算。
 * 用户一旦回文字，`handleWebviewAskResponse` 会清掉 `pendingAsk` 并重新进入流式，忙立刻恢复。
 *
 * 本文件不 import vscode，也不 import 任何宿主模块，纯函数可直接单测。
 */

/**
 * 终态 ask：模型循环已经结束，只剩「你要不要开下一个任务 / 提供反馈」。
 *
 * - `completion_result`：attempt_completion 收尾；
 * - `resume_completed_task`：重载后恢复一个已完成的会话；
 * - `new_task`：任务结束、问要不要开新任务。
 *
 * ⛔ 不要把 `resume_task` / `plan_mode_respond` / `act_mode_respond` / `mistake_limit_reached`
 * 加进来：那些状态下任务还会继续干活，算「忙」才是对的。
 */
export const TERMINAL_ASKS = ["completion_result", "resume_completed_task", "new_task"] as const

/** 只取判据真正用到的字段，避免把整个 TaskState 拖进来 */
export interface BusyStateLike {
	isStreaming?: boolean
	isWaitingForFirstChunk?: boolean
	pendingAsk?: string
}

export function isTaskStateBusy(state: BusyStateLike | undefined): boolean {
	if (!state) {
		return false
	}
	if (state.isStreaming || state.isWaitingForFirstChunk) {
		return true
	}
	const ask = state.pendingAsk
	if (!ask) {
		return false
	}
	return !(TERMINAL_ASKS as readonly string[]).includes(ask)
}

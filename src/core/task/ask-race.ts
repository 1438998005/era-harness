/**
 * 08 #202：pending ask 期间插队 say 会作废询问。
 *
 * 机制：`Task.ask()` 用 `taskState.lastMessageTs !== askTs` 判定询问是否被后来的消息取代；
 * 而 `Task.say()` 每新增一条消息都会刷新 `lastMessageTs`。上游已合并 PR cline#8283
 * 对同类错误的裁定是「修插入源，不要新发 say()」，而不是在多个调用点 blanket catch。
 * 本模块只放不依赖 vscode 的纯判据，便于 node:test 直接覆盖（见 test/update/ask-race.spec.ts）。
 */

/** 保持与上游/既有日志一致的错误文案，诊断包与 UI 都按这串检索。 */
export const ASK_PROMISE_IGNORED_MESSAGE = "Current ask promise was ignored"

/** 只表示「完成询问被内部旁路消息挤掉」这一类可恢复竞态，真实工具错误绝不能用它。 */
export class AskPromiseIgnoredError extends Error {
	readonly askType: string
	readonly askTs: number
	readonly lastMessageTs: number

	constructor(askType: string, askTs: number, lastMessageTs: number) {
		super(ASK_PROMISE_IGNORED_MESSAGE)
		this.name = "AskPromiseIgnoredError"
		this.askType = askType
		this.askTs = askTs
		this.lastMessageTs = lastMessageTs
	}
}

export function isAskPromiseIgnoredError(error: unknown): error is AskPromiseIgnoredError {
	return error instanceof AskPromiseIgnoredError
}

type ClineLikeMessage = { type?: string; say?: string; ask?: string; partial?: boolean }

/** 本任务历史里是否发过完整的完成结论（只作素材，判重请用下面的函数）。 */
export function hasCompleteCompletionResult(messages: readonly ClineLikeMessage[]): boolean {
	return messages.some((message) => message.type === "say" && message.say === "completion_result" && message.partial !== true)
}

/**
 * #202：本次 attempt_completion 是不是「完成询问被内部消息挤掉后的重试」。
 *
 * ⛔ 不能直接用「历史里有没有完整结论」判重：用户在结论后给反馈继续任务时，上一轮
 * 结论仍留在 clineMessages 里，全局判重会把新一轮的结论整个吃掉（不发
 * completion_result、不存 checkpoint、不记完成遥测），用户看到的永远是第一轮的旧结论。
 *
 * 竞态重试的形状是：最后一条消息仍是被作废的 completion_result 询问，往前紧邻一份
 * 完整结论、中间没有 user_feedback。用户一旦回过话，就按新一轮任务处理。
 */
export function shouldSkipDuplicateCompletionResult(messages: readonly ClineLikeMessage[]): boolean {
	const last = messages.at(-1)
	if (!last || last.type !== "ask" || last.ask !== "completion_result" || last.partial === true) {
		return false
	}
	if (!hasCompleteCompletionResult(messages)) {
		return false
	}

	// 找最后一份完整结论：竞态重试时它就在被作废的完成询问前面。
	let lastConclusionIndex = -1
	for (let i = messages.length - 2; i >= 0; i--) {
		const message = messages[i]!
		if (message.type === "say" && message.say === "completion_result" && message.partial !== true) {
			lastConclusionIndex = i
			break
		}
	}
	if (lastConclusionIndex === -1) {
		return false
	}

	// 这份结论之后出现过用户反馈 = 用户已经在旧结论上继续了任务，下一轮必须重新发结论。
	// 只看「历史里有没有 feedback」会误伤「中途拒过工具 → 首次完成时竞态」的幂等场景，
	// 所以口径限定在最后一份结论之后。
	return !messages.slice(lastConclusionIndex + 1).some((message) => message.type === "say" && message.say === "user_feedback")
}

/**
 * 纯展示类消息在「终态询问」等待用户响应期间应延后，不要新增消息。
 *
 * 刻意不覆盖 `command_output`（"Proceed While Running" 的审批语义）、`command` 审批、
 * 以及所有非终态 ask：那些消息是流程控制，不是装饰，跳过会改变行为。
 */
const DEFERRED_DISPLAY_SAYS = new Set([
	"info",
	"task_progress",
	"reasoning",
	"text",
	"mcp_notification",
	"checkpoint_created",
	"hook_status",
	"hook_output_stream",
])

// 与 taskBusy.ts 的 TERMINAL_ASKS 保持一致（#99：终态 ask 不算忙，也不该被插队消息挤掉）
const TERMINAL_ASKS = new Set(["completion_result", "resume_completed_task", "new_task"])

export function shouldDeferDisplayOnlySay(pendingAsk: string | undefined, sayType: string): boolean {
	return !!pendingAsk && TERMINAL_ASKS.has(pendingAsk) && DEFERRED_DISPLAY_SAYS.has(sayType)
}

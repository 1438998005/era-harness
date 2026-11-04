/**
 * 08 #202：pending ask 期间插队 say 会作废询问。
 *
 * 取证：2026-11-04 诊断包 turn10 `Error executing attempt_completion: Current ask promise was ignored`；
 * 任务对话记录里 `ask completion_result` 之后紧跟 #87 的 `say("info")` 与 `say("task_progress")`。
 * 上游已合并 PR cline#8283 的裁定：修插入源（不发新 say），而不是在多个调用点 blanket catch。
 *
 * 本 spec 不 import Task/ToolExecutor（它们带 vscode 依赖，默认 runner 跑不了），
 * 改为：① 测抽出来的纯判据；② 用假时间戳协议复刻 ask/say 竞态；③ 源码级接线断言。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	ASK_PROMISE_IGNORED_MESSAGE,
	AskPromiseIgnoredError,
	hasCompleteCompletionResult,
	isAskPromiseIgnoredError,
	shouldDeferDisplayOnlySay,
	shouldSkipDuplicateCompletionResult,
} from "../../src/core/task/ask-race"
import { readCode } from "./source-probe"

test("可恢复 ask 竞态：专属错误保留原 message，普通错误不被误判", () => {
	const race = new AskPromiseIgnoredError("completion_result", 100, 200)
	assert.equal(race.message, ASK_PROMISE_IGNORED_MESSAGE)
	assert.equal(race.askType, "completion_result")
	assert.equal(isAskPromiseIgnoredError(race), true)
	assert.equal(isAskPromiseIgnoredError(new Error(ASK_PROMISE_IGNORED_MESSAGE)), false)
	assert.equal(isAskPromiseIgnoredError(new Error("ENOENT")), false)
	assert.equal(isAskPromiseIgnoredError("Current ask promise was ignored"), false)
	assert.equal(isAskPromiseIgnoredError(null), false)
})

test("hasCompleteCompletionResult：只认完整的 completion_result say", () => {
	assert.equal(hasCompleteCompletionResult([]), false)
	assert.equal(hasCompleteCompletionResult([{ type: "say", say: "completion_result", partial: true }]), false)
	assert.equal(hasCompleteCompletionResult([{ type: "ask", say: "completion_result" }]), false)
	assert.equal(hasCompleteCompletionResult([{ type: "say", say: "text" }]), false)
	assert.equal(hasCompleteCompletionResult([{ type: "say", say: "completion_result" }]), true)
	assert.equal(
		hasCompleteCompletionResult([
			{ type: "say", say: "completion_result", partial: true },
			{ type: "say", say: "completion_result" },
		]),
		true,
	)
})

test("#202 判重只认竞态重试：用户反馈后继续任务必须重新发结论", () => {
	const conclusion = { type: "say", say: "completion_result" }
	const staleAsk = { type: "ask", ask: "completion_result" }
	const feedback = { type: "say", say: "user_feedback" }

	// 竞态重试：结论已发、完成询问被内部消息挤掉、用户还没回话 → 跳过重复发送
	assert.equal(shouldSkipDuplicateCompletionResult([conclusion, staleAsk]), true)
	// 结论与询问之间夹着展示类消息，不影响判定
	assert.equal(
		shouldSkipDuplicateCompletionResult([
			conclusion,
			{ type: "say", say: "command_output" },
			{ type: "say", say: "hook_status" },
			staleAsk,
		]),
		true,
	)
	// 用户在旧结论上给了反馈、任务继续：最后一条不再是挂起的完成询问 → 必须发新结论。
	// 旧实现用「整段历史有没有 completion_result」判重，会把这一轮的结论整个吃掉。
	assert.equal(shouldSkipDuplicateCompletionResult([conclusion, staleAsk, feedback, { type: "say", say: "text" }]), false)
	// 中途拒过工具产生的 feedback 不能破坏「首次完成时的竞态」幂等：
	// 只要最后一份结论在 feedback 之后，仍按竞态重试处理。
	assert.equal(shouldSkipDuplicateCompletionResult([feedback, { type: "say", say: "text" }, conclusion, staleAsk]), true)
	// 用户反馈后又走完一轮、新的完成询问再次被挤掉 → 依然幂等
	assert.equal(
		shouldSkipDuplicateCompletionResult([conclusion, staleAsk, feedback, { type: "say", say: "text" }, conclusion, staleAsk]),
		true,
	)

	assert.equal(shouldSkipDuplicateCompletionResult([]), false)
	assert.equal(shouldSkipDuplicateCompletionResult([conclusion]), false)
	assert.equal(shouldSkipDuplicateCompletionResult([{ type: "ask", ask: "tool" }]), false)
	assert.equal(shouldSkipDuplicateCompletionResult([{ type: "ask", ask: "completion_result", partial: true }]), false)
})

test("纯展示消息在 pending 终态 ask 期间应延后，审批/命令输出不受影响", () => {
	assert.equal(shouldDeferDisplayOnlySay("completion_result", "info"), true)
	assert.equal(shouldDeferDisplayOnlySay("completion_result", "task_progress"), true)
	assert.equal(shouldDeferDisplayOnlySay("new_task", "task_progress"), true)
	assert.equal(shouldDeferDisplayOnlySay("resume_completed_task", "info"), true)
	assert.equal(shouldDeferDisplayOnlySay(undefined, "info"), false)
	assert.equal(shouldDeferDisplayOnlySay("completion_result", "command_output"), false)
	assert.equal(shouldDeferDisplayOnlySay("command", "info"), false)
})

test("ask/say 时间戳协议：延后展示消息后 ask 仍可正常等到用户响应", () => {
	let clock = 0
	const state = {
		lastMessageTs: 0,
		pendingAsk: undefined as string | undefined,
		messages: [] as string[],
	}
	const say = (type: string) => {
		if (shouldDeferDisplayOnlySay(state.pendingAsk, type)) {
			return
		}
		state.lastMessageTs = ++clock
		state.messages.push(type)
	}
	const ask = (type: string) => {
		state.pendingAsk = type
		const askTs = ++clock
		state.lastMessageTs = askTs
		return askTs
	}

	const askTs = ask("completion_result")
	// 复刻流收尾段的 #87 info 与泄漏 task_progress 兜底
	say("info")
	say("task_progress")

	assert.equal(state.lastMessageTs, askTs, "插队消息不得刷新 lastMessageTs")
	assert.deepEqual(state.messages, [], "pending ask 期间不得新增 UI 消息")
	assert.equal(state.lastMessageTs !== askTs, false, "ask 不应被判为 ignored")

	// 无 pending ask 时消息照常写，行为不变
	state.pendingAsk = undefined
	say("info")
	assert.equal(state.messages.length, 1)
	assert.notEqual(state.lastMessageTs, askTs)
})

test("源码接线：#87 诊断信息不再新增 say，改走审计与日志", () => {
	const code = readCode("src/core/task/index.ts")
	assert.ok(!/say\(\s*"info"[\s\S]{0,120}模型本轮输出了/.test(code), "#87 仍以 say(info) 新增消息，会把 pending ask 作废")
	assert.match(code, /taskProgressMistake/, "应提前算出 #87 判定以并入 parse 审计")
	assert.match(code, /taskProgressChars=/, "剥离字数应并入诊断包可见的 parse 事件")
	assert.match(code, /Logger\.warn\(/, "诊断信息应保留在日志里")
})

test("源码接线：ask 抛可恢复错误、流收尾兜底有 pendingAsk 门控", () => {
	const code = readCode("src/core/task/index.ts")
	assert.match(code, /new AskPromiseIgnoredError\(/, "ask() 应抛专用错误以便上层精确识别")
	const fallbackStart = code.indexOf('assistantTextOnly.includes("<task_progress>")')
	assert.ok(fallbackStart > -1, "泄漏进度清单兜底仍应存在")
	const fallbackEnd = code.indexOf("updateFCListFromToolResponse(lastBlock", fallbackStart)
	assert.ok(fallbackEnd > fallbackStart)
	assert.match(
		code.slice(fallbackStart, fallbackEnd),
		/shouldDeferDisplayOnlySay/,
		"泄漏 task_progress 兜底前必须有 pendingAsk 门控",
	)
})

test("源码接线：attempt_completion 幂等且静默处理可恢复竞态", () => {
	const code = readCode("src/core/task/tools/handlers/AttemptCompletionHandler.ts")
	assert.match(code, /shouldSkipDuplicateCompletionResult\(/, "重试不得重复发 completion_result")
	assert.ok(!code.includes("hasCompleteCompletionResult("), "不得用整段历史判重，否则用户反馈后的新一轮结论会被吃掉")
	const catchGuard = code.indexOf("if (isAskPromiseIgnoredError(")
	assert.ok(catchGuard > -1, "可恢复竞态必须有精确 catch")
	assert.ok(catchGuard < code.indexOf('config.callbacks.say("user_feedback"'), "catch 必须在继续处理反馈之前")
})

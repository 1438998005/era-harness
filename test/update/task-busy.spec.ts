/**
 * #99：busy 判据必须排除「终态 ask」。
 *
 * 现场：建库任务跑完，界面停在「任务已完成」的收尾按钮上。此时 `pendingAsk` 是
 * `completion_result`，而它只有用户点按钮（`startNewTask → clearTask → abortTask`）
 * 才会消失，不经过 `handleWebviewAskResponse`。于是 `isConversationBusy()` 恒为 true，
 * 用户最自然的时序「建库跑完 → 补一个范围」被弹回「现在有一个对话正在跑」。
 *
 * 这条测试锁的是**判据本身**；接线（`knowledgeBaseTask.isConversationBusy` 调用它）
 * 由源码级断言在 `knowledge-base-wiring` 里兜住。
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { isTaskStateBusy, TERMINAL_ASKS } from "../../src/core/task/taskBusy"

test("#99 终态 ask 不算忙（等的是收尾按钮，不是用户回答）", () => {
	assert.deepEqual([...TERMINAL_ASKS].sort(), ["completion_result", "new_task", "resume_completed_task"])
	for (const ask of TERMINAL_ASKS) {
		assert.equal(isTaskStateBusy({ pendingAsk: ask }), false, `${ask} 不应算忙`)
	}
})

test("#99 等用户回答的 ask 仍然算忙", () => {
	// 这些状态下任务还会继续干活，抢开会把对方 abort 掉
	for (const ask of ["command", "tool", "followup", "plan_mode_respond", "act_mode_respond", "resume_task"]) {
		assert.equal(isTaskStateBusy({ pendingAsk: ask }), true, `${ask} 应算忙`)
	}
})

test("#99 流式输出 / 等首个 chunk 算忙", () => {
	assert.equal(isTaskStateBusy({ isStreaming: true }), true)
	assert.equal(isTaskStateBusy({ isWaitingForFirstChunk: true }), true)
	assert.equal(isTaskStateBusy({ isStreaming: true, pendingAsk: "completion_result" }), true, "流式优先于 ask 类型")
})

test("#99 没有任务 / 空状态不忙", () => {
	assert.equal(isTaskStateBusy(undefined), false)
	assert.equal(isTaskStateBusy({}), false)
	assert.equal(isTaskStateBusy({ isStreaming: false, isWaitingForFirstChunk: false }), false)
})

test("#99 接线：建库任务的忙判据必须走这个纯函数", () => {
	const source = fs.readFileSync(path.join(process.cwd(), "src/hosts/vscode/knowledgeBaseTask.ts"), "utf8")
	assert.ok(source.includes("isTaskStateBusy("), "knowledgeBaseTask 必须调用 isTaskStateBusy，否则终态 ask 的排除等于没接上")
})

/**
 * 08 #86：请求体指纹刹车。
 *
 * 抓的是「零工具空转」：模型连续多轮不调工具、每轮都对着同一段提示重新开大会，
 * 而 assistant 正文（reasoning / task_progress）每轮都在变。因此指纹只取
 * 「系统提示 + 最后一条 user 消息」，不含 assistant 文本。
 *
 * 边界（防误判）：
 * - 中间换了指纹（用户发了新消息 / 系统提示变化）→ 计数归 1；
 * - 空指纹（取不到上下文）→ 不参与判定；
 * - 达到阈值后再换指纹 → 不得误判。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { advanceRequestFingerprint, REQUEST_FINGERPRINT_REPEAT_LIMIT } from "../../src/core/task/loop-detection"

const FP = "system-prompt\u0000noToolsUsed text"

test("连续 5 次同指纹：第 5 次 tripped（阈值 5）", () => {
	assert.equal(REQUEST_FINGERPRINT_REPEAT_LIMIT, 5)
	const state: { fingerprint?: string; count: number } = { fingerprint: undefined, count: 0 }
	const results = [] as boolean[]
	for (let i = 0; i < 5; i++) {
		const step = advanceRequestFingerprint(state, FP)
		state.fingerprint = FP
		state.count = step.count
		results.push(step.tripped)
	}
	assert.deepEqual(results, [false, false, false, false, true], "前四次不判，第五次判")
	assert.equal(state.count, 5)
})

test("中间换指纹：计数归 1，不累计", () => {
	const state: { fingerprint?: string; count: number } = { fingerprint: FP, count: 3 }
	const step = advanceRequestFingerprint(state, "another prompt\u0000new user text")
	assert.equal(step.count, 1)
	assert.equal(step.tripped, false)
})

test("达到阈值后再换：不误判（新指纹从 1 开始）", () => {
	const state: { fingerprint?: string; count: number } = { fingerprint: FP, count: 5 }
	const step = advanceRequestFingerprint(state, `${FP}!`)
	assert.equal(step.count, 1)
	assert.equal(step.tripped, false)
})

test("空指纹不参与：返回 0 且不 trip", () => {
	assert.deepEqual(advanceRequestFingerprint({ fingerprint: FP, count: 4 }, ""), { count: 0, tripped: false })
})

test("阈值可注入（测试/调参用）：limit=2 时第二次就判", () => {
	const state: { fingerprint?: string; count: number } = { fingerprint: FP, count: 0 }
	assert.equal(advanceRequestFingerprint(state, FP, 2).tripped, false)
	assert.equal(advanceRequestFingerprint({ fingerprint: FP, count: 1 }, FP, 2).tripped, true)
})

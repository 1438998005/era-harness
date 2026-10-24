// era harness：DeepSeek 请求侧纯判定回归测试（上游 PR #11392 移植的守护）。
// 运行：npm run test:deepseek
import assert from "node:assert/strict"
import { test } from "node:test"
import { deepSeekStreamsReasoning, deepSeekUsesR1Replay } from "@shared/deepseek-request"

test("V4 系模型：走思考流，但不做 R1 历史回放（#11392 核心结论）", () => {
	for (const id of ["deepseek-flash", "deepseek-v4", "deepseek-v4-pro", "deepseek-v4-pro-0731"]) {
		assert.equal(deepSeekStreamsReasoning(id), true, `${id} 应走思考流`)
		assert.equal(deepSeekUsesR1Replay(id), false, `${id} 不应做 R1 回放`)
	}
})

test("旧 deepseek-reasoner：既走思考流，也保留 R1 历史回放", () => {
	assert.equal(deepSeekStreamsReasoning("deepseek-reasoner"), true)
	assert.equal(deepSeekUsesR1Replay("deepseek-reasoner"), true)
})

test("在线同步回来的带日期后缀 id 同样命中（子串匹配）", () => {
	assert.equal(deepSeekStreamsReasoning("deepseek-flash-0731"), true)
	assert.equal(deepSeekUsesR1Replay("deepseek-reasoner-20260601"), true)
})

test("非思考模型（deepseek-chat 等）：两者皆否 → temperature:0 + 无回放", () => {
	for (const id of ["deepseek-chat", "deepseek-v3", "unknown-model"]) {
		assert.equal(deepSeekStreamsReasoning(id), false, `${id} 不应走思考流`)
		assert.equal(deepSeekUsesR1Replay(id), false, `${id} 不应做 R1 回放`)
	}
})

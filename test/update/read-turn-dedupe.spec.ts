/**
 * 08 #88：同轮重复 read_file 的第 2 次仍整份重读。
 *
 * 现状（修前）：同区间要到**第 3 次**才降级成 `[SAME CONTENT]`（loop-detection 的
 * 梯度降级防的是跨轮死循环），第 2 次照样把整份文件再发一遍。
 * 但同一条 assistant 消息里重复读同一区间时，首读的正文还在同一条上下文里，
 * 第 2 次没有任何信息增量——这里守的就是这个「同轮去重」。
 *
 * 三个必须守住的边界：
 * 1. 不同区间照常放行（读 `1-50` 再读 `51-100` 是正常行为）；
 * 2. 写入失效后放行（「改完立刻读回验证」不能被误拦）；
 * 3. 跨轮放行（新一轮的重新读取是模型正当行为，只拦同一条消息内的重复）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { claimSameTurnRead, invalidateRepeatWindowForPath, readRangeKey } from "../../src/core/task/loop-detection"
import type { TaskState } from "../../src/core/task/TaskState"

// 只填 invalidateRepeatWindowForPath 会碰到的字段
function fakeState(): TaskState {
	return {
		recentToolSignatures: [],
		fileReadCounts: new Map<string, number>(),
		warnedRepeatSignatures: new Set<string>(),
		sameTurnReadKeys: new Set<string>(),
	} as unknown as TaskState
}

const KEY = readRangeKey("/workspace/src/a.ts", 1, 50)

test("同轮同 key 第二次：跳过（首次放行）", () => {
	const keys = new Set<string>()
	assert.equal(claimSameTurnRead(keys, KEY), true, "首读应放行")
	assert.equal(claimSameTurnRead(keys, KEY), false, "同轮第二次应拦")
	assert.equal(claimSameTurnRead(keys, KEY), false, "同轮第三次仍拦")
})

test("同轮不同区间：放行", () => {
	const keys = new Set<string>()
	assert.equal(claimSameTurnRead(keys, readRangeKey("/workspace/src/a.ts", 1, 50)), true)
	assert.equal(claimSameTurnRead(keys, readRangeKey("/workspace/src/a.ts", 51, 100)), true, "不同区间应放行")
	assert.equal(claimSameTurnRead(keys, readRangeKey("/workspace/src/b.ts", 1, 50)), true, "不同文件应放行")
})

test("缺省 start 与 start_line=1 同键：第二种写法仍算同轮重复", () => {
	const keys = new Set<string>()
	assert.equal(claimSameTurnRead(keys, readRangeKey("/workspace/src/a.ts")), true)
	assert.equal(claimSameTurnRead(keys, readRangeKey("/workspace/src/a.ts", 1)), false, "归一后同键，应拦")
})

test("写入失效后：同轮重读放行", () => {
	const state = fakeState()
	const key = readRangeKey("/workspace/src/a.ts", 1, 50)
	assert.equal(claimSameTurnRead(state.sameTurnReadKeys, key), true)
	assert.equal(claimSameTurnRead(state.sameTurnReadKeys, key), false)

	// 模型写入该文件（写路径会调 invalidateRepeatWindowForPath）
	invalidateRepeatWindowForPath(state, "src/a.ts")

	assert.equal(state.sameTurnReadKeys.size, 0, "失效后不应残留该文件的名额")
	assert.equal(claimSameTurnRead(state.sameTurnReadKeys, key), true, "改完立刻读回应放行")
})

test("写入失效只清该文件：别名路径不误清其它文件", () => {
	const state = fakeState()
	const a = readRangeKey("/workspace/src/a.ts", 1, 50)
	const b = readRangeKey("/workspace/src/b.ts", 1, 50)
	claimSameTurnRead(state.sameTurnReadKeys, a)
	claimSameTurnRead(state.sameTurnReadKeys, b)

	// 反斜杠/大小写等异形路径也要能清掉自己的（与 fileReadCounts 同判据）
	invalidateRepeatWindowForPath(state, "SRC\\a.ts")

	assert.equal(state.sameTurnReadKeys.has(a), false, "目标文件应被清")
	assert.equal(state.sameTurnReadKeys.has(b), true, "其它文件不应被误清")
})

test("跨轮（回合开头清空）后：放行", () => {
	const keys = new Set<string>()
	assert.equal(claimSameTurnRead(keys, KEY), true)
	// 新一轮入口：recursivelyMakeClineRequests 开头 clear()
	keys.clear()
	assert.equal(claimSameTurnRead(keys, KEY), true, "跨轮重读应放行")
})

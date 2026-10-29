/**
 * 冲突策略闸门（conflictPolicy.ts）回归测试。
 *
 * 锁死三件事：>20 组只问一次；「剩下的都这样」立即生效；取消要能中断整次更新。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { ConflictCancelled, createConflictPolicy } from "../../src/core/update/conflictPolicy"
import type { ConflictGroup } from "../../src/core/update/types"

function groups(count: number): ConflictGroup[] {
	return Array.from({ length: count }, (_, i) => ({
		kind: "file" as const,
		key: `ERB/f${i}.ERB`,
		label: `ERB/f${i}.ERB`,
		paths: [`ERB/f${i}.ERB`],
	}))
}

test("批量：30 组先问一次，选「全部合并」后逐组不再问", async () => {
	let batch = 0
	let one = 0
	const policy = createConflictPolicy({
		groupCount: 30,
		fileCount: 30,
		askBatch: async () => {
			batch++
			return "merge-all"
		},
		askOne: async () => {
			one++
			return "keep"
		},
	})
	const results: boolean[] = []
	for (const group of groups(30)) {
		results.push(await policy(group))
	}
	assert.equal(batch, 1)
	assert.equal(one, 0)
	assert.equal(results.every(Boolean), true)
})

test("批量：选「全部保留」后逐组返回 false 且不再问", async () => {
	let one = 0
	const policy = createConflictPolicy({
		groupCount: 25,
		fileCount: 25,
		askBatch: async () => "keep-all",
		askOne: async () => {
			one++
			return "merge"
		},
	})
	for (const group of groups(25)) {
		assert.equal(await policy(group), false)
	}
	assert.equal(one, 0)
})

test("批量：选「一个一个问」后逐组问；中途「剩下的都合并」立即生效", async () => {
	let one = 0
	const policy = createConflictPolicy({
		groupCount: 10,
		fileCount: 10,
		batchThreshold: 3,
		askBatch: async () => "one-by-one",
		askOne: async () => {
			one++
			return one === 2 ? "merge-rest" : "keep"
		},
	})
	const all = groups(10)
	assert.equal(await policy(all[0]!), false)
	assert.equal(await policy(all[1]!), true) // merge-rest
	for (const group of all.slice(2)) {
		assert.equal(await policy(group), true)
	}
	assert.equal(one, 2)
})

test("批量：组数不超过阈值时不问批量", async () => {
	let batch = 0
	const policy = createConflictPolicy({
		groupCount: 5,
		fileCount: 5,
		askBatch: async () => {
			batch++
			return "merge-all"
		},
		askOne: async () => "keep",
	})
	for (const group of groups(5)) {
		assert.equal(await policy(group), false)
	}
	assert.equal(batch, 0)
})

test("取消：批量里取消 / 单组里关窗都抛 ConflictCancelled", async () => {
	const cancelBatch = createConflictPolicy({
		groupCount: 30,
		fileCount: 30,
		askBatch: async () => "cancel",
		askOne: async () => "merge",
	})
	await assert.rejects(() => cancelBatch(groups(30)[0]!), ConflictCancelled)

	const cancelOne = createConflictPolicy({
		groupCount: 3,
		fileCount: 3,
		askBatch: async () => "one-by-one",
		askOne: async () => undefined,
	})
	await assert.rejects(() => cancelOne(groups(3)[0]!), ConflictCancelled)
})

/**
 * 计划指纹（U3）——「用户点过确认的计划」必须就是「实际执行的计划」。
 *
 * 二次 runUpdate 会重新联网、重新扫盘、重建计划；指纹的职责就是在确认回调里
 * 一眼认出"计划漂了"。这里逐字段验证指纹的敏感性：任何影响写盘内容的字段
 * 变了都必须认出来，纯展示字段变了不该误报。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { planFingerprint } from "../../src/core/update/plan"
import type { PlanEntry, UpdatePlan } from "../../src/core/update/types"

function entry(path: string, action: PlanEntry["action"], reason: PlanEntry["reason"], sha1?: string): PlanEntry {
	return { path, action, reason, theirsSha1: sha1 }
}

function plan(entries: PlanEntry[]): UpdatePlan {
	const summary = { write: 0, delete: 0, keep: 0, conflict: 0, unchanged: 0, keepByReason: {} }
	for (const item of entries) {
		if (item.action === "write") {
			summary.write++
		} else if (item.action === "delete") {
			summary.delete++
		} else if (item.action === "keep") {
			summary.keep++
		} else {
			summary.conflict++
		}
	}
	return { mode: "incremental", entries, groups: [], summary, warnings: [] }
}

test("指纹：同一份计划两次计算结果一致", () => {
	const p = plan([entry("ERB/a.ERB", "write", "clean-update", "x"), entry("ERB/b.ERB", "delete", "upstream-delete")])
	assert.equal(planFingerprint(p), planFingerprint(p))
})

test("指纹：条目顺序不同不算漂移", () => {
	const a = plan([entry("ERB/a.ERB", "write", "clean-update", "x"), entry("ERB/b.ERB", "write", "clean-update", "y")])
	const b = plan([entry("ERB/b.ERB", "write", "clean-update", "y"), entry("ERB/a.ERB", "write", "clean-update", "x")])
	assert.equal(planFingerprint(a), planFingerprint(b))
})

test("指纹：目标内容变了必须认出来（社区推了新版本）", () => {
	const a = plan([entry("ERB/a.ERB", "write", "clean-update", "oldsha1")])
	const b = plan([entry("ERB/a.ERB", "write", "clean-update", "newsha1")])
	assert.notEqual(planFingerprint(a), planFingerprint(b))
})

test("指纹：动作或路径变了必须认出来", () => {
	const a = plan([entry("ERB/a.ERB", "write", "clean-update", "x")])
	const b = plan([entry("ERB/a.ERB", "delete", "upstream-delete")])
	assert.notEqual(planFingerprint(a), planFingerprint(b))

	const c = plan([entry("ERB/other.ERB", "write", "clean-update", "x")])
	assert.notEqual(planFingerprint(a), planFingerprint(c))
})

test("指纹：条目数量变了必须认出来（新增文件）", () => {
	const a = plan([entry("ERB/a.ERB", "write", "clean-update", "x")])
	const b = plan([entry("ERB/a.ERB", "write", "clean-update", "x"), entry("ERB/new.ERB", "write", "upstream-add", "y")])
	assert.notEqual(planFingerprint(a), planFingerprint(b))
})

test("指纹：模式变了必须认出来（incremental ↔ first-sync）", () => {
	const a = plan([entry("ERB/a.ERB", "write", "clean-update", "x")])
	const b: UpdatePlan = { ...plan([entry("ERB/a.ERB", "write", "first-sync-bulk", "x")]), mode: "first-sync" }
	assert.notEqual(planFingerprint(a), planFingerprint(b))
})

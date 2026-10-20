/**
 * 冲突解决（把「待定」变成「可写」）的单元测试。
 *
 * 这里全部用内存里的 Map 当文件系统，不碰磁盘 —— 目的是把"什么时候敢合并、
 * 什么时候必须放弃"这几种分支钉死，因为这些分支决定了会不会写坏玩家的口上。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { resolveConflicts } from "../../src/core/update/mergeResolve"
import type { PlanEntry, RelPath, UpdatePlan } from "../../src/core/update/types"

interface Fake {
	path: RelPath
	local?: string
	theirs?: string
	base?: string | null
	/** 直接给字节，用于造非 UTF-8 */
	localBytes?: Buffer
}

function makePlan(fakes: Fake[], groupOf: (f: Fake) => { kind: "persona" | "file"; key: string }): UpdatePlan {
	const entries: PlanEntry[] = fakes.map((f) => ({
		path: f.path,
		action: "conflict",
		reason: "both-changed",
		localSha1: f.localBytes ? "raw" : `local-${f.path}`,
		theirsSha1: f.theirs === undefined ? undefined : `theirs-${f.path}`,
		baseSha1: f.base === null ? undefined : `base-${f.path}`,
	}))
	const groups = new Map<string, { kind: "persona" | "file"; key: string; paths: RelPath[] }>()
	for (const f of fakes) {
		const g = groupOf(f)
		const id = `${g.kind}:${g.key}`
		const existing = groups.get(id) ?? { ...g, paths: [] }
		existing.paths.push(f.path)
		groups.set(id, existing)
	}
	return {
		mode: "incremental",
		entries,
		groups: [...groups.values()].map((g) => ({ ...g, label: g.key })),
		summary: {
			write: 0,
			delete: 0,
			keep: 0,
			conflict: fakes.length,
			unchanged: 0,
			keepByReason: {},
		},
		warnings: [],
	}
}

function readers(fakes: Fake[]) {
	const local = new Map<RelPath, Buffer>()
	const theirs = new Map<RelPath, Buffer>()
	const base = new Map<RelPath, Buffer>()
	for (const f of fakes) {
		if (f.localBytes) {
			local.set(f.path, f.localBytes)
		} else if (f.local !== undefined) {
			local.set(f.path, Buffer.from(f.local, "utf8"))
		}
		if (f.theirs !== undefined) {
			theirs.set(f.path, Buffer.from(f.theirs, "utf8"))
		}
		if (typeof f.base === "string") {
			base.set(f.path, Buffer.from(f.base, "utf8"))
		}
	}
	return {
		readLocal: async (rel: RelPath) => local.get(rel) ?? null,
		readTheirs: async (rel: RelPath) => theirs.get(rel) ?? null,
		readBase: async (rel: RelPath) => base.get(rel) ?? null,
	}
}

const BASE_ERB = "@FOO\nIF A\n\tPRINTL 1\nENDIF\nRETURNF 0\n"

test("冲突解决：没有冲突时什么都不做", async () => {
	const plan = makePlan([], () => ({ kind: "file", key: "x" }))
	plan.summary.conflict = 0
	let asked = 0
	const result = await resolveConflicts({
		plan,
		...readers([]),
		ask: async () => {
			asked++
			return ""
		},
		shouldMerge: () => true,
	})
	assert.equal(asked, 0)
	assert.equal(result.overrides.size, 0)
	assert.deepEqual(result.files, [])
})

test("冲突解决：用户不同意时一律保留本地，一次模型都不调", async () => {
	const fakes: Fake[] = [
		{ path: "ERB/a.ERB", local: BASE_ERB.replace("PRINTL 1", "PRINTL 本地"), theirs: BASE_ERB, base: BASE_ERB },
	]
	let asked = 0
	const result = await resolveConflicts({
		plan: makePlan(fakes, () => ({ kind: "file", key: "a" })),
		...readers(fakes),
		ask: async () => {
			asked++
			return ""
		},
		shouldMerge: () => false,
	})
	assert.equal(asked, 0)
	assert.equal(result.overrides.size, 0)
	assert.equal(result.files[0].decision, "keep-local")
	assert.equal(result.groups[0].kept, 1)
})

test("冲突解决：合并成功时产出 overrides 与指纹", async () => {
	const fakes: Fake[] = [
		{
			path: "ERB/a.ERB",
			local: BASE_ERB.replace("PRINTL 1", "PRINTL 本地"),
			theirs: BASE_ERB.replace("PRINTL 1", "PRINTL 社区"),
			base: BASE_ERB,
		},
	]
	const result = await resolveConflicts({
		plan: makePlan(fakes, () => ({ kind: "file", key: "a" })),
		...readers(fakes),
		ask: async () => "PRINTL 合并",
		shouldMerge: () => true,
	})
	assert.equal(result.files[0].decision, "merged")
	assert.equal(result.overrides.size, 1)
	assert.equal(result.writes.size, 1)
	assert.match(result.overrides.get("ERB/a.ERB")?.toString("utf8") ?? "", /PRINTL 合并/)
	assert.match(result.writes.get("ERB/a.ERB") ?? "", /^[0-9a-f]{40}$/)
	assert.equal(result.groups[0].merged, 1)
})

test("冲突解决：模型跑偏时退回保留本地，绝不写半成品", async () => {
	const fakes: Fake[] = [
		{
			path: "ERB/a.ERB",
			local: BASE_ERB.replace("PRINTL 1", "PRINTL 本地"),
			theirs: BASE_ERB.replace("PRINTL 1", "PRINTL 社区"),
			base: BASE_ERB,
		},
	]
	const result = await resolveConflicts({
		plan: makePlan(fakes, () => ({ kind: "file", key: "a" })),
		...readers(fakes),
		ask: async () => "CALL 不存在的函数",
		shouldMerge: () => true,
	})
	assert.equal(result.overrides.size, 0)
	assert.equal(result.files[0].decision, "keep-local")
	assert.ok(result.files[0].issues.length > 0)
})

test("冲突解决：非 UTF-8 文件判 unsupported，不猜编码", async () => {
	const fakes: Fake[] = [
		{
			path: "ERB/a.ERB",
			localBytes: Buffer.from([0x82, 0xa0, 0x82, 0xa2]),
			theirs: BASE_ERB,
			base: BASE_ERB,
		},
	]
	const result = await resolveConflicts({
		plan: makePlan(fakes, () => ({ kind: "file", key: "a" })),
		...readers(fakes),
		ask: async () => "",
		shouldMerge: () => true,
	})
	assert.equal(result.files[0].decision, "unsupported")
	assert.equal(result.overrides.size, 0)
})

test("冲突解决：拿不到上次社区版内容时不硬合并", async () => {
	const fakes: Fake[] = [{ path: "ERB/a.ERB", local: BASE_ERB, theirs: BASE_ERB, base: BASE_ERB }]
	let asked = 0
	const result = await resolveConflicts({
		plan: makePlan(fakes, () => ({ kind: "file", key: "a" })),
		readLocal: async () => Buffer.from(BASE_ERB, "utf8"),
		readTheirs: async () => Buffer.from(BASE_ERB, "utf8"),
		readBase: async () => null,
		baseAvailable: false,
		ask: async () => {
			asked++
			return ""
		},
		shouldMerge: () => true,
	})
	assert.equal(asked, 0)
	assert.equal(result.files[0].decision, "no-content")
	assert.match(result.files[0].issues[0].detail, /拿不到上次的社区版/)
})

test("冲突解决：上游删除的文件没有可合并内容", async () => {
	const fakes: Fake[] = [{ path: "ERB/a.ERB", local: BASE_ERB, base: BASE_ERB }]
	const result = await resolveConflicts({
		plan: makePlan(fakes, () => ({ kind: "file", key: "a" })),
		...readers(fakes),
		ask: async () => "",
		shouldMerge: () => true,
	})
	assert.equal(result.files[0].decision, "no-content")
})

test("冲突解决：按组询问，口上整包只问一次", async () => {
	const fakes: Fake[] = [
		{ path: "ERB/個人口上/053/x.ERB", local: BASE_ERB, theirs: BASE_ERB, base: BASE_ERB },
		{ path: "ERB/個人口上/053/y.ERB", local: BASE_ERB, theirs: BASE_ERB, base: BASE_ERB },
		{ path: "ERB/本体.ERB", local: BASE_ERB, theirs: BASE_ERB, base: BASE_ERB },
	]
	const askedGroups: string[] = []
	const result = await resolveConflicts({
		plan: makePlan(fakes, (f) =>
			f.path.includes("個人口上") ? { kind: "persona", key: "053" } : { kind: "file", key: f.path },
		),
		...readers(fakes),
		ask: async () => BASE_ERB,
		shouldMerge: (group) => {
			askedGroups.push(group.key)
			return false
		},
	})
	assert.deepEqual(askedGroups, ["053", "ERB/本体.ERB"])
	assert.equal(result.groups.length, 2)
	assert.equal(result.groups[0].paths.length, 2)
})

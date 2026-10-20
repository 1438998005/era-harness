/**
 * G4 调用方检索回归测试。
 *
 * 判据正本：shared-trae `knowledge/eratw/import-merge-gates.md` G4。
 * 命名空间纪律（文档仓 Reference 确认）：CALL/TRYCALL/TRYCCALL/JUMP + CALLFORM 家族
 * → @NAME；CALLF → #FUNCTION（不参与）；GOTO $NAME → 函数内标签（不参与）。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { buildLabelIndex, extractGlobalCallRefs, findOrphanedCallers, type LabelIndex } from "../../src/core/update/labels"
import { buildPlan } from "../../src/core/update/plan"
import type { LocalScan, RelPath, UpstreamSnapshot } from "../../src/core/update/types"

// ─────────────────────────────────────────────────────────────────────────────
// 调用点提取（命名空间纪律）
// ─────────────────────────────────────────────────────────────────────────────

test("提取：CALL 家族与 JUMP 的 @NAME/裸名都收", () => {
	const text = ["@CALLER", "\tCALL FOO", "\tCALL FOO, 1, 2", "\tTRYCALL BAR", "\tTRYCCALL BAZ", "\tJUMP @QUX"].join("\n")
	const refs = extractGlobalCallRefs("a.ERB", text)
	assert.deepEqual(
		refs.map((r) => r.target),
		["FOO", "FOO", "BAR", "BAZ", "QUX"],
	)
	assert.equal(refs[0].line, 2)
})

test("提取：CALLFORM 家族静态目标收，动态跳过", () => {
	const text = [
		"@CALLER",
		"\tCALLFORM STATIC_ONE",
		"\tTRYCALLFORM M_KOJO%RESULTS%_SUCCESS_K1_1",
		"\tTRYCCALLFORM DYNAMIC_{LOCAL}",
		"\tTRYCALLFORM ANOTHER",
	].join("\n")
	const refs = extractGlobalCallRefs("a.ERB", text)
	assert.deepEqual(
		refs.map((r) => r.target),
		["STATIC_ONE", "ANOTHER"],
	)
})

test("提取：注释、CALLF、GOTO $NAME 不收（命名空间纪律）", () => {
	const text = [
		"@CALLER",
		"\t; CALL COMMENTED",
		"\tRESULTS = CALLF SOME_FUNCTION(1)",
		"\tGOTO $LOCAL_LABEL",
		"\tCALLFORM %DYNAMIC%",
	].join("\n")
	assert.deepEqual(extractGlobalCallRefs("a.ERB", text), [])
})

// ─────────────────────────────────────────────────────────────────────────────
// 索引与孤儿判定
// ─────────────────────────────────────────────────────────────────────────────

function index(files: Array<{ path: RelPath; text: string }>): LabelIndex {
	return buildLabelIndex(files)
}

test("索引：定义与调用各归各的键", () => {
	const idx = index([
		{ path: "ERB/a.ERB", text: "@FOO\nRETURN\n@BAR\n\tCALL FOO" },
		{ path: "ERB/b.ERB", text: "@CALLER\n\tCALL FOO\n\tJUMP @BAR" },
	])
	assert.deepEqual(idx.defs.get("FOO"), ["ERB/a.ERB"])
	assert.deepEqual(idx.defs.get("BAR"), ["ERB/a.ERB"])
	assert.equal(idx.calls.get("FOO")?.length, 2)
	assert.equal(idx.calls.get("BAR")?.length, 1)
	assert.equal(idx.files, 2)
})

test("G4：改动集外的调用方 + 无残留定义 → 报孤儿", () => {
	const idx = index([
		{ path: "ERB/a.ERB", text: "@GONE\nRETURN" },
		{ path: "ERB/mod.ERB", text: "@MY_MOD\n\tCALL GONE" },
	])
	const findings = findOrphanedCallers(idx, new Set(["GONE"]), new Set(["ERB/a.ERB"]))
	assert.equal(findings.length, 1)
	assert.equal(findings[0].gate, "G4")
	assert.equal(findings[0].code, "caller-orphaned")
	assert.equal(findings[0].path, "ERB/mod.ERB")
	assert.equal(findings[0].line, 2)
})

test("G4：改动集内还有定义 → 调用有着落，不报", () => {
	const idx = index([
		{ path: "ERB/a.ERB", text: "@GONE\nRETURN" },
		{ path: "ERB/b.ERB", text: "@GONE\nRETURN" }, // 另一处定义（本身是重复定义，但不是孤儿调用）
		{ path: "ERB/mod.ERB", text: "@MY_MOD\n\tCALL GONE" },
	])
	const findings = findOrphanedCallers(idx, new Set(["GONE"]), new Set(["ERB/a.ERB"]))
	assert.deepEqual(findings, [])
})

test("G4：调用方全在改动集内 → 不报（那是 G3 的活）", () => {
	const idx = index([
		{ path: "ERB/a.ERB", text: "@GONE\nRETURN" },
		{ path: "ERB/b.ERB", text: "@CALLER\n\tCALL GONE" },
	])
	const findings = findOrphanedCallers(idx, new Set(["GONE"]), new Set(["ERB/a.ERB", "ERB/b.ERB"]))
	assert.deepEqual(findings, [])
})

test("G4：没有调用方 → 不报", () => {
	const idx = index([{ path: "ERB/a.ERB", text: "@GONE\nRETURN" }])
	assert.deepEqual(findOrphanedCallers(idx, new Set(["GONE"]), new Set(["ERB/a.ERB"])), [])
})

test("G4：热门函数最多列 3 个调用点 + 汇总条", () => {
	const files = [{ path: "ERB/a.ERB", text: "@GONE\nRETURN" }]
	for (let i = 0; i < 5; i++) {
		files.push({ path: `ERB/mod${i}.ERB`, text: `@M${i}\n\tCALL GONE` })
	}
	const findings = findOrphanedCallers(index(files), new Set(["GONE"]), new Set(["ERB/a.ERB"]))
	assert.equal(findings.length, 4) // 3 个调用点 + 1 条汇总
	assert.match(findings[3].detail, /还有 2 处/)
})

// ─────────────────────────────────────────────────────────────────────────────
// plan 接线
// ─────────────────────────────────────────────────────────────────────────────

function makeScan(files: Array<[RelPath, string]>): LocalScan {
	return {
		root: "/g",
		files: new Map(files.map(([rel]) => [rel, { sha1: rel, size: 1, mtimeMs: 0 }])),
		batches: { batches: [], bulkPaths: new Set(), reliable: false, threshold: 0, total: files.length },
		excludedDirs: [],
		scannedAt: "",
	}
}

function makeTheirs(files: Array<[RelPath, string]>): UpstreamSnapshot {
	return {
		label: "develop@deadbeef",
		files: new Map(files.map(([rel]) => [rel, { sha1: `${rel}-t`, size: 2 }])),
	}
}

test("plan 接线：本地 MOD 调了上游删掉的函数 → G4 进 plan", () => {
	const gateContents = new Map<RelPath, { local: string | null; theirs: string | null }>([
		["ERB/a.ERB", { local: "@GONE\nRETURN\n@KEEP\nRETURN", theirs: "@KEEP\nRETURN" }],
	])
	const labelIndex = index([
		{ path: "ERB/a.ERB", text: "@GONE\nRETURN\n@KEEP\nRETURN" },
		{ path: "ERB/mod.ERB", text: "@MY_MOD\n\tCALL GONE" },
	])
	const plan = buildPlan({
		base: null,
		local: makeScan([
			["ERB/a.ERB", "x"],
			["ERB/mod.ERB", "y"],
		]),
		theirs: makeTheirs([["ERB/a.ERB", "x"]]),
		firstSyncPolicy: "add-only",
		gateContents,
		labelIndex,
	})
	const g4 = plan.gateFindings?.filter((f) => f.gate === "G4") ?? []
	assert.equal(g4.length, 1)
	assert.equal(g4[0].path, "ERB/mod.ERB")
	assert.match(g4[0].detail, /GONE/)
})

test("plan 接线：不传 labelIndex 就没有 G4", () => {
	const gateContents = new Map<RelPath, { local: string | null; theirs: string | null }>([
		["ERB/a.ERB", { local: "@GONE\nRETURN\n@KEEP\nRETURN", theirs: "@KEEP\nRETURN" }],
	])
	const plan = buildPlan({
		base: null,
		local: makeScan([["ERB/a.ERB", "x"]]),
		theirs: makeTheirs([["ERB/a.ERB", "x"]]),
		firstSyncPolicy: "add-only",
		gateContents,
	})
	assert.equal(
		plan.gateFindings?.some((f) => f.gate === "G4"),
		false,
	)
})

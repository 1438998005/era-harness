/**
 * 导入合并闸门（G2/G3/G6/G7）回归测试。
 *
 * 判据正本：shared-trae `knowledge/eratw/import-merge-gates.md`；
 * 产品内嵌副本：核心库 `src/knowledge/data/update-merge-gates.ts`。
 * 本测试锁定 gates.ts 的解析行为——改判据前先改这里。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	auditRandBranches,
	collectChangedLabels,
	decodeLikeEngine,
	dispatchDriftFindings,
	dispatchLabelFindings,
	eolMixedFinding,
	hphResidueFindings,
	randGateFindings,
	runContentGates,
} from "../../src/core/update/gates"
import { buildPlan } from "../../src/core/update/plan"
import type { LocalScan, RelPath, UpstreamSnapshot } from "../../src/core/update/types"

// ─────────────────────────────────────────────────────────────────────────────
// G2：RAND 双侧校验
// ─────────────────────────────────────────────────────────────────────────────

test("G2：满额分支不报", () => {
	const text = ["@FOO", "\tRAND:2", "\tCASE 0", "\t\tPRINTL A", "\tCASE 1", "\t\tPRINTL B", "\tENDSELECT"].join("\n")
	assert.deepEqual(randGateFindings("a.ERB", text), [])
})

test("G2：RAND:9 只有 CASE 0–4 → 落空 4/9", () => {
	const text = [
		"@FOO",
		"\tRAND:9",
		"\tCASE 0",
		"\t\tPRINTL A",
		"\tCASE 1",
		"\tCASE 2",
		"\tCASE 3",
		"\tCASE 4",
		"\t\tPRINTL B",
	].join("\n")
	const findings = randGateFindings("a.ERB", text)
	assert.equal(findings.length, 1)
	assert.equal(findings[0].code, "rand-hollow")
	assert.match(findings[0].detail, /4\/9/)
})

test("G2：CASE 值 ≥ RAND → 死分支", () => {
	const text = ["@FOO", "\tRAND:3", "\tCASE 0", "\tCASE 1", "\tCASE 2", "\tCASE 5"].join("\n")
	const findings = randGateFindings("a.ERB", text)
	assert.equal(findings.length, 1)
	assert.equal(findings[0].code, "rand-unreachable")
	assert.match(findings[0].detail, /CASE 5/)
})

test("G2：同一块同时报死分支与落空（复制粘贴错位的典型形态）", () => {
	const text = ["@FOO", "\tRAND:3", "\tCASE 0", "\tCASE 1", "\tCASE 7"].join("\n")
	const codes = randGateFindings("a.ERB", text)
		.map((f) => f.code)
		.sort()
	assert.deepEqual(codes, ["rand-hollow", "rand-unreachable"])
})

test("G2：CASEELSE 兜底不算落空", () => {
	const text = ["@FOO", "\tRAND:9", "\tCASE 0", "\tCASE 1", "\tCASEELSE", "\t\tPRINTL X"].join("\n")
	assert.deepEqual(randGateFindings("a.ERB", text), [])
})

test("G2：CASE 多值与 SELECTCASE 夹层都正确对账", () => {
	const text = [
		"@FOO",
		"\tRAND:3",
		"\tSELECTCASE RESULT",
		"\tCASE 0, 1",
		"\t\tPRINTL A",
		"\tCASE 2",
		"\t\tPRINTL B",
		"\tENDSELECT",
	].join("\n")
	assert.deepEqual(randGateFindings("a.ERB", text), [])
})

test("G2：表达式位 RAND（参数）不参与分发对账", () => {
	const text = ["@FOO", "\tGDRAWGWITHROTATE 3, 0, RAND:360", "\tPRINTFORML {RAND:100}"].join("\n")
	assert.deepEqual(auditRandBranches(text), [])
})

test("G2：块在缩进回升的真语句处收口，嵌套块互不污染", () => {
	const text = [
		"@FOO",
		"\tRAND:2",
		"\tCASE 0",
		"\t\tRAND:3",
		"\t\tCASE 0",
		"\t\tCASE 1",
		"\t\tCASE 2",
		"\tCASE 1",
		"\tRETURN",
	].join("\n")
	const blocks = auditRandBranches(text)
	assert.equal(blocks.length, 2)
	assert.equal(blocks[0].rand, 2)
	assert.deepEqual(blocks[0].cases, [0, 1])
	assert.equal(blocks[1].rand, 3)
	assert.deepEqual(blocks[1].cases, [0, 1, 2])
})

// ─────────────────────────────────────────────────────────────────────────────
// G3：派发拼名
// ─────────────────────────────────────────────────────────────────────────────

test("G3：上游删标签但派发仍在 → 报断裂", () => {
	const local = ["@OLD_HANDLER", "RETURN", "@KEEP", "RETURN"].join("\n")
	const theirs = ["@KEEP", "RETURN", "@CALLER", "\tTRYCALLFORM OLD_HANDLER", "\tRETURN"].join("\n")
	const findings = dispatchDriftFindings("a.ERB", local, theirs, new Set(["KEEP", "CALLER"]))
	assert.equal(findings.length, 1)
	assert.equal(findings[0].code, "dispatch-removed")
	assert.match(findings[0].detail, /OLD_HANDLER/)
})

test("G3：改动集里别的文件还定义着同名标签 → 不报", () => {
	const local = "@OLD_HANDLER\nRETURN"
	const theirs = "@CALLER\n\tTRYCALLFORM OLD_HANDLER"
	const findings = dispatchDriftFindings("a.ERB", local, theirs, new Set(["OLD_HANDLER"]))
	assert.deepEqual(findings, [])
})

test("G3：动态拼名目标跳过（静态判不了）", () => {
	const local = "@OLD_HANDLER\nRETURN"
	const theirs = "@CALLER\n\tTRYCALLFORM M_KOJO%RESULTS%_SUCCESS_K1_1\n\tTRYCALLFORM FOO_{LOCAL}"
	assert.deepEqual(dispatchDriftFindings("a.ERB", local, theirs, new Set(["CALLER"])), [])
})

test("G3 原语：静态派发 vs 标签集", () => {
	const text = "@A\n\tTRYCALLFORM B\n\tTRYCALLFORM C\n"
	const findings = dispatchLabelFindings("a.ERB", text, new Set(["A", "B"]))
	assert.equal(findings.length, 1)
	assert.match(findings[0].detail, /C/)
})

// ─────────────────────────────────────────────────────────────────────────────
// G6 / G7
// ─────────────────────────────────────────────────────────────────────────────

test("G6：字符串含 HPH/BPB 报回归；注释与变量名不误报", () => {
	const text = ["@A", "\tPRINTFORML 你说 HPH 呢", "\tPRINTFORML 没事 BPB 啊", "\t; HPH 在注释里不算", "\tHPHCOUNT = 1"].join(
		"\n",
	)
	const findings = hphResidueFindings("a.ERB", text)
	assert.equal(findings.length, 2)
	assert.equal(findings[0].line, 2)
	assert.equal(findings[1].line, 3)
})

test("G7：混用行尾才报", () => {
	assert.equal(eolMixedFinding("a.ERB", "A\r\nB\r\n").length, 0)
	assert.equal(eolMixedFinding("a.ERB", "A\nB\n").length, 0)
	const mixed = eolMixedFinding("a.ERB", "A\r\nB\nC\r\n")
	assert.equal(mixed.length, 1)
	assert.equal(mixed[0].code, "eol-mixed")
})

// ─────────────────────────────────────────────────────────────────────────────
// 解码（引擎口径）
// ─────────────────────────────────────────────────────────────────────────────

test("decodeLikeEngine：BOM 剥离 / CP932 兜底 / 坏字节不抛", () => {
	const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("@A\n", "utf8")])
	assert.equal(decodeLikeEngine(bom), "@A\n")

	const cp932 = Buffer.from("@A\n", "utf8") // 纯 ASCII 两种编码同字节
	assert.equal(decodeLikeEngine(cp932), "@A\n")

	// 0xFF 不是合法 UTF-8：严格解码失败 → 落 shift-jis，不抛
	const broken = Buffer.concat([Buffer.from("@A\n", "utf8"), Buffer.from([0xff])])
	assert.ok(decodeLikeEngine(broken).startsWith("@A"))
})

// ─────────────────────────────────────────────────────────────────────────────
// 汇总与 plan 接线
// ─────────────────────────────────────────────────────────────────────────────

test("runContentGates：一个文件跑全部门，finding 带行号", () => {
	const local = "@GONE\nRETURN\n@KEEP\nRETURN"
	const theirs = ["@KEEP", "RETURN", "@CALLER", "\tTRYCALLFORM GONE", "\tRAND:4", "\tCASE 0", "\tCASE 1"].join("\n")
	const findings = runContentGates("a.ERB", { local, theirs }, new Set(["KEEP", "CALLER"]))
	const codes = findings.map((f) => f.code).sort()
	assert.deepEqual(codes, ["dispatch-removed", "rand-hollow"])
	const rand = findings.find((f) => f.code === "rand-hollow")
	assert.equal(rand?.line, 5)
})

test("collectChangedLabels：并集且容忍 null 文本", () => {
	const labels = collectChangedLabels([
		{ path: "a.ERB", text: "@A\n@B" },
		{ path: "b.ERB", text: null },
		{ path: "c.ERB", text: "@C" },
	])
	assert.deepEqual([...labels].sort(), ["A", "B", "C"])
})

test("plan 接线：gateContents 有内容才跑，finding 进 plan", () => {
	const local: LocalScan = {
		root: "/g",
		files: new Map<RelPath, { sha1: string; size: number; mtimeMs: number }>([
			["ERB/a.ERB", { sha1: "aaa", size: 1, mtimeMs: 0 }],
		]),
		batches: { batches: [], bulkPaths: new Set(), reliable: false, threshold: 0, total: 1 },
		excludedDirs: [],
		scannedAt: "",
	}
	const theirs: UpstreamSnapshot = {
		label: "develop@deadbeef",
		files: new Map<RelPath, { sha1: string; size: number }>([["ERB/a.ERB", { sha1: "bbb", size: 2 }]]),
	}
	const base = {
		write: ["ERB/a.ERB"],
		gateContents: new Map([
			[
				"ERB/a.ERB" as RelPath,
				{
					local: "@A\n\tRAND:5\n\tCASE 0\n",
					theirs: "@A\n\tRAND:5\n\tCASE 0\n\tCASE 1\n",
				},
			],
		]),
	}
	const withGates = buildPlan({
		base: null,
		local,
		theirs,
		firstSyncPolicy: "add-only",
		gateContents: base.gateContents,
	})
	assert.equal(withGates.gateFindings?.length, 1)
	assert.equal(withGates.gateFindings?.[0].code, "rand-hollow")
	assert.equal(withGates.gatesSkipped, undefined)

	const withoutGates = buildPlan({ base: null, local, theirs, firstSyncPolicy: "add-only" })
	assert.equal(withoutGates.gateFindings, undefined)
})

/**
 * 判定表 × 规范形哈希：换行/BOM 差异不能再被当成「你改过」。
 *
 * 这些用例直接锁 2026-10-29 事故的判定口径：本地 CRLF、上游 LF 时，
 * 内容相同的文件必须判 unchanged（一个字节都不写），内容真变的才走替换/冲突。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { detectBatches } from "../../src/core/update/manifest"
import { buildPlan } from "../../src/core/update/plan"
import type { FileFingerprint, LocalScan, RelPath, UpstreamSnapshot } from "../../src/core/update/types"

function fp(sha1: string, canonBlobSha1?: string): FileFingerprint {
	return { sha1, canonBlobSha1, size: 1, mtimeMs: 1000 * 60_000 }
}

function makeLocal(files: Record<string, FileFingerprint>): LocalScan {
	const map = new Map<RelPath, FileFingerprint>()
	for (const [path, value] of Object.entries(files)) {
		map.set(path, value)
	}
	return {
		root: "/game",
		files: map,
		batches: detectBatches(map, { minCount: 2, minRatio: 0 }),
		excludedDirs: [],
		scannedAt: "",
	}
}

function makeTheirs(files: Record<string, { sha1: string; canonBlobSha1?: string }>): UpstreamSnapshot {
	const map = new Map<RelPath, { sha1: string; canonBlobSha1?: string; size: number }>()
	for (const [path, value] of Object.entries(files)) {
		map.set(path, { ...value, size: 1 })
	}
	return { label: "test", files: map }
}

function makeBase(
	files: Record<string, { sha1: string; canonBlobSha1?: string }>,
): Map<RelPath, { sha1: string; canonBlobSha1?: string }> {
	const map = new Map<RelPath, { sha1: string; canonBlobSha1?: string }>()
	for (const [path, value] of Object.entries(files)) {
		map.set(path, value)
	}
	return map
}

test("canon 判定：本地 CRLF、上游 LF、内容相同 → unchanged", () => {
	const plan = buildPlan({
		base: makeBase({ "ERB/a.ERB": { sha1: "base-lf", canonBlobSha1: "canon-a" } }),
		local: makeLocal({ "ERB/a.ERB": fp("local-crlf", "canon-a") }),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "theirs-lf", canonBlobSha1: "canon-a" } }),
	})
	assert.equal(plan.summary.unchanged, 1)
	assert.equal(plan.summary.write, 0)
	assert.equal(plan.summary.conflict, 0)
	assert.equal(plan.entries.length, 0)
})

test("canon 判定：上游真改了、本地只是换行不同 → clean-update（不是冲突）", () => {
	const plan = buildPlan({
		base: makeBase({ "ERB/a.ERB": { sha1: "base-v1", canonBlobSha1: "canon-v1" } }),
		local: makeLocal({ "ERB/a.ERB": fp("local-crlf", "canon-v1") }),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "theirs-v2", canonBlobSha1: "canon-v2" } }),
	})
	assert.equal(plan.summary.write, 1)
	assert.equal(plan.summary.conflict, 0)
	assert.equal(plan.entries[0]?.reason, "clean-update")
})

test("canon 判定：本地真改了内容 → 仍然算 both-changed", () => {
	const plan = buildPlan({
		base: makeBase({ "ERB/a.ERB": { sha1: "base-v1", canonBlobSha1: "canon-v1" } }),
		local: makeLocal({ "ERB/a.ERB": fp("local-edit", "canon-edit") }),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "theirs-v2", canonBlobSha1: "canon-v2" } }),
	})
	assert.equal(plan.summary.conflict, 1)
	assert.equal(plan.entries[0]?.reason, "both-changed")
})

test("canon 判定：上游删了、本地只差换行 → 照常删除", () => {
	const plan = buildPlan({
		base: makeBase({ "ERB/gone.ERB": { sha1: "base-lf", canonBlobSha1: "canon-g" } }),
		local: makeLocal({ "ERB/gone.ERB": fp("local-crlf", "canon-g") }),
		theirs: makeTheirs({}),
	})
	assert.equal(plan.summary.delete, 1)
	assert.equal(plan.summary.conflict, 0)
})

test("canon 判定：v1 基线没有 canon → 退回纯字节，不把真改动误判成 clean-update", () => {
	const plan = buildPlan({
		base: makeBase({ "ERB/a.ERB": { sha1: "base-lf" } }),
		local: makeLocal({ "ERB/a.ERB": fp("local-crlf", "canon-v1") }),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "theirs-v2", canonBlobSha1: "canon-v2" } }),
	})
	// 缺 canon 时不能凭本地单边的 canon 判同 —— 只能走 raw：base≠local、base≠theirs → 冲突
	assert.equal(plan.summary.write, 0)
	assert.equal(plan.summary.conflict, 1)
	assert.equal(plan.entries[0]?.reason, "both-changed")
})

test("一次性策略 keep-all：冲突全部改成保留，不产生任何询问组", () => {
	const plan = buildPlan({
		base: makeBase({
			"ERB/a.ERB": { sha1: "b1", canonBlobSha1: "c1" },
			"ERB/b.ERB": { sha1: "b2", canonBlobSha1: "c2" },
		}),
		local: makeLocal({
			"ERB/a.ERB": fp("l1", "x1"),
			"ERB/b.ERB": fp("l2", "x2"),
		}),
		theirs: makeTheirs({
			"ERB/a.ERB": { sha1: "t1", canonBlobSha1: "y1" },
			"ERB/b.ERB": { sha1: "t2", canonBlobSha1: "y2" },
		}),
		conflictPolicy: "keep-all",
	})
	assert.equal(plan.summary.conflict, 0)
	assert.equal(plan.summary.keep, 2)
	assert.equal(plan.groups.length, 0)
	assert.equal(
		plan.entries.every((entry) => entry.reason === "bulk-keep-local"),
		true,
	)
})

test("一次性策略 take-theirs：冲突改成替换，上游删掉的跟着删", () => {
	const plan = buildPlan({
		base: makeBase({
			"ERB/a.ERB": { sha1: "b1", canonBlobSha1: "c1" },
			"ERB/gone.ERB": { sha1: "b3", canonBlobSha1: "c3" },
		}),
		local: makeLocal({
			"ERB/a.ERB": fp("l1", "x1"),
			"ERB/gone.ERB": fp("l3", "x3"),
		}),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "t1", canonBlobSha1: "y1" } }),
		conflictPolicy: "take-theirs",
	})
	assert.equal(plan.summary.conflict, 0)
	assert.equal(plan.summary.write, 1)
	assert.equal(plan.summary.delete, 1)
	assert.equal(plan.groups.length, 0)
	const reasons = plan.entries.map((entry) => entry.reason).sort()
	assert.deepEqual(reasons, ["bulk-take-theirs", "upstream-delete"])
})

// —— 老记录（3.92.1 及更早，只有纯字节 sha1）必须还能比得上 ——
// 规范形摘要做成 git blob id 就是为了这一步：没有它，老用户第一次更新
// 照样会把上千个「只差换行」的文件判成改过。

test("老记录：base 只有纯字节 sha1，本地是 CRLF 变体 → 判「你没改过」（clean-update）", () => {
	const plan = buildPlan({
		// base 记的是当时那份 LF 文件的 blob id；本地是 CRLF，raw 不同但规范形 blob 相同
		base: makeBase({ "ERB/a.ERB": { sha1: "lf-blob-v1" } }),
		local: makeLocal({ "ERB/a.ERB": fp("crlf-blob-v1", "lf-blob-v1") }),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "lf-blob-v2", canonBlobSha1: "lf-blob-v2" } }),
	})
	assert.equal(plan.summary.conflict, 0, "不能因为换行差异判成冲突")
	assert.equal(plan.summary.write, 1)
	assert.equal(plan.entries[0]?.reason, "clean-update")
})

test("老记录：base 只有纯字节 sha1，本地 CRLF 且上游没动 → 判「你不用动」", () => {
	const plan = buildPlan({
		base: makeBase({ "ERB/a.ERB": { sha1: "lf-blob-v1" } }),
		local: makeLocal({ "ERB/a.ERB": fp("crlf-blob-v1", "lf-blob-v1") }),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "lf-blob-v1" } }),
	})
	assert.equal(plan.summary.unchanged, 1)
	assert.equal(plan.summary.write, 0)
})

test("老记录：本地真有改动时仍然是「你改过」（⛔ 不能把改动一起抹掉）", () => {
	const plan = buildPlan({
		base: makeBase({ "ERB/a.ERB": { sha1: "lf-blob-v1" } }),
		local: makeLocal({ "ERB/a.ERB": fp("crlf-edited", "lf-blob-edited") }),
		theirs: makeTheirs({ "ERB/a.ERB": { sha1: "lf-blob-v1" } }),
	})
	assert.equal(plan.summary.keepByReason["local-change"], 1)
	assert.equal(plan.summary.unchanged, 0)
})

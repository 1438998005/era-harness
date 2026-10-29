/**
 * 基线可信度（plan.ts#checkBaseline）回归测试。
 *
 * 判据要能同时做到两件事：
 * 1. 整合包/转码导致的系统性对不上 → 判 suspect，让上层只问一次；
 * 2. 用户真的手改了一部分 → 仍然判 ok，不能把正常用户吓一跳。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { describePlan } from "../../src/core/update/describe"
import { detectBatches } from "../../src/core/update/manifest"
import { buildPlan, checkBaseline } from "../../src/core/update/plan"
import type { FileFingerprint, LocalScan, RelPath, UpstreamSnapshot } from "../../src/core/update/types"

interface Triple {
	base: Map<RelPath, { sha1: string; canonBlobSha1?: string }>
	local: LocalScan
	theirs: UpstreamSnapshot
}

/**
 * 造 N 个文件的三方快照。
 * - `localEdits`：本地真的改了内容的文件比例（canon 不同）
 * - `localVariant`：本地只是换行/BOM 不同（canon 相同）
 * - `withCanon`：base 是否带 canon（false = 模拟 v1 老 state）
 */
function makeTriple(
	count: number,
	opts: {
		localEdits?: number
		localVariant?: boolean
		withCanon?: boolean
		baseCount?: number
		/** 前 N 个文件上游也改了（制造真实冲突） */
		theirsChanged?: number
	} = {},
): Triple {
	const edits = opts.localEdits ?? 0
	const changed = opts.theirsChanged ?? 0
	const base = new Map<RelPath, { sha1: string; canonBlobSha1?: string }>()
	const localFiles = new Map<RelPath, FileFingerprint>()
	const theirsFiles = new Map<RelPath, { sha1: string; canonBlobSha1?: string; size: number }>()
	const baseCount = opts.baseCount ?? count

	for (let i = 0; i < count; i++) {
		const path = `ERB/f${i}.ERB`
		const canon = `canon-${i}`
		const isEdited = i < edits
		const upstreamChanged = i < changed
		theirsFiles.set(path, {
			sha1: upstreamChanged ? `theirs-changed-${i}` : `base-${i}`,
			canonBlobSha1: upstreamChanged ? `theirs-changed-${i}` : canon,
			size: 10,
		})
		if (i < baseCount) {
			base.set(path, opts.withCanon === false ? { sha1: `base-${i}` } : { sha1: `base-${i}`, canonBlobSha1: canon })
		}
		// 本地：上游没动过（base==theirs），只有 EOL 变体或真改
		const localCanon = isEdited ? `edited-${i}` : canon
		localFiles.set(path, {
			sha1: opts.localVariant || isEdited ? `local-${i}` : `base-${i}`,
			canonBlobSha1: localCanon,
			size: 10,
			mtimeMs: 1000 * 60_000,
		})
	}

	return {
		base,
		local: {
			root: "/game",
			files: localFiles,
			batches: detectBatches(localFiles, { minCount: 2, minRatio: 0 }),
			excludedDirs: [],
			scannedAt: "",
		},
		theirs: { label: "test", files: theirsFiles },
	}
}

test("可信度：全 CRLF 变体 + LF 基线 → canon 下判 ok", () => {
	const { base, local, theirs } = makeTriple(1200, { localVariant: true })
	const check = checkBaseline(base, local, theirs)
	assert.equal(check.level, "ok")
	assert.equal(check.agreement, 1)
	assert.equal(check.sample, 1200)
})

test("可信度：v1 基线（无 canon）遇到 CRLF 变体 → 判 suspect", () => {
	const { base, local, theirs } = makeTriple(1200, { localVariant: true, withCanon: false })
	const check = checkBaseline(base, local, theirs)
	assert.equal(check.level, "suspect")
	assert.equal(check.agreement, 0)
})

test("可信度：用户真改了 40% → 判 suspect，但没有冲突时不弹窗（不打扰）", () => {
	const { base, local, theirs } = makeTriple(1200, { localEdits: 480 })
	const check = checkBaseline(base, local, theirs)
	assert.equal(check.level, "suspect")
	assert.equal(Math.round(check.agreement * 100), 60)
	// 上游没动过这些文件 → 全部静默保留，没有冲突要处理，因此不该告警
	const plan = buildPlan({ base, local, theirs })
	assert.equal(plan.summary.conflict, 0)
	assert.ok(!plan.warnings.includes("baseline-untrusted"))
})

test("可信度：用户只改了 5% → 判 ok", () => {
	const { base, local, theirs } = makeTriple(1200, { localEdits: 60 })
	const check = checkBaseline(base, local, theirs)
	assert.equal(check.level, "ok")
})

test("可信度：样本不足 1000 不下结论（unknown）", () => {
	const { base, local, theirs } = makeTriple(300, { localVariant: true, withCanon: false })
	const check = checkBaseline(base, local, theirs)
	assert.equal(check.level, "unknown")
	assert.equal(check.sample, 300)
})

test("可信度：基线路径大面积对不上（前缀没剥净）→ suspect", () => {
	const { base, local, theirs } = makeTriple(1200, { baseCount: 100 })
	const check = checkBaseline(base, local, theirs)
	assert.equal(check.level, "suspect")
	assert.ok(check.coverage < 0.5)
})

test("可信度：suspect 且真有冲突时计划带 warning，文案不出现行话且不替用户认账", () => {
	const { base, local, theirs } = makeTriple(1200, { localVariant: true, withCanon: false, theirsChanged: 10 })
	const plan = buildPlan({ base, local, theirs })
	assert.equal(plan.baseline?.level, "suspect")
	assert.ok(plan.summary.conflict > 0)
	assert.ok(plan.warnings.includes("baseline-untrusted"))
	const text = describePlan(plan, { fromVersion: "20261015", toVersion: "20261029" }).text
	assert.match(text, /差得太多/)
	assert.doesNotMatch(text, /你自己改过的/)
	for (const jargon of ["基线", "commit", "冲突", "覆盖", "上游", "分支", "仓库", "diff", "HEAD"]) {
		assert.ok(!text.includes(jargon), `文案不应出现「${jargon}」`)
	}
})

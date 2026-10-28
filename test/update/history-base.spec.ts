/**
 * 首次同步历史基线定位（F1，计划任务 D）——整合包误判修复的回归锁。
 *
 * 事故背景（2026-10-28 真实用户）：第三方整合包 mtime 多样 → mtime 批次判定失效 →
 * 590 个 both-changed 冲突窗口。修复：按本地 NOW_VERSION 在上游「动过 DIM.ERH 的提交」
 * 里定位发版点，用该点归档建合成基线；buildPlan 拿到非空 base 即走标准三方（plan.ts 零改动）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { findBaseCommit } from "../../src/core/update/historyBase"
import { buildPlan } from "../../src/core/update/plan"
import type {
	BatchDetection,
	FileFingerprint,
	LocalScan,
	RelPath,
	UpstreamFile,
	UpstreamSnapshot,
} from "../../src/core/update/types"

/** 假 GitLabSource：只实现 findBaseCommit 需要的两个方法（提交列表按新→旧） */
function fakeClient(versionByCommit: Record<string, string>, failFor: ReadonlySet<string> = new Set()) {
	const order = Object.keys(versionByCommit)
	return {
		listVersionCommits: async () => order.map((id) => ({ id })),
		rawFile: async (_path: string, ref: string) => {
			if (failFor.has(ref)) {
				throw new Error("network blip")
			}
			return Buffer.from(`; eraTW main version\nNOW_VERSION = ${versionByCommit[ref] ?? "0"}`)
		},
	}
}

test("历史基线定位：命中本地版本的发版点", async () => {
	const client = fakeClient({ "c3-new": "20261028", "c2-release": "20261004", "c1-old": "20260901" })
	assert.equal(await findBaseCommit(client, "20261004"), "c2-release")
})

test("同版本多个提交时取最早的那个（= 发版起点，最接近打包快照）", async () => {
	const client = fakeClient({ "c4-fix": "20261004", "c3-bump": "20261004", "c2-old": "20260901", "c1-old": "20260801" })
	assert.equal(await findBaseCommit(client, "20261004"), "c3-bump")
})

test("本地版本不在上游历史（比上游旧，魔改/未知来源）→ null，回退 mtime 路径", async () => {
	const client = fakeClient({ c3: "20261028", c2: "20261004", c1: "20260901" })
	assert.equal(await findBaseCommit(client, "20250101"), null)
})

test("本地比上游新 → null", async () => {
	const client = fakeClient({ c3: "20261028", c2: "20261004" })
	assert.equal(await findBaseCommit(client, "20271231"), null)
})

test("单个提交的 DIM.ERH 读不到时跳过，不炸整条流程", async () => {
	const client = fakeClient({ c3: "20261028", c2: "20261004" }, new Set(["c3"]))
	assert.equal(await findBaseCommit(client, "20261004"), "c2")
})

test("空 NOW_VERSION → null（不猜）", async () => {
	const client = fakeClient({ c2: "20261004" })
	assert.equal(await findBaseCommit(client, ""), null)
	assert.equal(await findBaseCommit(client, "   "), null)
})

/** 事故现场缩比模型：300 个打包者没动过的文件 + 2 个真改过 + 1 个本地独有 */
function makeScenario() {
	const base = new Map<RelPath, { sha1: string }>()
	const localFiles = new Map<RelPath, FileFingerprint>()
	const theirsFiles = new Map<RelPath, UpstreamFile>()
	for (let i = 0; i < 300; i++) {
		const rel = `ERB/f${i}.ERB`
		base.set(rel, { sha1: `b${i}` })
		// mtime 故意散开（模拟整合包多样 mtime）——修复后不再依赖 mtime
		localFiles.set(rel, { sha1: `b${i}`, size: 10, mtimeMs: 1_000_000 + i * 60_000 })
		theirsFiles.set(rel, { sha1: `t${i}`, size: 10 })
	}
	for (const [i, rel] of ["ERB/pack-a.ERB", "ERB/pack-b.ERB"].entries()) {
		base.set(rel, { sha1: `bp${i}` })
		localFiles.set(rel, { sha1: `mp${i}`, size: 10, mtimeMs: 2_000_000 + i })
		theirsFiles.set(rel, { sha1: `tp${i}`, size: 10 })
	}
	const localOnly = "ERB/私货.ERB"
	localFiles.set(localOnly, { sha1: "m0", size: 10, mtimeMs: 3_000_000 })

	const scan: LocalScan = {
		root: "D:/game",
		files: localFiles,
		batches: {
			batches: [],
			bulkPaths: new Set<RelPath>(),
			reliable: false,
			threshold: 0,
			total: 0,
		} satisfies BatchDetection,
		excludedDirs: [],
		scannedAt: new Date().toISOString(),
	}
	const theirs: UpstreamSnapshot = { label: "develop@head", files: theirsFiles }
	return { base, scan, theirs }
}

test("整合包形态：合成基线让打包者没动过的文件走 clean-update，而不是 both-changed", () => {
	const { base, scan, theirs } = makeScenario()
	const plan = buildPlan({ base, local: scan, theirs })

	assert.equal(plan.mode, "incremental")
	assert.equal(plan.summary.conflict, 2, "只有打包者真改过的文件才是冲突")
	assert.equal(plan.entries.filter((e) => e.reason === "clean-update").length, 300, "打包者没动过的文件必须走 clean-update")
	assert.equal(plan.entries.filter((e) => e.reason === "local-only").length, 1)
})

test("对照组：同一现场无基线（旧行为、mtime 批次失效）→ 大规模 first-sync-human 冲突", () => {
	const { scan, theirs } = makeScenario()
	const plan = buildPlan({ base: null, local: scan, theirs })

	assert.equal(plan.mode, "first-sync")
	assert.equal(plan.summary.conflict, 302, "旧行为下全部冲突（590 窗口事故的缩小版）")
	assert.ok(plan.warnings.includes("first-sync-unreliable"))
})

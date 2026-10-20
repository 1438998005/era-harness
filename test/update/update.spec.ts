/**
 * eratw 一键更新 —— 核心算法回归测试（node:test，零新增依赖）。
 *
 * 覆盖：
 * 1. gitBlobSha1 与真实 `git hash-object` 向量对拍
 * 2. 批量识别（首次同步的判定基础）
 * 3. 首次同步判定表（5 种）
 * 4. 稳态三方判定表（10 种，逐行）
 * 5. 冲突分组（口上按角色 / 本体按文件）
 * 6. 大小写不敏感兜底
 *
 * 跑法：node test/update/run.mjs
 */

import assert from "node:assert/strict"
import test from "node:test"
import { detectBatches, gitBlobSha1, isProtectedPath } from "../../src/core/update/manifest"
import { buildPlan, groupConflicts, personaKeyOf } from "../../src/core/update/plan"
import type { FileFingerprint, LocalScan, RelPath, UpstreamSnapshot } from "../../src/core/update/types"

const MIN = 60_000

function fp(sha1: string, mtimeMs = 0): FileFingerprint {
	return { sha1, size: 1, mtimeMs }
}

/** 构造 LocalScan：bulk 里的文件放在同一分钟，others 各自散开 */
function makeLocal(bulk: Record<string, string>, others: Record<string, string> = {}): LocalScan {
	const files = new Map<RelPath, FileFingerprint>()
	for (const [p, sha] of Object.entries(bulk)) {
		files.set(p, fp(sha, 1000 * MIN))
	}
	let m = 5000
	for (const [p, sha] of Object.entries(others)) {
		files.set(p, fp(sha, m++ * MIN))
	}
	const batches = detectBatches(files, { minCount: 2, minRatio: 0 })
	return { root: "/game", files, batches, excludedDirs: [], scannedAt: "" }
}

function makeTheirs(files: Record<string, string>): UpstreamSnapshot {
	const map = new Map<RelPath, { sha1: string; size: number }>()
	for (const [p, sha] of Object.entries(files)) {
		map.set(p, { sha1: sha, size: 1 })
	}
	return { label: "test", files: map }
}

function makeBase(files: Record<string, string>): Map<RelPath, { sha1: string }> {
	const map = new Map<RelPath, { sha1: string }>()
	for (const [p, sha] of Object.entries(files)) {
		map.set(p, { sha1: sha })
	}
	return map
}

// ---------------------------------------------------------------- 1. 指纹

test("gitBlobSha1 与 git hash-object 向量一致", () => {
	// 向量来自 `git hash-object --stdin` 实测
	assert.equal(gitBlobSha1(Buffer.from("")), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391")
	assert.equal(gitBlobSha1(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a")
	assert.equal(gitBlobSha1(Buffer.from("hello world\n")), "3b18e512dba79e4c8300dd08aeb37f8e728b8dad")
	assert.equal(gitBlobSha1(Buffer.from("test content\n")), "d670460b4b4aece5915caf5c68d12f560a9fe3e4")
	assert.equal(gitBlobSha1(Buffer.from("abc")), "f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f")
})

// ---------------------------------------------------------------- 2. 批量识别

test("批量识别：同一分钟的文件数达阈值即成批", () => {
	const files = new Map<RelPath, FileFingerprint>()
	for (let i = 0; i < 90; i++) {
		files.set(`ERB/b${i}.ERB`, fp("x", 2000 * MIN))
	}
	for (let i = 0; i < 10; i++) {
		files.set(`ERB/u${i}.ERB`, fp("y", (3000 + i) * MIN))
	}
	const result = detectBatches(files)
	assert.equal(result.batches.length, 1)
	assert.equal(result.batches[0]?.count, 90)
	assert.equal(result.bulkPaths.size, 90)
	assert.equal(result.reliable, true)
})

test("批量识别：全部散开时判定不可信（首次同步必须转人工）", () => {
	const files = new Map<RelPath, FileFingerprint>()
	for (let i = 0; i < 30; i++) {
		files.set(`ERB/f${i}.ERB`, fp("x", (i + 1) * MIN))
	}
	const result = detectBatches(files)
	assert.equal(result.batches.length, 0)
	assert.equal(result.reliable, false)
})

// ---------------------------------------------------------------- 3. 首次同步

test("首次同步：mtime 在批量内 → 判为上游旧版，直接覆盖", () => {
	const local = makeLocal({ "ERB/A.ERB": "old", "ERB/B.ERB": "same" })
	const theirs = makeTheirs({ "ERB/A.ERB": "new", "ERB/B.ERB": "same" })
	const plan = buildPlan({ base: null, local, theirs })

	assert.equal(plan.mode, "first-sync")
	assert.equal(plan.summary.unchanged, 1)
	const entry = plan.entries.find((e) => e.path === "ERB/A.ERB")
	assert.equal(entry?.action, "write")
	assert.equal(entry?.reason, "first-sync-bulk")
})

test("首次同步：mtime 在批量外 → 判为人手改过，保留并询问", () => {
	const local = makeLocal({ "ERB/B.ERB": "bulk" }, { "ERB/MINE.ERB": "mine" })
	const theirs = makeTheirs({ "ERB/B.ERB": "bulk", "ERB/MINE.ERB": "upstream" })
	const plan = buildPlan({ base: null, local, theirs })

	const entry = plan.entries.find((e) => e.path === "ERB/MINE.ERB")
	assert.equal(entry?.action, "conflict")
	assert.equal(entry?.reason, "first-sync-human")
	assert.equal(plan.groups.length, 1)
	assert.equal(plan.groups[0]?.kind, "file")
})

test("首次同步：批量内且上游已无该文件 → 备份后删除（仅限上游存在的顶层目录）", () => {
	const local = makeLocal({ "ERB/OLD.ERB": "gone", "sav/keep.sav": "sav" })
	const theirs = makeTheirs({ "ERB/NEW.ERB": "new" })
	const plan = buildPlan({ base: null, local, theirs })

	const old = plan.entries.find((e) => e.path === "ERB/OLD.ERB")
	assert.equal(old?.action, "delete")
	assert.equal(old?.reason, "upstream-delete")

	// sav/ 不在上游顶层目录里 → 绝不删
	const sav = plan.entries.find((e) => e.path === "sav/keep.sav")
	assert.equal(sav, undefined)
})

test("首次同步 add-only：只加新文件，一个字节都不覆盖", () => {
	const local = makeLocal({ "ERB/A.ERB": "old", "ERB/OLD.ERB": "gone" })
	const theirs = makeTheirs({ "ERB/A.ERB": "new", "ERB/NEW.ERB": "new" })
	const plan = buildPlan({ base: null, local, theirs, firstSyncPolicy: "add-only" })

	assert.equal(plan.summary.write, 1, "只应写入上游新增的那个文件")
	assert.equal(plan.summary.delete, 0)
	const a = plan.entries.find((e) => e.path === "ERB/A.ERB")
	assert.equal(a?.action, "keep")
	assert.equal(a?.reason, "first-sync-human")
})

test("首次同步：批量不可信时给出告警码", () => {
	const local = makeLocal({}, { "ERB/A.ERB": "old" })
	const theirs = makeTheirs({ "ERB/A.ERB": "new" })
	const plan = buildPlan({ base: null, local, theirs })
	assert.ok(plan.warnings.includes("first-sync"))
	assert.ok(plan.warnings.includes("first-sync-unreliable"))
})

// ---------------------------------------------------------------- 4. 稳态三方

interface Row {
	name: string
	base?: string
	local?: string
	theirs?: string
	action?: string
	reason?: string
}

const INCREMENTAL_ROWS: Row[] = [
	{ name: "本地没动、上游改了 → 覆盖", base: "b1", local: "b1", theirs: "t1", action: "write", reason: "clean-update" },
	{ name: "本地改了、上游没动 → 保留", base: "b1", local: "l1", theirs: "b1", action: "keep", reason: "local-change" },
	{ name: "双方都改 → 冲突", base: "b1", local: "l1", theirs: "t1", action: "conflict", reason: "both-changed" },
	{ name: "上游删了、本地没动 → 删除", base: "b1", local: "b1", action: "delete", reason: "upstream-delete" },
	{
		name: "上游删了、本地改过 → 冲突",
		base: "b1",
		local: "l1",
		action: "conflict",
		reason: "delete-vs-local-change",
	},
	{ name: "上游新增 → 写入", theirs: "t1", action: "write", reason: "upstream-add" },
	{ name: "上游新增了同名文件、本地也有 → 冲突", local: "l1", theirs: "t1", action: "conflict", reason: "add-vs-local" },
	{ name: "本地独有 → 保留", local: "l1", action: "keep", reason: "local-only" },
	{ name: "本地删了、上游没动 → 尊重本地删除", base: "b1", theirs: "b1", action: "keep", reason: "local-deleted" },
	{ name: "双方都删 → 无事发生", base: "b1" },
]

for (const row of INCREMENTAL_ROWS) {
	test(`稳态：${row.name}`, () => {
		const localFiles: Record<string, string> = {}
		const theirsFiles: Record<string, string> = {}
		const baseFiles: Record<string, string> = {}
		const P = "ERB/A.ERB"
		if (row.local !== undefined) {
			localFiles[P] = row.local
		}
		if (row.theirs !== undefined) {
			theirsFiles[P] = row.theirs
		}
		if (row.base !== undefined) {
			baseFiles[P] = row.base
		}
		const plan = buildPlan({
			base: makeBase(baseFiles),
			local: makeLocal({}, localFiles),
			theirs: makeTheirs(theirsFiles),
		})
		if (!row.action) {
			assert.equal(plan.entries.length, 0, "双方都删不应产生任何动作")
			return
		}
		const entry = plan.entries.find((e) => e.path === P)
		assert.ok(entry, "应产生一条计划项")
		assert.equal(entry.action, row.action)
		assert.equal(entry.reason, row.reason)
	})
}

test("稳态：上游删掉了整个顶层目录也能全部删除（基线证明它曾是上游文件）", () => {
	const base = makeBase({ "bad/1.ERB": "b1", "bad/2.ERB": "b2" })
	const local = makeLocal({ "bad/1.ERB": "b1", "bad/2.ERB": "b2" })
	const plan = buildPlan({ base, local, theirs: makeTheirs({ "ERB/X.ERB": "x" }) })
	assert.equal(plan.summary.delete, 2)
})

// ---------------------------------------------------------------- 5. 分组

test("personaKeyOf：口上目录内取角色目录，目录外返回 null", () => {
	assert.equal(personaKeyOf("ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/因幡帝海外版/x.ERB"), "053 Tewi [てゐ]")
	assert.equal(personaKeyOf("ERB/口上・メッセージ関連/KOJO_MESSAGE.ERB"), null)
	assert.equal(personaKeyOf("ERB/SYSTEM.ERB"), null)
})

test("冲突分组：同一角色的子目录文件并入一个组，本体侧逐文件成组", () => {
	const local = makeLocal(
		{},
		{
			"ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/A.ERB": "l1",
			"ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/因幡帝海外版/B.ERB": "l2",
			"ERB/口上・メッセージ関連/個人口上/001 Reimu [霊夢]/C.ERB": "l3",
			"ERB/SYSTEM.ERB": "l4",
			"CSV/Chara/Chara1.csv": "l5",
		},
	)
	const theirs = makeTheirs({
		"ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/A.ERB": "t1",
		"ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/因幡帝海外版/B.ERB": "t2",
		"ERB/口上・メッセージ関連/個人口上/001 Reimu [霊夢]/C.ERB": "t3",
		"ERB/SYSTEM.ERB": "t4",
		"CSV/Chara/Chara1.csv": "t5",
	})
	const plan = buildPlan({ base: null, local, theirs })

	assert.equal(plan.summary.conflict, 5)
	const personaGroups = plan.groups.filter((g) => g.kind === "persona")
	assert.equal(personaGroups.length, 2, "053 与 001 各一组")
	const tewi = personaGroups.find((g) => g.key === "053 Tewi [てゐ]")
	assert.equal(tewi?.paths.length, 2, "子目录里的文件必须并入本角色组")
	assert.equal(plan.groups.filter((g) => g.kind === "file").length, 2)
})

test("分组：口上组排在文件组之前", () => {
	const entries = [
		{ path: "ERB/SYSTEM.ERB", action: "conflict" as const, reason: "both-changed" as const },
		{ path: "ERB/口上・メッセージ関連/個人口上/001 A/X.ERB", action: "conflict" as const, reason: "both-changed" as const },
	]
	const groups = groupConflicts(entries)
	assert.equal(groups[0]?.kind, "persona")
	assert.equal(groups[1]?.kind, "file")
})

// ---------------------------------------------------------------- 6. 兜底

test("大小写不敏感：上游改名大小写时不该被当成新增+本地独有", () => {
	const local = makeLocal({ "ERB/foo.ERB": "same" })
	const theirs = makeTheirs({ "ERB/FOO.ERB": "same" })
	const plan = buildPlan({ base: null, local, theirs })
	assert.equal(plan.entries.length, 0)
	assert.equal(plan.summary.unchanged, 1)
})

test("受保护路径永不进计划", () => {
	assert.equal(isProtectedPath("_备份/update_backup_x/files/A.ERB"), true)
	assert.equal(isProtectedPath("sav/global.sav"), true)
	assert.equal(isProtectedPath(".era-harness/update-state.json"), true)
	assert.equal(isProtectedPath("ERB/SYSTEM.ERB"), false)
})

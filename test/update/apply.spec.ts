/**
 * 执行与回滚的回归测试 —— 这是唯一会真正改用户文件的模块，必须逐字节验证。
 *
 * 核心断言：**任何失败之后，整棵树必须与更新前逐字节一致**。
 * 不是"看起来恢复了"，是拿 sha1 逐个文件比对。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import test from "node:test"
import { createGunzip, gzipSync } from "node:zlib"
import { applyPlan, applyPlanFromTar, backupDirName, rollbackFromBackup } from "../../src/core/update/apply"
import { gitBlobSha1 } from "../../src/core/update/manifest"
import type { PlanEntry, RelPath, UpdatePlan } from "../../src/core/update/types"
import { buildTar } from "./tar-fixture"

/** tar 字节 → 已解压的流（模拟从磁盘读归档） */
function gzStream(tar: Buffer) {
	const gunzip = createGunzip()
	Readable.from([gzipSync(tar)]).pipe(gunzip)
	return gunzip
}

function makePlan(entries: PlanEntry[]): UpdatePlan {
	return {
		mode: "incremental",
		entries,
		groups: [],
		summary: { write: 0, delete: 0, keep: 0, conflict: 0, unchanged: 0, keepByReason: {} },
		warnings: [],
	}
}

async function withTempRoot(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-apply-"))
	try {
		await run(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
	for (const [rel, content] of Object.entries(files)) {
		const abs = path.join(root, ...rel.split("/"))
		await fs.mkdir(path.dirname(abs), { recursive: true })
		await fs.writeFile(abs, content, "utf8")
	}
}

/** 整棵树的指纹（排除备份目录），用于"失败后必须一模一样"的断言 */
async function snapshotTree(root: string): Promise<Map<RelPath, string>> {
	const out = new Map<RelPath, string>()
	const walk = async (dir: string, prefix: string): Promise<void> => {
		const entries = await fs.readdir(dir, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.name === "_备份" || entry.name === ".era-harness") {
				continue
			}
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name
			const abs = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				await walk(abs, rel)
			} else {
				out.set(rel, gitBlobSha1(await fs.readFile(abs)))
			}
		}
	}
	await walk(root, "")
	return out
}

test("正常执行：覆盖 + 新增 + 删除，备份内容正确", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, {
			"ERB/A.ERB": "old A",
			"ERB/OLD.ERB": "old old",
		})
		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" },
			{ path: "ERB/NEW.ERB", action: "write", reason: "upstream-add", theirsSha1: "y" },
			{ path: "ERB/OLD.ERB", action: "delete", reason: "upstream-delete" },
			{ path: "ERB/MINE.ERB", action: "keep", reason: "local-only" },
		])
		const content: Record<string, string> = { "ERB/A.ERB": "new A", "ERB/NEW.ERB": "brand new" }

		const report = await applyPlan({
			root,
			plan,
			label: "develop20261017",
			provide: (rel) => Buffer.from(content[rel] ?? "", "utf8"),
		})

		assert.equal(report.ok, true)
		assert.equal(report.written, 2)
		assert.equal(report.deleted, 1)
		assert.equal(report.skipped, 1)
		assert.ok(report.backupDir)

		assert.equal(await fs.readFile(path.join(root, "ERB", "A.ERB"), "utf8"), "new A")
		assert.equal(await fs.readFile(path.join(root, "ERB", "NEW.ERB"), "utf8"), "brand new")
		await assert.rejects(fs.stat(path.join(root, "ERB", "OLD.ERB")))

		// 备份里必须是**改动前**的内容
		assert.equal(await fs.readFile(path.join(report.backupDir, "files", "ERB", "A.ERB"), "utf8"), "old A")
		assert.equal(await fs.readFile(path.join(report.backupDir, "files", "ERB", "OLD.ERB"), "utf8"), "old old")

		const manifest = JSON.parse(await fs.readFile(path.join(report.backupDir, "manifest.json"), "utf8"))
		assert.equal(manifest.status, "done")
		assert.equal(manifest.actions.length, 3)
	})
})

test("中途失败自动回滚：整棵树必须与更新前逐字节一致", async () => {
	await withTempRoot(async (root) => {
		const original = {
			"ERB/A.ERB": "old A",
			"ERB/B.ERB": "old B",
			"ERB/OLD.ERB": "old old",
		}
		await writeFiles(root, original)
		const before = await snapshotTree(root)

		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update" },
			{ path: "ERB/B.ERB", action: "write", reason: "clean-update" },
			{ path: "ERB/OLD.ERB", action: "delete", reason: "upstream-delete" },
		])

		const report = await applyPlan({
			root,
			plan,
			label: "develop20261017",
			provide: () => Buffer.from("should not survive", "utf8"),
			failAfter: 1,
		})

		assert.equal(report.ok, false)
		assert.equal(report.rolledBack, true)
		const after = await snapshotTree(root)
		assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort(), "回滚后必须与原始状态完全一致")
	})
})

test("事后撤销（rollbackFromBackup）：恢复到更新前", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A", "ERB/OLD.ERB": "old old" })
		const before = await snapshotTree(root)

		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update" },
			{ path: "ERB/NEW.ERB", action: "write", reason: "upstream-add" },
			{ path: "ERB/OLD.ERB", action: "delete", reason: "upstream-delete" },
		])
		const content: Record<string, string> = { "ERB/A.ERB": "new A", "ERB/NEW.ERB": "brand new" }
		const report = await applyPlan({
			root,
			plan,
			label: "develop20261017",
			provide: (rel) => Buffer.from(content[rel] ?? "", "utf8"),
		})
		assert.equal(report.ok, true)
		assert.ok(report.backupDir)

		const rolled = await rollbackFromBackup(report.backupDir)
		assert.equal(rolled.ok, true)
		assert.equal(rolled.restored, 2)
		assert.equal(rolled.removed, 1)

		const after = await snapshotTree(root)
		assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort())
	})
})

test("事后撤销拒绝任意目录：只有 update_backup_* 能被当成备份", async () => {
	await withTempRoot(async (root) => {
		// 伪造一个带着「合法」manifest 的目录：撤销会写文件，不能让任意目录决定写到哪里
		const fake = path.join(root, "_备份", "my-backup")
		await fs.mkdir(fake, { recursive: true })
		await fs.writeFile(
			path.join(fake, "manifest.json"),
			JSON.stringify({
				schemaVersion: 1,
				root,
				label: "x",
				createdAt: new Date().toISOString(),
				status: "done",
				source: {},
				actions: [{ path: "victim.txt", action: "delete", existed: false, beforeSha1: null, afterSha1: null }],
			}),
			"utf8",
		)

		await assert.rejects(() => rollbackFromBackup(fake), /不是本插件生成的备份目录/)
	})
})

test("受保护路径直接拒绝，一个字节都不写", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "sav/global.sav": "save data" })
		const before = await snapshotTree(root)
		const plan = makePlan([{ path: "sav/global.sav", action: "delete", reason: "upstream-delete" }])

		await assert.rejects(applyPlan({ root, plan, label: "x", provide: () => Buffer.from("") }), /受保护路径/)
		assert.deepEqual([...(await snapshotTree(root)).entries()].sort(), [...before.entries()].sort())
	})
})

test("路径越界直接拒绝（防 ../ 穿越）", async () => {
	await withTempRoot(async (root) => {
		const plan = makePlan([{ path: "../outside.txt", action: "write", reason: "upstream-add" }])
		await assert.rejects(applyPlan({ root, plan, label: "x", provide: () => Buffer.from("x") }), /路径越界/)
	})
})

test("dryRun：不写盘、不产生备份目录", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A" })
		const before = await snapshotTree(root)
		const plan = makePlan([{ path: "ERB/A.ERB", action: "write", reason: "clean-update" }])

		const report = await applyPlan({
			root,
			plan,
			label: "x",
			dryRun: true,
			provide: () => Buffer.from("new", "utf8"),
		})

		assert.equal(report.ok, true)
		assert.equal(report.backupDir, null)
		assert.deepEqual([...(await snapshotTree(root)).entries()].sort(), [...before.entries()].sort())
		await assert.rejects(fs.stat(path.join(root, "_备份")))
	})
})

test("流式归档模式：只写计划内条目，其余丢弃", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A", "ERB/OLD.ERB": "old old" })
		const tar = buildTar([
			{ path: "eratw-sub-modding-develop", type: "dir" },
			{ path: "eratw-sub-modding-develop/ERB/A.ERB", content: "new A from archive" },
			{ path: "eratw-sub-modding-develop/ERB/NEW.ERB", content: "brand new" },
			{ path: "eratw-sub-modding-develop/ERB/IGNORED.ERB", content: "not in plan" },
		])

		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update" },
			{ path: "ERB/NEW.ERB", action: "write", reason: "upstream-add" },
			{ path: "ERB/OLD.ERB", action: "delete", reason: "upstream-delete" },
		])

		const report = await applyPlanFromTar({
			root,
			plan,
			label: "develop20261017",
			stream: gzStream(tar),
		})

		assert.equal(report.ok, true)
		assert.equal(report.written, 2)
		assert.equal(report.deleted, 1)
		assert.equal(await fs.readFile(path.join(root, "ERB", "A.ERB"), "utf8"), "new A from archive")
		assert.equal(await fs.readFile(path.join(root, "ERB", "NEW.ERB"), "utf8"), "brand new")
		await assert.rejects(fs.stat(path.join(root, "ERB", "OLD.ERB")))
		await assert.rejects(fs.stat(path.join(root, "ERB", "IGNORED.ERB")), "计划外文件绝不能落盘")
	})
})

test("流式归档缺少应写文件时回滚（不留下半个更新）", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A" })
		const before = await snapshotTree(root)
		const tar = buildTar([
			{ path: "eratw-sub-modding-develop", type: "dir" },
			{ path: "eratw-sub-modding-develop/ERB/A.ERB", content: "new A" },
		])
		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update" },
			{ path: "ERB/MISSING.ERB", action: "write", reason: "upstream-add" },
		])

		const report = await applyPlanFromTar({
			root,
			plan,
			label: "x",
			stream: gzStream(tar),
		})

		assert.equal(report.ok, false)
		assert.equal(report.rolledBack, true)
		assert.deepEqual([...(await snapshotTree(root)).entries()].sort(), [...before.entries()].sort())
	})
})

test("备份目录命名沿用用户既有习惯", () => {
	const name = backupDirName("develop20261017", new Date(2026, 9, 18, 20, 30))
	assert.equal(name, "update_backup_20261018_2030_develop20261017")
})

// ── U1：撤销必须连状态一起回滚 ──────────────────────────────────────────

const OLD_STATE = {
	schemaVersion: 1 as const,
	source: { projectUrl: "https://example.test/eratw", branch: "develop" },
	applied: { commit: "aaaaaaaa", nowVersion: "20261013", appliedAt: "2026-10-13T00:00:00.000Z" },
	files: { "ERB/A.ERB": { sha1: "bbbbbbbb", size: 5, mtimeMs: 0 } },
	localOverrides: [],
}

test("撤销更新：状态文件回到更新前（state-before.json 被写回）", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A" })
		const plan = makePlan([{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" }])

		const report = await applyPlan({
			root,
			plan,
			label: "x",
			stateBefore: OLD_STATE,
			provide: () => Buffer.from("new A", "utf8"),
		})
		assert.equal(report.ok, true)

		// 模拟 service.runUpdate 成功后的状态落盘（新快照）
		const statePath = path.join(root, ".era-harness", "update-state.json")
		await fs.mkdir(path.dirname(statePath), { recursive: true })
		await fs.writeFile(
			statePath,
			JSON.stringify({ ...OLD_STATE, applied: { commit: "new", nowVersion: "new", appliedAt: "now" } }),
			"utf8",
		)

		const undo = await rollbackFromBackup(report.backupDir!)
		assert.equal(undo.ok, true)

		// 状态必须是**更新前**的那份，不是"没有"也不是新快照
		const restored = JSON.parse(await fs.readFile(statePath, "utf8"))
		assert.equal(restored.applied.commit, "aaaaaaaa")
		assert.equal(restored.applied.nowVersion, "20261013")
	})
})

test("撤销更新：更新前没有状态（首次更新）时，状态文件应被删除", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A" })
		const plan = makePlan([{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" }])

		const report = await applyPlan({
			root,
			plan,
			label: "x",
			stateBefore: null,
			provide: () => Buffer.from("new A", "utf8"),
		})
		assert.equal(report.ok, true)

		const statePath = path.join(root, ".era-harness", "update-state.json")
		await fs.mkdir(path.dirname(statePath), { recursive: true })
		await fs.writeFile(statePath, "{}", "utf8")

		const undo = await rollbackFromBackup(report.backupDir!)
		assert.equal(undo.ok, true)
		await assert.rejects(fs.stat(statePath), "首次更新撤销后不该留下状态文件")
	})
})

test("撤销更新：老备份没有 state-before.json 时保持原行为（不碰状态文件）", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A" })
		const plan = makePlan([{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" }])

		const report = await applyPlan({ root, plan, label: "x", provide: () => Buffer.from("new A", "utf8") })
		assert.equal(report.ok, true)

		const statePath = path.join(root, ".era-harness", "update-state.json")
		await fs.mkdir(path.dirname(statePath), { recursive: true })
		await fs.writeFile(statePath, "keep-me", "utf8")

		const undo = await rollbackFromBackup(report.backupDir!)
		assert.equal(undo.ok, true)
		assert.equal(await fs.readFile(statePath, "utf8"), "keep-me")
	})
})

// ── U2：回滚没跑干净时必须如实报告 ─────────────────────────────────────

test("中途失败自动回滚成功：rolledBack 为 true", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A" })
		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" },
			{ path: "ERB/B.ERB", action: "write", reason: "upstream-add", theirsSha1: "y" },
		])

		// 第 2 个动作（写 B）时注入失败 → 回滚把 A、B 都还原回去
		const report = await applyPlan({
			root,
			plan,
			label: "x",
			failAfter: 1,
			provide: () => Buffer.from("content", "utf8"),
		})
		assert.equal(report.ok, false)
		assert.equal(report.rolledBack, true, "回滚干净时必须如实报 true")
	})
})

test("回滚本身失败（备份丢失）：rolledBack 为 false，且不谎报恢复原状", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A", "ERB/B.ERB": "old B" })
		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" },
			{ path: "ERB/B.ERB", action: "write", reason: "clean-update", theirsSha1: "y" },
		])

		const report = await applyPlan({
			root,
			plan,
			label: "x",
			// provide 在备份完成之后逐文件调用：写 A 前把 A 的备份删掉（模拟杀毒误删备份），
			// 再让 provide 对 B 抛错触发回滚 → 回滚还原 A 时备份已不在 → 回滚出错
			provide: async (rel) => {
				if (rel === "ERB/A.ERB") {
					await fs.rm(path.join(root, "_备份"), { recursive: true, force: true })
					return Buffer.from("new A", "utf8")
				}
				throw new Error("注入失败")
			},
		})

		assert.equal(report.ok, false)
		assert.equal(report.rolledBack, false, "回滚有残留错误时必须如实报 false")
		// 磁盘停在半更新状态：A 已是新内容（备份没了还原不了），这是必须让用户知道的
		assert.equal(await fs.readFile(path.join(root, "ERB", "A.ERB"), "utf8"), "new A")
		assert.ok(report.errors.some((e) => e.path === "ERB/A.ERB"))
	})
})

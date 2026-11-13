/**
 * 撤销与回滚保障的回归测试 —— apply.spec.ts 的姊妹篇（拆分原因：仓库 20KB 单文件
 * 门禁，apply.spec.ts 曾因本组用例膨胀到 24KB）。
 *
 * 覆盖：事后撤销 rollbackFromBackup 与状态回滚（U1）、自动回滚的如实报告与可重试
 * （U2）、流式 overrides 的回滚保护（KB 08 #257）。
 * 核心断言：**任何失败之后，整棵树必须与更新前逐字节一致**；回滚失败必须可重试，
 * 不得标 rolled-back 堵死重试路径。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import test from "node:test"
import { createGunzip, gzipSync } from "node:zlib"
import { applyPlan, applyPlanFromTar, rollbackFromBackup } from "../../src/core/update/apply"
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

// ── U1：撤销必须连状态一起回滚 ──────────────────────────────────────────

const OLD_STATE = {
	schemaVersion: 1 as const,
	source: { projectUrl: "https://example.test/eratw", branch: "develop" },
	applied: { commit: "aaaaaaaa", nowVersion: "20261013", appliedAt: "2026-10-13T00:00:00.000Z" },
	files: { "ERB/A.ERB": { sha1: "bbbbbbbb", size: 5, mtimeMs: 0 } },
	localOverrides: [],
}

/** schemaVersion 2（canonVersion 1）形态：service.runUpdate 现在写的就是这种（KB 08 #257） */
const V2_STATE = {
	schemaVersion: 2 as const,
	canonVersion: 1 as const,
	source: { projectUrl: "https://example.test/eratw", branch: "develop" },
	applied: { commit: "cccccccc", nowVersion: "20261110", appliedAt: "2026-11-10T00:00:00.000Z" },
	files: { "ERB/A.ERB": { sha1: "bbbbbbbb", canonBlobSha1: "dddddddd", size: 5, mtimeMs: 0 } },
	localOverrides: [] as string[],
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

test("撤销更新：schemaVersion 2 的 state-before 同样能写回（KB 08 #257）", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A" })
		const plan = makePlan([{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" }])

		const report = await applyPlan({
			root,
			plan,
			label: "x",
			stateBefore: V2_STATE,
			provide: () => Buffer.from("new A", "utf8"),
		})
		assert.equal(report.ok, true)

		// 模拟 service.runUpdate 成功后的状态落盘（v2 新快照）
		const statePath = path.join(root, ".era-harness", "update-state.json")
		await fs.mkdir(path.dirname(statePath), { recursive: true })
		await fs.writeFile(statePath, JSON.stringify({ ...V2_STATE, applied: { ...V2_STATE.applied, commit: "new" } }), "utf8")

		const undo = await rollbackFromBackup(report.backupDir!)
		assert.deepEqual(undo.errors, [], "v2 状态必须能恢复，不得报「格式不认识」")
		assert.equal(undo.ok, true)

		// 状态必须是更新前的那份 v2 原文
		const restored = JSON.parse(await fs.readFile(statePath, "utf8"))
		assert.equal(restored.schemaVersion, 2)
		assert.equal(restored.applied.commit, "cccccccc")
		assert.equal(restored.applied.nowVersion, "20261110")
	})
})

test("撤销更新：状态恢复失败时保持可重试，不得先标 rolled-back（KB 08 #257）", async () => {
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
		const backupDir = report.backupDir!
		const manifestPath = path.join(backupDir, "manifest.json")

		// 模拟 v2 状态落盘后，把备份目录里的 state-before.json 改成未知版本 → 恢复必然失败
		const statePath = path.join(root, ".era-harness", "update-state.json")
		await fs.mkdir(path.dirname(statePath), { recursive: true })
		await fs.writeFile(statePath, JSON.stringify({ ...V2_STATE, applied: { ...V2_STATE.applied, commit: "new" } }), "utf8")
		const stateBeforePath = path.join(backupDir, "state-before.json")
		await fs.writeFile(stateBeforePath, JSON.stringify({ schemaVersion: 99 }), "utf8")

		const undo = await rollbackFromBackup(backupDir)
		assert.equal(undo.ok, false, "状态没恢复成就必须如实报失败")
		const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"))
		assert.equal(manifest.status, "applying", "状态恢复失败时 manifest 必须保持可重试状态")

		// 排除障碍（换回合法 v1 state-before）后重试：真实恢复，不再是「已撤销」假成功
		await fs.writeFile(stateBeforePath, JSON.stringify(OLD_STATE), "utf8")
		const retry = await rollbackFromBackup(backupDir)
		assert.equal(retry.ok, true, "重试必须真正恢复状态")
		assert.deepEqual(retry.errors, [])
		const restored = JSON.parse(await fs.readFile(statePath, "utf8"))
		assert.equal(restored.applied.commit, "aaaaaaaa")
		const manifestAfter = JSON.parse(await fs.readFile(manifestPath, "utf8"))
		assert.equal(manifestAfter.status, "rolled-back", "全部恢复成功后才标记 rolled-back")
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

test("流式 overrides 写入失败须纳入回滚（KB 08 #257）", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A", "ERB/B.ERB": "old B" })
		const before = await snapshotTree(root)
		const tar = buildTar([
			{ path: "eratw-sub-modding-develop", type: "dir" },
			{ path: "eratw-sub-modding-develop/ERB/B.ERB", content: "new B from archive" },
		])
		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" },
			{ path: "ERB/B.ERB", action: "write", reason: "clean-update", theirsSha1: "y" },
		])
		const overrides = new Map<RelPath, Buffer>([
			["ERB/A.ERB", Buffer.from("merged A", "utf8")],
			["ERB/B.ERB", Buffer.from("merged B", "utf8")],
		])

		// failAfter:0 → 第一个 override 写盘（A）完成后注入失败。overrides 写入必须与
		// 归档写入同在回滚保护内：失败后已写的 A 要被还原，而不是停在半合并状态
		const report = await applyPlanFromTar({
			root,
			plan,
			label: "x",
			stream: gzStream(tar),
			overrides,
			failAfter: 0,
		})

		assert.equal(report.ok, false)
		assert.equal(report.rolledBack, true, "override 已写入的文件必须被回滚还原")
		const after = await snapshotTree(root)
		assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort(), "回滚后必须与更新前逐字节一致")
	})
})

test("自动回滚失败后可重试：manifest 停留 applying，事后撤销能真实还原（KB 08 #257）", async () => {
	await withTempRoot(async (root) => {
		await writeFiles(root, { "ERB/A.ERB": "old A", "ERB/B.ERB": "old B" })
		const before = await snapshotTree(root)
		const plan = makePlan([
			{ path: "ERB/A.ERB", action: "write", reason: "clean-update", theirsSha1: "x" },
			{ path: "ERB/B.ERB", action: "write", reason: "clean-update", theirsSha1: "y" },
		])

		const report = await applyPlan({
			root,
			plan,
			label: "x",
			provide: async (rel) => {
				if (rel === "ERB/A.ERB") {
					return Buffer.from("new A", "utf8")
				}
				// B：抛错前把已写入的 A 变只读，制造「自动回滚还原不了 A」的路径障碍
				await fs.chmod(path.join(root, "ERB", "A.ERB"), 0o444)
				throw new Error("注入失败")
			},
		})
		assert.equal(report.ok, false)
		assert.equal(report.rolledBack, false, "A 没恢复回去，必须如实报 false")
		assert.ok(report.backupDir)
		const manifestPath = path.join(report.backupDir, "manifest.json")
		const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"))
		assert.equal(manifest.status, "applying", "自动回滚失败时不得标 rolled-back（否则重试被堵死）")

		// 排除障碍后重试：真实还原，不是 ok:true restored:0 的假成功
		await fs.chmod(path.join(root, "ERB", "A.ERB"), 0o644)
		const undo = await rollbackFromBackup(report.backupDir!)
		assert.equal(undo.ok, true)
		assert.equal(undo.restored, 2, "A、B 都要从备份恢复")
		assert.deepEqual([...(await snapshotTree(root)).entries()].sort(), [...before.entries()].sort())

		// 重试全部成功后 status 才落 rolled-back
		const manifestAfter = JSON.parse(await fs.readFile(manifestPath, "utf8"))
		assert.equal(manifestAfter.status, "rolled-back")
	})
})

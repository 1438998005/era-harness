/**
 * 0 字节文件的回归测试。
 *
 * 真实事故：eratw 归档里有 134 个 0 字节文件（`sound/游戏bgm/*\/bgm`、
 * `パッチ/…/■■動作未確認■■.txt` 等）。`extractTar` 原先在 `size === 0` 时
 * 一次都不调用 `onFile`，于是：
 * - 快照漏记这 134 个文件 → 计划把它们判成"上游已删除" → **误删用户本地副本**
 * - 流式写盘时也不会 commit → 触发"归档里缺少 N 个应写入的文件" → 整次更新回滚
 *
 * 所以这里锁三层：解析器必须回调、快照必须收录、计划不得误删。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import test from "node:test"
import { createGunzip, gzipSync } from "node:zlib"
import { applyPlanFromTar } from "../../src/core/update/apply"
import { gitBlobSha1, scanLocal } from "../../src/core/update/manifest"
import { buildPlan } from "../../src/core/update/plan"
import { snapshotFromTarStream } from "../../src/core/update/source"
import { extractTar, type TarEntry } from "../../src/core/update/tarball"
import type { RelPath } from "../../src/core/update/types"
import { buildTar, chunked } from "./tar-fixture"

/** 空内容的 git blob sha1 —— 0 字节文件必须正好是这个值 */
const EMPTY_BLOB_SHA1 = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"

const TAR = buildTar([
	{ path: "proj", type: "dir" },
	{ path: "proj/sound/游戏bgm/三途川_冥界/bgm", type: "file", content: "" },
	{ path: "proj/sound/游戏bgm/人间之里/bgm", type: "file", content: "" },
	{ path: "proj/ERB/DIM.ERH", type: "file", content: "NOW_VERSION = 20261017\n" },
])

test("0 字节文件也会回调 onFile（一次，空 Buffer）与 onFileEnd", async () => {
	const seen: Array<{ path: string; chunks: number; bytes: number }> = []
	const ended: string[] = []
	await extractTar(chunked(TAR), {
		onFile: (entry: TarEntry, chunk: Buffer) => {
			const last = seen[seen.length - 1]
			if (last && last.path === entry.path) {
				last.chunks++
				last.bytes += chunk.length
			} else {
				seen.push({ path: entry.path, chunks: 1, bytes: chunk.length })
			}
		},
		onFileEnd: (entry: TarEntry) => {
			ended.push(entry.path)
		},
	})

	assert.deepEqual(
		seen.map((s) => s.path),
		["sound/游戏bgm/三途川_冥界/bgm", "sound/游戏bgm/人间之里/bgm", "ERB/DIM.ERH"],
	)
	for (const item of seen.slice(0, 2)) {
		assert.equal(item.chunks, 1, `${item.path} 应收到恰好一次回调`)
		assert.equal(item.bytes, 0, `${item.path} 的内容应为空`)
	}
	assert.equal(ended.length, 3, "每个文件都必须走到 onFileEnd")
})

test("快照收录 0 字节文件，且 sha1 是空 blob", async () => {
	const snapshot = await snapshotFromTarStream(chunked(TAR), "test")
	const empty = snapshot.files.get("sound/游戏bgm/三途川_冥界/bgm")
	assert.ok(empty, "0 字节文件不能从快照里消失")
	assert.equal(empty.sha1, EMPTY_BLOB_SHA1)
	assert.equal(empty.size, 0)
	assert.equal(snapshot.files.size, 3)
})

test("上游有 0 字节文件、本地也有同内容 → 判为无变化，绝不删除", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-empty-"))
	try {
		const rel = "sound/游戏bgm/三途川_冥界/bgm"
		const abs = path.join(root, ...rel.split("/"))
		await fs.mkdir(path.dirname(abs), { recursive: true })
		await fs.writeFile(abs, "")
		await fs.mkdir(path.join(root, "ERB"), { recursive: true })
		await fs.writeFile(path.join(root, "ERB", "DIM.ERH"), "NOW_VERSION = 20261013\n")

		const local = await scanLocal(root)
		const theirs = await snapshotFromTarStream(chunked(TAR), "test")
		const plan = buildPlan({ base: null, local, theirs })

		const deleted = plan.entries.filter((e) => e.action === "delete").map((e) => e.path)
		assert.deepEqual(deleted, [], "上游仍然有这个文件，不能删本地副本")
		assert.equal(plan.summary.delete, 0)
		// 内容与上游一致 → 不产生 entry，只计入 unchanged
		assert.ok(plan.summary.unchanged >= 1, "本地空文件应与上游判为一致")
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
})

test("流式写盘能写出 0 字节文件（不会误报「归档里缺少文件」）", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-empty-apply-"))
	try {
		const theirs = await snapshotFromTarStream(chunked(TAR), "test")
		const entries = [...theirs.files.entries()].map(([rel, file]) => ({
			path: rel as RelPath,
			action: "write" as const,
			reason: "upstream-add" as const,
			theirsSha1: file.sha1,
		}))

		const report = await applyPlanFromTar({
			root,
			plan: {
				mode: "incremental",
				entries,
				groups: [],
				summary: { write: entries.length, delete: 0, keep: 0, conflict: 0, unchanged: 0, keepByReason: {} },
				warnings: [],
			},
			label: "test",
			stream: Readable.from([gzipSync(TAR)]).pipe(createGunzip()),
		})

		assert.equal(report.ok, true, `写盘失败: ${JSON.stringify(report.errors)}`)
		assert.equal(report.written, entries.length)
		for (const entry of entries) {
			const abs = path.join(root, ...entry.path.split("/"))
			const content = await fs.readFile(abs)
			assert.equal(gitBlobSha1(content), entry.theirsSha1, `${entry.path} 内容应与归档一致`)
		}
		// 关键：两个 0 字节文件必须真的被写出来，而不是被跳过
		for (const rel of ["sound/游戏bgm/三途川_冥界/bgm", "sound/游戏bgm/人间之里/bgm"]) {
			const stat = await fs.stat(path.join(root, ...rel.split("/")))
			assert.equal(stat.size, 0, `${rel} 应写成一个空文件`)
		}
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
})

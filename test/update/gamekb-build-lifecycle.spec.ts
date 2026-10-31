/**
 * #96 / #97：建库状态机的**插件侧接线**。
 *
 * 核心库那边（`gamekb-build-sidecar.test.ts`）只证明「函数本身算得对」；
 * 这里证明「真的接上了」——否则删掉 `notify*` 里的调用，单测照样全绿。
 *
 * 两个现场：
 * - #96 模型喊一声 `attempt_completion`、一个分片都没写，库却变 `ready` 并被注入；
 * - #97 `initTask` → 写 `building` → 登记 taskId 之间被 abort，中断回调查不到 taskId
 *   直接 no-op，状态永久停在 `building`，三个出口全被禁用。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { createKnowledgeBase, knowledgeBaseDir, readManifest } from "@eraharness/gamekb/index"
import {
	notifyKnowledgeBaseBuildFinished,
	notifyKnowledgeBaseBuildInterrupted,
	registerKnowledgeBaseBuild,
} from "../../src/core/knowledge/knowledgeBaseBuildTracker"

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-gamekb-lifecycle-"))
	try {
		await run(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

const NOW = new Date(2026, 9, 31, 12, 0, 0)

test("#97 登记后立刻中断：终态是 failed，不会永久停在 building", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "a", now: NOW, suffix: "aaaa", mode: "full" })
		const dir = knowledgeBaseDir(root, manifest.slug)
		assert.equal((await readManifest(dir))?.build?.status, "building", "建库初始是 building")

		registerKnowledgeBaseBuild("task-interrupt", dir)
		await notifyKnowledgeBaseBuildInterrupted("task-interrupt")

		const build = (await readManifest(dir))?.build
		assert.equal(build?.status, "failed")
		assert.match(build?.error ?? "", /已中断/)
	})
})

test("#96 零产出完成：判 failed，并留下可读原因", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "b", now: NOW, suffix: "bbbb", mode: "full" })
		const dir = knowledgeBaseDir(root, manifest.slug)
		// index.md 还是骨架、没有分片：模型只是喊了完成
		registerKnowledgeBaseBuild("task-empty", dir)
		await notifyKnowledgeBaseBuildFinished("task-empty")

		const build = (await readManifest(dir))?.build
		assert.equal(build?.status, "failed", "零产出不能变 ready")
		assert.match(build?.error ?? "", /没有任何产出/)
	})
})

test("#96 有分片完成：判 ready", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "c", now: NOW, suffix: "cccc", mode: "full" })
		const dir = knowledgeBaseDir(root, manifest.slug)
		await fs.mkdir(path.join(dir, "functions"), { recursive: true })
		await fs.writeFile(path.join(dir, "functions", "combat.md"), "- @COMBAT — 战斗 — ERB/COMBAT.ERB:12\n", "utf8")

		registerKnowledgeBaseBuild("task-ok", dir)
		await notifyKnowledgeBaseBuildFinished("task-ok")

		assert.equal((await readManifest(dir))?.build?.status, "ready")
	})
})

test("#96 未登记的任务：no-op，不抛错也不改任何库", async () => {
	await withTempDir(async (root) => {
		const manifest = await createKnowledgeBase(root, { name: "d", now: NOW, suffix: "dddd", mode: "blank" })
		const dir = knowledgeBaseDir(root, manifest.slug)

		await notifyKnowledgeBaseBuildFinished("task-never-registered")
		await notifyKnowledgeBaseBuildInterrupted("task-never-registered")

		assert.equal((await readManifest(dir))?.build?.status, "draft", "空白库保持 draft")
	})
})

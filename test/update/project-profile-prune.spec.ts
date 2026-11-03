/**
 * 工程画像候选剪枝（pruneContained）的回归测试。
 *
 * 核心不变式（review 批 B4）：
 * 剪枝的两个条件不能对原数组串联求值——「容器剪枝」删掉的父候选不能再行使
 * 「分数 ≥ 子代 → 吞掉子代」的支配权，否则两层布局（工作区根是纯容器、
 * ERB 目录自己就是脚本目录）会把候选全部剪空，`usable[0]!` 直接 TypeError，
 * 炸穿 profile 构建（系统提示词 / write-guard / run_game 计划全依赖它）。
 *
 * 触发布局（打分实测：CANDIDATE_SCORE = 3）：
 *   root/            ← 纯容器：顶层无脚本无 CSV 无引擎（nested 5 个 .erb → score 3）
 *   └── ERB/
 *       ├── a-e.erb  ← 5 个顶层脚本 → score 3
 *       └── kojo/
 *           └── f-j.erb ← 5 个脚本 → score 3
 * 三个候选同分，旧代码把它们互相剪成空集。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { getEraProjectProfile } from "../../src/core/era/project-profile"

async function withTriggerLayout(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-prune-"))
	const erb = path.join(root, "ERB")
	const kojo = path.join(erb, "kojo")
	await fs.mkdir(kojo, { recursive: true })
	for (const name of ["a", "b", "c", "d", "e"]) {
		await fs.writeFile(path.join(erb, `${name}.erb`), "; stub")
	}
	for (const name of ["f", "g", "h", "i", "j"]) {
		await fs.writeFile(path.join(kojo, `${name}.erb`), "; stub")
	}
	try {
		await run(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

test("容器根 + 同分脚本目录：剪枝不剪空，工程根落在 ERB 而不是抛 TypeError", async () => {
	await withTriggerLayout(async (root) => {
		// 修复前这里直接抛 Cannot read properties of undefined (reading 'score')
		const profile = getEraProjectProfile(root, [])
		assert.equal(profile.roots.length, 1, "恰好剩 ERB 一个候选（容器根被剪掉，ERB 不被吞）")
		assert.equal(path.resolve(profile.roots[0]!), path.resolve(path.join(root, "ERB")))
	})
})

test("普通工程根（引擎在根上）：剪枝后仍以根为工程根", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-prune-plain-"))
	try {
		// 根上有引擎 exe + 顶层脚本：root 分数最高，不是容器
		await fs.writeFile(path.join(root, "Emuera_skiaV16.exe"), "")
		for (const name of ["a", "b", "c", "d", "e"]) {
			await fs.writeFile(path.join(root, `${name}.erb`), "; stub")
		}
		const profile = getEraProjectProfile(root, [])
		assert.ok(profile.roots.length >= 1)
		assert.equal(path.resolve(profile.roots[0]!), path.resolve(root))
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
})

test("没有任何 era 工程的目录：返回空画像而不是抛错", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-prune-empty-"))
	try {
		await fs.writeFile(path.join(root, "readme.txt"), "nothing here")
		const profile = getEraProjectProfile(root, [])
		assert.deepEqual(profile.roots, [])
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
})

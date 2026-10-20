/**
 * 游戏目录发现的回归测试。
 *
 * 对应真实痛点：工作区千奇百怪 —— 直接开游戏目录、套一层、套两层、
 * 甚至一个工作区里躺着多个版本。发现逻辑不能靠目录名猜。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { defaultSelection, describeCandidate, discoverGameRoots, readNowVersion } from "../../src/core/update/discover"

interface GameOptions {
	version?: string
	exe?: boolean
	csv?: boolean
	config?: boolean
	sav?: boolean
}

async function makeGame(root: string, opts: GameOptions = {}): Promise<void> {
	const { version = "20261013", exe = true, csv = true, config = true, sav = true } = opts
	await fs.mkdir(path.join(root, "ERB"), { recursive: true })
	await fs.writeFile(path.join(root, "ERB", "DIM.ERH"), `#DIM CONST NOW_VERSION = ${version}\n`, "utf8")
	if (csv) {
		await fs.mkdir(path.join(root, "CSV"), { recursive: true })
	}
	if (config) {
		await fs.writeFile(path.join(root, "emuera.config"), "USELAZYLOADING:YES\n", "utf8")
	}
	if (exe) {
		await fs.writeFile(path.join(root, "Emuera_skiaV16_x64.exe"), "MZ", "utf8")
	}
	if (sav) {
		await fs.mkdir(path.join(root, "sav"), { recursive: true })
	}
}

async function withTempWorkspace(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-discover-"))
	try {
		await run(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

test("工作区根就是游戏：识别为候选，relPath 为 '.'", async () => {
	await withTempWorkspace(async (root) => {
		await makeGame(root)
		const candidates = await discoverGameRoots(root)
		assert.equal(candidates.length, 1)
		assert.equal(candidates[0]?.relPath, ".")
		assert.equal(candidates[0]?.confidence, "high")
		assert.equal(candidates[0]?.nowVersion, "20261013")
		assert.deepEqual(defaultSelection(candidates).length, 1)
	})
})

test("多个游戏：全部找出来，但默认一个都不选（必须让用户挑）", async () => {
	await withTempWorkspace(async (root) => {
		await makeGame(path.join(root, "本体"), { version: "20261013" })
		await makeGame(path.join(root, "魔改版"), { version: "20260727" })
		const candidates = await discoverGameRoots(root)

		assert.equal(candidates.length, 2)
		assert.deepEqual(candidates.map((c) => c.relPath).sort(), ["本体", "魔改版"])
		assert.deepEqual(defaultSelection(candidates), [], "多候选时不能替用户做主")
	})
})

test("套一层目录（朋友给的整合包常见形态）：只认里层", async () => {
	await withTempWorkspace(async (root) => {
		const wrap = path.join(root, "eratw整合包")
		await fs.mkdir(wrap, { recursive: true })
		await fs.writeFile(path.join(wrap, "说明.txt"), "解压即玩", "utf8")
		await makeGame(path.join(wrap, "eratw"))
		const candidates = await discoverGameRoots(root)

		assert.equal(candidates.length, 1)
		assert.equal(candidates[0]?.relPath, "eratw整合包/eratw")
	})
})

test("只有 ERB/ 没有 CSV/ 与配置：不算候选（避免把口上包误认成游戏）", async () => {
	await withTempWorkspace(async (root) => {
		await fs.mkdir(path.join(root, "口上包", "ERB"), { recursive: true })
		await fs.writeFile(path.join(root, "口上包", "ERB", "KOJO.ERB"), "#FUNCTION X\n#END", "utf8")
		const candidates = await discoverGameRoots(root)
		assert.equal(candidates.length, 0)
	})
})

test("嵌套候选被标出来，且默认不选", async () => {
	await withTempWorkspace(async (root) => {
		// 外层只有 ERB/ + CSV/（中置信，会被继续下钻），里层是完整游戏
		const outer = path.join(root, "outer")
		await fs.mkdir(path.join(outer, "ERB"), { recursive: true })
		await fs.mkdir(path.join(outer, "CSV"), { recursive: true })
		await makeGame(path.join(outer, "inner"))

		const candidates = await discoverGameRoots(root)
		const inner = candidates.find((c) => c.relPath === "outer/inner")
		const outerCandidate = candidates.find((c) => c.relPath === "outer")

		assert.ok(outerCandidate, "外层也应被识别为中置信候选")
		assert.ok(inner)
		assert.equal(inner.nestedUnder, outerCandidate?.path)
		assert.deepEqual(
			defaultSelection(candidates).map((c) => c.relPath),
			["outer"],
		)
	})
})

test("深度限制生效：maxDepth=0 只看工作区根", async () => {
	await withTempWorkspace(async (root) => {
		await makeGame(path.join(root, "games", "eratw"))
		assert.equal((await discoverGameRoots(root, { maxDepth: 0 })).length, 0)
		assert.equal((await discoverGameRoots(root, { maxDepth: 2 })).length, 1)
	})
})

test("readNowVersion 读不到时返回 null（不抛异常）", async () => {
	await withTempWorkspace(async (root) => {
		await fs.mkdir(path.join(root, "ERB"), { recursive: true })
		assert.equal(await readNowVersion(root), null)
	})
})

test("同一份安装的两个副本：内容指纹一致，后者标 duplicateOf", async () => {
	await withTempWorkspace(async (root) => {
		await makeGame(path.join(root, "本体"), { version: "20261013" })
		await makeGame(path.join(root, "本体 - 副本"), { version: "20261013" })
		const candidates = await discoverGameRoots(root)

		assert.equal(candidates.length, 2)
		const duplicates = candidates.filter((c) => c.duplicateOf)
		assert.equal(duplicates.length, 1, "只有一个应被判为副本")
		const duplicate = duplicates[0]
		assert.ok(duplicate)
		assert.ok(
			candidates.some((c) => c.path === duplicate.duplicateOf),
			"duplicateOf 必须指向真实候选",
		)
	})
})

test("版本不同的两个安装：不算副本", async () => {
	await withTempWorkspace(async (root) => {
		await makeGame(path.join(root, "旧版"), { version: "20260727" })
		await makeGame(path.join(root, "新版"), { version: "20261013" })
		const candidates = await discoverGameRoots(root)
		assert.equal(candidates.filter((c) => c.duplicateOf).length, 0)
		assert.ok(candidates.every((c) => c.contentFingerprint))
		assert.notEqual(candidates[0]?.contentFingerprint, candidates[1]?.contentFingerprint)
	})
})

test("describeCandidate 给人看的标签里带版本与相对路径", async () => {
	await withTempWorkspace(async (root) => {
		await makeGame(path.join(root, "eratw"))
		const [candidate] = await discoverGameRoots(root)
		assert.ok(candidate)
		assert.equal(describeCandidate(candidate), "eratw 20261013 · eratw")
	})
})

/**
 * 工程能力探测（project-profile）的回归测试。
 *
 * 核心不变量：
 * 1. 识别只看「脚本扩展名 + 引擎产物」，不看目录名 —— 脚本目录被改名也要能认出来。
 * 2. 工作区路径本身叫什么，不能影响范围判定（`D:/口上工程/` 里的普通脚本不是口上文件）。
 * 3. 备份目录要被识别出来，但不能变成第二个工程根。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
	getEraProjectProfile,
	isBackupScopePath,
	isPersonaScopePath,
	resetEraProjectProfileCache,
} from "../../src/core/era/project-profile"

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-profile-"))
	try {
		await run(root)
	} finally {
		resetEraProjectProfileCache()
		await fs.rm(root, { recursive: true, force: true })
	}
}

async function touch(abs: string, content = "; x\n"): Promise<void> {
	await fs.mkdir(path.dirname(abs), { recursive: true })
	await fs.writeFile(abs, content, "utf8")
}

/** 造一个最小 EraBasic 工程：脚本目录名可指定，用来验证「改名也能认」 */
async function makeEraGame(root: string, scriptDir = "ERB", count = 12): Promise<void> {
	for (let i = 0; i < count; i++) {
		await touch(path.join(root, scriptDir, `S${i}.ERB`))
	}
	await fs.mkdir(path.join(root, "CSV"), { recursive: true })
	await fs.writeFile(path.join(root, "emuera.config"), "USELAZYLOADING:YES\n", "utf8")
	await fs.writeFile(path.join(root, "Emuera.exe"), "MZ", "utf8")
}

test("工程根就是工作区：识别为 Era 工程，脚本目录名来自探测", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const profile = getEraProjectProfile(root)
		assert.equal(profile.isEra, true)
		assert.deepEqual(profile.relativeRoots, ["."])
		assert.deepEqual(profile.scriptDirNames, ["ERB"])
	})
})

test("工程藏在子目录且脚本目录被改名：仍能识别", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(path.join(root, "games", "mygame"), "Script")
		const profile = getEraProjectProfile(root)
		assert.equal(profile.isEra, true)
		assert.deepEqual(profile.relativeRoots, ["games/mygame"])
		assert.deepEqual(profile.scriptDirNames, ["Script"])
	})
})

test("工程解压在 dist/ 里也能发现（构建产物目录名不是噪音）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(path.join(root, "dist", "game"))
		const profile = getEraProjectProfile(root)
		assert.equal(profile.isEra, true)
		assert.deepEqual(profile.relativeRoots, ["dist/game"])
	})
})

test("普通代码项目不会被当成 Era 工程", async () => {
	await withTempDir(async (root) => {
		await touch(path.join(root, "src", "index.ts"), "export {}\n")
		await fs.writeFile(path.join(root, "package.json"), "{}\n", "utf8")
		const profile = getEraProjectProfile(root)
		assert.equal(profile.isEra, false)
		assert.equal(profile.confidence, "none")
		assert.deepEqual(profile.roots, [])
	})
})

test("工作区路径本身含「口上」：不会把工程内所有文件都判成口上文件", async () => {
	await withTempDir(async (root) => {
		const gameRoot = path.join(root, "我的口上工程")
		await makeEraGame(gameRoot)
		const profile = getEraProjectProfile(gameRoot)
		assert.equal(profile.isEra, true)

		// 根目录名里的「口上」不该参与判定 —— 只看相对工程根的段
		assert.equal(
			isPersonaScopePath(path.join(gameRoot, "ERB", "SYSTEM.ERB"), gameRoot, profile),
			false,
			"工程根里的普通脚本不是口上文件",
		)
		assert.equal(
			isPersonaScopePath(path.join(gameRoot, "ERB", "口上・メッセージ関連", "CHARA.ERB"), gameRoot, profile),
			true,
			"真正的口上子目录仍然要认出来",
		)
	})
})

test("工作区路径本身含「备份」：不会把工程内所有文件都判成备份文件", async () => {
	await withTempDir(async (root) => {
		const gameRoot = path.join(root, "备份区", "eratw")
		await makeEraGame(gameRoot)
		const profile = getEraProjectProfile(gameRoot)
		assert.equal(
			isBackupScopePath(path.join(gameRoot, "ERB", "SYSTEM.ERB"), profile),
			false,
			"根目录名里的「备份」不该让所有脚本都被当成备份",
		)
	})
})

test("备份目录被识别出来，但不会变成第二个工程根", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		await makeEraGame(path.join(root, "_备份", "旧版"))
		const profile = getEraProjectProfile(root)
		assert.ok(profile.backupDirNames.includes("_备份"), "备份目录要能被识别")
		assert.deepEqual(profile.relativeRoots, ["."], "备份里的副本不能变成第二个工程根")
	})
})

test("空壳 ERB/CSV 目录不算证据：目录名不是识别依据", async () => {
	await withTempDir(async (root) => {
		await fs.mkdir(path.join(root, "ERB"), { recursive: true })
		await fs.mkdir(path.join(root, "CSV"), { recursive: true })
		const profile = getEraProjectProfile(root)
		assert.equal(profile.isEra, false, "只有空目录名时不能认定这是 Era 工程")
	})
})

test("多根工作区：两个根里的工程都能探测到", async () => {
	await withTempDir(async (root) => {
		const first = path.join(root, "a")
		const second = path.join(root, "b")
		await makeEraGame(first)
		await makeEraGame(second, "Script")
		const profile = getEraProjectProfile(first, [second])
		assert.equal(profile.isEra, true)
		assert.equal(profile.roots.length, 2)
	})
})

test("isBackupScopePath：探测到的备份目录名优先，没传 profile 时按通用形态判断", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		await makeEraGame(path.join(root, "_备份", "旧版"))
		const profile = getEraProjectProfile(root)

		assert.equal(isBackupScopePath(path.join(root, "_备份", "旧版", "ERB", "A.ERB"), profile), true)
		assert.equal(isBackupScopePath(path.join(root, "ERB", "A.ERB"), profile), false)
		// 不传 profile 时仍能认出通用备份形态（避免调用方漏传就完全失效）
		assert.equal(isBackupScopePath("D:/proj/backup/A.ERB"), true)
	})
})

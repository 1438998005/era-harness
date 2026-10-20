/**
 * 引擎探测与选拣（game-runner）的回归测试。
 *
 * 核心不变式：
 * 1. 只认引擎本体（文件名以 Emuera 开头），编辑器/调试宿主的伴生文件不算。
 * 2. 默认选最新版本 —— 和 DEBUG_MODE.bat 的 `dir /O-D` 意图一致，但按版本号而不是
 *    解压时间排序：两个版本同时存在时，用户要的几乎总是新的那个。
 * 3. exe 参数给不出唯一结果时返回 undefined，让调用方把候选列出来，绝不瞎猜。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
	diffEngineArtifacts,
	type EngineCandidate,
	listEngineCandidates,
	pickEngine,
	type RunningGame,
	sleep,
	snapshotEngineArtifacts,
	startEngine,
	stopEngine,
	waitForSettle,
} from "../../src/core/era/game-runner"

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-runner-"))
	try {
		await run(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

function candidate(fileName: string, mtimeMs = 0): EngineCandidate {
	return {
		filePath: path.join("D:/fake", fileName),
		fileName,
		sizeBytes: 1024,
		mtimeMs,
		version: /v(\d+(?:\.\d+)?)/i.exec(fileName)?.[1],
	}
}

test("listEngineCandidates: 只认 Emuera*.exe，跳过伴生文件与非引擎程序", async () => {
	await withTempDir(async (root) => {
		await fs.writeFile(path.join(root, "Emuera_skiaV16_x64.exe"), "")
		await fs.writeFile(path.join(root, "Emuera_skiaV10_x64.exe"), "")
		await fs.writeFile(path.join(root, "Emuera.exe.config"), "")
		await fs.writeFile(path.join(root, "Emuera.vshost.exe"), "")
		await fs.writeFile(path.join(root, "notepad.exe"), "")

		const found = await listEngineCandidates(root, [])
		assert.deepEqual(found.map((item) => item.fileName).sort(), ["Emuera_skiaV10_x64.exe", "Emuera_skiaV16_x64.exe"])
		// 默认排序：V16 在前
		assert.equal(found[0]!.fileName, "Emuera_skiaV16_x64.exe")
		assert.equal(found[0]!.version, "16")
	})
})

test("listEngineCandidates: 引擎在下一层子目录里也能找到", async () => {
	await withTempDir(async (root) => {
		const sub = path.join(root, "Emuera")
		await fs.mkdir(sub)
		await fs.writeFile(path.join(sub, "Emuera.exe"), "")

		const found = await listEngineCandidates(root, [])
		assert.equal(found.length, 1)
		assert.equal(found[0]!.fileName, "Emuera.exe")
		assert.equal(found[0]!.version, undefined)
	})
})

test("listEngineCandidates: 已经没有候选时返回空数组而不是抛错", async () => {
	await withTempDir(async (root) => {
		assert.deepEqual(await listEngineCandidates(root, []), [])
	})
})

test("pickEngine: 省略 preferred 时取第一个（已按版本降序）", () => {
	const candidates = [candidate("Emuera_skiaV16_x64.exe"), candidate("Emuera_skiaV10_x64.exe")]
	assert.equal(pickEngine(candidates)?.fileName, "Emuera_skiaV16_x64.exe")
	assert.equal(pickEngine(candidates, "   ")?.fileName, "Emuera_skiaV16_x64.exe")
})

test("pickEngine: 文件名 / 完整路径 / 唯一片段都能命中", () => {
	const candidates = [candidate("Emuera_skiaV16_x64.exe"), candidate("Emuera_skiaV10_x64.exe")]

	assert.equal(pickEngine(candidates, "Emuera_skiaV10_x64.exe")?.fileName, "Emuera_skiaV10_x64.exe")
	// 大小写不敏感
	assert.equal(pickEngine(candidates, "EMUERA_SKIAV10_X64.EXE")?.fileName, "Emuera_skiaV10_x64.exe")
	assert.equal(pickEngine(candidates, "V10")?.fileName, "Emuera_skiaV10_x64.exe")
	assert.equal(pickEngine(candidates, "v16")?.fileName, "Emuera_skiaV16_x64.exe")
	assert.equal(pickEngine(candidates, "D:/fake/Emuera_skiaV16_x64.exe")?.fileName, "Emuera_skiaV16_x64.exe")
})

test("pickEngine: 片段命中多个时返回 undefined，不猜", () => {
	const candidates = [candidate("Emuera_skiaV16_x64.exe"), candidate("Emuera_skiaV10_x64.exe")]
	// "Emuera_skia" 同时命中两个
	assert.equal(pickEngine(candidates, "Emuera_skia"), undefined)
	// 完全不存在
	assert.equal(pickEngine(candidates, "V99"), undefined)
})

test("pickEngine: 没有候选时不抛错", () => {
	assert.equal(pickEngine([]), undefined)
	assert.equal(pickEngine([], "V16"), undefined)
})

function fakeGame(exited: boolean): RunningGame {
	return {
		child: { kill: () => true } as unknown as RunningGame["child"],
		exePath: "D:/fake/Emuera.exe",
		pid: exited ? undefined : 12345,
		startedAt: Date.now(),
		exited,
	}
}

test("stopEngine: 已退出的进程返回 false，不会重复处理", () => {
	assert.equal(stopEngine(fakeGame(true)), false)
})

// —— 真实进程生命周期（用 node 自身当假引擎，不碰真实游戏目录）——

test("startEngine: 能启动真实进程，并捕获退出码", async () => {
	const run = startEngine(process.execPath, ["-e", "process.exit(3)"])
	await waitForSettle(run, 15000)

	assert.equal(run.exited, true)
	assert.equal(run.exitCode, 3)
	assert.equal(run.spawnError, undefined)
	// 退出后不应该再被视为可结束的进程
	assert.equal(stopEngine(run), false)
})

test("startEngine: 长驻进程可被 stopEngine 结束", async () => {
	const run = startEngine(process.execPath, ["-e", "setTimeout(() => {}, 20000)"])
	try {
		await sleep(400)
		assert.equal(run.exited, false)
		assert.equal(typeof run.pid, "number")
		assert.equal(stopEngine(run), true)
		await waitForSettle(run, 15000)
		assert.equal(run.exited, true)
	} finally {
		stopEngine(run)
	}
})

test("startEngine: exe 不存在时报 spawn 错误而不是抛异常", async () => {
	const run = startEngine("D:/definitely-not-here/Emuera_nope.exe", [])
	await waitForSettle(run, 10000)
	assert.equal(run.exited, true)
	assert.ok(run.spawnError)
})

// —— 加载痕迹 ——
//
// 真机实测确认：Emuera 停在标题画面时**不会写游戏日志**，所以「日志有没有变」
// 判断不了「加载是否走完」。这组测试锁住替代判据的行为。

test("snapshotEngineArtifacts: 不存在的产物记 0，存在的记 mtime", async () => {
	await withTempDir(async (root) => {
		await fs.writeFile(path.join(root, "lazyloading.bin"), "x")
		const snapshot = await snapshotEngineArtifacts(root)

		assert.ok((snapshot.get("lazyloading.bin") ?? 0) > 0)
		// 缺失的项要留在快照里（值为 0），否则「启动后新出现」就检测不到
		assert.equal(snapshot.get("lazyloadingfiles.bin"), 0)
		assert.equal(snapshot.get("sav/global.sav"), 0)
	})
})

test("diffEngineArtifacts: 只报告变新的产物，未变的不算", async () => {
	await withTempDir(async (root) => {
		const lazyloading = path.join(root, "lazyloading.bin")
		const globalSav = path.join(root, "sav", "global.sav")
		await fs.mkdir(path.join(root, "sav"))
		await fs.writeFile(lazyloading, "old")
		await fs.writeFile(globalSav, "old")

		const before = await snapshotEngineArtifacts(root)
		const future = new Date(Date.now() + 5000)
		await fs.utimes(lazyloading, future, future)

		const changed = diffEngineArtifacts(before, await snapshotEngineArtifacts(root))
		assert.deepEqual(
			changed.map((item) => item.relativePath),
			["lazyloading.bin"],
		)
	})
})

test("diffEngineArtifacts: 启动后新出现的产物也算变化", async () => {
	await withTempDir(async (root) => {
		const before = await snapshotEngineArtifacts(root)
		await fs.mkdir(path.join(root, "sav"))
		await fs.writeFile(path.join(root, "sav", "global.sav"), "new")

		const changed = diffEngineArtifacts(before, await snapshotEngineArtifacts(root))
		assert.deepEqual(
			changed.map((item) => item.relativePath),
			["sav/global.sav"],
		)
	})
})

test("diffEngineArtifacts: 两者都没变时返回空数组", () => {
	const empty = new Map<string, number>()
	assert.deepEqual(diffEngineArtifacts(empty, empty), [])
})

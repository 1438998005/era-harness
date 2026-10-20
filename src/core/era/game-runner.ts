import { type ChildProcess, spawn } from "node:child_process"
import type { Dirent } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { getEraScanRoots } from "@core/era/project-profile"

/**
 * Emuera 引擎进程管理。
 *
 * 只做三件事：**找 exe、起进程、看它有没有活着**。不碰游戏数据，
 * 也不负责判断「跑起来之后发生了什么」——那交给日志解析。
 *
 * 为什么不用 `start` / `cmd /c`：那样拿不到 pid，也就没法判断进程是
 * 立刻崩了还是正在加载，更没法在跑完后收尾。
 */

/** 引擎可执行文件候选 */
export interface EngineCandidate {
	filePath: string
	fileName: string
	sizeBytes: number
	mtimeMs: number
	/** 从文件名里抽到的版本号，如 "16" / "10.1" */
	version?: string
}

/** 一次引擎运行 */
export interface RunningGame {
	child: ChildProcess
	exePath: string
	pid?: number
	startedAt: number
	exited: boolean
	exitedAt?: number
	exitCode?: number | null
	exitSignal?: NodeJS.Signals | null
	/** spawn 阶段的错误（exe 不存在、权限不足等） */
	spawnError?: string
}

const MAX_ENGINE_SCAN_DEPTH = 2
const MAX_ENGINE_CANDIDATES = 50
/** 引擎本体：文件名以 Emuera 开头 */
const EXE_NAME_RE = /^emuera.*\.exe$/i
/** 编辑器临时文件与调试宿主，不是引擎。`.vshost.` 不能锚定末尾：它后面还有 `.exe` */
const EXE_EXCLUDE_RE = /\.vshost\.|\.config$|\.pdb$|\.xml$|\.manifest$/i

function isNoiseDir(name: string): boolean {
	return name.startsWith(".") || name === "node_modules"
}

function parseVersion(fileName: string): string | undefined {
	return /v(\d+(?:\.\d+)?)/i.exec(fileName)?.[1]
}

/** 版本号降序优先（V16 比 V10 新），其次按修改时间降序（和 DEBUG_MODE.bat 的 /O-D 一致） */
function compareCandidates(a: EngineCandidate, b: EngineCandidate): number {
	const versionA = a.version ? Number.parseFloat(a.version) : -1
	const versionB = b.version ? Number.parseFloat(b.version) : -1
	if (versionA !== versionB) {
		return versionB - versionA
	}
	return b.mtimeMs - a.mtimeMs
}

/** 在探测到的工程根下找引擎 exe。浅层扫描：引擎一定在根目录或紧邻的版本目录里。 */
export async function listEngineCandidates(cwd: string, extraRoots: readonly string[]): Promise<EngineCandidate[]> {
	const roots = getEraScanRoots(cwd, extraRoots)
	const found: EngineCandidate[] = []
	const seen = new Set<string>()

	const walk = async (dir: string, depth: number): Promise<void> => {
		if (depth > MAX_ENGINE_SCAN_DEPTH || found.length >= MAX_ENGINE_CANDIDATES) {
			return
		}
		let entries: Dirent[]
		try {
			entries = await fs.readdir(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				// 已经找到引擎就不再钻子目录：同一份工程只会有同一个引擎
				if (found.length === 0 && !isNoiseDir(entry.name)) {
					await walk(fullPath, depth + 1)
				}
				continue
			}
			if (!entry.isFile() || !EXE_NAME_RE.test(entry.name) || EXE_EXCLUDE_RE.test(entry.name)) {
				continue
			}
			const key = fullPath.toLowerCase()
			if (seen.has(key)) {
				continue
			}
			seen.add(key)
			try {
				const stat = await fs.stat(fullPath)
				found.push({
					filePath: fullPath,
					fileName: entry.name,
					sizeBytes: stat.size,
					mtimeMs: stat.mtimeMs,
					version: parseVersion(entry.name),
				})
			} catch {
				// 读不到 stat 的直接跳过
			}
		}
	}

	for (const root of roots) {
		await walk(root, 0)
	}
	return found.sort(compareCandidates)
}

/**
 * 挑一个引擎。
 *
 * `preferred` 支持三种写法：完整路径、带扩展名的文件名、文件名片段（如 `V10`）。
 * 都给不出唯一结果时返回 `undefined`，由调用方把候选列表交给模型自己选。
 */
export function pickEngine(candidates: readonly EngineCandidate[], preferred?: string): EngineCandidate | undefined {
	const wanted = preferred?.trim()
	if (!wanted) {
		return candidates[0]
	}
	const lower = wanted.toLowerCase().replace(/\\/g, "/")

	const exactPath = candidates.find((item) => item.filePath.toLowerCase().replace(/\\/g, "/") === lower)
	if (exactPath) {
		return exactPath
	}
	const exactName = candidates.find((item) => item.fileName.toLowerCase() === lower)
	if (exactName) {
		return exactName
	}
	const partial = candidates.filter((item) => item.fileName.toLowerCase().includes(lower))
	return partial.length === 1 ? partial[0] : undefined
}

// —— 启动痕迹 ——
//
// 日志不能用来判断「加载是否走完」：Emuera 只在**进入游戏后**才写日志，
// 停在标题画面时日志一动不动。实测确认（2026-10-20）：正常启动 V16 后
// `logs/` 里最新一份日志的 mtime 完全没变，但引擎确实起来了。
//
// 真正可靠的信号是引擎启动时重写的产物：
//   - lazyloading*.bin：只在 ERB 有改动时重建 → 重建 = 扫描并解析完了 ERB
//   - sav/global.sav：每次启动都写 → 只能证明「引擎起来了」，不证明加载成功
// 前者恰好对得上 run_game 的主场景（改完脚本验加载）。

/** 引擎启动会重写的产物，路径相对**exe 所在目录**（引擎的 cwd） */
const ARTIFACT_CANDIDATES = ["lazyloading.bin", "lazyloadingfiles.bin", "sav/global.sav"] as const

/** 某项产物在启动前后的状态 */
export interface EngineArtifact {
	/** 相对引擎目录的路径，正斜杠 */
	relativePath: string
	beforeMs: number
	afterMs: number
}

export async function fileMtimeMs(filePath: string): Promise<number> {
	try {
		return (await fs.stat(filePath)).mtimeMs
	} catch {
		return 0
	}
}

/** 记录产物当前的 mtime。不存在的记 0，便于把「启动后新出现」也算作变化。 */
export async function snapshotEngineArtifacts(root: string): Promise<Map<string, number>> {
	const snapshot = new Map<string, number>()
	for (const relativePath of ARTIFACT_CANDIDATES) {
		snapshot.set(relativePath, await fileMtimeMs(path.join(root, relativePath)))
	}
	return snapshot
}

/** 只返回确实变化了的产物。没变不是错——没改 ERB 时本来就不该重建。 */
export function diffEngineArtifacts(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): EngineArtifact[] {
	const changed: EngineArtifact[] = []
	for (const [relativePath, beforeMs] of before) {
		const afterMs = after.get(relativePath) ?? 0
		if (afterMs > beforeMs) {
			changed.push({ relativePath, beforeMs, afterMs })
		}
	}
	return changed
}

// —— 运行中的进程 ——

const runningGames = new Map<string, RunningGame>()

function keyOf(exePath: string): string {
	return exePath.toLowerCase()
}

/** 启动引擎。返回的对象会持续更新 exited / exitCode，调用方据此判断是否崩溃。 */
export function startEngine(exePath: string, args: readonly string[]): RunningGame {
	const child = spawn(exePath, [...args], {
		cwd: path.dirname(exePath),
		// 引擎是 GUI 程序，不接管 stdio；保留窗口让用户能看到报错对话框
		stdio: "ignore",
		detached: false,
		windowsHide: false,
	})

	const run: RunningGame = {
		child,
		exePath,
		pid: child.pid,
		startedAt: Date.now(),
		exited: false,
	}

	child.on("error", (error: Error) => {
		run.spawnError = error.message
		run.exited = true
		run.exitedAt = Date.now()
	})
	child.on("exit", (code, signal) => {
		run.exited = true
		run.exitedAt = Date.now()
		run.exitCode = code
		run.exitSignal = signal
	})

	runningGames.set(keyOf(exePath), run)
	return run
}

export function listRunningGames(): RunningGame[] {
	return [...runningGames.values()]
}

/**
 * 结束进程。
 *
 * Windows 上 `kill()` 是 TerminateProcess，Emuera 没有可拦截的关闭钩子，
 * 因此**未保存的游戏进度会丢失**。这一点由调用方在输出里明确告知用户。
 */
export function stopEngine(run: RunningGame): boolean {
	if (run.exited || run.pid === undefined) {
		return false
	}
	try {
		return run.child.kill()
	} catch {
		return false
	}
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

/** 等待进程结束或超时。进程提前退出时立刻返回，不必等满时长。 */
export async function waitForSettle(run: RunningGame, maxMs: number): Promise<void> {
	const deadline = Date.now() + maxMs
	while (!run.exited && Date.now() < deadline) {
		await sleep(250)
	}
}

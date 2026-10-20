import fs from "node:fs/promises"
import path from "node:path"
import type { ToolUse } from "@core/assistant-message"
import {
	diffEngineArtifacts,
	type EngineArtifact,
	type EngineCandidate,
	fileMtimeMs,
	listEngineCandidates,
	listRunningGames,
	pickEngine,
	type RunningGame,
	snapshotEngineArtifacts,
	startEngine,
	stopEngine,
	waitForSettle,
} from "@core/era/game-runner"
import { getExtraWorkspaceRoots } from "@core/era/workspace-extra-roots"
import { formatResponse } from "@core/prompts/responses"
import { readTextFile } from "@eraharness/encoding/encoding"
import { parseLog } from "@eraharness/log/parser"
import { getReadablePath, isLocatedInWorkspace } from "@utils/path"
import { telemetryService } from "@/services/telemetry"
import { formatBytes, truncateContent } from "@/shared/content-limits"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"
import { findNewestLog, formatSession } from "./LogDiagnoseToolHandler"

const MAX_OUTPUT_BYTES = 10 * 1024
/** 同 LogDiagnoseToolHandler：先限流再解析，避免大体量日志把宿主卡死 */
const MAX_LOG_READ_BYTES = 8 * 1024 * 1024
const DEFAULT_WAIT_SECONDS = 12
const MIN_WAIT_SECONDS = 3
const MAX_WAIT_SECONDS = 120

function parseBool(raw: string | undefined, fallback: boolean): boolean {
	if (raw === undefined || raw.trim() === "") {
		return fallback
	}
	const lowered = raw.trim().toLowerCase()
	if (lowered === "true" || lowered === "1" || lowered === "yes") {
		return true
	}
	if (lowered === "false" || lowered === "0" || lowered === "no") {
		return false
	}
	return fallback
}

function parseWaitSeconds(raw: string | undefined): number {
	const value = Number.parseInt((raw || "").trim(), 10)
	if (!Number.isFinite(value)) {
		return DEFAULT_WAIT_SECONDS
	}
	return Math.min(MAX_WAIT_SECONDS, Math.max(MIN_WAIT_SECONDS, value))
}

function formatCandidate(candidate: EngineCandidate): string {
	const version = candidate.version ? ` V${candidate.version}` : ""
	return `- ${candidate.fileName}${version}（${formatBytes(candidate.sizeBytes)}）`
}

async function mtimeOf(filePath: string): Promise<number> {
	return fileMtimeMs(filePath)
}

/** 把启动痕迹翻译成「加载走到哪一步」，这是日志给不了的信息 */
function describeArtifacts(changed: readonly EngineArtifact[]): string {
	if (changed.length === 0) {
		return [
			"启动前后没有任何引擎产物变化。这不一定代表失败，但确实无法确认加载走完了：",
			"- 没改 ERB 时 `lazyloading.bin` 本来就不会重建；",
			"- 引擎可能弹了错误对话框在等确认，或者被安全软件拦下。",
			"",
			"要验证一次改动，请先真的改至少一个 ERB 再跑；否则请看游戏窗口里有没有报错。",
		].join("\n")
	}
	const lines = changed.map((item) => {
		if (item.relativePath.startsWith("lazyloading")) {
			return `- ${item.relativePath}：**已重建** —— 本次启动重新扫描并解析了全部 ERB，加载阶段走完了。`
		}
		return `- ${item.relativePath}：已更新 —— 引擎跑到了存档阶段。`
	})
	if (!changed.some((item) => item.relativePath.startsWith("lazyloading"))) {
		lines.push("", "`lazyloading.bin` 没有重建：说明这次 ERB 没有改动。要验证改动是否被加载，先改一个 ERB 再测。")
	}
	return lines.join("\n")
}

function describeExit(run: RunningGame): string {
	const elapsed = ((run.exitedAt ?? Date.now()) - run.startedAt) / 1000
	if (run.spawnError) {
		return `- 状态：启动失败（${run.spawnError}）`
	}
	const code = run.exitCode === null || run.exitCode === undefined ? "无" : String(run.exitCode)
	const signal = run.exitSignal ? `，signal ${run.exitSignal}` : ""
	return `- 状态：已退出（退出码 ${code}${signal}，启动后 ${elapsed.toFixed(1)} 秒）\n- 这通常意味着引擎无法启动：被安全软件拦截、缺少 DLL、配置损坏，或者脚本加载阶段直接崩了。`
}

function describeAlive(run: RunningGame, waitedSeconds: number): string {
	const pid = run.pid === undefined ? "未知" : String(run.pid)
	return [
		`- 状态：仍在运行（PID ${pid}，已等待 ${waitedSeconds} 秒）`,
		"- 进程存活只说明没有立刻崩溃。真正能确认「改动加载成功」的是下面的加载痕迹与日志。",
	].join("\n")
}

function formatProcessList(games: readonly RunningGame[]): string {
	if (games.length === 0) {
		return "本扩展还没有启动过引擎。用 action=run 启动一次。"
	}
	const now = Date.now()
	return games
		.map((run) => {
			const name = path.basename(run.exePath)
			if (run.exited) {
				const seconds = ((run.exitedAt ?? now) - run.startedAt) / 1000
				return `- ${name}：已退出（退出码 ${run.exitCode ?? "无"}，运行了 ${seconds.toFixed(1)} 秒）`
			}
			const minutes = ((now - run.startedAt) / 60000).toFixed(1)
			return `- ${name}：运行中（PID ${run.pid ?? "未知"}，已运行 ${minutes} 分钟）`
		})
		.join("\n")
}

export class RunGameToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.RUN_GAME

	// 全部参数都可选（action 默认 run），不做路径校验，不需要 ToolValidator
	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const action = (block.params.action || "run").trim()
		const target = block.params.exe || "自动探测"
		return `[${block.name} for '${action} ${target}']`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 启动是副作用操作，等完整块再说
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const rawAction = (block.params.action || "run").trim().toLowerCase()
		const action = rawAction === "status" || rawAction === "stop" ? rawAction : "run"

		try {
			let body: string

			if (action === "status") {
				body = `## 进程\n${formatProcessList(listRunningGames())}`
			} else if (action === "stop") {
				const games = listRunningGames()
				if (games.length === 0) {
					body = "本扩展还没有启动过引擎，没有可结束的进程。"
				} else {
					const lines = games.map((run) => {
						const name = path.basename(run.exePath)
						if (run.exited) {
							return `- ${name}：已经退出，无需操作`
						}
						const stopped = stopEngine(run)
						return `- ${name}：${stopped ? "已结束" : "结束失败（可能已经退出）"}`
					})
					body = `## 结束结果\n${lines.join("\n")}\n\n> 强制结束不会保存游戏进度。`
				}
			} else {
				body = await this.runEngine(config, block)
			}

			const result = truncateContent(body, MAX_OUTPUT_BYTES)
			const sharedMessageProps = {
				tool: "readFile",
				path: getReadablePath(config.cwd, "."),
				content: result,
				operationIsLocatedInWorkspace: await isLocatedInWorkspace("."),
			}
			const completeMessage = JSON.stringify(sharedMessageProps)

			if (await config.callbacks.shouldAutoApproveToolWithPath(block.name, ".")) {
				await config.callbacks.say("tool", completeMessage, undefined, undefined, false)
			} else {
				const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("tool", completeMessage, config)
				if (!didApprove) {
					return formatResponse.toolDenied()
				}
			}

			telemetryService.captureToolUsage(
				config.ulid,
				block.name,
				config.api.getModel().id,
				config.services.stateManager.getApiConfiguration().actModeApiProvider as string,
				true,
				true,
				{
					isMultiRootEnabled: config.isMultiRootEnabled || false,
					usedWorkspaceHint: false,
					resolvedToNonPrimary: false,
					resolutionMethod: "primary_fallback",
				},
				block.isNativeToolCall,
			)

			config.taskState.consecutiveMistakeCount = 0
			return result
		} catch (error) {
			config.taskState.consecutiveMistakeCount++
			const errorMessage = error instanceof Error ? error.message : String(error)
			return formatResponse.toolError(`启动引擎失败：${errorMessage}`)
		}
	}

	private async runEngine(config: TaskConfig, block: ToolUse): Promise<string> {
		const extraRoots = await getExtraWorkspaceRoots(config.cwd)
		const candidates = await listEngineCandidates(config.cwd, extraRoots)

		if (candidates.length === 0) {
			return [
				"## 没有找到引擎",
				"已在探测到的工程根下按 `Emuera*.exe` 查找，没有匹配。请确认：",
				"- 引擎 exe 确实在工程根或其一层子目录里；",
				"- 文件名以 Emuera 开头（部分整合包会改名，需要手动指定时用 exe 参数给出完整路径）。",
			].join("\n")
		}

		const preferred = (block.params.exe || "").trim()
		const engine = pickEngine(candidates, preferred || undefined)
		if (!engine) {
			return [
				`## 找到 ${candidates.length} 个引擎，但「${preferred}」无法唯一匹配`,
				candidates.map(formatCandidate).join("\n"),
				"",
				"用 exe 参数指定其中一个的文件名（或更精确的片段）再试。",
			].join("\n")
		}

		const debug = parseBool(block.params.debug, true)
		const waitSeconds = parseWaitSeconds(block.params.wait_seconds)
		const keepAlive = parseBool(block.params.keep_alive, false)
		const args = debug ? ["-Debug"] : []

		// 同一个 exe 已经有活着的实例时不能再起一个：
		// ① 注册表按 exe 路径索引，新实例会覆盖旧条目，旧进程从此无法 stop（孤儿进程）；
		// ② Emuera 同时开两份会互相抢写 sav/ 与懒加载索引。
		const normalizedExe = engine.filePath.replace(/\\/g, "/").toLowerCase()
		const alive = listRunningGames().find(
			(run) => !run.exited && run.exePath.replace(/\\/g, "/").toLowerCase() === normalizedExe,
		)
		if (alive) {
			return [
				"## 已有实例在运行",
				`${engine.fileName} 已经在跑（PID ${alive.pid ?? "未知"}，已运行 ${((Date.now() - alive.startedAt) / 60000).toFixed(1)} 分钟）。`,
				"",
				"同一个引擎不能同时跑两份（会互相抢写存档与懒加载索引）。请先用 `action=stop` 结束它，再重新启动。",
			].join("\n")
		}

		// 启动前先记住当前最新日志，之后靠它区分「新写的」和「原本就有的」
		const before = await findNewestLog(config.cwd, extraRoots)
		const beforeMtime = before ? await mtimeOf(before.filePath) : 0

		// 引擎产物记在 exe 目录（引擎的 cwd），不是工作区根
		const engineDir = path.dirname(engine.filePath)
		const beforeArtifacts = await snapshotEngineArtifacts(engineDir)

		const run = startEngine(engine.filePath, args)
		await waitForSettle(run, waitSeconds * 1000)

		const afterArtifacts = await snapshotEngineArtifacts(engineDir)
		const changedArtifacts = diffEngineArtifacts(beforeArtifacts, afterArtifacts)

		const sections: string[] = []
		sections.push(
			[
				"## 引擎",
				`${engine.fileName}（${formatBytes(engine.sizeBytes)}）`,
				`路径：${engine.filePath.replace(/\\/g, "/")}`,
				`参数：${args.length > 0 ? args.join(" ") : "（无）"}`,
			].join("\n"),
		)

		if (candidates.length > 1) {
			sections.push(
				`## 其他候选\n${candidates
					.filter((item) => item !== engine)
					.map(formatCandidate)
					.join("\n")}`,
			)
		}

		sections.push(`## 进程\n${run.exited ? describeExit(run) : describeAlive(run, waitSeconds)}`)

		// 加载痕迹：这才是「能不能加载」的真判据，日志只在进入游戏后才有
		sections.push(`## 加载痕迹\n${describeArtifacts(changedArtifacts)}`)

		// 日志：优先用本次新写出来的那一份
		const after = await findNewestLog(config.cwd, extraRoots)
		if (!after) {
			sections.push("## 日志\n没有找到任何日志文件。引擎可能还没走到写日志的阶段，或者日志写在探测范围之外。")
		} else {
			const afterMtime = await mtimeOf(after.filePath)
			const isFresh = before === undefined || after.filePath !== before.filePath || afterMtime > beforeMtime
			const relative = path.relative(config.cwd, after.filePath).replace(/\\/g, "/") || after.filePath
			if (!isFresh) {
				sections.push(
					[
						"## 日志",
						`${relative} 没有变化。`,
						"Emuera 只在**进入游戏后**才写日志，停在标题画面时不会动——所以这一条不代表加载失败。加载结果看上面的「加载痕迹」。",
					].join("\n"),
				)
			} else {
				const stat = await fs.stat(after.filePath)
				const readResult = await readTextFile(after.filePath, { maxBytes: MAX_LOG_READ_BYTES })
				const session = parseLog(readResult.text)
				const sizeNote = readResult.truncated ? `，已截断：只解析了开头 ${formatBytes(readResult.byteLength)}` : ""
				sections.push(`## 日志\n${relative}（${formatBytes(stat.size)}${sizeNote}，本次启动新写入）`)
				sections.push(formatSession(session))
			}
		}

		if (keepAlive && !run.exited) {
			sections.push("## 收尾\n游戏窗口保持运行，用户可以继续操作。需要关闭时用 action=stop。")
		} else if (!run.exited) {
			const stopped = stopEngine(run)
			sections.push(
				`## 收尾\n${stopped ? "已关闭进程（强制结束，不会保存游戏进度）。" : "关闭进程失败，可能已经自行退出。"}\n需要保留窗口时传 keep_alive=true。`,
			)
		}

		return sections.join("\n\n")
	}
}

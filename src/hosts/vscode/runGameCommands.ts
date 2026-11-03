import path from "node:path"
import * as vscode from "vscode"
import { type BlockingRun, findBlockingRun, listActiveCliDebugSessions } from "@/core/era/clidebug"
import {
	type EngineCandidate,
	listEngineCandidates,
	listRunningGames,
	startEngine,
	stopEngine,
	waitForSettle,
} from "@/core/era/game-runner"
import { getExtraWorkspaceRoots } from "@/core/era/workspace-extra-roots"

/**
 * 侧栏「启动游戏 / 调试启动 / 结束游戏」三条命令的实现（08 #187）。
 *
 * 与 AI 工具 `run_game` 的分工：这里是**用户亲手点**的直启入口——没有审批卡片，
 * 单候选直接启动（启动游戏正是用户点按钮想做的事）。唯一要弹窗确认的是
 * 「强制结束」：Windows 上是 TerminateProcess，未保存的游戏进度会丢（KB 17 §17.5）。
 *
 * 引擎探测完全复用 `game-runner.ts`（版本号排序、排除 .vshost），与 AI 工具
 * 看到同一份候选列表；本命令不做 CliDebug/版本门槛——GUI 启动任何版本的引擎都行。
 */

/** 在全部工作区根（含多根的额外根）下探测引擎候选，跨根去重 */
async function findEngineCandidates(): Promise<EngineCandidate[]> {
	const folders = vscode.workspace.workspaceFolders ?? []
	if (folders.length === 0) {
		return []
	}
	// 与 RunGameToolHandler 同款：主根 + 额外根一次扫完（getEraScanRoots 内部合并）
	const primary = folders[0].uri.fsPath
	const extraRoots = await getExtraWorkspaceRoots(primary)
	return listEngineCandidates(primary, extraRoots)
}

async function pickEngineWithQuickPick(candidates: readonly EngineCandidate[]): Promise<EngineCandidate | undefined> {
	const picked = await vscode.window.showQuickPick(
		candidates.map((candidate) => ({
			label: candidate.fileName,
			description: candidate.version ? `V${candidate.version}` : undefined,
			detail: candidate.filePath,
			candidate,
		})),
		{ placeHolder: "选择要启动的 Emuera 引擎" },
	)
	return picked?.candidate
}

/**
 * 启动游戏。`debugMode=true` 时带 `-Debug`（与游戏目录 DEBUG_MODE.bat 一致），
 * 调试窗口可实时求值/看变量/跳报错行。
 */
export async function runGameCommand(debugMode: boolean): Promise<void> {
	const candidates = await findEngineCandidates()
	if (candidates.length === 0) {
		vscode.window.showInformationMessage(
			"没有在工作区里找到 Emuera 引擎（Emuera*.exe）。请确认游戏工程已作为工作区文件夹打开，引擎在工程根或其一层子目录里。",
		)
		return
	}

	const engine = candidates.length === 1 ? candidates[0] : await pickEngineWithQuickPick(candidates)
	if (!engine) {
		return
	}

	// 同一 exe 不能开第二份（互斥统一走 findBlockingRun 的归一化判定，review 批 B2）：
	// GUI 实例活着 / era_verify 在跑，都会互抢写 sav/ 与懒加载索引
	const blocking: BlockingRun | undefined = findBlockingRun(engine.filePath)
	if (blocking?.kind === "game") {
		vscode.window.showInformationMessage(
			`${engine.fileName} 已经在运行（PID ${blocking.run.pid ?? "未知"}）。同一个引擎不能同时开两份；要结束它用「era harness: 结束游戏」命令。`,
		)
		return
	}
	if (blocking) {
		vscode.window.showInformationMessage(`${engine.fileName} 正在被 era_verify 验证，跑完会自动关闭；请稍后再启动。`)
		return
	}

	const run = startEngine(engine.filePath, debugMode ? ["-Debug"] : [])
	// 稍等一下让 spawn 阶段的错误（exe 被删/权限不足）浮出来；正常加载是异步的，不等它走完
	await waitForSettle(run, 1500)
	if (run.spawnError) {
		vscode.window.showErrorMessage(`启动 ${engine.fileName} 失败：${run.spawnError}`)
		return
	}
	if (run.exited) {
		vscode.window.showErrorMessage(
			`${engine.fileName} 启动后立刻退出（退出码 ${run.exitCode ?? "无"}）。可能被安全软件拦截、缺少 DLL 或配置损坏。`,
		)
		return
	}
	vscode.window.showInformationMessage(
		`已${debugMode ? "以调试模式" : ""}启动 ${engine.fileName}（PID ${run.pid ?? "未知"}）。`,
	)
}

/**
 * 结束本插件启动的游戏实例与 era_verify 验证进程（review 修复批 #4：
 * verify 卡死时 quit 不可靠，「结束游戏」是用户的兜底手段）。
 * 强杀不保存进度，必须弹模态确认。
 */
export async function stopGameCommand(): Promise<void> {
	const aliveGames = listRunningGames().filter((run) => !run.exited)
	const verifySessions = listActiveCliDebugSessions()
	if (aliveGames.length === 0 && verifySessions.length === 0) {
		vscode.window.showInformationMessage("没有本插件启动的游戏或验证进程。")
		return
	}

	type StopItem =
		| { kind: "game"; label: string; description: string; run: (typeof aliveGames)[number] }
		| { kind: "verify"; label: string; description: string; session: (typeof verifySessions)[number]["session"] }

	const items: StopItem[] = [
		...aliveGames.map(
			(run): StopItem => ({
				kind: "game",
				label: path.basename(run.exePath),
				description: `游戏实例，PID ${run.pid ?? "未知"}`,
				run,
			}),
		),
		...verifySessions.map(
			(entry): StopItem => ({
				kind: "verify",
				label: path.basename(entry.exePath),
				description: `era_verify 验证进程，PID ${entry.session.pid ?? "未知"}`,
				session: entry.session,
			}),
		),
	]

	let targets = items
	if (items.length > 1) {
		const picked = await vscode.window.showQuickPick(
			items.map((item) => ({ label: item.label, description: item.description, item })),
			{ placeHolder: "选择要结束的进程" },
		)
		if (!picked) {
			return
		}
		targets = [picked.item]
	}

	const names = targets.map((item) => item.label).join("、")
	const answer = await vscode.window.showWarningMessage(
		`强制结束 ${names} 不会保存游戏进度（验证进程会连带丢弃本次验证结果），确认结束？`,
		{ modal: true },
		"结束",
	)
	if (answer !== "结束") {
		return
	}
	for (const item of targets) {
		if (item.kind === "game") {
			const stopped = stopEngine(item.run)
			if (!stopped) {
				vscode.window.showErrorMessage(`结束 ${item.label} 失败（可能已经自行退出）。`)
			}
		} else {
			// kill 是 TerminateProcess，异步落地；稍等让 exit 事件走完再返回
			item.session.kill()
			await item.session.waitForExit(3000)
		}
	}
}

/**
 * eratw 一键更新 —— VS Code 侧的用户流程。
 *
 * 为什么用**原生弹窗**而不是聊天区卡片：
 * 1. 目标用户没有 git 概念，一个"是/否"的模态框比一张带 diff 的卡片更容易下决心；
 * 2. 原生弹窗不需要新增 proto 消息类型、不需要改 webview，风险面小得多；
 * 3. 弹窗的按钮本身就是**不可伪造的确认**——AI 没有任何办法替你点它，
 *    天然满足「apply 必须有人点确认，与自动批准无关」。
 *
 * 全部文案走 `describe.ts`，这里只负责顺序与交互，不拼字符串。
 */

import type { Controller } from "@core/controller"
import { rollbackFromBackup } from "@core/update/apply"
import { describeFreeModelRisk, describeGroup, describePlan, describeResult } from "@core/update/describe"
import {
	defaultSelection,
	describeCandidate,
	discoverGameRoots,
	type GameRootCandidate,
	readNowVersion,
} from "@core/update/discover"
import { resolveConflictsViaWorkbench } from "@core/update/mergeResolve"
import type { MergeReaders, RunUpdateResult, UpdateEvent, UpdateSourceInput } from "@core/update/service"
import { runUpdate } from "@core/update/service"
import type { ConflictGroup, UpdatePlan } from "@core/update/types"
import { Logger } from "@shared/services/Logger"
import { ulid } from "ulid"
import * as vscode from "vscode"
import { canRunMergeConversation, isConversationBusy, runMergeConversation } from "./mergeTask"

const PROGRESS_TITLE = "正在更新 eraTW"

/** 阶段 → 人话（不出现 download/scan/apply 这类词） */
function stageText(event: UpdateEvent): string {
	switch (event.stage) {
		case "check":
			return "正在看看社区有没有新版本…"
		case "download":
			return "正在下载社区版本…"
		case "snapshot":
			return "正在读取文件清单…"
		case "scan":
			return "正在扫描本地的游戏文件…"
		case "labels":
			return "正在建函数索引（查有没有人调被删掉的函数）…"
		case "plan":
			return "正在比对哪些文件要更新…"
		case "merge":
			return event.message ? `正在合并 ${event.message}…` : "正在合并你改过的文件…"
		case "apply":
			if (!event.message) {
				return "正在备份并写入…"
			}
			// 删旧文件时不能说"正在写入"——用户会以为刚删掉的又被写回来了
			return event.action === "delete" ? `正在清理 ${event.message}…` : `正在写入 ${event.message}…`
		case "verify":
			return "正在检查有没有写对…"
	}
}

/**
 * 把 `UpdateEvent` 翻译成进度条文案，**只在文案变化时上报**。
 *
 * 扫描 16906 个文件会发上万次事件，每次都 `progress.report` 会让通知区不停重绘
 * （真机验收时观察到同一句话被上报上万次）。`apply` / `merge` 阶段文案里带文件名，
 * 会自然变化，所以仍然逐个显示"正在写入 xxx"。
 */
function stageReporter(progress: vscode.Progress<{ message?: string }>): (event: UpdateEvent) => void {
	let last = ""
	return (event) => {
		const text = stageText(event)
		if (text === last) {
			return
		}
		last = text
		progress.report({ message: text })
	}
}

/**
 * 造一个「问模型」的函数给合并用。
 *
 * `@core/api` 是**动态加载**的：更新本身不需要模型，只有用户在冲突弹窗里
 * 真的点了「让 AI 帮我合并」才需要。这样即使 provider 层没配好、甚至初始化
 * 失败，更新依然能走完（冲突文件原样保留），不会因为"AI 不可用"而更新不了。
 */
async function mergeAsk(controller?: Controller) {
	if (!controller) {
		return null
	}
	try {
		const { buildApiHandler } = await import("@core/api")
		const { createMergeAsk } = await import("@core/update/mergeProvider")
		const config = controller.stateManager.getApiConfiguration()
		const api = buildApiHandler({ ...config, ulid: ulid() }, "act")
		return createMergeAsk(api)
	} catch (error) {
		// 没配模型也能更新，只是不能帮你合并 —— 冲突文件会原样保留
		Logger.warn(`[update] AI 合并不可用：${error}`)
		return null
	}
}

async function pickRoots(candidates: GameRootCandidate[]): Promise<GameRootCandidate[] | null> {
	const preselected = new Set(defaultSelection(candidates).map((c) => c.path))
	const items = candidates.map((candidate) => {
		const duplicate = candidate.duplicateOf
		return {
			label: candidate.duplicateOf ? `$(copy) ${candidate.relPath}` : candidate.relPath,
			description: describeCandidate(candidate),
			detail: duplicate ? `和 ${duplicate} 是同一份安装的副本` : undefined,
			picked: preselected.has(candidate.path) && !duplicate,
			candidate,
		}
	})

	const picked = await vscode.window.showQuickPick(items, {
		title: "找到好几个 eraTW，要更新哪个？",
		placeHolder: "可以多选。带「副本」标记的是重复安装，一般不用勾。",
		canPickMany: true,
		ignoreFocusOut: true,
	})
	if (!picked || picked.length === 0) {
		return null
	}
	return picked.map((item) => item.candidate)
}

/** 连不上社区服务器时，退到"我有压缩包" */
async function pickArchive(): Promise<string | null> {
	const choice = await vscode.window.showWarningMessage(
		"连不上社区服务器。如果你手上有别人给的压缩包，也可以用它来更新。",
		{ modal: true },
		"我有压缩包",
		"算了",
	)
	if (choice !== "我有压缩包") {
		return null
	}
	const picked = await vscode.window.showOpenDialog({
		title: "选择社区版压缩包（.tar.gz）",
		canSelectMany: false,
		canSelectFolders: false,
		filters: { 压缩包: ["gz", "tgz"] },
	})
	return picked?.[0]?.fsPath ?? null
}

interface Planned {
	source: UpdateSourceInput
	result: RunUpdateResult
}

/** 先只算计划，一个字节都不写 */
async function planFor(root: string): Promise<Planned | null> {
	let source: UpdateSourceInput = { kind: "gitlab" }
	try {
		const result = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: PROGRESS_TITLE },
			(progress) =>
				runUpdate({
					root,
					source,
					dryRun: true,
					onEvent: stageReporter(progress),
				}),
		)
		return { source, result }
	} catch (error) {
		Logger.warn(`[update] 检查更新失败：${error}`)
		const archive = await pickArchive()
		if (!archive) {
			await vscode.window.showErrorMessage("连不上社区服务器，这次没能更新。稍后再试，或者找朋友要一份压缩包。")
			return null
		}
		source = { kind: "archive", path: archive }
		const result = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: PROGRESS_TITLE },
			(progress) =>
				runUpdate({
					root,
					source,
					dryRun: true,
					onEvent: stageReporter(progress),
				}),
		)
		return { source, result }
	}
}

/**
 * 找正在运行的 Emuera 进程。
 *
 * Windows 上文件被占用时写入会半途失败，虽然 `apply.ts` 会整体回滚，
 * 但让用户先关游戏比"更新失败再来一次"体验好得多（`知识库/13 §13.10` 第 3 条）。
 */
async function runningGameProcesses(): Promise<string[]> {
	if (process.platform !== "win32") {
		return []
	}
	try {
		const { execFile } = await import("node:child_process")
		const stdout = await new Promise<string>((resolve, reject) => {
			execFile("tasklist", ["/FO", "CSV", "/NH"], { windowsHide: true }, (error, output) => {
				if (error) {
					reject(error)
				} else {
					resolve(output)
				}
			})
		})
		const names = new Set<string>()
		for (const line of stdout.split(/\r?\n/)) {
			const name = line.split('","')[0]?.replace(/^"/, "") ?? ""
			if (/emuera/i.test(name)) {
				names.add(name)
			}
		}
		return [...names]
	} catch {
		// 查不到就当没在跑：不让这个检查本身挡住更新
		return []
	}
}

/**
 * 当前是不是免费模型（2026-10-19 用户需求）。
 *
 * 更新里的 AI 合稿走 act 模式 handler（`mergeAsk` 用 `buildApiHandler(config, "act")`），
 * 所以看 `actModeApiProvider`——它的默认值本身就是免费（`DEFAULT_API_PROVIDER`），
 * 新装用户会被这条提醒覆盖到，符合预期。
 */
function isFreeModelProvider(controller?: Controller): boolean {
	const provider = controller?.stateManager.getApiConfiguration().actModeApiProvider
	return provider === "free"
}

/** 逐组问「你改过，社区也改了」 */
function askGroup(group: ConflictGroup): Thenable<string | undefined> {
	return vscode.window.showWarningMessage(describeGroup(group), { modal: true }, "让 AI 帮我合并", "保留我的版本")
}

/** 冲突走哪条路 */
type MergeMode = "conversation" | "silent" | "abort"

/**
 * 用户想看到合并过程吗？
 *
 * 默认**对话**——这是本功能的目的：让用户看清 AI 改了什么。三种情况退回静默：
 * 没有可用对话（测试替身 / 无 controller）、有对话正在跑、用户自己选静默。
 * 返回 `"abort"` 表示用户连更新都不想继续了。
 */
async function pickMergeMode(controller?: Controller): Promise<MergeMode> {
	if (!canRunMergeConversation(controller)) {
		return "silent"
	}
	if (isConversationBusy(controller)) {
		const choice = await vscode.window.showWarningMessage(
			"现在有一个对话正在跑，没法为合并新开一个对话。",
			{
				modal: true,
				detail: "想看到 AI 每一步改了什么，就等这个对话结束或取消之后，再点更新。",
			},
			"这次用静默合并",
			"先不更新了",
		)
		return choice === "这次用静默合并" ? "silent" : "abort"
	}
	if (controller?.task) {
		const choice = await vscode.window.showWarningMessage(
			"合并要在一个新对话里进行——你能看到 AI 读了什么、改了什么、为什么这么改。",
			{
				modal: true,
				detail: "不过这会替换掉当前的对话（内容不会丢，「历史记录」里还能找回来）。",
			},
			"开新对话合并",
			"用静默合并",
			"先不更新了",
		)
		if (choice === "开新对话合并") {
			return "conversation"
		}
		return choice === "用静默合并" ? "silent" : "abort"
	}
	return "conversation"
}

/** 工作台时间戳：同一游戏下多次回合并各占一个目录，不会互相覆盖 */
function workbenchStamp(): string {
	return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")
}

async function updateOne(root: string, controller?: Controller): Promise<void> {
	const planned = await planFor(root)
	if (!planned) {
		return
	}

	// `planned` = 算出了计划但没执行；`up-to-date` 才是真的没事干
	const hasWork = planned.result.status === "planned"
	const localVersion = await readNowVersion(root)
	const upstreamVersion = planned.result.head?.nowVersion ?? null

	if (!hasWork) {
		const done = describeResult("up-to-date", { root, nowVersion: localVersion ?? upstreamVersion })
		await vscode.window.showInformationMessage(done.text)
		return
	}

	// 免费模型风险提醒（2026-10-19 用户需求）：免费池可能抽到智力不高的模型，
	// AI 合稿有风险，建议升级之前先手动备份。放在计划确认之前——用户看到这屏时
	// 已经知道"有活要干"，是最该下决心的那一刻。
	if (isFreeModelProvider(controller)) {
		const risk = describeFreeModelRisk()
		const proceed = await vscode.window.showWarningMessage(
			risk.title,
			{ modal: true, detail: risk.detail },
			"继续更新",
			"先不更新",
		)
		if (proceed !== "继续更新") {
			return
		}
	}

	const narrative = describePlan(planned.result.plan, {
		fromVersion: localVersion,
		toVersion: upstreamVersion,
	})

	const confirmed = await vscode.window.showInformationMessage(
		narrative.title,
		{ modal: true, detail: narrative.lines.join("\n") },
		"开始更新",
		"以后再说",
	)
	if (confirmed !== "开始更新") {
		return
	}

	const running = await runningGameProcesses()
	if (running.length > 0) {
		await vscode.window.showErrorMessage(`游戏还开着（${running.join("、")}），先关掉再更新。开着的时候改文件会失败。`)
		return
	}

	const mode = await pickMergeMode(controller)
	if (mode === "abort") {
		return
	}

	const ask = await mergeAsk(controller)
	const resolveConflicts =
		mode === "conversation" && controller
			? (plan: UpdatePlan, readers: MergeReaders) =>
					resolveConflictsViaWorkbench({
						plan,
						root,
						stamp: workbenchStamp(),
						...readers,
						shouldMerge: async (group) => (await askGroup(group)) === "让 AI 帮我合并",
						runTask: (prompt, layout) => runMergeConversation(controller, root, prompt, layout),
						maxAttempts: 2,
					})
			: undefined

	const result = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: PROGRESS_TITLE, cancellable: false },
		(progress) =>
			runUpdate({
				root,
				source: planned.source,
				confirm: () => true,
				merge:
					resolveConflicts || !ask
						? undefined
						: {
								ask,
								shouldMerge: async (group) => (await askGroup(group)) === "让 AI 帮我合并",
							},
				resolveConflicts,
				onEvent: stageReporter(progress),
			}),
	)

	const merged = result.resolve?.files.filter((file) => file.decision === "merged").length ?? 0
	const keptLocal = result.resolve?.files.filter((file) => file.decision !== "merged").length ?? 0
	const narrative2 = describeResult(result.status, {
		root,
		nowVersion: result.verify?.nowVersion ?? result.head?.nowVersion ?? null,
		merged,
		keptLocal,
		backupDir: result.report?.backupDir ?? null,
		error: result.error,
	})

	// 对话工作台的备注（有几个窗口没交、AI 有没有动工作台之外的文件）：
	// 不影响成败，但用户有权知道，所以单独弹一次而不塞进结果框。
	const notes = result.resolve?.notes ?? []
	if (notes.length > 0) {
		await vscode.window.showWarningMessage(notes.join("\n"), { modal: true }, "知道了")
	}

	if (result.status === "applied") {
		const choice = await vscode.window.showInformationMessage(
			narrative2.title,
			{ modal: true, detail: narrative2.lines.join("\n") },
			"撤销这次更新",
			"知道了",
		)
		if (choice === "撤销这次更新") {
			await undo(result, root)
		}
		return
	}

	if (result.status === "failed") {
		await vscode.window.showErrorMessage(narrative2.text)
		return
	}

	await vscode.window.showInformationMessage(narrative2.text)
}

async function undo(result: RunUpdateResult, root: string): Promise<void> {
	const backupDir = result.report?.backupDir
	if (!backupDir) {
		await vscode.window.showErrorMessage("找不到这次更新的备份，没法自动撤销。备份一般在游戏目录下的「_备份」文件夹里。")
		return
	}
	const report = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: "正在撤销…", cancellable: false },
		() => rollbackFromBackup(backupDir),
	)
	if (report.ok) {
		await vscode.window.showInformationMessage(`已经撤销，游戏回到更新前的样子（${root}）。`)
	} else {
		await vscode.window.showErrorMessage(
			`撤销没完全成功：${report.errors[0]?.message ?? "未知原因"}。备份还留在 ${backupDir}，可以手动还原。`,
		)
	}
}

/**
 * 命令入口。
 *
 * 不传 `controller` 也能跑，只是没有 AI 合并能力（冲突文件一律保留本地）。
 */

/** 多个工作区根可能重叠（同一个游戏被两个根覆盖），按路径去重 */
function dedupeCandidates(candidates: GameRootCandidate[]): GameRootCandidate[] {
	const seen = new Set<string>()
	const result: GameRootCandidate[] = []
	for (const candidate of candidates) {
		const key = candidate.path.replace(/\\/g, "/").toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		result.push(candidate)
	}
	return result
}

export async function updateGameCommand(controller?: Controller): Promise<void> {
	// 多根工作区：每个根都找一遍，不替用户选第一个根
	const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath)
	if (workspaceRoots.length === 0) {
		await vscode.window.showErrorMessage("请先用编辑器打开游戏所在的文件夹（或其上层目录），再点更新。")
		return
	}

	let candidates: GameRootCandidate[]
	try {
		candidates = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: "正在找 eraTW 的游戏目录…" },
			async () => {
				const collected: GameRootCandidate[] = []
				for (const root of workspaceRoots) {
					collected.push(...(await discoverGameRoots(root)))
				}
				return dedupeCandidates(collected)
			},
		)
	} catch (error) {
		await vscode.window.showErrorMessage(`找游戏目录时出错了：${error instanceof Error ? error.message : error}`)
		return
	}

	if (candidates.length === 0) {
		await vscode.window.showErrorMessage(
			"当前工作区里没找到 eraTW 的游戏目录。可以打开游戏所在的文件夹，或打开它的上层目录（插件会自己往下找）再试。",
		)
		return
	}

	const roots = candidates.length === 1 ? candidates : await pickRoots(candidates)
	if (!roots) {
		return
	}

	for (const root of roots) {
		await updateOne(root.path, controller)
	}
}

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
import { type BatchChoice, type ConflictChoice, createConflictPolicy } from "@core/update/conflictPolicy"
import {
	describeBaselineUntrusted,
	describeBatchConflict,
	describeFreeModelRisk,
	describeGroup,
	describeGroupDetail,
	describeMergeCost,
	describePlan,
	describeResult,
	describeRootSuspicionShort,
	describeRootTrustWarning,
} from "@core/update/describe"
import {
	assessRootSuspicion,
	defaultSelection,
	describeCandidate,
	discoverGameRoots,
	type GameRootCandidate,
	readNowVersion,
} from "@core/update/discover"
import {
	availableMergeModelOptions,
	defaultMergeModelOption,
	describeMergeModelPicker,
	describeMergeModelUsed,
	describeWeakMergeModel,
	type MergeModelOption,
	mergeModelOptions,
	mergeModelOverride,
} from "@core/update/mergeModel"
import { resolveConflictsViaWorkbench } from "@core/update/mergeResolve"
import { planFingerprint } from "@core/update/plan"
import { describeMergeHeartbeat, describeWorkbenchProgress, stageText } from "@core/update/progressText"
import type { MergeReaders, RunUpdateResult, UpdateEvent, UpdateSourceInput } from "@core/update/service"
import { runUpdate } from "@core/update/service"
import type { ConflictGroup, UpdatePlan } from "@core/update/types"
import { Logger } from "@shared/services/Logger"
import { ulid } from "ulid"
import * as vscode from "vscode"
import { canRunMergeConversation, isConversationBusy, runMergeConversation } from "./mergeTask"
import { createUpdatePanel, panelEventPayload } from "./updatePanel"

const PROGRESS_TITLE = "正在更新 eraTW"

/**
 * 把 `UpdateEvent` 翻译成进度条文案，**只在文案变化时上报**。
 *
 * 扫描 16906 个文件会发上万次事件，每次都 `progress.report` 会让通知区不停重绘
 * （真机验收时观察到同一句话被上报上万次）。`apply` / `merge` 阶段文案里带文件名，
 * 会自然变化，所以仍然逐个显示"正在写入 xxx"。
 *
 * ⚠️ 必须**只创建一次**再反复调用：`stageReporter(progress)(event)` 每次都会新建闭包，
 * `last` 永远重置，等于没有去重（08 #181 修的就是这个）。
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
 *
 * #64：传了 `model` 就按它覆盖**本次**请求用的家与模型——不写全局设置，
 * 用户聊天的模型一点不变。
 */
async function mergeAsk(controller?: Controller, model?: MergeModelOption) {
	if (!controller) {
		return null
	}
	try {
		const { buildApiHandler } = await import("@core/api")
		const { createMergeAsk } = await import("@core/update/mergeProvider")
		const config = controller.stateManager.getApiConfiguration()
		const override = model ? mergeModelOverride(model) : {}
		const api = buildApiHandler({ ...config, ...override, ulid: ulid() }, "act")
		return createMergeAsk(api)
	} catch (error) {
		// 没配模型也能更新，只是不能帮你合并 —— 冲突文件会原样保留
		Logger.warn(`[update] AI 合并不可用：${error}`)
		return null
	}
}

async function pickRoots(candidates: GameRootCandidate[]): Promise<GameRootCandidate[] | null> {
	const preselected = new Set(defaultSelection(candidates).map((c) => c.path))
	const items = await Promise.all(
		candidates.map(async (candidate) => {
			const duplicate = candidate.duplicateOf
			// 多候选也标注环境疑点（嵌套副本/口上工程），让用户挑的时候看得见风险；
			// 是用户自己勾的，勾完不再重复弹窗。
			const suspicionNote = describeRootSuspicionShort(await assessRootSuspicion(candidate.path))
			const notes = [duplicate ? `和 ${duplicate} 是同一份安装的副本` : undefined, suspicionNote].filter(
				(note): note is string => note !== undefined,
			)
			return {
				label: candidate.duplicateOf ? `$(copy) ${candidate.relPath}` : candidate.relPath,
				description: describeCandidate(candidate),
				detail: notes.length > 0 ? notes.join("；") : undefined,
				picked: preselected.has(candidate.path) && !duplicate,
				candidate,
			}
		}),
	)

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
 * 但让用户先关游戏比"更新失败再来一次"体验好得多（写盘前拦，⛔ 事后回滚）。
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

/**
 * 逐组问「你改过，社区也改了」；完整路径放 detail（弹窗正文只露短名，F4）。
 *
 * 后两个按钮是「剩下的都这样」——用户点到一半发现还有几十个，可以一次收尾。
 */
function askGroup(group: ConflictGroup): Thenable<string | undefined> {
	return vscode.window.showWarningMessage(
		describeGroup(group),
		{ modal: true, detail: describeGroupDetail(group) },
		"让 AI 帮我合并",
		"保留我的版本",
		"剩下的都合并",
		"剩下的都保留",
	)
}

/** 冲突太多时先问一次整体做法：2785 个冲突不该变成 2785 次弹窗 */
async function askBatchConflict(groups: number, files: number): Promise<BatchChoice | undefined> {
	const narrative = describeBatchConflict(groups, files)
	const choice = await vscode.window.showWarningMessage(
		narrative.title,
		{ modal: true, detail: narrative.detail },
		narrative.options.mergeAll,
		narrative.options.keepAll,
		narrative.options.oneByOne,
		narrative.options.cancel,
	)
	if (choice === narrative.options.mergeAll) {
		// 选「全部合并」才提成本：一次性把轮数/时限说清，别让用户以为点一下就好
		const proceed = await vscode.window.showWarningMessage(
			"全部合并要花点时间",
			{ modal: true, detail: describeMergeCost(files) },
			"继续",
			"取消更新",
		)
		return proceed === "继续" ? "merge-all" : undefined
	}
	if (choice === narrative.options.keepAll) {
		return "keep-all"
	}
	if (choice === narrative.options.oneByOne) {
		return "one-by-one"
	}
	return undefined
}

/** 一组冲突 → 策略枚举（关掉弹窗 = 取消整次更新） */
async function askOneGroup(group: ConflictGroup): Promise<ConflictChoice | undefined> {
	const choice = await askGroup(group)
	if (choice === "让 AI 帮我合并") {
		return "merge"
	}
	if (choice === "保留我的版本") {
		return "keep"
	}
	if (choice === "剩下的都合并") {
		return "merge-rest"
	}
	if (choice === "剩下的都保留") {
		return "keep-rest"
	}
	return undefined
}

/** 选模型这一步的结果（三态必须分清，见 `pickMergeModel` 的注释） */
type MergeModelPick =
	| { kind: "picked"; option: MergeModelOption }
	| { kind: "cancelled" }
	| { kind: "unavailable"; reason: string }

/**
 * 每次合并前选一次模型（#64）。
 *
 * 三态而不是 `option | null`：
 * - `picked`：用户选了，按它合并；
 * - `cancelled`：用户放弃 → **中止整次更新**（⛔ 不要静默拿默认款继续：
 *   「你没选，我就替你花了另一家的钱」比多问一句糟得多）；
 * - `unavailable`：一个可用的都没有（全新用户只有免费池、没填任何付费密钥）
 *   → 沿用当前模型，⛔ 绝不能当成 cancelled：那等于把免费用户的更新功能关掉。
 */
async function pickMergeModel(controller?: Controller): Promise<MergeModelPick> {
	const stateManager = controller?.stateManager
	const config = stateManager?.getApiConfiguration()
	const all = mergeModelOptions()
	// 没填密钥的家不列：选了也调不通，只会让合并 401 后白等一轮
	const options = stateManager ? availableMergeModelOptions(all, (key) => Boolean(stateManager.getSecretKey(key))) : all
	if (options.length === 0) {
		return { kind: "unavailable", reason: "没有已填密钥的模型可选，这次沿用当前模型" }
	}

	const fallback = defaultMergeModelOption(options, {
		provider: config?.actModeApiProvider,
		modelId: config?.actModeApiModelId,
	})
	// quickpick 的数组形态没有「预选中」，所以把当前在用的那款顶到第一行并标注，
	// 用户回车即等于「不改」。⛔ 不要默认选推荐款——那等于偷偷换家花钱。
	const ordered = fallback ? [fallback, ...options.filter((option) => option !== fallback)] : options
	const items = ordered.map((option) => ({
		label: option.label,
		description: option === fallback ? `当前在用 · ${option.description}` : option.description,
		detail: option.detail,
		option,
	}))

	const picked = await vscode.window.showQuickPick(items, {
		...describeMergeModelPicker(),
		ignoreFocusOut: true,
		matchOnDetail: true,
	})
	if (!picked) {
		return { kind: "cancelled" }
	}

	if (picked.option.weak) {
		const warn = describeWeakMergeModel(picked.option)
		const choice = await vscode.window.showWarningMessage(
			warn.title,
			{ modal: true, detail: warn.detail },
			warn.keep,
			warn.change,
		)
		if (choice === warn.change) {
			// 重新选一次（而不是在这里列模型）：用户已经见过一遍清单了
			return pickMergeModel(controller)
		}
		if (choice !== warn.keep) {
			return { kind: "cancelled" }
		}
	}

	Logger.log(`[update] 本次合并用模型：${picked.option.provider}/${picked.option.modelId}`)
	return { kind: "picked", option: picked.option }
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

/** 工作台时间戳：同一游戏下多次回合并各占一个目录，不会互相覆盖；秒级避免同分钟互相覆盖（U5） */
function workbenchStamp(): string {
	return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")
}

/**
 * 二次执行的确认回调（U3）：用户点过的计划必须就是实际执行的计划。
 *
 * 确认之后还要重新联网取最新、重新扫盘、重建计划，中间可能隔着一整段对话式合并。
 * 期间社区推了新版本、或本地文件被动过，写盘集合就会和确认过的不同——
 * 所以这里比对计划指纹：一致直接放行，漂移了就把**新**清单再弹一次给用户拍板。
 */
async function confirmRebuiltPlan(rebuilt: UpdatePlan, confirmed: UpdatePlan): Promise<boolean> {
	if (planFingerprint(rebuilt) === planFingerprint(confirmed)) {
		return true
	}
	const narrative = describePlan(rebuilt)
	const choice = await vscode.window.showWarningMessage(
		"刚才确认之后，要更新的内容又有变化。下面是最新的改动清单。",
		{ modal: true, detail: narrative.lines.join("\n") },
		"按新清单继续",
		"取消更新",
	)
	return choice === "按新清单继续"
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
		root,
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

	// #64：只有真有冲突才需要合并——也才需要问「开不开新对话」和「用哪个模型」。
	// 没有冲突还问这两句，等于让用户为一件不会发生的事做决定。
	const needsMerge = planned.result.plan.summary.conflict > 0
	const mode = needsMerge ? await pickMergeMode(controller) : "silent"
	if (mode === "abort") {
		return
	}

	const pick = needsMerge ? await pickMergeModel(controller) : { kind: "unavailable" as const, reason: "这次没有要合并的文件" }
	if (pick.kind === "cancelled") {
		return
	}
	if (pick.kind === "unavailable") {
		Logger.log(`[update] 未指定合并模型：${pick.reason}`)
	}
	const mergeModel = pick.kind === "picked" ? pick.option : undefined

	// 没冲突就不构造 handler：构造本身不发请求，但 provider 配置异常时会打一条
	// 「AI 合并不可用」的 warn，容易被误读成「这次更新要 AI 但失败了」。
	const ask = needsMerge ? await mergeAsk(controller, mergeModel ?? undefined) : null
	// 会话级冲突策略：两条合并路径共用同一个实例，行为不可能分裂
	const shouldMerge = createConflictPolicy({
		groupCount: planned.result.plan.groups.length,
		fileCount: planned.result.plan.summary.conflict,
		askBatch: ({ groups, files }) => askBatchConflict(groups, files),
		askOne: askOneGroup,
	})
	// F5：「eraTW 更新中心」面板——更新全程的可视镜像（阶段/进度/当前文件/取消/结果）。
	// 增量旁路设计：确认与执行仍走既有模态框（安全闸门不变），面板加载失败自动降级为纯通知。
	// 08 #181：面板要在 resolveConflicts 之前建好——合并心跳要往它里面写。
	const panel = await createUpdatePanel(root)

	const resolveConflicts =
		mode === "conversation" && controller
			? (plan: UpdatePlan, readers: MergeReaders) =>
					resolveConflictsViaWorkbench({
						plan,
						root,
						stamp: workbenchStamp(),
						...readers,
						shouldMerge,
						runTask: (prompt, layout) =>
							runMergeConversation(controller, root, prompt, layout, mergeModel ?? undefined, (info) => {
								// 合并阶段唯一的活性信号：面板明细 + 通知区各写一条
								const text = describeMergeHeartbeat(info.elapsedMs, info.lastText)
								panel?.post({ type: "event", stage: "merge", message: text })
							}),
						// 这条通道早就铺好了，之前没接 → 合并期间面板一行都不动
						onProgress: (progress) => {
							panel?.post({ type: "event", stage: "merge", message: describeWorkbenchProgress(progress) })
						},
						maxAttempts: 2,
					})
			: undefined

	const UPDATE_CANCELLED = "UPDATE_CANCELLED"
	let result: RunUpdateResult
	try {
		result = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: PROGRESS_TITLE, cancellable: false },
			(progress) => {
				// 只建一次：每次事件新建闭包会让 `last` 重置，去重形同虚设
				const reportStage = stageReporter(progress)
				return runUpdate({
					root,
					source: planned.source,
					confirm: (rebuilt) => confirmRebuiltPlan(rebuilt, planned.result.plan),
					// 比对对不上时先问一次整体做法，绝不逐文件问上千次
					onBaselineUntrusted: async (info) => {
						const narrative = describeBaselineUntrusted(info)
						const choice = await vscode.window.showWarningMessage(
							narrative.title,
							{ modal: true, detail: narrative.detail },
							narrative.options.keepAll,
							narrative.options.takeTheirs,
							narrative.options.cancel,
						)
						if (choice === narrative.options.keepAll) {
							return "keep-all"
						}
						if (choice === narrative.options.takeTheirs) {
							return "take-theirs"
						}
						return "cancel"
					},
					merge:
						resolveConflicts || !ask
							? undefined
							: {
									ask,
									shouldMerge,
								},
					resolveConflicts,
					onEvent: (event) => {
						reportStage(event)
						panel?.post(panelEventPayload(event))
						if (panel?.cancelled) {
							// 取消在下一个事件边界生效：写入阶段的取消会触发 apply.ts 的整体回滚
							throw new Error(UPDATE_CANCELLED)
						}
					},
				})
			},
		)
	} catch (error) {
		if (error instanceof Error && error.message === UPDATE_CANCELLED) {
			panel?.finish({
				title: "已取消更新",
				lines: [
					"你在更新过程中点了取消，已安全停下。",
					"如果取消发生在写入阶段，所有文件已自动回滚，游戏回到更新前的样子。",
				],
			})
			return
		}
		throw error
	}

	const merged = result.resolve?.files.filter((file) => file.decision === "merged").length ?? 0
	const keptLocal = result.resolve?.files.filter((file) => file.decision !== "merged").length ?? 0
	const narrative2 = describeResult(result.status, {
		root,
		nowVersion: result.verify?.nowVersion ?? result.head?.nowVersion ?? null,
		merged,
		keptLocal,
		backupDir: result.report?.backupDir ?? null,
		error: result.error,
		// 回滚没跑干净时明说；写后校验没过的文件点名（这两个字段只在对应状态有值）
		rolledBack: result.report?.rolledBack,
		verifyMismatches: result.verify?.mismatches.map((m) => m.path) ?? [],
	})

	// F5：结果同步进面板（标题/明细/备份位置/合并与保留计数），面板留给用户看完再关。
	// 单一来源（#53）：结构化字段（backupDir/merged/kept）由面板自行渲染，lines 里与之重复的行
	// 在此滤掉——此前两侧都画，备份路径出现两条且措辞不一。无面板降级路径（下方 modal）仍用完整 lines。
	const backupDir = result.report?.backupDir ?? null
	// kept 追加行只进 modal（面板由结构化 kept 渲染同一信息）
	const modalLines = [...narrative2.lines, ...(keptLocal > 0 ? ["这些文件社区这次没能更新它们，下次更新会再问。"] : [])]
	// #64：用户选了合并用模型，就得在结果里看到它确实生效了（选了却看不到 = 等于没生效）
	if (mergeModel && (merged > 0 || keptLocal > 0)) {
		modalLines.push(describeMergeModelUsed(mergeModel))
	}
	// 校验失败分支的备份行自带「手动对照」提示，过滤后补回一句等价的，提示不丢
	const keepCompareAdvice =
		backupDir !== null && modalLines.some((line) => line.includes(backupDir) && line.includes("不放心可以手动对照"))
	const panelLines = modalLines.filter(
		(line) =>
			!(backupDir !== null && line.includes(backupDir)) && !line.startsWith("其中 ") && !line.startsWith("这些文件社区"),
	)
	if (keepCompareAdvice) {
		panelLines.push("备份还在原处，不放心可以打开对照。")
	}
	panel?.finish({
		title: narrative2.title,
		lines: panelLines,
		backupDir,
		merged,
		kept: keptLocal,
		// 只有成功落盘的更新才有「撤销」的意义（失败分支已自动回滚，没有可撤销的东西）
		canUndo: result.status === "applied",
	})
	// #61：结果态的撤销 / 打开备份目录按钮走这条回调（面板可能已关，panel 为 null 时自然跳过）
	if (panel && backupDir) {
		panel.handlers.openBackup = () => {
			void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(backupDir))
		}
		if (result.status === "applied") {
			panel.handlers.undo = () => {
				void undo(result, root)
			}
		}
	}

	// 对话工作台的备注（有几个窗口没交、AI 有没有动工作台之外的文件）：
	// 不影响成败，但用户有权知道，所以单独弹一次而不塞进结果框。
	const notes = result.resolve?.notes ?? []
	if (notes.length > 0) {
		await vscode.window.showWarningMessage(notes.join("\n"), { modal: true }, "知道了")
	}

	if (result.status === "applied") {
		const choice = await vscode.window.showInformationMessage(
			narrative2.title,
			{ modal: true, detail: modalLines.join("\n") },
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
			"当前工作区里没找到 eraTW 的游戏目录。如果现在打开的是口上工程，游戏本体不在工作区里——请打开游戏所在的文件夹（或它的上层目录，插件会自己往下找），再点更新。",
		)
		return
	}

	if (candidates.length === 1) {
		const only = candidates[0]
		if (!only) {
			return
		}
		// 2026-11-02 用户报告的事故：口上工程里捆着一份游戏副本，恰好是唯一候选，
		// 零确认被自动选用，整个更新连 `_备份` 一起落进了口上文件夹。
		// 所以唯一候选也要过环境疑点检查：可疑就把话说清楚，再让人决定。
		// 「取消」放在第一个按钮：这个提醒的风险（写错目录）比别的提醒更硬，回车要落在安全的一侧。
		const suspicions = await assessRootSuspicion(only.path)
		if (suspicions.length > 0) {
			const warn = describeRootTrustWarning(only, suspicions)
			const proceed = await vscode.window.showWarningMessage(
				warn.title,
				{ modal: true, detail: warn.detail },
				"取消",
				"仍要更新",
			)
			if (proceed !== "仍要更新") {
				return
			}
		}
		await updateOne(only.path, controller)
		return
	}

	const roots = await pickRoots(candidates)
	if (!roots) {
		return
	}

	for (const root of roots) {
		await updateOne(root.path, controller)
	}
}

/**
 * eratw 一键更新 —— 把 AI 合并跑成一个**可见的对话**。
 *
 * 为什么单独一个文件：`mergeResolve.resolveConflictsViaWorkbench` 是纯 Node 的
 * 编排，「怎么开一个对话、怎么等它结束、怎么防止 AI 跑飞」全是 VS Code 侧的事，
 * 混在一起就没法单测。这里只做三件事：
 *
 * 1. **守卫**：`controller.initTask()` 会先 `clearTask()`，而 `clearTask()` 会
 *    `abortTask()` —— 也就是说开新对话会把用户正在跑的对话**中止掉**。
 *    所以必须先问清楚有没有对话在跑，有就拒绝（`controller.task` 是 public，
 *    状态机可从 `controller.task.taskState` 读到）。
 * 2. **等结束**：`startTask()` 是 fire-and-forget，没有「完成」回调。
 *    唯一可用的信号是任务状态机（`isTaskStateBusy`，与建库任务共用同一判据）。
 *    注意刚 `initTask` 完它可能还是「不忙」，所以要等它先忙过一次（否则会把
 *    「还没开始」误判成「已经结束」）；也不能用裸 `isStreaming`——合并对话中途会停在
 *    工具确认弹窗上，那时 `isStreaming` 已是 false，会被误判成「跑完了」（#113）。
 * 3. **兜底扫描**：`write_to_file` / `read_file` 在这套代码里**没有**工作区
 *    校验（实测只有 ApplyPatchHandler 有 `isLocatedInWorkspace`），AI 理论上
 *    能改游戏目录里任何文件。所以在对话前后各扫一遍全树比对内容指纹，
 *    工作台目录本身在 `.era-harness/` 下、本来就被扫描排除，不会误报。
 *
 * **这个模块不决定合并结果**。它只负责让对话跑完；合不合法、要不要写盘，
 * 一律由 `mergeWorkbench.ts` 的静态校验和 `apply.ts` 的备份通道决定。
 */

import fs from "node:fs/promises"
import path from "node:path"
import type { Controller } from "@core/controller"
import { isTaskStateBusy } from "@core/task/taskBusy"
import { scanLocal } from "@core/update/manifest"
import type { MergeModelOption } from "@core/update/mergeModel"
import { mergeModelOverride } from "@core/update/mergeModel"
import type { UnexpectedChange, WorkbenchLayout, WorkbenchRunOutcome } from "@core/update/mergeWorkbench"
import { describeMergeHeartbeat } from "@core/update/progressText"
import type { RelPath } from "@core/update/types"
import { Logger } from "@shared/services/Logger"
import * as vscode from "vscode"
import { beginUpdateSession, endUpdateSession } from "./updateSession"

export type { UnexpectedChange, WorkbenchRunOutcome }

/** 轮询间隔。对话动辄几分钟，1 秒足够，不会烧 CPU。 */
const POLL_INTERVAL_MS = 1000
/** 刚 initTask 完的宽限期：等 isStreaming 先变成 true，别把「还没开始」当成「已结束」。 */
const START_GRACE_MS = 15_000
/** 单次对话的硬上限。超了就中止并当成失败——宁可保守，不让它跑一晚上。 */
const MAX_CONVERSATION_MS = 30 * 60 * 1000
/** 报告里最多列几个异常改动，全列会刷屏。 */
const MAX_LISTED_CHANGES = 20
/** 合并对话期间的心跳间隔（08 #181）：再长用户就会以为卡死了 */
const HEARTBEAT_INTERVAL_MS = 10_000

/** 这个环境能不能开对话（测试替身的 controller 没有 initTask） */
export function canRunMergeConversation(controller?: Controller): boolean {
	return Boolean(controller && typeof controller.initTask === "function")
}

/** 有对话正在跑时不能开工——开了会把用户那个对话中止掉 */
export function isConversationBusy(controller?: Controller): boolean {
	// 不能只看 isStreaming：任务停在「等用户点确认」时它已经是 false，但任务仍然活着。
	// 用与建库任务同一套判据（#99 / #113），否则这里会误判「不忙」→ initTask → 把用户的任务杀掉。
	return isTaskStateBusy(controller?.task?.taskState)
}

async function fingerprintTree(root: string): Promise<Map<RelPath, string>> {
	const scan = await scanLocal(root)
	const out = new Map<RelPath, string>()
	for (const [rel, file] of scan.files) {
		out.set(rel, file.sha1)
	}
	return out
}

/** 对话前后各扫一遍，找出游戏树里所有意外变动（工作台目录被排除，不会误报） */
export async function diffTree(root: string, before: Map<RelPath, string>): Promise<UnexpectedChange[]> {
	const after = await fingerprintTree(root)
	const changes: UnexpectedChange[] = []
	for (const [rel, sha] of before) {
		const now = after.get(rel)
		if (now === undefined) {
			changes.push({ path: rel, kind: "removed" })
		} else if (now !== sha) {
			changes.push({ path: rel, kind: "modified" })
		}
	}
	for (const rel of after.keys()) {
		if (!before.has(rel)) {
			changes.push({ path: rel, kind: "added" })
		}
	}
	return changes
}

function describeUnexpected(changes: UnexpectedChange[]): string {
	const head = changes.slice(0, MAX_LISTED_CHANGES)
	const lines = head.map((c) => `  · ${c.path}（${c.kind === "added" ? "新增" : c.kind === "removed" ? "被删" : "被改"}）`)
	if (changes.length > head.length) {
		lines.push(`  · ……还有 ${changes.length - head.length} 个`)
	}
	return lines.join("\n")
}

/**
 * 快照只覆盖**脚本类文本文件**：AI 越界改的就是这些，体积也可控。
 * `sound/` 那类几百 MB 的二进制不复制——它们本来也不会被模型写。
 */
const SNAPSHOT_EXTENSIONS = new Set([".erb", ".erh", ".csv", ".tsv", ".txt", ".md", ".json", ".config", ".ini"])
/** 单个文件超过这个大小就不快照（大 CSV 复制一遍太贵，且模型不会整篇写它） */
const SNAPSHOT_MAX_BYTES = 4 * 1024 * 1024
const SNAPSHOT_DIR_NAME = "_snapshot"

function shouldSnapshot(rel: RelPath): boolean {
	const lower = rel.toLowerCase()
	const dot = lower.lastIndexOf(".")
	if (dot < 0) {
		return false
	}
	return SNAPSHOT_EXTENSIONS.has(lower.slice(dot))
}

/**
 * 把脚本类文件的内容复制一份到工作台下（`<layout.root>/_snapshot/`）。
 *
 * 为什么要**内容**而不只是指纹：指纹只能「发现」被改，不能「还原」。
 * 工作台目录在 `.era-harness/` 下，本来就被 `scanLocal` 排除，不会自我误报。
 */
async function snapshotTree(root: string, dir: string, rels: Iterable<RelPath>): Promise<number> {
	let count = 0
	for (const rel of rels) {
		if (!shouldSnapshot(rel)) {
			continue
		}
		const src = path.join(root, ...rel.split("/"))
		try {
			const stat = await fs.stat(src)
			if (stat.size > SNAPSHOT_MAX_BYTES) {
				continue
			}
			const dst = path.join(dir, ...rel.split("/"))
			await fs.mkdir(path.dirname(dst), { recursive: true })
			await fs.copyFile(src, dst)
			count++
		} catch (error) {
			Logger.warn(`[update] 快照失败：${rel}（${error instanceof Error ? error.message : String(error)}）`)
		}
	}
	return count
}

/**
 * 把越界改动还原回去。
 *
 * - `modified` / `removed`：从快照复制回原位
 * - `added`：删掉（对话前它不存在）
 *
 * 返回**还原失败**的路径；有失败时调用方必须把它写进 detail，不能谎报「已还原」。
 */
async function restoreFromSnapshot(root: string, dir: string, changes: readonly UnexpectedChange[]): Promise<string[]> {
	const failed: string[] = []
	for (const change of changes) {
		const target = path.join(root, ...change.path.split("/"))
		try {
			if (change.kind === "added") {
				await fs.rm(target, { force: true })
				continue
			}
			const backup = path.join(dir, ...change.path.split("/"))
			await fs.access(backup)
			await fs.mkdir(path.dirname(target), { recursive: true })
			await fs.copyFile(backup, target)
		} catch (error) {
			failed.push(change.path)
			Logger.warn(`[update] 还原失败：${change.path}（${error instanceof Error ? error.message : String(error)}）`)
		}
	}
	return failed
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 开一个对话跑完整个合并，然后回报「树里有没有被意外改动」。
 *
 * #64：`model` 非空时按它跑这次合并（任务级覆盖，见 `mergeModelOverride` 的注释）。
 * 不传就沿用用户当前聊天用的模型——与 3.92.1 之前的行为一致。
 *
 * 任何失败/取消都**不抛错**，一律变成返回值——调用方（`resolveConflictsViaWorkbench`）
 * 会把它记进 `notes`，冲突文件按「保留本地」处理。合并这条路上没有任何异常
 * 应该逃出去把更新流程弄崩。
 */
export async function runMergeConversation(
	controller: Controller,
	root: string,
	prompt: string,
	layout: WorkbenchLayout,
	model?: MergeModelOption,
	onHeartbeat?: (info: { elapsedMs: number; lastText?: string }) => void,
): Promise<WorkbenchRunOutcome> {
	if (isConversationBusy(controller)) {
		return { status: "busy", detail: "现在有一个对话正在跑。等它结束或取消之后，再点更新合并。" }
	}
	if (!canRunMergeConversation(controller)) {
		return { status: "unavailable", detail: "这个环境里没有可用的对话，改用了静默合并。" }
	}

	// #123：扫描失败绝不能用空 Map 兜底——空 before 会让 diffTree 把整棵树判成
	// 「对话期间新增」，restoreFromSnapshot 对 added 的处理是逐个 fs.rm，等于删光游戏树。
	// 扫描失败 = 检测不可用，直接中止本轮合并（保守但诚实，不猜）。
	let before: Map<RelPath, string>
	try {
		before = await fingerprintTree(root)
	} catch (error) {
		Logger.warn(`[update] 合并前扫描失败：${error}`)
		return {
			status: "failed",
			detail: "合并前的文件扫描失败，无法检测 AI 对话是否越界改动。为安全起见这次更新中止，冲突文件全部保留你的版本。",
		}
	}

	// 快照必须在开对话之前：对话期间 AI 一旦越界写盘，事后只能靠这份副本还原（#114）
	const snapshotDir = path.join(layout.root, SNAPSHOT_DIR_NAME)
	try {
		const copied = await snapshotTree(root, snapshotDir, before.keys())
		Logger.log(`[update] 合并前快照 ${copied} 个脚本文件 → ${snapshotDir}`)
	} catch (error) {
		Logger.warn(`[update] 合并前快照失败（越界改动将无法还原）：${error}`)
	}

	let started: string
	try {
		// 第 5 个参数是任务级设置覆盖：只影响这个合并对话，`clearTask()` 时自动还原
		started = await controller.initTask(
			prompt,
			undefined,
			undefined,
			undefined,
			model ? mergeModelOverride(model) : undefined,
		)
	} catch (error) {
		// #131：快照里是用户脚本全文的副本，开对话失败也不能把副本留在盘上
		await cleanupSnapshot(snapshotDir)
		return { status: "failed", detail: `开对话没成功：${error instanceof Error ? error.message : String(error)}` }
	}
	if (typeof started !== "string" || started.length === 0) {
		await cleanupSnapshot(snapshotDir)
		return { status: "failed", detail: "开对话没成功（没有拿到任务号）。" }
	}
	Logger.log(`[update] 合并对话已开启：${started}（工作台 ${layout.root}）`)
	// 08 #179：记下这场对话，误关侧栏/切走之后还能回来。落盘失败不影响更新。
	await beginUpdateSession({ taskId: started, root })

	// 这里是 withProgress 的**中间态**形状（不含 unexpected——最后由 { ...wait, unexpected } 补上），
	// 不能直接标成 WorkbenchRunOutcome（completed 变体要求带 unexpected）。
	let wait: { status: "completed" } | { status: "failed"; detail: string }
	try {
		wait = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "AI 正在合并你改过的文件…",
				cancellable: true,
			},
			async (progress, token) => {
				const began = Date.now()
				let sawBusy = false
				let lastHeartbeatAt = began
				for (;;) {
					if (token.isCancellationRequested) {
						await controller.task?.abortTask?.()
						return { status: "failed" as const, detail: "你取消了这次合并对话，冲突文件全部保留你的版本。" }
					}
					// 用 isTaskStateBusy 而不是裸 isStreaming：合并对话中途会停在工具确认弹窗上，
					// 那时 isStreaming 已是 false，会把「等用户点确认」误判成「已经跑完」（#113）。
					const busy = isTaskStateBusy(controller.task?.taskState)
					if (busy) {
						sawBusy = true
					} else if (sawBusy || Date.now() - began > START_GRACE_MS) {
						return { status: "completed" as const }
					} else {
						progress.report({ message: "正在打开对话…" })
					}
					if (Date.now() - began > MAX_CONVERSATION_MS) {
						await controller.task?.abortTask?.()
						return {
							status: "failed" as const,
							detail: `这次合并对话跑了超过 ${Math.round(MAX_CONVERSATION_MS / 60000)} 分钟，已停下。冲突文件全部保留你的版本。`,
						}
					}
					// 08 #181：模型思考/流式输出期间没有任何事件进面板，靠心跳让用户看见「在干活」。
					// 只写通知区与面板明细，不走 onEvent——不破坏 stageReporter 的防重绘契约。
					const now = Date.now()
					if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
						lastHeartbeatAt = now
						const elapsedMs = now - began
						const lastText = controller.task?.messageStateHandler.getClineMessages().at(-1)?.text
						progress.report({ message: describeMergeHeartbeat(elapsedMs, lastText) })
						onHeartbeat?.({ elapsedMs, lastText })
					}
					await sleep(POLL_INTERVAL_MS)
				}
			},
		)
	} catch (error) {
		// #135：withProgress 里 abortTask 抛错会穿出整个函数，跳过 diffTree/restore/
		// cleanupSnapshot——快照（用户脚本全文副本）残留盘上，还违反本文件头
		// 「任何失败/取消都不抛错」的契约。就地转成 failed，落回下方正常的扫描/还原/清理
		//（异常时 AI 可能同样已经越界写盘，照样要扫、要还）。
		Logger.warn(`[update] 等待合并对话时出错：${error instanceof Error ? error.message : String(error)}`)
		try {
			await controller.task?.abortTask?.()
		} catch {
			// 中止失败无能为力；下方 diffTree 仍会如实报告树上的变动
		}
		wait = { status: "failed", detail: "等待合并对话时出错，已停止等待。冲突文件全部保留你的版本。" }
	}
	// 08 #179：对话结束（成功/失败/取消/异常）都清掉登记，避免「回到现场」指向一场已结束的对话。
	// 放在这里而不是 finally：下面还有 diffTree/还原，那些与「对话是否还活着」无关。
	await endUpdateSession(started)

	let unexpected: UnexpectedChange[] = []
	try {
		unexpected = await diffTree(root, before)
	} catch (error) {
		Logger.warn(`[update] 合并后扫描失败：${error}`)
	}

	if (unexpected.length > 0) {
		// #114：越界改动必须**还原**，不能只报告。`write_to_file` 没有工作区校验，
		// 上游 ERB 注释里写一句「把 sav/ 删掉」就能让模型照做；只 warn 等于让用户的文件没了。
		// #123：还原不再以「对话跑完」为前提——用户取消/超时中止时 AI 可能同样已经
		// 越界写了盘，那部分改动一样要还原，不能只随取消文案一起被吞掉。
		Logger.warn(
			`[update] 合并对话改动了 ${unexpected.length} 个工作台之外的文件，正在还原\n${describeUnexpected(unexpected)}`,
		)
		const failed = await restoreFromSnapshot(root, snapshotDir, unexpected)
		const restoredCount = unexpected.length - failed.length
		const restoreDetail =
			failed.length === 0
				? `AI 改动了 ${unexpected.length} 个本次合并之外的文件，已全部还原：\n${describeUnexpected(unexpected)}\n为避免继续扩大影响，这次更新已中止，冲突文件全部保留你的版本。`
				: `AI 改动了 ${unexpected.length} 个本次合并之外的文件，已还原 ${restoredCount} 个，**${failed.length} 个还原失败**（需要你手动检查）：\n${failed.join("\n")}\n这次更新已中止。`
		const detail = wait.status === "completed" ? restoreDetail : `${wait.detail}\n${restoreDetail}`
		await cleanupSnapshot(snapshotDir)
		return { status: "failed", detail, unexpected }
	}

	await cleanupSnapshot(snapshotDir)
	return { ...wait, unexpected }
}

/** 快照只在本次合并期间有用，结束就删（成功失败都删） */
async function cleanupSnapshot(dir: string): Promise<void> {
	try {
		await fs.rm(dir, { recursive: true, force: true })
	} catch (error) {
		Logger.warn(`[update] 清理合并快照失败：${error instanceof Error ? error.message : String(error)}`)
	}
}

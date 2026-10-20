/**
 * eratw 一键更新 —— 把 AI 合并跑成一个**可见的对话**。
 *
 * 为什么单独一个文件：`mergeResolve.resolveConflictsViaWorkbench` 是纯 Node 的
 * 编排，「怎么开一个对话、怎么等它结束、怎么防止 AI 跑飞」全是 VS Code 侧的事，
 * 混在一起就没法单测。这里只做三件事：
 *
 * 1. **守卫**：`controller.initTask()` 会先 `clearTask()`，而 `clearTask()` 会
 *    `abortTask()` —— 也就是说开新对话会把用户正在跑的对话**中止掉**。
 *    所以必须先问清楚有没有对话在跑，有就拒绝（实测 `controller.task` 是 public、
 *    `taskState.isStreaming` 可读）。
 * 2. **等结束**：`startTask()` 是 fire-and-forget，没有「完成」回调。
 *    唯一可用的信号是 `taskState.isStreaming`（stream 开始置 true、结束置 false）。
 *    注意刚 `initTask` 完它可能还是 false，所以要等它先 true 过一次（否则会把
 *    「还没开始」误判成「已经结束」）。
 * 3. **兜底扫描**：`write_to_file` / `read_file` 在这套代码里**没有**工作区
 *    校验（实测只有 ApplyPatchHandler 有 `isLocatedInWorkspace`），AI 理论上
 *    能改游戏目录里任何文件。所以在对话前后各扫一遍全树比对内容指纹，
 *    工作台目录本身在 `.era-harness/` 下、本来就被扫描排除，不会误报。
 *
 * **这个模块不决定合并结果**。它只负责让对话跑完；合不合法、要不要写盘，
 * 一律由 `mergeWorkbench.ts` 的静态校验和 `apply.ts` 的备份通道决定。
 */

import type { Controller } from "@core/controller"
import { scanLocal } from "@core/update/manifest"
import type { UnexpectedChange, WorkbenchLayout, WorkbenchRunOutcome } from "@core/update/mergeWorkbench"
import type { RelPath } from "@core/update/types"
import { Logger } from "@shared/services/Logger"
import * as vscode from "vscode"

export type { UnexpectedChange, WorkbenchRunOutcome }

/** 轮询间隔。对话动辄几分钟，1 秒足够，不会烧 CPU。 */
const POLL_INTERVAL_MS = 1000
/** 刚 initTask 完的宽限期：等 isStreaming 先变成 true，别把「还没开始」当成「已结束」。 */
const START_GRACE_MS = 15_000
/** 单次对话的硬上限。超了就中止并当成失败——宁可保守，不让它跑一晚上。 */
const MAX_CONVERSATION_MS = 30 * 60 * 1000
/** 报告里最多列几个异常改动，全列会刷屏。 */
const MAX_LISTED_CHANGES = 20

/** 这个环境能不能开对话（测试替身的 controller 没有 initTask） */
export function canRunMergeConversation(controller?: Controller): boolean {
	return Boolean(controller && typeof controller.initTask === "function")
}

/** 有对话正在跑时不能开工——开了会把用户那个对话中止掉 */
export function isConversationBusy(controller?: Controller): boolean {
	const task = controller?.task
	return Boolean(task && task.taskState.isStreaming)
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 开一个对话跑完整个合并，然后回报「树里有没有被意外改动」。
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
): Promise<WorkbenchRunOutcome> {
	if (isConversationBusy(controller)) {
		return { status: "busy", detail: "现在有一个对话正在跑。等它结束或取消之后，再点更新合并。" }
	}
	if (!canRunMergeConversation(controller)) {
		return { status: "unavailable", detail: "这个环境里没有可用的对话，改用了静默合并。" }
	}

	let before: Map<RelPath, string>
	try {
		before = await fingerprintTree(root)
	} catch (error) {
		Logger.warn(`[update] 合并前扫描失败：${error}`)
		before = new Map()
	}

	let started: string
	try {
		started = await controller.initTask(prompt)
	} catch (error) {
		return { status: "failed", detail: `开对话没成功：${error instanceof Error ? error.message : String(error)}` }
	}
	if (typeof started !== "string" || started.length === 0) {
		return { status: "failed", detail: "开对话没成功（没有拿到任务号）。" }
	}
	Logger.log(`[update] 合并对话已开启：${started}（工作台 ${layout.root}）`)

	const wait = await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: "AI 正在合并你改过的文件…",
			cancellable: true,
		},
		async (progress, token) => {
			const began = Date.now()
			let sawStreaming = false
			for (;;) {
				if (token.isCancellationRequested) {
					await controller.task?.abortTask?.()
					return { status: "failed" as const, detail: "你取消了这次合并对话，冲突文件全部保留你的版本。" }
				}
				const streaming = Boolean(controller.task?.taskState.isStreaming)
				if (streaming) {
					sawStreaming = true
				} else if (sawStreaming || Date.now() - began > START_GRACE_MS) {
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
				await sleep(POLL_INTERVAL_MS)
			}
		},
	)

	let unexpected: UnexpectedChange[] = []
	try {
		unexpected = await diffTree(root, before)
	} catch (error) {
		Logger.warn(`[update] 合并后扫描失败：${error}`)
	}

	if (wait.status === "completed" && unexpected.length > 0) {
		Logger.warn(`[update] 合并对话改动了 ${unexpected.length} 个工作台之外的文件\n${describeUnexpected(unexpected)}`)
	}
	return { ...wait, unexpected }
}

/** 给人看的总结，供结果弹窗直接展示 */
export function describeMergeConversation(outcome: WorkbenchRunOutcome): string | null {
	if (outcome.status === "completed") {
		if (outcome.unexpected.length === 0) {
			return null
		}
		return `注意：这次对话动了 ${outcome.unexpected.length} 个不该动的文件：\n${describeUnexpected(outcome.unexpected)}\n这些改动没有被采用，建议你打开游戏目录确认一下。`
	}
	return outcome.detail
}

/**
 * 更新进度的文案（纯函数，不依赖 vscode）——08 #181。
 *
 * 从 `updateGame.ts` 搬出来是为了可单测：合并阶段的心跳文案要能被钉住，
 * 否则「已 2 分 13 秒」这种格式化错误只能靠肉眼在通知区发现。
 */

import type { UpdateEvent } from "./service"

/** 阶段 → 人话（不出现 download/scan/apply 这类词） */
export function stageText(event: UpdateEvent): string {
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
 * 合并工作台的阶段进度（`WorkbenchProgress`）→ 人话。
 *
 * 这条通道（`resolveConflictsViaWorkbench` 的 `onProgress`）早就铺好了，只是之前没接，
 * 所以合并期间面板一行都不动（08 #181）。
 */
export function describeWorkbenchProgress(progress: { phase: string; done?: number; total?: number; path?: string }): string {
	switch (progress.phase) {
		case "materialize":
			return progress.path ? `正在准备合并工作台：${progress.path}` : "正在准备合并工作台…"
		case "conversation":
			return progress.total
				? `已把 ${progress.total} 个冲突文件交给模型，等它逐个合并…`
				: "已把冲突文件交给模型，等它逐个合并…"
		case "collect":
			return "正在收回模型改过的文件…"
		default:
			return `正在合并（${progress.phase}）…`
	}
}

/**
 * 合并阶段的心跳文案。
 *
 * 为什么需要：合并跑的是**一场真实对话**，模型思考/流式输出期间没有任何事件进面板，
 * 用户只能看到「合并你改过的文件」一动不动——分不清「在干活」还是「卡死」。
 * 心跳每 10–15 秒一条，只走面板明细与通知区，不走 `onEvent`（不破坏防重绘）。
 */
export function describeMergeHeartbeat(elapsedMs: number, lastText?: string): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	const elapsed = minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`
	const snippet = (lastText ?? "").replace(/\s+/g, " ").trim().slice(0, 40)
	return snippet ? `仍在等待模型响应（已 ${elapsed}）：${snippet}` : `仍在等待模型响应（已 ${elapsed}）`
}

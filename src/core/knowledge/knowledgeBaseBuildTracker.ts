/**
 * 建库任务的完成/中断跟踪（#93）。
 *
 * 为什么单独放一个模块，而不是塞进 `knowledgeBaseTask.ts`：
 * - `knowledgeBaseTask.ts` 在 `src/hosts/vscode/`，依赖 Controller；而完成信号来自
 *   `AttemptCompletionHandler`、中断信号来自 `Task.abortTask`，两边都 import 它会形成环。
 * - 这里只做「taskId → 库目录」的登记与落盘，不依赖 vscode，谁都能安全引用。
 *
 * 状态必须落盘到 `kb.json`：窗口重载、任务被替换之后，还要能告诉用户「上次没建完」，
 * 并阻止半成品索引进入后续对话。
 */

import { finalizeKnowledgeBaseBuild, updateKnowledgeBaseBuild } from "@eraharness/gamekb/index"
import { Logger } from "@shared/services/Logger"

const builds = new Map<string, { dir: string }>()

/** 开完建库/更新/增量对话后登记：taskId 是唯一关联键 */
export function registerKnowledgeBaseBuild(taskId: string, dir: string): void {
	builds.set(taskId, { dir })
}

/** 当前任务是不是建库任务（用于完成/中断时的快速 no-op 判断） */
export function isKnowledgeBaseBuildTask(taskId: string | undefined): boolean {
	return Boolean(taskId && builds.has(taskId))
}

/**
 * 摘掉登记。开对话失败时用：这条任务不会再有完成/中断回调，
 * 留在 Map 里只会让后续判断误以为还有建库在跑。
 */
export function unregisterKnowledgeBaseBuild(taskId: string | undefined): void {
	if (taskId) {
		builds.delete(taskId)
	}
}

export function getKnowledgeBaseBuildDir(taskId: string | undefined): string | undefined {
	return taskId ? builds.get(taskId)?.dir : undefined
}

/**
 * 任务正常完成 → 先取证再定状态（#96）。
 *
 * 「没报错」不等于「建成了」：模型喊一声 `attempt_completion` 就结束，磁盘上可能一个分片
 * 都没有。状态判定交给 `finalizeKnowledgeBaseBuild`（数分片 + 看索引是否还是骨架），
 * 零产出判 `failed`，避免半成品在窗口重载后被当成可用库注入。
 *
 * 任何磁盘异常只记 warn：知识库状态不能反过来让任务完成失败。
 */
export async function notifyKnowledgeBaseBuildFinished(taskId: string | undefined, error?: string): Promise<void> {
	if (!taskId) {
		return
	}
	const entry = builds.get(taskId)
	if (!entry) {
		return
	}
	builds.delete(taskId)
	try {
		await finalizeKnowledgeBaseBuild(entry.dir, { taskId, ...(error ? { error } : {}) })
	} catch (cause) {
		Logger.warn(`[knowledge-base] 写入构建完成状态失败（已忽略）：${cause}`)
	}
}

/**
 * 任务被中断（切模型/开新对话/取消/重载）→ `failed`，并留下「可继续构建」的提示。
 * 半成品库不注入，用户点「继续构建」时按已有分片续建。
 */
export async function notifyKnowledgeBaseBuildInterrupted(taskId: string | undefined): Promise<void> {
	if (!taskId) {
		return
	}
	const entry = builds.get(taskId)
	if (!entry) {
		return
	}
	builds.delete(taskId)
	try {
		await updateKnowledgeBaseBuild(entry.dir, {
			status: "failed",
			taskId,
			finishedAt: new Date().toISOString(),
			error: "已中断（可继续构建）",
		})
	} catch (cause) {
		Logger.warn(`[knowledge-base] 写入构建中断状态失败（已忽略）：${cause}`)
	}
}

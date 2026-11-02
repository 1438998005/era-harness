/**
 * 任务结束时的一次性「可以续写」提示（续写的发现入口）。
 *
 * 为什么需要它：续写的正确用法是「这次改了哪些语义，就把它们补进库」，
 * 但用户不会记得每次任务结束后去设置页点按钮。所以在一场**真正读过工程文件**的任务
 * 结束后，顺手提一句——不产生任何模型调用，也不自动建任务（自动建任务会在用户
 * 没预期时花钱，见 06 决策记录「拒绝的替代方案」）。
 *
 * 三条边界：
 * 1. **每任务最多一次**：`say("info")` 是可见气泡，重复刷屏会变成噪音；
 * 2. **没有可用库就不提**：没建过库的用户不该被推销；
 * 3. **绝不抛错**：这是纯提示，读盘失败只记日志（增强项不能弄挂主流程）。
 */

import * as path from "node:path"
import { getEraProjectProfile } from "@core/era/project-profile"
import { getTaskMetadata } from "@core/storage/disk"
import { listKnowledgeBases } from "@eraharness/gamekb/index"
import { Logger } from "@shared/services/Logger"
import { HostProvider } from "@/hosts/host-provider"
import type { TaskConfig } from "../task/tools/types/TaskConfig"

/** 低于这个文件数就不提示：只碰了一两个文件的任务，续写不值当 */
const MIN_FILES_FOR_HINT = 3
/** 已提示过的任务（模块级：同一任务可能多次 attempt_completion） */
const hintedTasks = new Set<string>()
const MAX_TRACKED_TASKS = 200

type KnowledgeBaseEntries = Awaited<ReturnType<typeof listKnowledgeBases>>

/**
 * 给 `listKnowledgeBases` 套一层按工作区根隔离的 TTL 缓存（08 #108）。
 *
 * 为什么只缓存这一条路径、不改 `listKnowledgeBases` 本体：它还被设置页与提示词小节使用，
 * 全局缓存会带来「刚建完库读不到」的陈旧风险；而这条提示只需要 `buildStatus`，
 * 容忍 60 秒的陈旧。
 *
 * 依赖注入（`list` / `now` / `ttlMs`）是为了让测试能钉住「TTL 内只扫一次」。
 */
export function createKnowledgeBaseListCache(deps: {
	list: (root: string) => Promise<KnowledgeBaseEntries>
	ttlMs?: number
	now?: () => number
}): (root: string) => Promise<KnowledgeBaseEntries> {
	const ttlMs = deps.ttlMs ?? 60_000
	const now = deps.now ?? Date.now
	const cache = new Map<string, { at: number; entries: KnowledgeBaseEntries }>()
	return async (root: string) => {
		const hit = cache.get(root)
		const current = now()
		if (hit && current - hit.at < ttlMs) {
			return hit.entries
		}
		const entries = await deps.list(root)
		cache.set(root, { at: current, entries })
		return entries
	}
}

const listKnowledgeBasesCached = createKnowledgeBaseListCache({ list: listKnowledgeBases })

/**
 * 任务完成后调用。满足条件时发一条 `info`，否则静默返回。
 *
 * 条件：工作区里存在 `draft` 或 `ready` 的库；且本任务读过的文件里
 * 位于游戏根（拿不到游戏根就用工作区根）下的不少于 3 个。
 */
export async function maybeSuggestKnowledgeBaseIncrement(config: TaskConfig): Promise<void> {
	try {
		const taskId = config.taskId
		if (!taskId || hintedTasks.has(taskId)) {
			return
		}

		const response = await HostProvider.workspace.getWorkspacePaths({})
		const workspacePaths = response.paths ?? []
		const workspaceRoot = workspacePaths[0]
		if (!workspaceRoot) {
			return
		}

		const entries = await listKnowledgeBasesCached(workspaceRoot)
		// `draft`（空白建库的骨架）与 `ready`（已可用）都可以继续补；
		// `building` 正在跑、`failed` 需要先「继续构建」，都不该被这条提示引导去开第二个对话。
		const usable = entries.filter((entry) => entry.buildStatus === "draft" || entry.buildStatus === "ready")
		if (usable.length === 0) {
			return
		}

		let gameRoot = workspaceRoot
		try {
			gameRoot = getEraProjectProfile(workspaceRoot, workspacePaths).roots[0] ?? workspaceRoot
		} catch {
			gameRoot = workspaceRoot
		}

		const metadata = await getTaskMetadata(taskId)
		const rootAbs = path.resolve(gameRoot)
		const touched = new Set<string>()
		for (const entry of metadata?.files_in_context ?? []) {
			const raw = typeof entry.path === "string" ? entry.path.trim() : ""
			if (!raw) {
				continue
			}
			const abs = path.isAbsolute(raw) ? raw : path.resolve(workspaceRoot, raw)
			const rel = path.relative(rootAbs, abs)
			if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
				continue
			}
			touched.add(rel.replace(/\\/g, "/"))
		}

		if (touched.size < MIN_FILES_FOR_HINT) {
			return
		}

		hintedTasks.add(taskId)
		// 防泄漏：只留最近的一小批任务号（任务对象释放后 Set 会无限长）
		if (hintedTasks.size > MAX_TRACKED_TASKS) {
			const oldest = hintedTasks.values().next()
			if (!oldest.done) {
				hintedTasks.delete(oldest.value)
			}
		}

		// 08 #175：入口已经移到对话里（回复下方的「更新知识库」按钮），文案跟着指过去
		const message = `本任务涉及 ${touched.size} 个工程文件；点下方「更新知识库」可把新语义补进库。`
		await config.callbacks.say("info", message)
	} catch (error) {
		Logger.warn(`[knowledge-base] 续写提示失败（已忽略）：${error}`)
	}
}

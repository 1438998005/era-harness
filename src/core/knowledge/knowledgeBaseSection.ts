/**
 * 任务创建时读一次「专属知识库」索引快照。
 *
 * 为什么在这里读、而不是在提示词组件里读：`PromptBuilder.build()` 是同步的，
 * 而读盘是异步的；照 `globalMemory` 的做法——先在 Task 里取好塞进
 * `SystemPromptContext`，组件只负责渲染。
 *
 * 只读 `index.md`，不读分片：一个游戏几千个函数，全量进提示词会直接吃掉上下文。
 */

import { getEraProjectProfile } from "@core/era/project-profile"
import { readNowVersion } from "@core/update/discover"
import {
	buildKnowledgeBaseSection,
	type KnowledgeBaseSectionItem,
	listKnowledgeBases,
	readIndexText,
	resolveBuildStatus,
} from "@eraharness/gamekb/index"
import { Logger } from "@shared/services/Logger"

/**
 * 返回已格式化的提示词小节；没有可用知识库（或读盘失败）时返回空串。
 * ⛔ 任何异常都必须吞掉：知识库是增强项，不该因为它让任务建不起来。
 */
export async function loadKnowledgeBaseSection(cwd: string | undefined): Promise<string> {
	if (!cwd) {
		return ""
	}
	try {
		const entries = await listKnowledgeBases(cwd)
		const usable = entries.filter(
			(entry) => entry.manifest && entry.manifest.enabled !== false && !entry.broken && entry.hasIndex,
		)
		if (usable.length === 0) {
			return ""
		}

		let currentGameVersion: string | undefined
		try {
			const profile = getEraProjectProfile(cwd)
			const gameRoot = profile.roots[0]
			if (gameRoot) {
				currentGameVersion = (await readNowVersion(gameRoot)) ?? undefined
			}
		} catch {
			currentGameVersion = undefined
		}

		const items: KnowledgeBaseSectionItem[] = []
		for (const entry of usable) {
			const manifest = entry.manifest
			if (!manifest) {
				continue
			}
			const index = await readIndexText(entry)
			if (!index) {
				continue
			}
			// 只注入 ready：骨架 / 构建中 / 失败的库不能当参考（#93）
			const buildStatus = resolveBuildStatus(manifest, entry.fileCount, index)
			if (buildStatus !== "ready") {
				continue
			}
			items.push({
				name: manifest.name,
				slug: entry.slug,
				index,
				updatedAt: manifest.updatedAt,
				gameVersion: manifest.gameVersion,
				currentGameVersion,
				counts: manifest.counts as Record<string, number> | undefined,
				buildStatus,
			})
		}

		return buildKnowledgeBaseSection(items)
	} catch (error) {
		Logger.warn(`[knowledge-base] 读取索引失败（本次不注入）：${error}`)
		return ""
	}
}

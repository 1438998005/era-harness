import { getEraProjectProfile } from "@core/era/project-profile"
import { readNowVersion } from "@core/update/discover"
import { listKnowledgeBases } from "@eraharness/gamekb/index"
import type { KnowledgeBaseListItem } from "@shared/knowledgeBase"
import type { EmptyRequest, String as StringMessage } from "@shared/proto/cline/common"
import { String as StringValue } from "@shared/proto/cline/common"
import { HostProvider } from "@/hosts/host-provider"
import type { Controller } from "../index"

/**
 * 列出工作区里的专属知识库（设置页挂载时取一次）。
 *
 * 响应是 JSON 字符串而不是自定义 proto message：与 `getGlobalMemory` 同一套做法，
 * 契约在 `src/shared/knowledgeBase.ts`（两端共用一份类型）。
 *
 * 「过期」判定是**软**的：只比较建库时记录的 NOW_VERSION 与当前探测值，
 * 读不到版本就一律不标过期（⛔ 不要凭猜测给用户制造焦虑）。
 */
export async function getKnowledgeBases(_controller: Controller, _request: EmptyRequest): Promise<StringMessage> {
	let workspaceRoot: string | undefined
	let workspacePaths: string[] = []
	try {
		const response = await HostProvider.workspace.getWorkspacePaths({})
		workspacePaths = response.paths ?? []
		workspaceRoot = workspacePaths[0]
	} catch {
		workspaceRoot = undefined
	}

	if (!workspaceRoot) {
		return StringValue.create({ value: "[]" })
	}

	let currentGameVersion: string | undefined
	try {
		const profile = getEraProjectProfile(workspaceRoot, workspacePaths)
		const gameRoot = profile.roots[0]
		if (gameRoot) {
			currentGameVersion = (await readNowVersion(gameRoot)) ?? undefined
		}
	} catch {
		currentGameVersion = undefined
	}

	const entries = await listKnowledgeBases(workspaceRoot)
	const items: KnowledgeBaseListItem[] = entries.map((entry) => {
		const manifest = entry.manifest
		const gameVersion = manifest?.gameVersion
		return {
			slug: entry.slug,
			name: manifest?.name ?? entry.slug,
			dir: entry.dir,
			enabled: manifest?.enabled !== false,
			broken: entry.broken,
			fileCount: entry.fileCount,
			hasIndex: entry.hasIndex,
			createdAt: manifest?.createdAt ?? "",
			updatedAt: manifest?.updatedAt ?? "",
			gameVersion,
			currentGameVersion,
			stale: Boolean(gameVersion && currentGameVersion && gameVersion !== currentGameVersion),
			counts: manifest?.counts,
		}
	})

	return StringValue.create({ value: JSON.stringify(items) })
}

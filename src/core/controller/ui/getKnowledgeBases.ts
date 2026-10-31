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
		const build = manifest?.build
		let buildStatus = entry.buildStatus
		let buildError = build?.error
		// 窗口重载 / 任务被替换时，不会有任何回调来收尾；超过 6 小时的 building
		// 一律按「上次未完成」展示。只影响展示，不写盘。
		if (buildStatus === "building" && build?.startedAt) {
			const started = Date.parse(build.startedAt)
			if (Number.isFinite(started) && Date.now() - started > 6 * 60 * 60 * 1000) {
				buildStatus = "failed"
				buildError = "上次构建未完成（窗口已重载或任务被替换）"
			}
		}
		// #96：`ready` 但零产出会被 resolveBuildStatus 降级成 failed。
		// 红标必须给出原因，否则用户只知道「坏了」却不知道该重建还是该续写。
		if (buildStatus === "failed" && !buildError && entry.fileCount === 0) {
			buildError = "上次构建没有任何产出（模型可能提前收尾），需要重新构建"
		}
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
			buildStatus,
			buildMode: build?.mode,
			buildTaskKind: build?.taskKind,
			buildStartedAt: build?.startedAt,
			buildError,
		}
	})

	return StringValue.create({ value: JSON.stringify(items) })
}

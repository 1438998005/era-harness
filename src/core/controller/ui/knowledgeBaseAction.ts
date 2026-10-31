import * as path from "node:path"
import { getEraProjectProfile } from "@core/era/project-profile"
import { getTaskMetadata } from "@core/storage/disk"
import { readNowVersion } from "@core/update/discover"
import {
	createKnowledgeBase,
	isValidSlug,
	type KnowledgeBaseIncrementScope,
	knowledgeBaseDir,
	readManifest,
	setKnowledgeBaseEnabled,
	trashKnowledgeBase,
	updateKnowledgeBaseBuild,
} from "@eraharness/gamekb/index"
import type { KnowledgeBaseAction, KnowledgeBaseActionResult } from "@shared/knowledgeBase"
import type { String as StringMessage, StringRequest } from "@shared/proto/cline/common"
import { String as StringValue } from "@shared/proto/cline/common"
import * as vscode from "vscode"
import { HostProvider } from "@/hosts/host-provider"
import { openKnowledgeBaseTask } from "@/hosts/vscode/knowledgeBaseTask"
import { createOpenInOsDeps, openFolderInOs } from "@/hosts/vscode/open-in-os"
import type { Controller } from "../index"

/**
 * 专属知识库的唯一写入口（新建 / 更新 / 开关 / 删除）。
 *
 * 「新建」和「更新」都只是**开一场对话**：知识库的内容由 AI 读当前工作区生成，
 * 扩展不内置任何游戏知识（分发边界 + 版本跟随，理由见 `@eraharness/gamekb`）。
 *
 * 入参是 JSON 字符串（与 `updateGlobalMemory` 同款）。编译期没有形状约束，所以这里
 * 逐项校验：slug 必须是自己生成的形态（防目录穿越），name 必须非空，未知 action 一律拒。
 */
export async function knowledgeBaseAction(controller: Controller, request: StringRequest): Promise<StringMessage> {
	const respond = (result: KnowledgeBaseActionResult) => StringValue.create({ value: JSON.stringify(result) })

	let parsed: unknown
	try {
		parsed = request.value ? JSON.parse(request.value) : undefined
	} catch {
		return respond({ ok: false, message: "请求不是合法的 JSON" })
	}
	if (!parsed || typeof parsed !== "object") {
		return respond({ ok: false, message: "请求为空" })
	}

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
		return respond({ ok: false, message: "没有打开工作区。专属知识库要落在工作区的 .era-harness/knowledge/ 下。" })
	}

	const action = parsed as KnowledgeBaseAction

	if (action.action === "create") {
		const name = typeof action.name === "string" ? action.name.trim() : ""
		if (!name) {
			return respond({ ok: false, message: "先给知识库起个名字。" })
		}

		// 建库时顺手记下「给哪个工程建的、什么版本」，设置页据此判断是否过期
		let gameRoot: string | undefined
		let gameVersion: string | undefined
		try {
			const profile = getEraProjectProfile(workspaceRoot, workspacePaths)
			gameRoot = profile.roots[0]
			if (gameRoot) {
				gameVersion = (await readNowVersion(gameRoot)) ?? undefined
			}
		} catch {
			gameRoot = undefined
		}

		const mode = action.mode === "blank" ? "blank" : "full"
		const manifest = await createKnowledgeBase(workspaceRoot, {
			name,
			now: new Date(),
			suffix: Math.random().toString(36).slice(2, 6),
			gameRoot,
			gameVersion,
			mode,
		})
		const dir = knowledgeBaseDir(workspaceRoot, manifest.slug)

		// 空白建库：只建骨架，不立即开全量任务（那正是 102 元事故的形态）。
		// 之后在卡片上点「续写」按范围补；产物与完整建库相同。
		if (mode === "blank") {
			return respond({ ok: true, slug: manifest.slug })
		}

		const opened = await openKnowledgeBaseTask(controller, {
			create: { dir, name: manifest.name, workspaceRoot, gameRoot, gameVersion },
		})
		if (!opened.ok) {
			await updateKnowledgeBaseBuild(dir, { status: "failed", error: opened.message })
			return respond({
				ok: false,
				slug: manifest.slug,
				message: `库已建好（${manifest.slug}），但对话没开起来：${opened.message}`,
			})
		}
		return respond({ ok: true, slug: manifest.slug })
	}

	if (action.action === "update") {
		if (typeof action.slug !== "string" || !isValidSlug(action.slug)) {
			return respond({ ok: false, message: "知识库标识不合法。" })
		}
		const dir = knowledgeBaseDir(workspaceRoot, action.slug)
		const manifest = await readManifest(dir)
		if (!manifest) {
			return respond({ ok: false, message: "这个知识库的 kb.json 读不出来（可能被删或损坏），先删掉重建。" })
		}

		let gameRoot: string | undefined
		let gameVersion: string | undefined
		try {
			const profile = getEraProjectProfile(workspaceRoot, workspacePaths)
			gameRoot = profile.roots[0]
			if (gameRoot) {
				gameVersion = (await readNowVersion(gameRoot)) ?? undefined
			}
		} catch {
			gameRoot = undefined
		}

		const opened = await openKnowledgeBaseTask(controller, {
			update: { dir, manifest, workspaceRoot, gameRoot, gameVersion },
		})
		if (!opened.ok) {
			await updateKnowledgeBaseBuild(dir, { status: "failed", error: opened.message })
		}
		return respond(opened.ok ? { ok: true, slug: manifest.slug } : { ok: false, message: opened.message })
	}

	if (action.action === "increment") {
		if (typeof action.slug !== "string" || !isValidSlug(action.slug)) {
			return respond({ ok: false, message: "知识库标识不合法。" })
		}
		const dir = knowledgeBaseDir(workspaceRoot, action.slug)
		const manifest = await readManifest(dir)
		if (!manifest) {
			return respond({ ok: false, message: "这个知识库的 kb.json 读不出来（可能被删或损坏），先删掉重建。" })
		}

		let gameRoot: string | undefined
		let gameVersion: string | undefined
		try {
			const profile = getEraProjectProfile(workspaceRoot, workspacePaths)
			gameRoot = profile.roots[0]
			if (gameRoot) {
				gameVersion = (await readNowVersion(gameRoot)) ?? undefined
			}
		} catch {
			gameRoot = undefined
		}

		const resolved = await resolveIncrementScope(action.scope, controller, gameRoot ?? workspaceRoot)
		if (!resolved.ok) {
			return respond({ ok: false, message: resolved.message })
		}

		const opened = await openKnowledgeBaseTask(controller, {
			increment: {
				dir,
				manifest,
				workspaceRoot,
				gameRoot,
				gameVersion,
				scope: resolved.value,
			},
		})
		if (!opened.ok) {
			await updateKnowledgeBaseBuild(dir, { status: "failed", error: opened.message })
		}
		return respond(opened.ok ? { ok: true, slug: manifest.slug } : { ok: false, message: opened.message })
	}

	if (action.action === "enable") {
		if (typeof action.slug !== "string" || !isValidSlug(action.slug)) {
			return respond({ ok: false, message: "知识库标识不合法。" })
		}
		const updated = await setKnowledgeBaseEnabled(workspaceRoot, action.slug, action.enabled !== false)
		return respond(updated ? { ok: true } : { ok: false, message: "写入失败（kb.json 读不出来）" })
	}

	if (action.action === "delete") {
		if (typeof action.slug !== "string" || !isValidSlug(action.slug)) {
			return respond({ ok: false, message: "知识库标识不合法。" })
		}
		// 不直接 rm：挪进 .trash/，误删还能拖回来
		const trashed = await trashKnowledgeBase(workspaceRoot, action.slug, new Date())
		return respond(trashed ? { ok: true } : { ok: false, message: "删除失败（目录不存在）" })
	}

	if (action.action === "reveal") {
		if (typeof action.slug !== "string" || !isValidSlug(action.slug)) {
			return respond({ ok: false, message: "知识库标识不合法。" })
		}
		const dir = knowledgeBaseDir(workspaceRoot, action.slug)
		// 复用 open-in-os：Windows 上 openExternal 打开目录会静默失败（见该文件顶部），
		// 所以「打开失败」必须如实回给设置页，而不是吞掉当成成功。
		const failure = await openFolderInOs(
			dir,
			createOpenInOsDeps(async (target) => await vscode.env.openExternal(vscode.Uri.file(target))),
		)
		return respond(failure ? { ok: false, message: `打不开目录：${failure}。路径：${dir}` } : { ok: true })
	}

	return respond({ ok: false, message: `未知操作：${String((parsed as { action?: unknown }).action)}` })
}

type IncrementScopeInput = { kind: "recent" } | { kind: "topic"; topic: string } | { kind: "paths"; paths: string[] }

/**
 * 把设置页传来的范围解析成「相对工程根的一组路径」或「一个主题」。
 *
 * `recent` 走任务元数据（`files_in_context`）：这是「随着用户使用逐步塞」的入口，
 * 只取当前对话真正读过的文件，按最近读取排序、去重、最多 60 条。
 */
async function resolveIncrementScope(
	scope: IncrementScopeInput,
	controller: Controller,
	root: string,
): Promise<{ ok: true; value: KnowledgeBaseIncrementScope } | { ok: false; message: string }> {
	if (!scope || typeof scope !== "object") {
		return { ok: false, message: "缺少增量范围。" }
	}

	if (scope.kind === "topic") {
		const topic = typeof scope.topic === "string" ? scope.topic.trim() : ""
		if (!topic) {
			return { ok: false, message: "先填一个目录或主题。" }
		}
		if (topic.length > 200) {
			return { ok: false, message: "范围太长（最多 200 字）。" }
		}
		return { ok: true, value: { label: `主题：${topic}`, topic } }
	}

	if (scope.kind === "paths") {
		const rootAbs = path.resolve(root)
		const normalized = (Array.isArray(scope.paths) ? scope.paths : [])
			.map((value) => (typeof value === "string" ? value.trim() : ""))
			.filter(Boolean)
			.map((value) => {
				const abs = path.isAbsolute(value) ? value : path.resolve(rootAbs, value)
				const rel = path.relative(rootAbs, abs)
				return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel.replace(/\\/g, "/") : ""
			})
			.filter(Boolean)
		const unique = [...new Set(normalized)].slice(0, 60)
		if (unique.length === 0) {
			return { ok: false, message: "范围里没有有效的工程文件。" }
		}
		return { ok: true, value: { label: `${unique.length} 个指定文件`, paths: unique } }
	}

	if (scope.kind === "recent") {
		const taskId = controller.task?.taskId
		if (!taskId) {
			return { ok: false, message: "当前没有对话；改用「指定目录或主题」。" }
		}

		let metadata: Awaited<ReturnType<typeof getTaskMetadata>> | undefined
		try {
			metadata = await getTaskMetadata(taskId)
		} catch {
			metadata = undefined
		}

		const rootAbs = path.resolve(root)
		const entries = [...(metadata?.files_in_context ?? [])].sort(
			(a, b) => (b.cline_read_date ?? 0) - (a.cline_read_date ?? 0),
		)
		const paths: string[] = []
		const seen = new Set<string>()
		for (const entry of entries) {
			const raw = typeof entry.path === "string" ? entry.path.trim() : ""
			if (!raw) {
				continue
			}
			const abs = path.isAbsolute(raw) ? raw : path.resolve(rootAbs, raw)
			const rel = path.relative(rootAbs, abs)
			if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
				continue
			}
			const normalized = rel.replace(/\\/g, "/")
			if (seen.has(normalized)) {
				continue
			}
			seen.add(normalized)
			paths.push(normalized)
			if (paths.length >= 60) {
				break
			}
		}

		if (paths.length === 0) {
			return { ok: false, message: "当前对话还没有读过工程文件；改用「指定目录或主题」。" }
		}
		return { ok: true, value: { label: `本次对话涉及的 ${paths.length} 个文件`, paths } }
	}

	return { ok: false, message: "未知的增量范围。" }
}

/**
 * 专属知识库 —— 把「建库 / 更新库」跑成一场**可见的对话**。
 *
 * 为什么不在扩展里直接扫描生成：知识库的价值在于「函数是干什么的」这类语义，
 * 静态扫描只能拿到名字和形状（那正是 `era_symbols` 已经做的事）。让 AI 读代码、
 * 按主题分片、写清出处，才有意义；而写成对话，用户可以随时打断、纠正、追问。
 *
 * 这个模块只负责三件事：
 * 1. 守卫：`initTask()` 会先 `clearTask()`（进而 abort 当前任务），所以有对话在跑就拒绝；
 * 2. 拼提示词（模板在核心库 `@eraharness/gamekb`，可单测）；
 * 3. 开对话并把结果回报给调用方。
 *
 * 身份：提示词自带 `<era-identity mode="unrestricted">`（见 `UNRESTRICTED_IDENTITY_BLOCK`）。
 * 用户要求「知识库的新对话权限默认不限」；实际也必要——库写在 `.era-harness/knowledge/`，
 * 默认身份下会被判成「范围外」，每写一个文件都要人工确认。
 */

import type { Controller } from "@core/controller"
import { registerKnowledgeBaseBuild } from "@core/knowledge/knowledgeBaseBuildTracker"
import {
	buildCreatePrompt,
	buildIncrementPrompt,
	buildUpdatePrompt,
	type GameKbManifest,
	type GameKbTaskKind,
	type KnowledgeBaseIncrementScope,
	updateKnowledgeBaseBuild,
} from "@eraharness/gamekb/index"
import { UNRESTRICTED_IDENTITY_BLOCK } from "@shared/identity"
import { Logger } from "@shared/services/Logger"

/**
 * 有对话在跑 / 在等用户确认时不能开工。
 *
 * 只看 `isStreaming` 不够：等待批准/提问时流已经暂停，`isStreaming` 为 false，
 * 但 `initTask()` 仍会 `clearTask()` 把那个对话中止掉（#93）。
 */
export function isConversationBusy(controller?: Controller): boolean {
	const task = controller?.task
	if (!task) {
		return false
	}
	const state = task.taskState
	return Boolean(state.isStreaming || state.isWaitingForFirstChunk || state.pendingAsk)
}

/** 控制器与 initTask 都在才算能开对话；用类型谓词让调用处直接收窄 */
function canStartTask(controller?: Controller): controller is Controller {
	return Boolean(controller && typeof controller.initTask === "function")
}

export interface OpenKnowledgeBaseTaskParams {
	/** 建库：库目录与名称 */
	create?: {
		dir: string
		name: string
		workspaceRoot: string
		gameRoot?: string
		gameVersion?: string
	}
	/** 更新库：已有 manifest */
	update?: { dir: string; manifest: GameKbManifest; workspaceRoot: string; gameRoot?: string; gameVersion?: string }
	/** 续写：按范围补库（完整库与空白库都适用，产物与完整建库相同） */
	increment?: {
		dir: string
		manifest: GameKbManifest
		workspaceRoot: string
		gameRoot?: string
		gameVersion?: string
		scope: KnowledgeBaseIncrementScope
	}
}

/**
 * 开一场建库/更新对话。任何失败都**不抛错**，一律变成返回值——
 * 设置页要能把「为什么没开起来」原样展示给用户。
 */
export async function openKnowledgeBaseTask(
	controller: Controller | undefined,
	params: OpenKnowledgeBaseTaskParams,
): Promise<{ ok: boolean; message?: string }> {
	if (!canStartTask(controller)) {
		return { ok: false, message: "这个环境里没有可用的对话（扩展未就绪）。" }
	}
	if (isConversationBusy(controller)) {
		return { ok: false, message: "现在有一个对话正在跑。等它结束或取消之后，再新建/更新知识库。" }
	}

	let prompt: string
	let dir: string
	let taskKind: GameKbTaskKind
	if (params.create) {
		const { name, workspaceRoot, gameRoot, gameVersion } = params.create
		dir = params.create.dir
		// 建库形态只决定「第一场任务怎么跑」：空白建库不会走到这里（它不开对话）
		taskKind = "full"
		prompt = buildCreatePrompt({
			name,
			dir,
			workspaceRoot,
			gameRoot,
			gameVersion,
			identityBlock: UNRESTRICTED_IDENTITY_BLOCK,
		})
	} else if (params.update) {
		const { workspaceRoot, gameRoot, gameVersion, manifest } = params.update
		dir = params.update.dir
		taskKind = "update"
		prompt = buildUpdatePrompt({
			dir,
			workspaceRoot,
			gameRoot: gameRoot ?? manifest.gameRoot,
			gameVersion: gameVersion ?? manifest.gameVersion,
			manifest,
			identityBlock: UNRESTRICTED_IDENTITY_BLOCK,
		})
	} else if (params.increment) {
		const { workspaceRoot, gameRoot, gameVersion, manifest, scope } = params.increment
		dir = params.increment.dir
		taskKind = "incremental"
		prompt = buildIncrementPrompt({
			dir,
			workspaceRoot,
			gameRoot: gameRoot ?? manifest.gameRoot,
			gameVersion: gameVersion ?? manifest.gameVersion,
			manifest,
			scope,
			identityBlock: UNRESTRICTED_IDENTITY_BLOCK,
		})
	} else {
		return { ok: false, message: "没有指定要做什么。" }
	}

	try {
		const taskId = await controller.initTask(prompt)
		if (typeof taskId !== "string" || taskId.length === 0) {
			return { ok: false, message: "开对话没成功（没有拿到任务号）。" }
		}
		// 先落盘再登记：哪怕后续回调丢失，设置页也能看到「构建中」而不是一片空白。
		// ⛔ 只写 taskKind，不写 mode：建库形态是用户的选项，不能被任务覆盖。
		await updateKnowledgeBaseBuild(dir, {
			status: "building",
			taskKind,
			taskId,
			startedAt: new Date().toISOString(),
			error: undefined,
		})
		registerKnowledgeBaseBuild(taskId, dir)
		Logger.log(`[knowledge-base] 已开启对话：${taskId}（${taskKind}）`)
		return { ok: true }
	} catch (error) {
		Logger.warn(`[knowledge-base] 开对话失败：${error}`)
		const message = `开对话没成功：${error instanceof Error ? error.message : String(error)}`
		await updateKnowledgeBaseBuild(dir, { status: "failed", error: message }).catch(() => false)
		return { ok: false, message }
	}
}

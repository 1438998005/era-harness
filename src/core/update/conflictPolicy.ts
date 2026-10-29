/**
 * eratw 一键更新 —— 冲突询问的会话级策略闸门。
 *
 * 为什么需要：判定表按「口上角色整包、本体逐文件」分组（`plan.ts#groupConflicts`），
 * 2785 个冲突就是 2785 次弹窗（2026-10-29 真实用户：点到放弃更新）。这里把
 * 「问不问、问几次」收敛成一次选择，同时保持 `shouldMerge` 的签名不变 ——
 * 对话工作台路径与静默路径共用同一个实例，行为结构上不可能分裂。
 *
 * 纯 Node、无 vscode；弹窗能力由调用方注入。
 */

import type { ConflictGroup } from "./types"

/** 单个冲突组的处理选择 */
export type ConflictChoice = "merge" | "keep" | "merge-rest" | "keep-rest" | "cancel"

/** 批量提问的结果 */
export type BatchChoice = "merge-all" | "keep-all" | "one-by-one" | "cancel"

/** 用户在冲突环节取消更新（由 `service.ts` 捕获并返回 cancelled，不冒到命令层） */
export class ConflictCancelled extends Error {
	constructor() {
		super("用户在冲突处理时取消了更新")
		this.name = "ConflictCancelled"
	}
}

export interface ConflictPolicyOptions {
	/** 冲突组总数（`plan.groups.length`） */
	groupCount: number
	/** 冲突文件总数（`plan.summary.conflict`），只用于文案 */
	fileCount: number
	/** 超过这个组数就先问一次整体做法；默认 20 */
	batchThreshold?: number
	askBatch: (info: { groups: number; files: number }) => Promise<BatchChoice | undefined>
	askOne: (
		group: ConflictGroup,
		ctx: { index: number; total: number; remaining: number },
	) => Promise<ConflictChoice | undefined>
}

/**
 * 造一个 `shouldMerge`。
 *
 * - 组数 > 阈值：第一次调用前先问整体做法；选「一个一个问」才进入逐组
 * - 逐组时任何一组都可以选「剩下的都这样」，之后不再打扰
 * - 取消抛 `ConflictCancelled`
 */
export function createConflictPolicy(opts: ConflictPolicyOptions): (group: ConflictGroup) => Promise<boolean> {
	const total = Math.max(0, opts.groupCount)
	const threshold = opts.batchThreshold ?? 20
	let mode: "ask" | "merge" | "keep" = "ask"
	let batchAsked = false
	let index = 0

	return async (group: ConflictGroup): Promise<boolean> => {
		index++
		if (mode === "merge") {
			return true
		}
		if (mode === "keep") {
			return false
		}

		if (!batchAsked && total > threshold) {
			batchAsked = true
			const choice = await opts.askBatch({ groups: total, files: opts.fileCount })
			if (choice === "merge-all") {
				mode = "merge"
				return true
			}
			if (choice === "keep-all") {
				mode = "keep"
				return false
			}
			if (choice !== "one-by-one") {
				throw new ConflictCancelled()
			}
		}

		const choice = await opts.askOne(group, { index, total, remaining: Math.max(0, total - index) })
		switch (choice) {
			case "merge":
				return true
			case "merge-rest":
				mode = "merge"
				return true
			case "keep-rest":
				mode = "keep"
				return false
			case "keep":
				return false
			default:
				throw new ConflictCancelled()
		}
	}
}

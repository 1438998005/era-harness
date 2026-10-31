/**
 * 子代理预算（纯函数，不依赖 vscode / 网络）。
 *
 * 为什么必须有这层：2026-10-31 真实事故——一次建库任务里 5 个子代理并行，
 * 其中一个循环了 1936 次工具调用、383K 上下文，单独花掉 ¥96.86，整批 ¥102.43，
 * 还卡了 93 分钟没有结果。`SubagentRunner` 此前只限制「空回复重试 3 次」，
 * 轮次 / 工具调用数 / 费用 / 墙钟 / 空闲一概不设上限；而且子代理直接调
 * `handler.execute()`，绕过了主循环的 `checkRepeatedToolCall` 熔断。
 *
 * 阈值集中在这里（只写一份）：调大/调小时改这一个文件，
 * `SubagentRunner`（执行期）与 `SubagentToolHandler`（调用期总预算）都引用它。
 */

/** 单个子代理的硬预算 */
export const SUBAGENT_BUDGET = {
	/** 最多几轮「请求 → 工具」循环 */
	maxTurns: 30,
	/** 最多执行多少次工具 */
	maxToolCalls: 150,
	/** 累计费用上限（人民币，与 SubagentRunner 的费用口径一致） */
	maxCostCny: 3,
	/** 墙钟上限（从 run() 开始算） */
	maxWallMs: 10 * 60_000,
	/** 两次流式 chunk 之间的最长空闲；超时视为请求卡死 */
	maxIdleMs: 90_000,
} as const

/** 一次 use_subagents 调用（最多 5 个子代理）的总费用上限 */
export const SUBAGENT_CALL_BUDGET = {
	maxTotalCostCny: 10,
} as const

export type SubagentBudgetReason = "turns" | "toolCalls" | "cost" | "wall" | "idle" | "callCost"

export interface SubagentBudgetSnapshot {
	/** 已完成的「请求 → 工具」轮次 */
	turns: number
	/** 已执行的工具调用次数 */
	toolCalls: number
	/** 累计费用（元） */
	costCny: number
	/** 从 run() 开始到现在的毫秒数 */
	elapsedMs: number
	/** 距离上一个流式 chunk 的毫秒数 */
	idleMs: number
}

/**
 * 判定是否超预算。顺序刻意固定：先墙钟/空闲（与模型行为无关的硬止损），
 * 再轮次/工具数，最后费用——这样错误文案能指出最贴近事实的那一条。
 */
export function checkSubagentBudget(snapshot: SubagentBudgetSnapshot): SubagentBudgetReason | undefined {
	if (snapshot.elapsedMs > SUBAGENT_BUDGET.maxWallMs) {
		return "wall"
	}
	if (snapshot.idleMs > SUBAGENT_BUDGET.maxIdleMs) {
		return "idle"
	}
	if (snapshot.turns > SUBAGENT_BUDGET.maxTurns) {
		return "turns"
	}
	if (snapshot.toolCalls > SUBAGENT_BUDGET.maxToolCalls) {
		return "toolCalls"
	}
	if (snapshot.costCny > SUBAGENT_BUDGET.maxCostCny) {
		return "cost"
	}
	return undefined
}

/** 给用户/模型看的中文原因；必须把当前阈值写出来，否则调阈值后文案会撒谎 */
export function budgetMessage(reason: SubagentBudgetReason): string {
	switch (reason) {
		case "wall":
			return `子代理已中止：运行超过 ${Math.round(SUBAGENT_BUDGET.maxWallMs / 60_000)} 分钟`
		case "idle":
			return `子代理已中止：模型 ${Math.round(SUBAGENT_BUDGET.maxIdleMs / 1000)} 秒没有返回任何内容（请求卡死）`
		case "turns":
			return `子代理已中止：超过 ${SUBAGENT_BUDGET.maxTurns} 轮`
		case "toolCalls":
			return `子代理已中止：超过 ${SUBAGENT_BUDGET.maxToolCalls} 次工具调用`
		case "cost":
			return `子代理已中止：费用超过 ¥${SUBAGENT_BUDGET.maxCostCny}`
		case "callCost":
			return `本次调用的子代理总费用已超过 ¥${SUBAGENT_CALL_BUDGET.maxTotalCostCny}，剩余子代理已跳过`
	}
}

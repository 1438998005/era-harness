/**
 * #95（2026-10-31）：子代理预算的纯函数单测。
 *
 * 这层存在的理由是真实事故：一次建库任务里 5 个子代理并行，其中一个循环了
 * 1936 次工具调用、单条烧掉 ¥96.86，整批 ¥102.43，卡了 93 分钟且零分片产出。
 * 事故的四条根因里三条与「阈值」有关，所以这里逐条钉死边界：
 *
 * ① 刚好等于阈值**不算超**（`>` 而不是 `>=`）——阈值是「允许的上限」，
 *    写成 `>=` 会让 maxTurns=30 实际只跑 29 轮，调参数时非常难发现；
 * ② 判定顺序固定 wall → idle → turns → toolCalls → cost：
 *    同时超好几项时，文案要指出最贴近事实的那一条（卡死优先于「轮次多」）；
 * ③ 文案必须带当前阈值——否则把 30 改成 40 之后，错误信息还在说 30（撒谎）；
 * ④ 0 值一律不触发（新任务第一轮就是全 0，不能让预算器把正常任务拦下来）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	budgetMessage,
	checkSubagentBudget,
	SUBAGENT_BUDGET,
	SUBAGENT_CALL_BUDGET,
	type SubagentBudgetSnapshot,
} from "../../src/core/task/tools/subagent/subagentBudget"

function snapshot(overrides: Partial<SubagentBudgetSnapshot> = {}): SubagentBudgetSnapshot {
	return { turns: 0, toolCalls: 0, costCny: 0, totalTokens: 0, elapsedMs: 0, idleMs: 0, ...overrides }
}

test("#95 全 0 不触发（第一轮不能被自己的预算拦下来）", () => {
	assert.equal(checkSubagentBudget(snapshot()), undefined)
})

test("#95 刚好等于阈值不算超，超一才中止（六个维度逐个验证）", () => {
	const boundaries: Array<{ field: keyof SubagentBudgetSnapshot; at: number; next: number; reason: string }> = [
		{ field: "elapsedMs", at: SUBAGENT_BUDGET.maxWallMs, next: SUBAGENT_BUDGET.maxWallMs + 1, reason: "wall" },
		{ field: "idleMs", at: SUBAGENT_BUDGET.maxIdleMs, next: SUBAGENT_BUDGET.maxIdleMs + 1, reason: "idle" },
		{ field: "turns", at: SUBAGENT_BUDGET.maxTurns, next: SUBAGENT_BUDGET.maxTurns + 1, reason: "turns" },
		{ field: "toolCalls", at: SUBAGENT_BUDGET.maxToolCalls, next: SUBAGENT_BUDGET.maxToolCalls + 1, reason: "toolCalls" },
		{ field: "costCny", at: SUBAGENT_BUDGET.maxCostCny, next: SUBAGENT_BUDGET.maxCostCny + 1, reason: "cost" },
	]

	for (const { field, at, next, reason } of boundaries) {
		assert.equal(checkSubagentBudget(snapshot({ [field]: at })), undefined, `${field}=${at}（等于阈值）不该中止`)
		assert.equal(checkSubagentBudget(snapshot({ [field]: next })), reason, `${field}=${next}（超一）必须中止`)
	}
})

test("#95 判定顺序：wall → idle → turns → toolCalls → cost", () => {
	// 全部超限时只报第一个（墙钟最硬）
	assert.equal(
		checkSubagentBudget(
			snapshot({
				elapsedMs: SUBAGENT_BUDGET.maxWallMs + 1,
				idleMs: SUBAGENT_BUDGET.maxIdleMs + 1,
				turns: SUBAGENT_BUDGET.maxTurns + 1,
				toolCalls: SUBAGENT_BUDGET.maxToolCalls + 1,
				costCny: SUBAGENT_BUDGET.maxCostCny + 1,
			}),
		),
		"wall",
	)

	// 卡死优先于「轮次多」：93 分钟那次事故就是卡在最后一个请求里
	assert.equal(
		checkSubagentBudget(snapshot({ idleMs: SUBAGENT_BUDGET.maxIdleMs + 1, turns: SUBAGENT_BUDGET.maxTurns + 1 })),
		"idle",
	)

	// 轮次优先于工具数与费用
	assert.equal(
		checkSubagentBudget(snapshot({ turns: SUBAGENT_BUDGET.maxTurns + 1, toolCalls: SUBAGENT_BUDGET.maxToolCalls + 1 })),
		"turns",
	)

	// 工具数优先于费用
	assert.equal(
		checkSubagentBudget(snapshot({ toolCalls: SUBAGENT_BUDGET.maxToolCalls + 1, costCny: SUBAGENT_BUDGET.maxCostCny + 1 })),
		"toolCalls",
	)
})

test("#95 事故量级确实会触发：1936 次工具 / ¥96.86 / 93 分钟三条都命中", () => {
	const incident = snapshot({
		turns: 1936,
		toolCalls: 1936,
		costCny: 96.86,
		elapsedMs: 5_572_349,
		idleMs: 0,
	})
	assert.equal(checkSubagentBudget(incident), "wall", "先被 10 分钟墙钟拦下，不会走到费用判定")

	// 假如墙钟没到（例如慢但没超时），费用也必须拦得住
	assert.equal(checkSubagentBudget({ ...incident, elapsedMs: 60_000 }), "turns")
	assert.equal(checkSubagentBudget({ ...incident, elapsedMs: 60_000, turns: 5, toolCalls: 151 }), "toolCalls")
	assert.equal(checkSubagentBudget({ ...incident, elapsedMs: 60_000, turns: 5, toolCalls: 5 }), "cost")
})

test("#98 价格未知（cost 恒 0）时按 token 兜底：套餐 provider 的止损不能失效", () => {
	// 套餐 provider 把价格全置 0，`chunk.totalCost` 返回的是 0（不是 undefined），
	// `??` 不会回退到计价公式 → cost / callCost 两个分支永不触发，只剩 token 这道闸
	assert.equal(
		checkSubagentBudget(snapshot({ costCny: 0, totalTokens: SUBAGENT_BUDGET.maxTotalTokens })),
		undefined,
		"等于阈值不算超",
	)
	assert.equal(checkSubagentBudget(snapshot({ costCny: 0, totalTokens: SUBAGENT_BUDGET.maxTotalTokens + 1 })), "tokens")

	// 有单价时**不**启用 token 兜底：正常任务不该因为用量大被误杀
	assert.equal(checkSubagentBudget(snapshot({ costCny: 0.01, totalTokens: SUBAGENT_BUDGET.maxTotalTokens + 1 })), undefined)
})

test("#98 费用优先于 token：有单价时报告的是「费用超了」而不是「用量超了」", () => {
	assert.equal(
		checkSubagentBudget(
			snapshot({ costCny: SUBAGENT_BUDGET.maxCostCny + 1, totalTokens: SUBAGENT_BUDGET.maxTotalTokens + 1 }),
		),
		"cost",
	)
})

test("#95 单次调用总预算单独存在（¥10），不与单子代理 ¥3 混用", () => {
	assert.ok(SUBAGENT_CALL_BUDGET.maxTotalCostCny > SUBAGENT_BUDGET.maxCostCny, "总预算必须大于单个上限，否则多子代理没意义")
	// 5 个子代理各刚好 ¥3 → 合计 ¥15 > ¥10，必须由调用期预算拦下（不是单个预算）
	assert.ok(SUBAGENT_BUDGET.maxCostCny * 5 > SUBAGENT_CALL_BUDGET.maxTotalCostCny)
	// token 兜底同理：调用级上限必须大于单个上限
	assert.ok(SUBAGENT_CALL_BUDGET.maxTotalTokens > SUBAGENT_BUDGET.maxTotalTokens)
})

test("#95 文案带当前阈值（改常量后文案不能撒谎）", () => {
	const reasons = ["wall", "idle", "turns", "toolCalls", "cost", "tokens", "callTokens", "callCost"] as const
	for (const reason of reasons) {
		const message = budgetMessage(reason)
		assert.ok(message.length > 0, `${reason} 必须有文案`)
		assert.equal(message.includes("undefined"), false, `${reason} 文案不能出现 undefined`)
	}

	assert.ok(budgetMessage("wall").includes(String(Math.round(SUBAGENT_BUDGET.maxWallMs / 60_000))))
	assert.ok(budgetMessage("idle").includes(String(Math.round(SUBAGENT_BUDGET.maxIdleMs / 1000))))
	assert.ok(budgetMessage("turns").includes(String(SUBAGENT_BUDGET.maxTurns)))
	assert.ok(budgetMessage("toolCalls").includes(String(SUBAGENT_BUDGET.maxToolCalls)))
	assert.ok(budgetMessage("cost").includes(String(SUBAGENT_BUDGET.maxCostCny)))
	assert.ok(budgetMessage("tokens").includes(String(SUBAGENT_BUDGET.maxTotalTokens)))
	assert.ok(budgetMessage("callTokens").includes(String(SUBAGENT_CALL_BUDGET.maxTotalTokens)))
	assert.ok(budgetMessage("callCost").includes(String(SUBAGENT_CALL_BUDGET.maxTotalCostCny)))
})

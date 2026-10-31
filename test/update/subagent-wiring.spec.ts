/**
 * #98 / #100：子代理预算与嵌套守卫的**接线断言**。
 *
 * 为什么读源码文本而不是 import 模块：
 * `test/update/run.mjs` 用 esbuild 打包 spec，且把 `vscode` 标成 external——
 * 只要 import `SubagentRunner` / `SubagentToolHandler`，运行时就会在 `require("vscode")` 处抛错。
 * 而这两个模块的真实行为（每轮都判预算、中止后回调抛错被接住）又必须有人盯着。
 *
 * 于是退一步：断言「调用点存在且参数对得上」。这挡不住逻辑写错，但能挡住最危险的一种回归——
 * **函数写好了却没接线**（#95 的 `checkSubagentBudget` 当初就是这样：纯函数有单测，调用点为零）。
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

// run.mjs 用 `cwd: repoRoot` 起子进程，所以这里就是仓库根
const repoRoot = process.cwd()
const read = (relative: string): string => {
	const full = path.join(repoRoot, relative)
	assert.ok(fs.existsSync(full), `源码文件不存在：${full}`)
	return fs.readFileSync(full, "utf8")
}

test("#98 Runner 真的每轮都判预算（3 个调用点：轮首 / 请求后 / 工具后）", () => {
	const source = read("src/core/task/tools/subagent/SubagentRunner.ts")
	const callSites = source.match(/this\.checkBudget\(/g) ?? []
	assert.ok(callSites.length >= 3, `checkBudget 调用点只有 ${callSites.length} 个，至少要有轮首/请求后/工具后 3 个`)
	assert.ok(source.includes("checkSubagentBudget({"), "必须真的调用纯函数，不能只留一个同名方法")
})

test("#98 预算快照必须带上 totalTokens（否则套餐 provider 下 token 兜底不生效）", () => {
	const source = read("src/core/task/tools/subagent/SubagentRunner.ts")
	assert.ok(
		source.includes("totalTokens: stats.inputTokens + stats.outputTokens"),
		"checkBudget 必须传 input+output 的累计 token",
	)
	// 不能把 cacheReads 算进去：缓存命中会把同一段上下文反复计数，会误杀正常任务
	assert.equal(
		/costCny:[\s\S]{0,200}totalTokens:[\s\S]{0,120}cacheReadTokens/.test(source),
		false,
		"totalTokens 不应包含 cacheReadTokens",
	)
})

test("#98 onProgress 的 rejection 必须被接住（中止后 say 会抛）", () => {
	const source = read("src/core/task/tools/subagent/SubagentRunner.ts")
	assert.ok(source.includes("private async emit("), "必须有统一的 emit 包装")
	assert.ok(source.includes("void this.emit(onProgress,"), "调用点必须走 emit，不能裸调 onProgress")
	assert.equal(source.includes("\n\t\tonProgress({"), false, "不能残留裸调用 onProgress({")
	const emitSites = source.match(/void this\.emit\(onProgress,/g) ?? []
	assert.ok(emitSites.length >= 10, `emit 调用点只有 ${emitSites.length} 个，进度上报明显漏了`)
})

test("#100 嵌套子代理有两道守卫：运行时拦截 + 允许工具集过滤", () => {
	const handler = read("src/core/task/tools/handlers/SubagentToolHandler.ts")
	assert.ok(handler.includes("config.isSubagentExecution"), "Handler 必须拒绝在子代理里再开子代理")
	assert.ok(handler.includes("SUBAGENT_CALL_BUDGET.maxTotalTokens"), "调用级预算必须有 token 兜底（套餐 provider 下费用恒 0）")

	const builder = read("src/core/task/tools/subagent/SubagentBuilder.ts")
	assert.ok(builder.includes("ClineDefaultTool.USE_SUBAGENTS"), "允许工具集必须显式摘掉 use_subagents")
})

test("#109 调用级定时器必须进 finally（runner 卡死时不能残留 100ms 轮询）", () => {
	const handler = read("src/core/task/tools/handlers/SubagentToolHandler.ts")
	assert.ok(
		/try\s*\{[\s\S]*?Promise\.race\(\[Promise\.allSettled\(execution\), wallClock\]\)[\s\S]*?\}\s*finally\s*\{/.test(handler),
		"allSettled 必须包在 try/finally 里",
	)
	assert.ok(/finally\s*\{[\s\S]{0,200}clearInterval\(abortPollInterval\)/.test(handler), "finally 里必须清掉轮询定时器")
})

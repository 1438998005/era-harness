/**
 * 08 #203–#206 / #211 / #213：诊断包口径、审计模型口径、进度清单诱导、校验文件 401。
 *
 * 取证（diagnostics-20261104-134607.txt）：
 * - 头部「运行时错误: 0 条」与 `tool attempt_completion outcome:error` 并存；
 * - 同一 turn 的 api/usage 与 tool/parse 记录到两款不同的 free 池模型；
 * - 7 条 `parse repair taskProgress=…` 与「220 字进度清单」说明免费池模型把清单当正文吐；
 * - 校验文件下载 HTTP 401 连败 4 次后第 5 次才成功。
 *
 * #204/#211/#213 的重试部分是**真跑的行为测试**：整段重试循环在纯模块 checksumRetry 里，
 * 用真实 AbortController + 注入的 fetch/wait 覆盖请求序列与取消时序，不靠源码字符串断言。
 * 带 vscode 依赖的宿主代码只保留一条薄薄的「是否仍调用纯模块」接线断言。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	describeErrorStats,
	serializeAuditEntry,
	summarizeErrorEvents,
	summarizeSilentSuspects,
	summarizeToolFailures,
} from "../../src/core/logging/audit-log-format"
import { FocusChainPrompts } from "../../src/core/task/focus-chain/prompts"
import {
	type CommandExecutionMeta,
	commandOutcomeFromMeta,
	outcomeFromToolResponse,
	type ToolExecutionResult,
} from "../../src/core/task/tool-outcome"
import {
	CHECKSUM_MAX_ATTEMPTS,
	type ChecksumFetchResponse,
	checksumRetryDelayMs,
	fetchChecksumWithRetry,
	isRetryableChecksumStatus,
	waitForChecksumRetry,
} from "../../src/shared/checksumRetry"
import { readCode, readRaw } from "./source-probe"

const toolFailureLines = [
	JSON.stringify({ event: "tool", tool: "attempt_completion", outcome: "error", message: "boom" }),
	JSON.stringify({ event: "tool", tool: "read_file", outcome: "ok" }),
	JSON.stringify({ event: "tool", tool: "search_files", outcome: "error" }),
	JSON.stringify({ event: "error", action: "folded", outcome: "error" }),
	JSON.stringify({ event: "error", source: "host", outcome: "error" }),
	"not json",
]

test("#203 工具失败计数：只数包内 event=tool 且 outcome=error 的行", () => {
	assert.equal(summarizeToolFailures(toolFailureLines), 2)
	assert.equal(summarizeToolFailures([]), 0)
	assert.equal(summarizeToolFailures([JSON.stringify({ event: "tool", outcome: "Error" })]), 0)
})

test("#203 诊断包头部：0 条运行时错误也要写明工具失败次数", () => {
	const zero = { ...summarizeErrorEvents([]), toolFailures: 2 }
	const lines = describeErrorStats(zero)
	assert.equal(lines.length, 1)
	assert.match(lines[0]!, /运行时错误: 0 条/)
	assert.match(lines[0]!, /若刚触发过失败操作仍为 0/)
	assert.match(lines[0]!, /工具失败 2 次/)

	const withErrors = { ...summarizeErrorEvents([toolFailureLines[4]!]), toolFailures: 1 }
	assert.match(describeErrorStats(withErrors)[0]!, /工具失败 1 次/)

	// 老调用方不传 toolFailures 时文案一字不变（#63 的兼容契约）
	assert.equal(
		describeErrorStats(summarizeErrorEvents([]))[0],
		"运行时错误: 0 条（记录窗口内没有错误；若刚触发过失败操作仍为 0，说明该错误没被捕获链路覆盖）",
	)
})

test("#204 校验文件重试判据：只重试瞬时状态，退避递增且有上限", () => {
	for (const status of [401, 408, 429, 500, 502, 503]) {
		assert.equal(isRetryableChecksumStatus(status), true, `HTTP ${status} 应可重试`)
	}
	for (const status of [200, 400, 403, 404, 410]) {
		assert.equal(isRetryableChecksumStatus(status), false, `HTTP ${status} 不该重试`)
	}
	assert.equal(CHECKSUM_MAX_ATTEMPTS, 3)
	assert.ok(checksumRetryDelayMs(0) > 0)
	assert.ok(checksumRetryDelayMs(1) > checksumRetryDelayMs(0))
	assert.ok(checksumRetryDelayMs(2) > checksumRetryDelayMs(1))
})

// ——— #204/#211/#213：真跑重试循环 ———

type FakeResponse = ChecksumFetchResponse

const resp = (status: number): FakeResponse => ({ ok: status >= 200 && status < 300, status })

function makeHarness(
	statuses: readonly number[],
	options: { abortBefore?: boolean; abortDuringWait?: boolean; abortDuringFetch?: boolean } = {},
) {
	const controller = new AbortController()
	if (options.abortBefore) {
		controller.abort()
	}
	const seenSignals: AbortSignal[] = []
	const waits: number[] = []
	const retries: string[] = []
	const errorMessages: string[] = []
	let index = 0

	const run = () =>
		fetchChecksumWithRetry<FakeResponse>({
			signal: controller.signal,
			fetchOnce: async (signal) => {
				seenSignals.push(signal)
				if (options.abortDuringFetch) {
					controller.abort()
				}
				return resp(statuses[Math.min(index++, statuses.length - 1)] ?? 599)
			},
			onRetry: (next, max) => {
				retries.push(`第 ${next}/${max} 次`)
			},
			wait: async (ms, signal) => {
				waits.push(ms)
				assert.equal(signal, controller.signal, "等待要用同一个 15s 预算的 signal")
				if (options.abortDuringWait) {
					controller.abort()
				}
			},
			makeError: (message) => {
				errorMessages.push(message)
				return new Error(message)
			},
		})

	return {
		controller,
		seenSignals,
		waits,
		retries,
		errorMessages,
		run,
		get attempts() {
			return seenSignals.length
		},
	}
}

test("#204 行为：401 连败后成功，退避递增且进度文案齐全", async () => {
	const h = makeHarness([401, 401, 200])
	const result = await h.run()
	assert.equal(result.status, 200)
	assert.equal(h.attempts, 3)
	assert.deepEqual(h.waits, [checksumRetryDelayMs(0), checksumRetryDelayMs(1)])
	assert.deepEqual(h.retries, ["第 2/3 次", "第 3/3 次"])
})

test("#204 行为：首次成功不重试；404 立刻失败不白等", async () => {
	const ok = makeHarness([200])
	assert.equal((await ok.run()).status, 200)
	assert.equal(ok.attempts, 1)
	assert.deepEqual(ok.waits, [])

	const missing = makeHarness([404])
	await assert.rejects(missing.run(), /校验文件下载失败（HTTP 404）/)
	assert.equal(missing.attempts, 1, "确定性失败不能重试")
	assert.deepEqual(missing.waits, [])
	assert.deepEqual(missing.retries, [])
})

test("#204 行为：瞬时状态用尽次数后按原文案报错", async () => {
	for (const status of [401, 503]) {
		const h = makeHarness([status])
		await assert.rejects(h.run(), new RegExp(`校验文件下载失败（HTTP ${status}）`))
		assert.equal(h.attempts, CHECKSUM_MAX_ATTEMPTS)
		assert.equal(h.waits.length, CHECKSUM_MAX_ATTEMPTS - 1)
	}
})

test("#211 行为：请求前已取消/超时 → 零请求、给友好文案", async () => {
	const h = makeHarness([200], { abortBefore: true })
	await assert.rejects(h.run(), /校验文件下载失败（请求已取消或超时）/)
	assert.equal(h.attempts, 0, "已 abort 的 signal 不能再发请求")
	assert.deepEqual(h.waits, [])
})

test("#213 行为：退避等待期间被取消 → 不再发第二次请求", async () => {
	const h = makeHarness([401, 200], { abortDuringWait: true })
	await assert.rejects(h.run(), /校验文件下载失败（请求已取消或超时）/)
	assert.equal(h.attempts, 1, "旧实现在这里会带 aborted signal 再 fetch 一次")
	assert.deepEqual(h.waits, [checksumRetryDelayMs(0)])
	assert.equal(h.errorMessages.at(-1), "校验文件下载失败（请求已取消或超时）")
})

test("#211 行为：请求进行中被取消 → 下一轮循环顶部拦下，不继续重试", async () => {
	const h = makeHarness([401, 200], { abortDuringFetch: true })
	await assert.rejects(h.run(), /校验文件下载失败（请求已取消或超时）/)
	assert.equal(h.attempts, 1)
	assert.deepEqual(h.waits, [])
})

test("#211 行为：等待器在已取消 / 中途取消时立即醒来，不空等定时器", async () => {
	const pre = new AbortController()
	pre.abort()
	const started = Date.now()
	await waitForChecksumRetry(60_000, pre.signal)
	assert.ok(Date.now() - started < 1_000, "已 abort 时必须立刻返回")

	const during = new AbortController()
	const pending = waitForChecksumRetry(60_000, during.signal)
	during.abort()
	await pending
	assert.ok(Date.now() - started < 1_000, "等待中 abort 必须唤醒等待")

	// 未取消时按传入的 ms 正常到点唤醒（用 1ms 避免拖慢套件）
	await waitForChecksumRetry(1, new AbortController().signal)
})

test("#211 源码接线：宿主把重试委托给纯模块，错误仍包装成 UpdateError", () => {
	const code = readCode("src/hosts/vscode/updateChecker.ts")
	assert.match(code, /fetchChecksumWithRetry\(\{/, "宿主必须调用可测的纯模块")
	assert.match(code, /makeError: \(message\) => new UpdateError\("http", message\)/, "错误分类不能丢")
	const raw = readRaw("src/hosts/vscode/updateChecker.ts")
	assert.match(raw, /正在重试/, "要给 0 基础用户明确进度提示")
	const shared = readRaw("src/shared/checksumRetry.ts")
	assert.match(shared, /校验文件下载失败（HTTP \$\{response\.status\}）/, "既有错误文案不得改写")
})

test("#205 源码接线：任务层与 tool 事件都用请求时模型快照", () => {
	const code = readCode("src/core/task/index.ts")
	const metaAt = code.indexOf("private auditTaskMeta()")
	assert.ok(metaAt > -1)
	assert.match(code.slice(metaAt, metaAt + 800), /lastRequestProviderInfo/, "任务层审计入口应优先取快照")
	const startAt = code.indexOf('action: "start"')
	assert.ok(startAt > -1)
	assert.match(
		code.slice(startAt - 300, startAt + 300),
		/auditTaskMeta\(\)/,
		"task/start 仍走同一入口，快照为空自动回退实时设置",
	)

	const toolCode = readCode("src/core/task/ToolExecutor.ts")
	const guardAt = toolCode.indexOf("private auditModelInfo()")
	assert.ok(guardAt > -1)
	assert.match(toolCode.slice(guardAt, guardAt + 800), /lastRequestProviderInfo/, "tool 事件也要用同一份快照")
})

test("#206 源码接线：免费池不再被诱导输出 task_progress 清单", () => {
	const code = readCode("src/core/task/index.ts")
	assert.match(code, /skipFreePoolRecommended/, "free provider 应跳过 RECOMMENDED 段")
	const prompt = readRaw("src/core/task/focus-chain/prompts.ts")
	assert.match(prompt, /Never write the checklist as message text/, "提示词要禁止把清单写进正文")
})

test("#252 元测试：focus-chain 请求计数提醒文案使用 recommended", () => {
	// 负向断言用拼接构造错词，避免本文件自身命中「全仓不得出现该错拼」的验收判据
	const typo = "recom" + "ended"
	assert.match(FocusChainPrompts.apiRequestCount, /strongly recommended/, "提醒文案必须是正确拼写")
	assert.ok(!FocusChainPrompts.apiRequestCount.includes(typo), "不得回归到错拼")
})

// —— 08 #238：四类回放的端到端（真实审计行 → 诊断包头部）+ 元测试 ——

const replayMeta: CommandExecutionMeta = {
	exitCode: 0,
	signal: undefined,
	outputLength: 57,
	stderrHints: [],
	truncated: false,
}

/** 走完整判定链：meta → commandOutcomeFromMeta → serializeAuditEntry，产出一条真实 JSONL 审计行。 */
function commandToolLine(meta: CommandExecutionMeta | undefined, base: ToolExecutionResult = { outcome: "ok" }): string {
	const result = commandOutcomeFromMeta(meta, base)
	return serializeAuditEntry(
		{
			event: "tool",
			tool: "execute_command",
			outcome: result.outcome,
			message: result.message,
			suspect: result.suspect || undefined,
		},
		1,
	)!
}

function headerStats(lines: string[]) {
	return {
		...summarizeErrorEvents(lines),
		toolFailures: summarizeToolFailures(lines),
		silentSuspects: summarizeSilentSuspects(lines),
	}
}

test("#238 端到端回放：exit 255 / exit 1 进「工具失败 N 次」，管道 stderr / exit 0 空输出进「疑似静默失败」", () => {
	const lines = [
		commandToolLine({ ...replayMeta, exitCode: 255 }),
		commandToolLine({ ...replayMeta, exitCode: 1 }),
		commandToolLine({ ...replayMeta, stderrHints: ["FINDSTR:"] }),
		commandToolLine({ ...replayMeta, outputLength: 0 }),
	]
	const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>)
	// 前两类 outcome=error，后两类 outcome=ok，且 suspect 只落在后两类
	assert.deepEqual(
		parsed.map((p) => p.outcome),
		["error", "error", "ok", "ok"],
	)
	assert.deepEqual(
		parsed.map((p) => p.suspect ?? false),
		[false, false, true, true],
	)

	const stats = headerStats(lines)
	assert.equal(stats.toolFailures, 2, "前两类计入工具失败")
	assert.equal(stats.silentSuspects, 2, "后两类计入疑似静默失败")
	const head = describeErrorStats(stats)[0]!
	assert.match(head, /运行时错误: 0 条/)
	assert.match(head, /工具失败 2 次/)
	assert.match(head, /疑似静默失败 2 条/)
})

test("#238 端到端回放：正常成功命令不误判、用户拒绝仍 denied 不被覆盖", () => {
	const normal = commandToolLine(replayMeta)
	assert.equal(JSON.parse(normal).outcome, "ok")
	assert.equal("suspect" in JSON.parse(normal), false, "正常命令不带 suspect")

	// 用户拒绝：outcomeFromToolResponse 产出 denied，即使带非零 exitCode 也不被覆盖
	const deniedBase = outcomeFromToolResponse("The user denied this operation.")
	assert.equal(deniedBase.outcome, "denied")
	const deniedLine = commandToolLine({ ...replayMeta, exitCode: 255 }, deniedBase)
	assert.equal(JSON.parse(deniedLine).outcome, "denied")
	assert.equal("suspect" in JSON.parse(deniedLine), false)

	const stats = headerStats([normal, deniedLine])
	assert.equal(stats.toolFailures, 0)
	assert.equal(stats.silentSuspects, 0)
	assert.equal(describeErrorStats(stats)[0]!.includes("疑似静默失败"), false, "0 条时按既有风格省略")
})

test("#238 suspect 不计入工具失败统计（用户裁定：不新增 outcome 枚举、不动 #203 口径）", () => {
	const lines = [commandToolLine({ ...replayMeta, stderrHints: ["Traceback"] })]
	assert.equal(summarizeToolFailures(lines), 0)
	assert.equal(summarizeSilentSuspects(lines), 1)
	assert.match(describeErrorStats(headerStats(lines))[0]!, /疑似静默失败 1 条/)
	assert.equal(describeErrorStats(headerStats(lines))[0]!.includes("工具失败"), false)
})

test("#238 元测试：CommandExecutor 不再丢弃 exitCode，meta 作为元组第三项透传", () => {
	const code = readCode("src/integrations/terminal/CommandExecutor.ts")
	assert.match(code, /exitCode:\s*result\.exitCode/, "必须把 orchestrator 的 exitCode 组装进 meta")
	assert.match(code, /signal:\s*result\.signal/, "signal 也要透传")
	assert.match(code, /return \[result\.userRejected, result\.result, meta\]/, "execute() 第三项返回 meta")
	assert.match(code, /CommandExecutionMeta/, "返回类型标注了 meta")
})

test("#238 元测试：AuditOutcome 仍是五态、OUTCOMES 白名单未动、summarizeToolFailures 口径未改", () => {
	const raw = readRaw("src/core/logging/audit-log-format.ts")
	assert.match(raw, /export type AuditOutcome = "ok" \| "error" \| "denied" \| "cancelled" \| "info"/, "不得新增 outcome 枚举")
	assert.match(
		raw,
		/const OUTCOMES = new Set<AuditOutcome>\(\["ok", "error", "denied", "cancelled", "info"\]\)/,
		"OUTCOMES 白名单保持五态",
	)
	const code = readCode("src/core/logging/audit-log-format.ts")
	const fnAt = code.indexOf("export function summarizeToolFailures")
	const nextFnAt = code.indexOf("export function summarizeSilentSuspects", fnAt)
	assert.ok(fnAt > -1 && nextFnAt > fnAt)
	const body = code.slice(fnAt, nextFnAt)
	assert.match(body, /record\.outcome === "error"/, "口径仍只数 outcome=error")
	assert.equal(body.includes("suspect"), false, "summarizeToolFailures 不得混入 suspect")
})

test("#238 元测试：命令结果判定走同一单源 commandOutcomeFromMeta", () => {
	const outcome = readCode("src/core/task/tool-outcome.ts")
	assert.match(outcome, /export function commandOutcomeFromMeta\(/, "单源函数定义在 tool-outcome.ts")
	const executor = readCode("src/core/task/ToolExecutor.ts")
	assert.match(
		executor,
		/commandOutcomeFromMeta\(this\.taskState\.lastCommandMeta, toolOutcome\)/,
		"ToolExecutor 用单源叠加 toolOutcome",
	)
	// 判定不在透传链路的其它层重复实现
	for (const file of [
		"src/integrations/terminal/CommandExecutor.ts",
		"src/core/task/tools/handlers/ExecuteCommandToolHandler.ts",
		"src/core/task/index.ts",
	]) {
		assert.equal(readCode(file).includes("commandOutcomeFromMeta"), false, `${file} 不得重复判定`)
	}
})

test("review #238：用户取消命令判 cancelled，不再被记成 ok", () => {
	const cancelledMeta: CommandExecutionMeta = {
		cancelled: true,
		outputLength: 0,
		stderrHints: [],
		truncated: false,
	}
	// 先钉住旧行为：取消文案既不匹配 denied 也不含 toolError 前缀，纯文本判定确实是 ok
	const base = outcomeFromToolResponse("Command was cancelled by the user.")
	assert.equal(base.outcome, "ok")
	const result = commandOutcomeFromMeta(cancelledMeta, base)
	assert.equal(result.outcome, "cancelled", "取消必须进 cancelled 而不是 ok")
	assert.match(result.message ?? "", /cancelled by the user/)
	assert.equal("suspect" in result, false, "cancelled 不应同时被标 suspect")
	// 优先级保持：denied / error 不可被 cancelled 覆盖
	assert.equal(commandOutcomeFromMeta(cancelledMeta, { outcome: "denied" }).outcome, "denied")
	assert.equal(commandOutcomeFromMeta(cancelledMeta, { outcome: "error" }).outcome, "error")
	// 正常命令零行为变化
	assert.equal(
		commandOutcomeFromMeta({ exitCode: 0, outputLength: 12, stderrHints: [], truncated: false }, { outcome: "ok" }).outcome,
		"ok",
	)
})

test("review #238 元测试：取消分支返回三元组 meta、ToolExecutor 在 finally 清空", () => {
	const cmd = readCode("src/integrations/terminal/CommandExecutor.ts")
	const at = cmd.indexOf("if (this.wasCancelledExternally)")
	assert.ok(at > -1, "必须定位到取消分支本身，而不是前面的 flag 复位")
	const body = cmd.slice(at, at + 900)
	assert.match(body, /cancelled:\s*true/, "取消分支必须写 cancelled 标记")
	assert.match(body, /return \[true,[\s\S]{0,160}cancelledMeta\]/, "取消分支必须返回第三项 meta")
	const executor = readCode("src/core/task/ToolExecutor.ts")
	assert.match(executor, /finally \{[\s\S]{0,400}lastCommandMeta = undefined/, "meta 清理必须放 finally，abort/异常也不残留")
})

test("#239 元测试：SearchFilesToolHandler 确实调用 dialect-guard 单源，且保留 #45 双分支", () => {
	const handler = readCode("src/core/task/tools/handlers/SearchFilesToolHandler.ts")
	assert.match(handler, /buildUnclosedTagFailureMessage\(/, "必须复用 dialect-guard 的归因函数")
	assert.match(handler, /from "\.\.\/\.\.\/dialect-guard"/, "从 dialect-guard import")
	assert.match(handler, /allTargetsMissing/, "#45 路径缺失分支仍在")
	const raw = readRaw("src/core/task/tools/handlers/SearchFilesToolHandler.ts")
	assert.match(raw, /ripgrep failed while the target path exists/, "#45 ripgrep 分支仍在")
	const guard = readCode("src/core/task/dialect-guard.ts")
	assert.match(guard, /export function buildUnclosedTagFailureMessage\(/, "归因函数单源定义")
	assert.match(guard, /export function findUnclosedTagResidueParam\(/, "检测函数单源定义")
})

test("#239 元测试：GUARDED_PARAMS 与 handler 校验一致（path/regex/file_pattern 同族）", () => {
	const guard = readRaw("src/core/task/dialect-guard.ts")
	for (const key of ["path", "regex", "file_pattern"]) {
		assert.match(guard, new RegExp(`"${key}"`), `GUARDED_PARAMS 含 ${key}`)
	}
	const handler = readCode("src/core/task/tools/handlers/SearchFilesToolHandler.ts")
	assert.match(handler, /assertRequiredParams\(block, "path"\)/, "handler 校验 path")
	assert.match(handler, /if \(!regex\)/, "handler 校验 regex")
	assert.match(handler, /block\.params\.file_pattern/, "handler 读取 file_pattern")
})

test("#239 元测试：通用防线把专用归因接到拦截分支并回推 toolError，模型才看得到", () => {
	const code = readCode("src/core/task/ToolExecutor.ts")
	// 归因必须复用 dialect-guard 单源，且带 pollutedParam 钉住归因对象
	assert.match(code, /buildUnclosedTagFailureMessage\(block\.params, pollutedParam\)/, "拦截分支调用单源归因")
	assert.match(code, /findDialectResidueParam\(block\.params\)/, "#45 防线仍在")
	assert.match(code, /this\.pushToolResult\(formatResponse\.toolError\(message\), block\)/, "必须回推 tool_result")
	assert.match(code, /Invalid '\$\{pollutedParam\}'/, "DSML 残片仍走 #45 通用文案")

	// 顺序：防线在 coordinator.execute 之前（否则污染值已被执行，归因也来不及给模型）
	const guardAt = code.indexOf("const pollutedParam = findDialectResidueParam")
	const execAt = code.indexOf("toolResult = await this.coordinator.execute")
	assert.ok(guardAt > -1 && execAt > guardAt, "防线必须先于 handler 执行")

	// 归因函数本身仍单源，且 expectedParam 分支存在（防「多参数污染又指错方向」）
	const guard = readCode("src/core/task/dialect-guard.ts")
	assert.match(guard, /expectedParam\?: string/, "单源函数支持钉住归因参数")
	assert.match(guard, /unclosed !== expectedParam/, "不一致时退回通用文案")
})

test("#240 元测试：健康度表只做展示，统计口径与 outcome 白名单同源、路由侧零改动", () => {
	const fmt = readCode("src/core/logging/audit-log-format.ts")
	assert.match(fmt, /export function summarizeModelHealth\(/)
	assert.match(fmt, /record\.outcome === "error"/, "失败口径与 summarizeToolFailures 同源")
	assert.match(fmt, /record\.action === "folded"/, "只数包内行，折叠摘要不重复计")
	assert.match(fmt, /export const MODEL_HEALTH_COMMAND_TOOL = "execute_command"/, "命令工具 id 单源")
	const tools = readRaw("src/shared/tools.ts")
	assert.match(tools, /BASH = "execute_command"/, "与 ClineDefaultTool.BASH 逐字一致")

	const log = readCode("src/core/logging/auditLog.ts")
	assert.match(log, /const modelHealth = summarizeModelHealth\(lines\)/, "从折叠后的包内行计算")
	assert.match(log, /buildDiagnosticsHeader\(\{[\s\S]*?modelHealth,/, "接进诊断头部")

	// ⛔ 只做可观测：失败分类 / 路由循环 / 候选链签名一律不动
	const pools = readCode("src/shared/free-pools.ts")
	assert.match(pools, /export function buildFreeCandidateChain\(options: FreeChainOptions\)/, "候选链签名未变")
	for (const file of ["src/core/api/providers/free-errors.ts", "src/core/api/providers/free.ts"]) {
		assert.equal(readCode(file).includes("modelHealth"), false, `${file} 不得把健康度接进路由`)
	}
})

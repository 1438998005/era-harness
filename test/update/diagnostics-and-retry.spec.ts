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
import { describeErrorStats, summarizeErrorEvents, summarizeToolFailures } from "../../src/core/logging/audit-log-format"
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

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { buildDiagnosticsHeader, sanitizeAuditEntry, summarizeStreamErrorStreaks } from "../../src/core/logging/audit-log-format"
import {
	clearStreamErrorStreaks,
	peekStreamErrorStreak,
	recordStreamError,
	resetStreamErrorStreak,
} from "../../src/core/task/stream-error-streak-store"
import {
	buildErrorRetryStreakFields,
	isStreamErrorStreakEscalated,
	normalizeStreamErrorSignature,
	STREAM_ERROR_STREAK_THRESHOLD,
} from "../../src/shared/stream-error-streak"

/**
 * KB 08 #247：pinned 单链上 28 次「重试」全是同一条错误，零工具调用、白烧
 * 226,448 input tokens，UI 却从不告诉用户「已经连续失败 N 次」。
 *
 * 用户裁定：**N=3，只提示不退避**。所以这里钉死四件事：
 * ① 错误签名归一化要抹掉 request id / URL / 长数字，但保留 429/500 这类短数字；
 * ② 计数必须**跨 Task 实例**（reinitExistingTaskFromId 每次重试都重建 Task）；
 * ③ error_retry 载荷 / 审计 / 诊断包三处都能看到这个数字；
 * ④ ⛔ 不自动清 pinnedModelId、不自动切模型、不阻断手动重试（#242 裁定）。
 */

function repoRoot(): string {
	const fromCwd = path.resolve(process.cwd(), "src", "core", "task", "index.ts")
	if (fs.existsSync(fromCwd)) return process.cwd()
	return path.join(__dirname, "..", "..")
}

function readRepo(relative: string): string {
	return fs.readFileSync(path.join(repoRoot(), relative), "utf8")
}

const SAME_ERROR = (id: string) =>
	`Beam 1.0 返回了空响应 [ERA_FREE_PINNED_RECOVERY] (Request ID: ${id}) https://api.example.com/v1/chat 12345678`

describe("KB 08 #247 · 错误签名归一化", () => {
	it("同一错误带不同 request id / URL / 长数字仍是同一签名", () => {
		const a = normalizeStreamErrorSignature(SAME_ERROR("abcdef0123456789"))
		const b = normalizeStreamErrorSignature(SAME_ERROR("9988776655443322"))
		assert.equal(a, b)
		assert.ok(!a.includes("abcdef0123456789"), "长十六进制 id 必须抹掉")
		assert.ok(!a.includes("https://"), "URL 必须抹掉")
		assert.ok(!a.includes("[ERA_FREE_PINNED_RECOVERY]"), "pinned 恢复标记不能污染签名")
	})

	it("429 / 500 / 空响应不共用计数（短数字必须保留）", () => {
		const rateLimited = normalizeStreamErrorSignature("Rate limited: HTTP 429, retry later")
		const serverError = normalizeStreamErrorSignature("Upstream error: HTTP 500, retry later")
		const empty = normalizeStreamErrorSignature("Beam 1.0 返回了空响应")
		assert.notEqual(rateLimited, serverError)
		assert.notEqual(rateLimited, empty)
		assert.match(rateLimited, /429/)
		assert.match(serverError, /500/)
	})

	it("缺错误文本统一归到 unknown，签名长度有上界", () => {
		assert.equal(normalizeStreamErrorSignature(undefined), "unknown")
		assert.equal(normalizeStreamErrorSignature("   "), "unknown")
		assert.ok(normalizeStreamErrorSignature("x".repeat(1000)).length <= 160)
	})
})

describe("KB 08 #247 · 阈值与 error_retry 载荷", () => {
	it("阈值常量就是用户裁定的 N=3", () => {
		assert.equal(STREAM_ERROR_STREAK_THRESHOLD, 3)
	})

	it("第 3 次起升级；只写字段，不带任何阻断/退避动作", () => {
		assert.equal(isStreamErrorStreakEscalated({ signature: "e", streak: 2 }), false)
		assert.equal(isStreamErrorStreakEscalated({ signature: "e", streak: 3 }), true)
		assert.deepEqual(buildErrorRetryStreakFields(1), { streak: 1, streakThreshold: 3 })
		assert.deepEqual(buildErrorRetryStreakFields(3), { streak: 3, streakThreshold: 3, streakEscalated: true })
		const keys = Object.keys(buildErrorRetryStreakFields(9))
		assert.ok(!keys.includes("blocked"), "⛔ 不得阻断手动重试")
		assert.ok(!keys.includes("backoffMs"), "⛔ 不得加退避")
		assert.ok(!keys.includes("switchModel"), "⛔ 不得自动切模型")
	})

	it("无效 streak 返回空对象：老路径零改动", () => {
		for (const invalid of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			assert.deepEqual(buildErrorRetryStreakFields(invalid as number | undefined), {})
		}
	})
})

describe("KB 08 #247 · 跨实例累计（回放 28 次同因 stream_error）", () => {
	it("连续 28 次同签名：第 3 次起升级，计数一路到 28", () => {
		clearStreamErrorStreaks()
		const escalatedAt: number[] = []
		for (let i = 1; i <= 28; i++) {
			// 每次都当成一个「重建后的 Task 实例」：只带 taskId，不带任何实例状态。
			const state = recordStreamError("1793967201589", SAME_ERROR(`req-${i}-abcdef0123456789`))
			if (isStreamErrorStreakEscalated(state)) escalatedAt.push(state.streak)
		}
		assert.equal(peekStreamErrorStreak("1793967201589")?.streak, 28)
		assert.equal(escalatedAt[0], 3, "第 3 次就必须给出升级提示")
		assert.equal(escalatedAt.length, 26)
		assert.deepEqual(buildErrorRetryStreakFields(28), {
			streak: 28,
			streakThreshold: 3,
			streakEscalated: true,
		})
	})

	it("不同错误签名 / 不同任务不共用计数", () => {
		clearStreamErrorStreaks()
		recordStreamError("t1", SAME_ERROR("aaaaaaaaaaaaaaaa"))
		recordStreamError("t1", SAME_ERROR("bbbbbbbbbbbbbbbb"))
		assert.equal(recordStreamError("t1", "HTTP 429 rate limited").streak, 1, "换了错误种类就从 1 重新数")
		assert.equal(recordStreamError("t2", SAME_ERROR("cccccccccccccccc")).streak, 1)
		assert.equal(peekStreamErrorStreak("t1")?.streak, 1)
	})

	it("一次成功请求归零：隔了成功轮次不能显示「已连续 4 次」", () => {
		clearStreamErrorStreaks()
		recordStreamError("t1", SAME_ERROR("aaaaaaaaaaaaaaaa"))
		recordStreamError("t1", SAME_ERROR("bbbbbbbbbbbbbbbb"))
		assert.equal(peekStreamErrorStreak("t1")?.streak, 2)
		resetStreamErrorStreak("t1")
		assert.equal(peekStreamErrorStreak("t1"), undefined)
		assert.equal(recordStreamError("t1", SAME_ERROR("cccccccccccccccc")).streak, 1)
	})

	it("跟踪的任务数有上界，活跃任务不会被淘汰", () => {
		clearStreamErrorStreaks()
		for (let i = 0; i < 70; i++) recordStreamError(`bulk-${i}`, "same error")
		assert.equal(peekStreamErrorStreak("bulk-0"), undefined, "最早插入的已被淘汰")
		assert.equal(peekStreamErrorStreak("bulk-69")?.streak, 1, "最新任务必须还在")
		clearStreamErrorStreaks()
	})
})

describe("KB 08 #247 · 审计白名单与诊断包可见", () => {
	it("sanitizeAuditEntry 保留 streak / streakEscalated，非法值被清掉", () => {
		// 故意塞一个白名单外的正文类字段，验证审计脱敏纪律没被 #247 破坏。
		const entry = {
			event: "api",
			action: "stream_error_streak",
			taskId: "t1",
			streak: 28,
			streakEscalated: true,
			detail: "signature=beam empty,threshold=3",
			prompt: "must not leak",
		} as unknown as Parameters<typeof sanitizeAuditEntry>[0]
		const record = sanitizeAuditEntry(entry)
		assert.ok(record)
		assert.equal(record.streak, 28)
		assert.equal(record.streakEscalated, true)
		assert.equal(record.prompt, undefined)
		assert.equal(sanitizeAuditEntry({ event: "api", streak: Number.NaN })?.streak, undefined)
	})

	it("summarizeStreamErrorStreaks 只数目标事件，0 条也写进诊断头部", () => {
		const lines = [
			JSON.stringify({ event: "api", action: "stream_error", taskId: "t1" }),
			JSON.stringify({ event: "api", action: "stream_error_streak", taskId: "t1", streak: 2 }),
			JSON.stringify({ event: "api", action: "stream_error_streak", taskId: "t1", streak: 28, streakEscalated: true }),
			"{bad json",
		]
		const summary = summarizeStreamErrorStreaks(lines)
		assert.deepEqual(summary, { total: 2, maxStreak: 28, escalated: 1, tasks: 1 })
		const header = buildDiagnosticsHeader({
			extensionVersion: "3.102.0-test",
			streamErrorStreak: summary,
		})
		assert.match(header, /连续同因流式失败: 2 条（涉及 1 个任务，最长连续 28 次，达到升级阈值 1 条）/)
		const emptyHeader = buildDiagnosticsHeader({
			extensionVersion: "3.102.0-test",
			streamErrorStreak: summarizeStreamErrorStreaks([]),
		})
		assert.match(emptyHeader, /连续同因流式失败: 0 条/, "0 条也必须出现，否则分不清没发生和功能没接上")
	})
})

describe("KB 08 #247 · 接线元测试（防静默漏接）", () => {
	it("6 处 error_retry 载荷全部带升级字段", () => {
		const task = readRepo("src/core/task/index.ts")
		const payloads = task.match(/JSON\.stringify\(\{[\s\S]*?\}\)/g) ?? []
		const retryPayloads = payloads.filter((block) => block.includes("maxAttempts"))
		assert.equal(retryPayloads.length, 6, `error_retry 载荷数量变了，请同步本测试：${retryPayloads.length}`)
		for (const block of retryPayloads) {
			assert.match(block, /buildErrorRetryStreakFields\(/, "每个 error_retry 载荷都必须带连续失败字段")
		}
		assert.equal((task.match(/buildErrorRetryStreakFields\(peekStreamErrorStreak\(/g) ?? []).length, 6)
	})

	it("三条失败路径都推进计数，有内容的回合才归零", () => {
		const task = readRepo("src/core/task/index.ts")
		assert.equal(
			(task.match(/this\.recordStreamErrorStreak\(/g) ?? []).length,
			3,
			"首 chunk、中流、以及流走完但零内容的空响应各一处",
		)
		assert.match(
			task,
			/const assistantHasContent[\s\S]*?resetStreamErrorStreak\(this\.taskId\)/,
			"归零须在判定 assistantHasContent 之后，且仅在有内容分支",
		)
		assert.match(
			task,
			/const noResponseErrorMessage[\s\S]*?this\.recordStreamErrorStreak\(noResponseErrorMessage\)[\s\S]*?"error_retry"/,
			"空响应须在发 error_retry 前用稳定文案记一次",
		)
		assert.match(task, /action: "stream_error_streak"/, "审计必须有独立事件")
	})

	it("跨实例状态放在模块级 Map，不放 TaskState 实例字段", () => {
		const store = readRepo("src/core/task/stream-error-streak-store.ts")
		assert.match(store, /new Map<string, StreamErrorStreakState>\(\)/)
		assert.match(store, /reinitExistingTaskFromId/)
		assert.doesNotMatch(store, /taskState/)
	})

	it("ChatRow 消费升级字段，两份 locale 都有文案", () => {
		const row = readRepo("webview-ui/src/components/chat/ChatRow.tsx")
		assert.match(row, /streakEscalated === true/)
		assert.match(row, /t\("chatRow\.streamErrorStreak"/)
		for (const locale of ["zh-CN", "en"]) {
			const json = JSON.parse(readRepo(`webview-ui/src/locales/${locale}/common.json`))
			assert.match(json.chatRow.streamErrorStreak, /\{\{streak\}\}/, `${locale} 缺插值`)
			assert.match(json.chatRow.streamErrorStreak, /\{\{threshold\}\}/, `${locale} 缺插值`)
		}
	})

	it("⛔ 守住 #242：不自动清 pinnedModelId、不自动切模型、不退避、不阻断", () => {
		const shared = readRepo("src/shared/stream-error-streak.ts")
		const store = readRepo("src/core/task/stream-error-streak-store.ts")
		for (const source of [shared, store]) {
			assert.doesNotMatch(source, /pinnedModelId\s*=|clearApiConfigurationFields|buildFreeCandidateChain/)
			assert.doesNotMatch(source, /backoff|setTimeout|blockRetry|autoSwitch/)
		}
		const row = readRepo("webview-ui/src/components/chat/ChatRow.tsx")
		const block = row.match(/streakEscalated === true[\s\S]{0,600}/)?.[0] ?? ""
		assert.doesNotMatch(block, /disabled=|disabled>/, "升级提示不能把重试按钮禁用掉")
	})
})

/**
 * Shell 集成降级提示的节流状态机（任务 A2）。
 *
 * 纪律：只统计**真实发生**的降级（no_shell_integration），命令开始不记账；
 * 冷却期内必须静默，避免用户连跑几条命令就被反复打扰。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	createShellNoticeState,
	resolveShellNoticeMode,
	type ShellNoticeState,
} from "../../src/integrations/terminal/shellNotice"

const MINUTE = 60 * 1000

function resolveAt(now: number, state: ShellNoticeState) {
	return resolveShellNoticeMode(now, state)
}

test("首次降级给普通提示，并记录展示时间", () => {
	const t0 = 1_000_000_000_000
	const { mode, state } = resolveAt(t0, createShellNoticeState())

	assert.equal(mode, "warn")
	assert.equal(state.lastWarningShown, t0)
	assert.deepEqual(state.warnTimestamps, [t0])
})

test("5 分钟内重复降级保持静默，但仍记账", () => {
	const t0 = 1_000_000_000_000
	const first = resolveAt(t0, createShellNoticeState())
	const second = resolveAt(t0 + 2 * MINUTE, first.state)

	assert.equal(second.mode, "silent")
	assert.equal(second.state.lastWarningShown, t0, "静默不应刷新展示时间")
	assert.deepEqual(second.state.warnTimestamps, [t0, t0 + 2 * MINUTE])
})

test("冷却期结束后重新提示", () => {
	const t0 = 1_000_000_000_000
	const first = resolveAt(t0, createShellNoticeState())
	const later = resolveAt(t0 + 6 * MINUTE, first.state)

	assert.equal(later.mode, "warn")
	assert.equal(later.state.lastWarningShown, t0 + 6 * MINUTE)
})

test("1 小时内第 3 次降级升级为「建议切后台」", () => {
	const t0 = 1_000_000_000_000
	let state = createShellNoticeState()

	const first = resolveAt(t0, state)
	state = first.state
	assert.equal(first.mode, "warn")

	const second = resolveAt(t0 + 6 * MINUTE, state)
	state = second.state
	assert.equal(second.mode, "warn")

	const third = resolveAt(t0 + 12 * MINUTE, state)
	assert.equal(third.mode, "suggest")
	assert.equal(third.state.lastSuggestionShown, t0 + 12 * MINUTE)
})

test("同一统计窗口内只升级一次，之后回到普通提示", () => {
	const t0 = 1_000_000_000_000
	let state = createShellNoticeState()

	for (const offset of [0, 6 * MINUTE, 12 * MINUTE]) {
		state = resolveAt(t0 + offset, state).state
	}

	const fourth = resolveAt(t0 + 18 * MINUTE, state)
	assert.equal(fourth.mode, "warn")

	const fifth = resolveAt(t0 + 24 * MINUTE, fourth.state)
	assert.equal(fifth.mode, "warn")
})

test("窗口外的旧时间戳被清理，不会撑着升级", () => {
	const t0 = 1_000_000_000_000
	const stale = createShellNoticeState()
	stale.warnTimestamps = [t0 - 3 * 60 * MINUTE, t0 - 2 * 60 * MINUTE]

	const { mode, state } = resolveAt(t0, stale)

	assert.equal(mode, "warn")
	assert.deepEqual(state.warnTimestamps, [t0])
})

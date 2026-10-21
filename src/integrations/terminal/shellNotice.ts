/**
 * Shell 集成降级提示的节流状态机（纯函数，不依赖 vscode，便于单测）。
 *
 * 背景：VSCode 终端没有 Shell Integration 时，命令仍会执行，但输出改走
 * 「sendText + 等 3 秒 + 终端快照」兜底。上游实现每失败一次就插一条红框，
 * 且计数发生在命令开始时——用户连跑 3 条正常命令也会被建议切后台模式。
 *
 * 这里把「什么时候说、说多重」收成纯函数：
 * - silent  ：冷却期内不重复打扰；
 * - warn    ：普通提示（命令已执行，输出是快照读的）；
 * - suggest ：一小时内的第 N 次，升级为「建议切后台终端」。
 *
 * 注意：只有真正收到 no_shell_integration 才调用本函数；命令开始不记账。
 */

export type ShellNoticeMode = "silent" | "warn" | "suggest"

export interface ShellNoticeState {
	/** 最近一段时间内真实发生的降级警告时间戳 */
	warnTimestamps: number[]
	/** 上一次展示普通警告的时间 */
	lastWarningShown?: number
	/** 上一次展示「建议切后台」的时间 */
	lastSuggestionShown?: number
}

export interface ShellNoticeOptions {
	/** 同一类提示的最短间隔，默认 5 分钟 */
	warnCooldownMs?: number
	/** 统计窗口，默认 1 小时 */
	windowMs?: number
	/** 窗口内达到多少次升级为 suggest，默认 3 次 */
	suggestAfter?: number
}

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000
const DEFAULT_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_SUGGEST_AFTER = 3

export function createShellNoticeState(): ShellNoticeState {
	return { warnTimestamps: [] }
}

export function resolveShellNoticeMode(
	now: number,
	state: ShellNoticeState,
	options: ShellNoticeOptions = {},
): { mode: ShellNoticeMode; state: ShellNoticeState } {
	const warnCooldownMs = options.warnCooldownMs ?? DEFAULT_COOLDOWN_MS
	const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
	const suggestAfter = Math.max(1, options.suggestAfter ?? DEFAULT_SUGGEST_AFTER)

	// 只保留窗口内的记录，再把本次真实警告计入
	const warnTimestamps = state.warnTimestamps.filter((timestamp) => now - timestamp < windowMs)
	warnTimestamps.push(now)

	const withinCooldown = state.lastWarningShown !== undefined && now - state.lastWarningShown < warnCooldownMs
	const suggestionRecentlyShown = state.lastSuggestionShown !== undefined && now - state.lastSuggestionShown < windowMs

	if (!suggestionRecentlyShown && warnTimestamps.length >= suggestAfter) {
		return {
			mode: "suggest",
			state: {
				warnTimestamps,
				lastWarningShown: now,
				lastSuggestionShown: now,
			},
		}
	}

	if (withinCooldown) {
		return {
			mode: "silent",
			state: { ...state, warnTimestamps },
		}
	}

	return {
		mode: "warn",
		state: {
			...state,
			warnTimestamps,
			lastWarningShown: now,
		},
	}
}

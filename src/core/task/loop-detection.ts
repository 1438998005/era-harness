/**
 * Repeated tool call loop detection.
 *
 * Detects when the LLM calls the same tool with identical arguments
 * repeatedly, which wastes tokens without making progress.
 *
 * This is complementary to fileReadCache in ReadFileToolHandler, which
 * deduplicates file *content* on cache hits but still allows the tool
 * call to succeed and consume a turn. Loop detection catches the
 * repeated call pattern itself, regardless of which tool is involved.
 *
 * Shared between ToolExecutor (production) and tests so the
 * comparison algorithm cannot drift between the two.
 */

import type { TaskState } from "./TaskState"

// Soft threshold: inject a warning, giving the LLM one chance to self-correct.
// Hard threshold: escalate to user or fail task. Set higher to avoid false
// positives on tools that may legitimately repeat (e.g., browser_action screenshots).
export const LOOP_DETECTION_SOFT_THRESHOLD = 3
const LOOP_DETECTION_HARD_THRESHOLD = 5

// Windowed detection: the strict counter above resets on any different call, so a
// model can dodge it with "read A → read A → search → read A". Counting occurrences
// inside a sliding window closes that gap.
export const REPEAT_WINDOW_SIZE = 12
export const REPEAT_WINDOW_SOFT_COUNT = 3
export const REPEAT_WINDOW_HARD_COUNT = 5

// Tools whose repetition is normal conversational plumbing (no workspace side
// effects, arguments legitimately stable) and would otherwise trip the window.
const REPEAT_EXEMPT_TOOLS = new Set([
	"act_mode_respond",
	"plan_mode_respond",
	"attempt_completion",
	"new_task",
	"focus_chain",
	"condense",
	"summarize_task",
])

// Reads of the same file+range beyond this count return a short marker instead of
// the body: the model already has the content verbatim, so re-sending is pure cost.
export const REPEAT_READ_SUPPRESS_THRESHOLD = 3

// Params that are metadata/tracking, not tool-relevant input.
// These change between calls even when the user-facing arguments are identical
// (e.g., task_progress updates its checklist each turn).
const IGNORED_PARAMS = new Set(["task_progress"])

/**
 * Compute a canonical signature for a tool call's params.
 * Strips metadata fields and sorts keys via the JSON.stringify replacer
 * so key order doesn't affect comparison.
 *
 * block.params is Partial<Record<ToolParamName, string>> — always flat,
 * string-valued, no nesting — so the replacer array is sufficient.
 */
export function toolCallSignature(params: Partial<Record<string, string>> | undefined): string {
	if (!params) return "{}"
	const keys = Object.keys(params)
		.filter((k) => !IGNORED_PARAMS.has(k))
		.sort()
	return JSON.stringify(params, keys)
}

export interface LoopDetectionResult {
	softWarning: boolean
	hardEscalation: boolean
	/** Occurrences of this exact call inside the current window (0 for exempt tools). */
	windowCount: number
}

/**
 * Core loop detection step. Must be called BEFORE updating
 * lastToolName / lastToolParams on TaskState.
 *
 * Two independent signals feed the result:
 * 1. strict-consecutive count (legacy behaviour, unchanged thresholds);
 * 2. sliding-window count over the last REPEAT_WINDOW_SIZE calls, which
 *    survives interleaved different calls.
 */
export function checkRepeatedToolCall(state: TaskState, toolName: string, currentSignature: string): LoopDetectionResult {
	if (toolName === state.lastToolName && currentSignature === state.lastToolParams) {
		state.consecutiveIdenticalToolCount++
	} else {
		state.consecutiveIdenticalToolCount = 1
	}

	const repeatKey = `${toolName}\u0000${currentSignature}`
	let windowCount = 0
	if (!REPEAT_EXEMPT_TOOLS.has(toolName)) {
		state.recentToolSignatures.push({ name: toolName, signature: currentSignature })
		const overflow = state.recentToolSignatures.length - REPEAT_WINDOW_SIZE
		if (overflow > 0) {
			state.recentToolSignatures.splice(0, overflow)
		}
		windowCount = state.recentToolSignatures.filter(
			(entry) => entry.name === toolName && entry.signature === currentSignature,
		).length
	}

	// Soft warning fires once per tool+signature so the model is nudged, not spammed.
	const windowSoft = windowCount >= REPEAT_WINDOW_SOFT_COUNT && !state.warnedRepeatSignatures.has(repeatKey)
	const softWarning = state.consecutiveIdenticalToolCount === LOOP_DETECTION_SOFT_THRESHOLD || windowSoft
	if (softWarning) {
		state.warnedRepeatSignatures.add(repeatKey)
	}

	return {
		softWarning,
		hardEscalation:
			state.consecutiveIdenticalToolCount === LOOP_DETECTION_HARD_THRESHOLD || windowCount >= REPEAT_WINDOW_HARD_COUNT,
		windowCount,
	}
}

/**
 * Forget repetition history that targeted a file the agent just modified.
 * Without this, an "edit → re-read" sequence looks like a read loop and the
 * third read would be suppressed even though the content really did change.
 */
export function invalidateRepeatWindowForPath(state: TaskState, filePath: string | undefined): void {
	if (!filePath) return
	const needle = filePath.toLowerCase()

	state.recentToolSignatures = state.recentToolSignatures.filter((entry) => !entry.signature.toLowerCase().includes(needle))

	const prefix = `${needle}|`
	for (const key of Array.from(state.fileReadCounts.keys())) {
		if (key.startsWith(prefix)) {
			state.fileReadCounts.delete(key)
		}
	}

	// Stale warnings would silence a genuine loop on the new content; cheap to rebuild.
	state.warnedRepeatSignatures.clear()
}

/** Whether a same-range read has happened often enough to stop re-sending the body. */
export function shouldSuppressRepeatRead(readCount: number): boolean {
	return Number.isFinite(readCount) && readCount >= REPEAT_READ_SUPPRESS_THRESHOLD
}

/** Short marker returned instead of the file body once a repeat read is suppressed. */
export function repeatReadSuppressedMessage(displayPath: string, readCount: number): string {
	return `[SAME CONTENT] '${displayPath}' 该区间已读取 ${readCount} 次，内容与首次完全一致（mtime 未变）。\n不要重复读取同一区间：需要其它部分请用 start_line/end_line，或直接基于已读内容继续。`
}

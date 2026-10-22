/**
 * 重复调用检测（工作流 A1）与重复读降级判据（A2）。
 *
 * 纪律：
 * - 老的「严格连续」仍保留（兼容既有阈值）；
 * - 新增「滑动窗口」：模型按「读 A → 读 A → 搜一下 → 读 A」的节奏也必须被抓到；
 * - 同一文件的不同区间是正常读取，不能算重复。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	checkRepeatedToolCall,
	extractApplyPatchPaths,
	invalidateRepeatWindowForPath,
	LOOP_DETECTION_SOFT_THRESHOLD,
	nextRepeatReadCount,
	REPEAT_READ_SUPPRESS_THRESHOLD,
	REPEAT_WINDOW_HARD_COUNT,
	REPEAT_WINDOW_SIZE,
	repeatReadSuppressedMessage,
	shouldSuppressRepeatRead,
	toolCallSignature,
} from "../../src/core/task/loop-detection"
import type { TaskState } from "../../src/core/task/TaskState"

/** 只构造检测算法真正读写的字段，避免把整个 Anthropic SDK 拖进测试。 */
function createState(): TaskState {
	return {
		lastToolName: "",
		lastToolParams: "",
		consecutiveIdenticalToolCount: 0,
		recentToolSignatures: [],
		warnedRepeatSignatures: new Set<string>(),
		fileReadCounts: new Map<string, number>(),
	} as unknown as TaskState
}

function call(state: TaskState, name: string, params: Record<string, string>) {
	const signature = toolCallSignature(params)
	const result = checkRepeatedToolCall(state, name, signature)
	state.lastToolName = name
	state.lastToolParams = signature
	return result
}

const READ_A = { path: "ERB/A.ERB", start_line: "1", end_line: "100" }
const READ_B = { path: "ERB/B.ERB", start_line: "1", end_line: "100" }

test("连续 3 次相同调用触发软警告", () => {
	const state = createState()

	assert.equal(call(state, "read_file", READ_A).softWarning, false)
	assert.equal(call(state, "read_file", READ_A).softWarning, false)
	const third = call(state, "read_file", READ_A)

	assert.equal(third.softWarning, true)
	assert.equal(third.hardEscalation, false)
	assert.equal(third.windowCount, LOOP_DETECTION_SOFT_THRESHOLD)
})

test("间歇重复（A, A, B, A）在窗口内同样触发软警告", () => {
	const state = createState()

	call(state, "read_file", READ_A)
	call(state, "read_file", READ_A)
	call(state, "search_files", { path: "ERB" }) // 打断严格连续计数
	assert.equal(state.consecutiveIdenticalToolCount, 1, "严格计数已被打断")

	const thirdRead = call(state, "read_file", READ_A)
	assert.equal(thirdRead.softWarning, true, "窗口计数必须仍然抓到")
	assert.equal(thirdRead.windowCount, 3)
})

test("软警告对同一调用只发一次，不刷屏", () => {
	const state = createState()

	call(state, "read_file", READ_A)
	call(state, "read_file", READ_A)
	assert.equal(call(state, "read_file", READ_A).softWarning, true)
	assert.equal(call(state, "read_file", READ_A).softWarning, false)
})

test("窗口内 5 次相同调用升级为硬升级，且不同区间不误判", () => {
	const state = createState()

	call(state, "read_file", READ_A)
	call(state, "read_file", READ_B)
	call(state, "read_file", READ_A)
	call(state, "read_file", READ_B)
	call(state, "read_file", READ_A)
	call(state, "read_file", READ_B) // A=3, B=3，均只软警告
	call(state, "read_file", READ_A)
	const fifthA = call(state, "read_file", READ_A)

	assert.equal(fifthA.windowCount, REPEAT_WINDOW_HARD_COUNT)
	assert.equal(fifthA.hardEscalation, true)

	// 同文件、不同行区间 = 不同签名，各算各的
	const state2 = createState()
	call(state2, "read_file", { path: "ERB/A.ERB", start_line: "1", end_line: "100" })
	call(state2, "read_file", { path: "ERB/A.ERB", start_line: "1", end_line: "100" })
	const otherRange = call(state2, "read_file", { path: "ERB/A.ERB", start_line: "101", end_line: "200" })
	assert.equal(otherRange.softWarning, false)
	assert.equal(otherRange.windowCount, 1)
})

test("窗口长度有界，旧记录被裁掉", () => {
	const state = createState()

	for (let i = 0; i < REPEAT_WINDOW_SIZE * 3; i++) {
		call(state, "list_files", { path: `ERB/dir${i}` })
	}

	assert.equal(state.recentToolSignatures.length, REPEAT_WINDOW_SIZE)
})

test("对话类工具不进窗口计数，但严格连续仍然生效", () => {
	const state = createState()

	for (let i = 0; i < 4; i++) {
		const result = call(state, "act_mode_respond", { response: "same" })
		assert.equal(result.windowCount, 0)
		assert.equal(result.hardEscalation, false)
	}
	assert.equal(state.recentToolSignatures.length, 0)
	assert.equal(state.consecutiveIdenticalToolCount, 4, "严格连续计数仍然生效")
})

test("依赖元数据的参数不影响签名（task_progress 被忽略）", () => {
	const withProgress = toolCallSignature({ path: "ERB/A.ERB", task_progress: "第一条" })
	const withoutProgress = toolCallSignature({ path: "ERB/A.ERB" })

	assert.equal(withProgress, withoutProgress)

	// 键顺序不影响签名
	assert.equal(toolCallSignature({ path: "a", start_line: "1" }), toolCallSignature({ start_line: "1", path: "a" }))
})

test("编辑文件后只清该文件的重读历史与计数（不误伤同名前缀）", () => {
	const state = createState()
	const path = "ERB/A.ERB"

	call(state, "read_file", { path, start_line: "1", end_line: "100" })
	state.fileReadCounts.set("erb/a.erb|1|100", 3)
	state.fileReadCounts.set("d:/work/erb/a.erb|1|100", 3)
	state.fileReadCounts.set("d:/work/xerb/a.erb|1|100", 2)
	state.fileReadCounts.set("erb/b.erb|1|100", 2)
	state.recentToolSignatures.push({ name: "read_file", signature: toolCallSignature({ path: "ERB/AX.ERB" }) })
	state.warnedRepeatSignatures.add(`read_file\u0000${toolCallSignature({ path: "ERB/A.ERB" })}`)
	state.warnedRepeatSignatures.add(`read_file\u0000${toolCallSignature({ path: "ERB/AX.ERB" })}`)

	invalidateRepeatWindowForPath(state, path)

	assert.equal(state.recentToolSignatures.length, 1, "只清掉该文件自己的读历史（同前缀 AX 保留）")
	assert.equal(state.fileReadCounts.get("erb/a.erb|1|100"), undefined, "相对路径键被清")
	assert.equal(state.fileReadCounts.get("d:/work/erb/a.erb|1|100"), undefined, "绝对路径键按分隔符边界匹配")
	assert.equal(state.fileReadCounts.get("d:/work/xerb/a.erb|1|100"), 2, "同前缀的其它目录不受影响")
	assert.equal(state.fileReadCounts.get("erb/b.erb|1|100"), 2, "其它文件不受影响")
	assert.equal(state.warnedRepeatSignatures.size, 1, "只丢掉与该文件相关的警告记录")
})

test("路径分隔符与大小写不同也能失效重读历史", () => {
	const state = createState()
	state.recentToolSignatures.push({ name: "read_file", signature: toolCallSignature({ path: "ERB\\Sub\\A.ERB" }) })

	invalidateRepeatWindowForPath(state, "./erb/sub/a.erb")

	assert.equal(state.recentToolSignatures.length, 0)
})

test("apply_patch 从 patch 文本提取受影响路径，从而能失效读历史", () => {
	const patch = [
		"*** Begin Patch",
		"*** Update File: ERB/A.ERB",
		"@@",
		"-old",
		"+new",
		"*** Add File: ERB/B.ERB",
		"+content",
		"*** Move to: ERB/C.ERB",
		"*** End Patch",
	].join("\n")

	const paths = extractApplyPatchPaths(patch)
	assert.deepEqual(paths.sort(), ["ERB/A.ERB", "ERB/B.ERB", "ERB/C.ERB"])
	assert.deepEqual(extractApplyPatchPaths(undefined), [])
	assert.deepEqual(extractApplyPatchPaths("*** Begin Patch\n*** End Patch"), [])
})

test("同区间计数：首读播种为 1，第 3 次才降级（不再晚一拍）", () => {
	const counts: number[] = []
	let previous: number | undefined

	// 第 1 次：首读，播种 1
	const first = nextRepeatReadCount(previous, true)
	counts.push(first)
	previous = first

	// 第 2、3 次：缓存命中，+1
	for (let i = 0; i < 2; i++) {
		const next = nextRepeatReadCount(previous, false)
		counts.push(next)
		previous = next
	}

	assert.deepEqual(counts, [1, 2, 3])
	assert.equal(shouldSuppressRepeatRead(counts[1]), false, "第 2 次仍回正文")
	assert.equal(shouldSuppressRepeatRead(counts[2]), true, "第 3 次只回 [SAME CONTENT]")
})

test("重复读降级判据：第 3 次起只回标记", () => {
	assert.equal(shouldSuppressRepeatRead(0), false)
	assert.equal(shouldSuppressRepeatRead(1), false)
	assert.equal(shouldSuppressRepeatRead(2), false)
	assert.equal(shouldSuppressRepeatRead(REPEAT_READ_SUPPRESS_THRESHOLD), true)
	assert.equal(shouldSuppressRepeatRead(4), true)
	assert.equal(shouldSuppressRepeatRead(Number.NaN), false, "未知计数不应误降级")

	const message = repeatReadSuppressedMessage("ERB/A.ERB", 3)
	assert.match(message, /\[SAME CONTENT\]/)
	assert.match(message, /ERB\/A\.ERB/)
	assert.match(message, /3 次/)
	assert.match(message, /start_line\/end_line/)
})

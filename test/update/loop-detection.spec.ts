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
	commitRangeRead,
	extractApplyPatchPaths,
	invalidateRepeatWindowForPath,
	isSuppressedRepeatReadResult,
	LOOP_DETECTION_SOFT_THRESHOLD,
	parseSuppressedRepeatReadResult,
	REPEAT_READ_SUPPRESS_THRESHOLD,
	REPEAT_SUPPRESSED_HARD_COUNT,
	REPEAT_WINDOW_HARD_COUNT,
	REPEAT_WINDOW_SIZE,
	readDedupeKey,
	readRangeKey,
	repeatReadSuppressedMessage,
	shouldEscalateLoop,
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
	// 旧实现是子串匹配：编辑 A.ERB 会把它误清掉（A.ERB.bak 包含 A.ERB）
	state.recentToolSignatures.push({ name: "read_file", signature: toolCallSignature({ path: "ERB/A.ERB.bak" }) })
	state.recentToolSignatures.push({ name: "read_file", signature: toolCallSignature({ path: "ERB/AX.ERB" }) })
	state.warnedRepeatSignatures.add(`read_file\u0000${toolCallSignature({ path: "ERB/A.ERB" })}`)
	state.warnedRepeatSignatures.add(`read_file\u0000${toolCallSignature({ path: "ERB/AX.ERB" })}`)

	invalidateRepeatWindowForPath(state, path)

	assert.equal(state.recentToolSignatures.length, 2, "只清掉该文件自己的读历史（A.ERB.bak / AX 保留）")
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
	const counts = new Map<string, number>()
	const cacheKey = "d:/work/erb/a.erb"
	const rangeKey = `${cacheKey}|1|100`

	// 首读：播种 1，且清掉该文件的其它区间计数
	counts.set(`${cacheKey}|200|300`, 4)
	assert.equal(commitRangeRead(counts, cacheKey, rangeKey, true), 1)
	assert.equal(counts.get(`${cacheKey}|200|300`), undefined, "首读重置该文件的其它区间计数")

	// 第 2、3 次：缓存命中
	const second = commitRangeRead(counts, cacheKey, rangeKey, false)
	const third = commitRangeRead(counts, cacheKey, rangeKey, false)

	assert.equal(second, 2)
	assert.equal(third, 3)
	assert.equal(shouldSuppressRepeatRead(second), false, "第 2 次仍回正文")
	assert.equal(shouldSuppressRepeatRead(third), true, "第 3 次只回 [SAME CONTENT]")
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

test("区间键归一：缺省 start 与 start_line=1 累加到同一个键", () => {
	const cacheKey = "d:/work/erb/a.erb"
	assert.equal(readRangeKey(cacheKey), readRangeKey(cacheKey, 1), "缺省 start 等价于 1")
	assert.equal(readRangeKey(cacheKey, 0), readRangeKey(cacheKey, 1), "start_line=0 展示时也按 1 处理")
	assert.notEqual(readRangeKey(cacheKey, 2), readRangeKey(cacheKey, 1), "不同区间仍是不同键")

	const counts = new Map<string, number>()
	// 模型在「整文件读」与「start_line=1」之间来回切，计数必须连续累加
	assert.equal(commitRangeRead(counts, cacheKey, readRangeKey(cacheKey), false), 1)
	assert.equal(commitRangeRead(counts, cacheKey, readRangeKey(cacheKey, 1), false), 2)
	assert.equal(commitRangeRead(counts, cacheKey, readRangeKey(cacheKey, 1), false), 3)
	assert.equal(shouldSuppressRepeatRead(3), true, "第 3 次必须降级，不能因写法不同绕过")
})

test("read_file 签名归一：缺省区间与 start_line=1 视为同一次调用", () => {
	const base = { path: "ERB/A.ERB" }
	assert.equal(toolCallSignature(base, "read_file"), toolCallSignature({ ...base, start_line: "1" }, "read_file"))
	assert.equal(toolCallSignature(base, "read_file"), toolCallSignature({ ...base, start_line: "0" }, "read_file"))
	assert.equal(toolCallSignature(base, "read_file"), toolCallSignature({ ...base, end_line: "" }, "read_file"))
	assert.notEqual(
		toolCallSignature(base, "read_file"),
		toolCallSignature({ ...base, start_line: "2" }, "read_file"),
		"不同区间仍是不同调用",
	)

	// 不传 toolName 时保持旧行为：其它工具的 start_line 语义未必等价于缺省
	assert.notEqual(toolCallSignature(base), toolCallSignature({ ...base, start_line: "1" }))
})

/**
 * 第 3 次同区间读起只回 `[SAME CONTENT]` 短标记（本回合几乎零 token 成本），
 * 但第 5 次会撞上 `consecutiveIdenticalToolCount === 5` → `consecutiveMistakeCount = max`
 * → yolo 模式下任务**直接失败**。等于「已经止损了还判死」。
 *
 * 判据：已降级的读不参与判死，但要到同一区间第 8 次读才真正升级（真正的死循环仍然要停住）。
 */
test("降级读不参与第 5 次判死，第 8 次才升级", () => {
	const state = createState()
	const counts = new Map<string, number>()
	const cacheKey = "d:/work/erb/a.erb"
	const signature = toolCallSignature(READ_A, "read_file")
	const rangeKey = readRangeKey(cacheKey, 1, 100)

	const trace: Array<{ read: number; suppressed: boolean; escalated: boolean }> = []

	for (let read = 1; read <= REPEAT_SUPPRESSED_HARD_COUNT; read++) {
		const loopCheck = checkRepeatedToolCall(state, "read_file", signature)
		state.lastToolName = "read_file"
		state.lastToolParams = signature

		const count = commitRangeRead(counts, cacheKey, rangeKey, read === 1)
		const response = shouldSuppressRepeatRead(count) ? repeatReadSuppressedMessage("ERB/A.ERB", count) : "文件正文"

		trace.push({
			read,
			suppressed: isSuppressedRepeatReadResult(response),
			escalated: shouldEscalateLoop({
				hardEscalation: loopCheck.hardEscalation,
				toolName: "read_file",
				response,
			}),
		})
	}

	assert.deepEqual(
		trace.map((step) => step.suppressed),
		[false, false, true, true, true, true, true, true],
		"第 1、2 次回正文，第 3 次起只回 [SAME CONTENT]",
	)

	// 第 5 次：hardEscalation 本身为真（老逻辑就在这一拍把任务判死）
	assert.equal(trace[4].read, 5)
	assert.equal(trace[4].escalated, false, "已经降级的读不该把任务判死")
	assert.equal(trace[REPEAT_SUPPRESSED_HARD_COUNT - 1].escalated, true, "第 8 次仍然要停住")
})

/**
 * 第六轮审查指出的真洞（我的回归）：
 *
 * 上一版拿 `windowCount >= 8` 当「延后判死」的判据，但 `windowCount` = 最近 12 条非豁免调用里
 * 同签名的条数，而 `读A/命令/读A/命令` 交替下该签名**最多只占 6 槽**（`ceil(12/2)`），
 * `>= 8` 结构不可达。更要命的是：第一次 `hardEscalation` 为真的那一拍（第 5 次读，
 * `windowCount=5`）响应**必然已降级**，于是 `shouldEscalateLoop` 返回 false 且此后再无
 * 机会为真 → 判死从此永不触发（改之前第 5 次就停）。
 *
 * 所以判据必须换成与窗口占空比无关的量：`commitRangeRead` 的区间累计次数。
 * 本用例就是那个洞的回归网——纯重复 8 次恰好落在「能达成 8」的路径上，测不到它。
 */
test("交替读/命令时判死仍然可达：16 轮内必然在第 8 次读升级", () => {
	const state = createState()
	const counts = new Map<string, number>()
	const cacheKey = "d:/work/erb/a.erb"
	const rangeKey = readRangeKey(cacheKey, 1, 100)
	const signature = toolCallSignature(READ_A, "read_file")
	const escalatedAt: number[] = []
	let read = 0

	for (let round = 0; round < 16; round++) {
		read++
		const loopCheck = checkRepeatedToolCall(state, "read_file", signature)
		state.lastToolName = "read_file"
		state.lastToolParams = signature

		const count = commitRangeRead(counts, cacheKey, rangeKey, read === 1)
		const response = shouldSuppressRepeatRead(count) ? repeatReadSuppressedMessage("ERB/A.ERB", count) : "文件正文"

		if (shouldEscalateLoop({ hardEscalation: loopCheck.hardEscalation, toolName: "read_file", response })) {
			escalatedAt.push(read)
		}

		// 中间插一条命令：不同签名、非豁免工具，占掉窗口里的另一槽
		const commandParams = { command: `echo ${round}` }
		const commandSignature = toolCallSignature(commandParams)
		const commandCheck = checkRepeatedToolCall(state, "execute_command", commandSignature)
		state.lastToolName = "execute_command"
		state.lastToolParams = commandSignature
		assert.equal(
			shouldEscalateLoop({ hardEscalation: commandCheck.hardEscalation, toolName: "execute_command", response: "ok" }),
			false,
			`第 ${round + 1} 轮的命令不该被判死`,
		)
	}

	assert.equal(
		escalatedAt[0],
		REPEAT_SUPPRESSED_HARD_COUNT,
		"首次升级必须落在第 8 次读：早一拍是把刹车提前，晚一拍就是放行死循环",
	)
	assert.equal(escalatedAt.length, 16 - REPEAT_SUPPRESSED_HARD_COUNT + 1, "越过阈值后每次读都应判死（升级后不回退）")
})

/**
 * 判据与文案同源，但**机器字段必须独占首行**：路径里可能有 `'`（`O'Brien.ts`），
 * 一旦首行要把路径框进引号，这类路径就会解析失败 → 退回第 5 次判死。
 */
test("降级标记的机器字段独占首行，且只对 read_file 生效", () => {
	const marker = repeatReadSuppressedMessage("ERB/O'Brien.ERB", 3)

	assert.equal(marker.split("\n")[0], "[SAME CONTENT] read=3", "首行必须是可解析的机器字段")
	assert.equal(parseSuppressedRepeatReadResult(marker).readCount, 3)
	assert.equal(parseSuppressedRepeatReadResult(marker.replace(/\n/g, "\r\n")).readCount, 3, "CRLF 也要认")
	assert.equal(parseSuppressedRepeatReadResult([{ text: marker }]).readCount, 3, "内容块数组形态也要认")
	assert.equal(parseSuppressedRepeatReadResult("[SAME CONTENT] 旧格式没有 read 字段").suppressed, false)
	assert.equal(parseSuppressedRepeatReadResult("[SAME CONTENT] read=3 后面还有散文").suppressed, false)
	assert.equal(parseSuppressedRepeatReadResult("文件正文\n[SAME CONTENT] read=3").suppressed, false, "标记必须在首行")

	// 别的工具回了一段恰好以标记开头的内容，不能拿到延后判死的豁免
	assert.equal(shouldEscalateLoop({ hardEscalation: true, toolName: "execute_command", response: marker }), true)
	assert.equal(shouldEscalateLoop({ hardEscalation: true, toolName: "read_file", response: marker }), false)
	assert.equal(
		shouldEscalateLoop({ hardEscalation: true, toolName: "read_file", response: repeatReadSuppressedMessage("a", 8) }),
		true,
		"第 8 次仍要停住",
	)
})

test("未降级的重复读仍按老规则判死，且不升级时不误报", () => {
	assert.equal(
		shouldEscalateLoop({ hardEscalation: true, toolName: "read_file", response: "文件正文" }),
		true,
		"没降级的第 5 次重复读照旧判死",
	)
	assert.equal(
		shouldEscalateLoop({ hardEscalation: false, toolName: "read_file", response: repeatReadSuppressedMessage("a", 8) }),
		false,
		"检测器没要求升级时不能自作主张",
	)
	// 数组形态的响应也要能识别（handler 有时返回内容块数组）
	assert.equal(isSuppressedRepeatReadResult([{ text: repeatReadSuppressedMessage("a", 3) }]), true)
	assert.equal(isSuppressedRepeatReadResult(undefined), false)
})

/**
 * 同一次 read_file 会写两条审计（ToolExecutor 一条 + handler 缓存命中一条），
 * 两处 dedupeKey 拼法必须一致，否则「缺省 start」与 `start_line=1` 会被分成两组。
 */
test("审计 dedupeKey 与区间键同源：缺省 start 与 start_line=1 必须同键", () => {
	assert.equal(readDedupeKey("ERB/A.ERB"), "read|ERB/A.ERB|1|")
	assert.equal(readDedupeKey("ERB/A.ERB", 1), "read|ERB/A.ERB|1|")
	assert.equal(readDedupeKey("ERB/A.ERB", 0), "read|ERB/A.ERB|1|")
	assert.equal(readDedupeKey("ERB/A.ERB", 1, 100), "read|ERB/A.ERB|1|100")
	assert.notEqual(readDedupeKey("ERB/A.ERB", 2, 100), readDedupeKey("ERB/A.ERB", 1, 100))
})

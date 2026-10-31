/**
 * 08 #87：`<task_progress>` 复读要计进熔断。
 *
 * 背景：模型把整段进度清单当正文吐出来时，解析器会把标签连同内容**剥掉**（不展示），
 * 于是本回合既没有工具、也没有可见输出——UI 上看不出发生过什么，模型下一轮继续复读。
 * 现在剥掉的字数会进 ParseRepairStats；超过阈值就计一次 mistake。
 *
 * 两个必须守住的量：
 * 1. 阈值边界（>200 才计，200 整不计）——正常顺手带一句进度不能误伤；
 * 2. 统计口径是**单次最大**而非累加：流式每个 chunk 都会拿已累积全文重解析，
 *    累加会把一段 300 字记成几万，熔断理由里的数字就成了假的。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { createParseRepairStats, parseAssistantMessageV2 } from "../../src/core/assistant-message"
import { shouldCountTaskProgressAsMistake, TASK_PROGRESS_MISTAKE_CHARS } from "../../src/core/task/loop-detection"

test("阈值边界：200 整不计，201 起计", () => {
	assert.equal(TASK_PROGRESS_MISTAKE_CHARS, 200)
	assert.equal(shouldCountTaskProgressAsMistake(0), false)
	assert.equal(shouldCountTaskProgressAsMistake(199), false)
	assert.equal(shouldCountTaskProgressAsMistake(200), false, "等于阈值不计（> 才计）")
	assert.equal(shouldCountTaskProgressAsMistake(201), true)
})

test("非法输入不误判：NaN / Infinity / 负数", () => {
	assert.equal(shouldCountTaskProgressAsMistake(Number.NaN), false)
	assert.equal(shouldCountTaskProgressAsMistake(Number.POSITIVE_INFINITY), false)
	assert.equal(shouldCountTaskProgressAsMistake(-1), false)
})

test("解析后统计被剥掉的字数（单次 = 整段清单体积）", () => {
	const raw = "先做第一步。\n<task_progress>\n- 条目一：已完成\n- 条目二：进行中\n</task_progress>\n然后继续。"
	const stats = createParseRepairStats()
	const blocks = parseAssistantMessageV2(raw, stats)

	assert.equal(stats.taskProgressStrip, 1, "应记一次剥离")
	assert.equal(stats.taskProgressStrippedChars, raw.length - "先做第一步。\n\n然后继续。".length, "字数为被剥掉的那一段")
	// 正文保留、清单不可见
	const text = blocks
		.filter((b) => b.type === "text")
		.map((b) => (b as { content?: string }).content ?? "")
		.join("")
	assert.ok(text.includes("先做第一步"))
	assert.ok(!text.includes("条目一"), "清单内容不应展示")
})

test("流式重解析：统计取最大单次，不随 chunk 次数累加", () => {
	const stats = createParseRepairStats()
	// 模拟同一轮里连续三次重解析已累积的消息（块逐步变长）
	const chunky1 = "开始。\n<task_progress>\n- 条目一\n"
	const chunky2 = "开始。\n<task_progress>\n- 条目一\n- 条目二\n"
	const chunky3 = "开始。\n<task_progress>\n- 条目一\n- 条目二\n</task_progress>\n结束。"
	for (const text of [chunky1, chunky2, chunky3]) {
		parseAssistantMessageV2(text, stats)
	}

	const expectedMax = chunky3.length - "开始。\n\n结束。".length
	assert.equal(stats.taskProgressStrippedChars, expectedMax, "应等于最大一次剥离，而不是三次之和")
	assert.ok(stats.taskProgressStrip >= 3, "剥离次数仍是逐次计数")
})

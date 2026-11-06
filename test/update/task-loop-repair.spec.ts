import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { createParseRepairStats, parseAssistantMessageV2 } from "../../src/core/assistant-message"
import { shouldCountNoToolsUsedAsMistake } from "../../src/core/task/loop-detection"

/**
 * KB 08 #245 / #246：实弹跑分里观察到的两处插件侧开销。
 *
 * #245 用户裁定「不动契约，只统一计数」：noToolsUsed 注入照旧（agentic loop 的
 * 结束契约），但 mistake 计数只能有一个判定入口，且「答完了但没走 attempt_completion」
 * 不能被误计为错误。
 *
 * #246 用户裁定「只修统计口径」：系统提示本来就把 `<task_progress>` 定义为**工具调用
 * 内部的 parameter**（system-prompt/types.ts + hermes/overrides.ts），嵌在工具标签里是
 * 合法形状，不该被记成 parse 修复、不该推高 #87 的字数阈值；只有正文里独立成段才算。
 * ⛔ 系统提示一字不改。
 */

function repoRoot(): string {
	const fromCwd = path.resolve(process.cwd(), "src", "core", "task", "index.ts")
	if (fs.existsSync(fromCwd)) return process.cwd()
	return path.join(__dirname, "..", "..")
}

function readRepo(relative: string): string {
	return fs.readFileSync(path.join(repoRoot(), relative), "utf8")
}

/** 结构性断言只看真代码：#245 的注释里刻意留了「这里曾无条件 ++」的历史字样。 */
function stripComments(code: string): string {
	return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

describe("KB 08 #245 · noToolsUsed 的 mistake 计数单源", () => {
	it("零文本零思考空转才计错误", () => {
		assert.equal(shouldCountNoToolsUsedAsMistake([], undefined), true)
		assert.equal(shouldCountNoToolsUsedAsMistake([{ type: "text", content: "   \n " }], undefined), true)
		assert.equal(shouldCountNoToolsUsedAsMistake([{ type: "tool_use" }], undefined), true)
	})

	it("已给出完整答案 / 有思考内容都不计错误", () => {
		assert.equal(shouldCountNoToolsUsedAsMistake([{ type: "text", content: "17 行路径\n命中总数：17" }], undefined), false)
		assert.equal(shouldCountNoToolsUsedAsMistake([], "  "), true)
		assert.equal(shouldCountNoToolsUsedAsMistake([], "正在规划下一步"), false)
		assert.equal(
			shouldCountNoToolsUsedAsMistake([{ type: "text", content: 42 }], undefined),
			true,
			"非字符串 content 不算有效文本",
		)
	})

	it("结构性：主循环尾部不再无条件累加，结束契约仍在", () => {
		const task = readRepo("src/core/task/index.ts")
		const start = task.indexOf("private async initiateTaskLoop")
		const end = task.indexOf("async recursivelyMakeClineRequests")
		assert.ok(start > 0 && end > start, "没找到任务循环方法边界")
		const loop = stripComments(task.slice(start, end))
		assert.match(loop, /formatResponse\.noToolsUsed\(/, "noToolsUsed 收尾提示必须保留（不改契约）")
		assert.doesNotMatch(loop, /consecutiveMistakeCount\+\+/, "⛔ 不得退回无条件累加")
		assert.equal((task.match(/formatResponse\.noToolsUsed\(/g) ?? []).length, 2, "两处注入路径都还在")
	})

	it("结构性：唯一的 mistake 累加点走纯函数", () => {
		const task = readRepo("src/core/task/index.ts")
		assert.match(
			task,
			/if \(shouldCountNoToolsUsedAsMistake\([\s\S]{0,240}?\) \{\s*this\.taskState\.consecutiveMistakeCount\+\+/,
			"计数判定必须与 loop-detection 的纯函数同源",
		)
		const loopDetection = readRepo("src/core/task/loop-detection.ts")
		assert.match(loopDetection, /export function shouldCountNoToolsUsedAsMistake/)
	})
})

describe("KB 08 #246 · task_progress 合法参数与正文独立段分开统计", () => {
	const toolParamBlock = [
		"<list_files>",
		"<path>ERB</path>",
		"<task_progress>",
		"- 条目一：已完成",
		"- 条目二：进行中",
		"</task_progress>",
		"</list_files>",
	].join("\n")

	it("工具标签内部的 task_progress 是合法形状，不计 parse 修复", () => {
		const stats = createParseRepairStats()
		const blocks = parseAssistantMessageV2(toolParamBlock, stats)
		assert.equal(stats.taskProgressInTool, 1, "合法参数应单独记数")
		assert.equal(stats.taskProgressStrip, 0, "⛔ 不得记成正文剥离 / parse 修复")
		assert.equal(stats.taskProgressStrippedChars, 0, "⛔ 不得推高 #87 的字数阈值")
		const serialized = JSON.stringify(blocks)
		assert.match(serialized, /ERB/, "工具参数 path 不能被剥离误伤")
		assert.ok(!serialized.includes("条目一"), "进度清单不进解析结果")
	})

	it("正文里独立成段仍按 #87 口径计入 parse 修复", () => {
		const raw = "先做第一步。\n<task_progress>\n- 条目一：已完成\n</task_progress>\n然后继续。"
		const stats = createParseRepairStats()
		parseAssistantMessageV2(raw, stats)
		assert.equal(stats.taskProgressStrip, 1)
		assert.equal(stats.taskProgressInTool, 0, "⛔ 正文段不能倒灌进合法参数计数")
		assert.ok(stats.taskProgressStrippedChars > 0)
	})

	it("同一回合两种形状并存时各自归位，字数只算正文块", () => {
		const stats = createParseRepairStats()
		parseAssistantMessageV2(`<task_progress>\n- 正文清单\n</task_progress>\n${toolParamBlock}`, stats)
		assert.equal(stats.taskProgressStrip, 1)
		assert.equal(stats.taskProgressInTool, 1)
		const standaloneOnly = "<task_progress>\n- 正文清单\n</task_progress>".length
		assert.equal(stats.taskProgressStrippedChars, standaloneOnly, "合法参数不算字数")
	})

	it("结构性：totalRepairs 不含合法参数，系统提示契约未改", () => {
		const task = readRepo("src/core/task/index.ts")
		const totalRepairs = task.match(/const totalRepairs =[\s\S]*?\n\s*if \(totalRepairs > 0\)/)?.[0] ?? ""
		assert.ok(totalRepairs, "没找到 totalRepairs 表达式")
		assert.doesNotMatch(totalRepairs, /taskProgressInTool/, "⛔ 合法参数不得计入 parse 修复总数")
		assert.match(totalRepairs, /taskProgressStrip/, "正文剥离仍要计入")
		const overrides = readRepo("src/core/prompts/system-prompt/variants/hermes/overrides.ts")
		assert.match(overrides, /must be included as a parameter/, "⛔ 系统提示的既有契约不能改")
		const parser = readRepo("src/core/assistant-message/parse-assistant-message.ts")
		assert.match(parser, /isToolParameter\(offset\)/, "统计口径靠位置判定，不是全局正则一刀切")
		assert.match(parser, /taskProgressInTool: number/)
	})
})

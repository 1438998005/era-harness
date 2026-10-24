// era harness：search_files 结果格式化回归测试。
// 背景（2026-10-24 实弹取证）：匹配行无行号驱动模型自写 python 命令取行号
// （deepseek 果渣单 4 次、Qwen 单 5 版临时脚本）；行数上限按 5 行/结果估算
// 导致 --context 2 下大搜索静默截断。本文件锁定三件事：
// ① 匹配行带 `│{line} | ` 前缀、上下文行裸文本；② 字节超限提示存在；
// ③ 行数上限截断可见（且不与字节提示叠加）。
// 运行：npm run test:ripgrep
import assert from "node:assert/strict"
import { test } from "node:test"
import { formatResults, MAX_RESULTS, type SearchResult } from "@services/ripgrep/format"

const CWD = "D:/proj"

function makeResult(over: Partial<SearchResult> & { filePath: string; line: number }): SearchResult {
	return {
		column: 1,
		match: "match line\n",
		beforeContext: ["before 1\n", "before 2\n"],
		afterContext: ["after 1\n", "after 2\n"],
		...over,
	}
}

test("匹配行带行号前缀，上下文行保持裸文本", () => {
	const out = formatResults([makeResult({ filePath: `${CWD}/a.erb`, line: 697 })], CWD)
	assert.ok(out.includes("│697 | match line"), `匹配行应有行号前缀：\n${out}`)
	assert.ok(out.includes("│before 1"), "上下文行不应有行号")
	assert.ok(out.includes("│after 2"), "上下文行不应有行号")
	assert.ok(!out.includes("│0 | "), "不应出现错误行号")
	// 头部统计保留
	assert.ok(out.startsWith("Found 1 result."))
})

test("同一文件多条结果：全部带各自行号，结果间有分隔线", () => {
	const out = formatResults(
		[
			makeResult({ filePath: `${CWD}/a.erb`, line: 10, match: "first\n" }),
			makeResult({ filePath: `${CWD}/a.erb`, line: 20, match: "second\n" }),
		],
		CWD,
	)
	assert.ok(out.includes("│10 | first"))
	assert.ok(out.includes("│20 | second"))
	assert.ok(out.includes("│----"))
})

test("多文件按相对路径分组（Windows 反斜杠路径归一为 posix）", () => {
	const out = formatResults(
		[makeResult({ filePath: "D:\\proj\\sub\\a.erb", line: 5 }), makeResult({ filePath: "D:\\proj\\b.erb", line: 6 })],
		CWD,
	)
	assert.ok(out.includes("sub/a.erb"), `相对路径应为 posix：\n${out}`)
	assert.ok(out.includes("b.erb"))
})

test("字节超限：尾部有可见的截断提示", () => {
	const big = Array.from({ length: 200 }, (_, i) =>
		makeResult({ filePath: `${CWD}/big.erb`, line: i + 1, match: `x`.repeat(2000) + `\n` }),
	)
	const out = formatResults(big, CWD)
	assert.ok(out.includes("Results truncated"), `截断必须可见：\n${out.slice(-300)}`)
	assert.ok(out.includes("size limit"))
})

test("行数上限截断（lineTruncated=true）：尾部有可见提示", () => {
	const out = formatResults([makeResult({ filePath: `${CWD}/a.erb`, line: 1 })], CWD, true)
	assert.ok(out.includes("line cap reached"), `行数截断必须可见：\n${out}`)
})

test("行数上限提示不与字节超限提示叠加", () => {
	const big = Array.from({ length: 200 }, (_, i) =>
		makeResult({ filePath: `${CWD}/big.erb`, line: i + 1, match: `x`.repeat(2000) + `\n` }),
	)
	const out = formatResults(big, CWD, true)
	assert.ok(out.includes("size limit"))
	assert.ok(!out.includes("line cap reached"), "字节提示在场时行数提示应省略")
})

test(`达到 MAX_RESULTS（${MAX_RESULTS}）：头部显示 first ${MAX_RESULTS} of ${MAX_RESULTS}+`, () => {
	const many = Array.from({ length: MAX_RESULTS }, (_, i) =>
		makeResult({ filePath: `${CWD}/m${i}.erb`, line: 1, match: "m\n" }),
	)
	const out = formatResults(many, CWD)
	assert.ok(out.startsWith(`Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results.`))
})

test("空上下文与缺字段容错（trimEnd / undefined）", () => {
	const out = formatResults(
		[{ column: 1, filePath: `${CWD}/a.erb`, line: 3, match: "only match\n", beforeContext: [], afterContext: [] }],
		CWD,
	)
	assert.ok(out.includes("│3 | only match"))
	assert.ok(!out.includes("│undefined"), "undefined 不应渗入输出")
})

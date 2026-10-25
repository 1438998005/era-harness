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

// ===== era harness（2026-10-25）：CP932 双编码搜索 =====
// 背景：eraTW 工程有无 BOM 的 CP932 文件，默认遍（UTF-8）搜不到 CJK——DS 曾以此为由
// 放弃内置搜索改写 python 双编码脚本（真实任务 1792887990433 第 1 轮推理原话）。

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { mergeEncodingPasses, regexSearchFiles } from "@services/ripgrep"
import { HostProvider } from "../../src/hosts/host-provider"

// 测试宿主：只有 getBinaryLocation 生效（取系统 PATH 上的 rg.exe），其余 creator 不会被调用
const rgPath = spawnSync("where", ["rg"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0]
if (rgPath) {
	HostProvider.initialize(
		(() => {
			throw new Error("not available in tests")
		}) as any,
		(() => {
			throw new Error("not available in tests")
		}) as any,
		(() => {
			throw new Error("not available in tests")
		}) as any,
		(() => {
			throw new Error("not available in tests")
		}) as any,
		(() => {
			throw new Error("not available in tests")
		}) as any,
		() => {},
		async () => "",
		async () => rgPath,
		".",
		".",
	)
}

test("mergeEncodingPasses：默认遍已命中的文件不采纳第二遍结果（防 UTF-8 文件假阳性）", () => {
	const pass1 = [{ column: 0, filePath: "d:/p/utf8.erb", line: 1, match: "hit\n", beforeContext: [], afterContext: [] }]
	const pass2 = [
		// 同文件的第二遍结果（转码假阳性）→ 应被排除
		{ column: 0, filePath: "d:/p/utf8.erb", line: 3, match: "false positive\n", beforeContext: [], afterContext: [] },
		// 新文件（CP932 命中）→ 应保留
		{ column: 0, filePath: "d:/p/cp932.erb", line: 7, match: "cp932 hit\n", beforeContext: [], afterContext: [] },
	]
	const merged = mergeEncodingPasses(pass1, pass2 as any)
	assert.equal(merged.length, 2)
	assert.deepEqual(
		merged.map((r) => `${r.filePath}:${r.line}`),
		["d:/p/utf8.erb:1", "d:/p/cp932.erb:7"],
	)
})

test("mergeEncodingPasses：第二遍为空时原样返回", () => {
	const pass1 = [{ column: 0, filePath: "a", line: 1, match: "m\n", beforeContext: [], afterContext: [] }]
	assert.equal(mergeEncodingPasses(pass1, []).length, 1)
})

test("集成：CP932 无 BOM 文件与 UTF-8 文件在同一搜索中都能命中", async () => {
	// 「テスト」的 CP932 字节：テ=0x83 0x65、ス=0x83 0x58、ト=0x83 0x67
	const cp932Line = 'msg = "' + Buffer.from([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]).toString("latin1") + 'cp932"\r\n'
	const dir = mkdtempSync(path.join(tmpdir(), "era-rg-"))
	try {
		writeFileSync(path.join(dir, "utf8.erb"), 'msg = "テストutf8"\r\n', "utf8")
		writeFileSync(path.join(dir, "cp932.erb"), Buffer.from(cp932Line, "latin1"))

		const out = await regexSearchFiles(dir, dir, "テスト")
		assert.ok(out.includes("utf8.erb"), `UTF-8 文件应命中：\n${out}`)
		assert.ok(out.includes("cp932.erb"), `CP932 文件必须经 Shift-JIS 第二遍命中：\n${out}`)
		assert.ok(out.includes("テストcp932"), "CP932 内容应被正确转码显示（无乱码）")
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

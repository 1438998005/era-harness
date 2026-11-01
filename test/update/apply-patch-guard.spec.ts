/**
 * #138/#144/#148：apply_patch 解析器与 diff V1 的守卫（行为测试）。
 *
 * PatchParser 只依赖 @shared/Patch 与 @shared/string（两者零 import），diff.ts
 * 零 import——都是纯模块，直接行为单测，不需要源码探针。
 *
 * ⚠️ #138 的失败形态是**同步死循环**：node:test 的 timeout 跑在同一个事件循环上，
 * 拦不住阻塞中的同步循环，所以红相证据要用外部时钟单独跑本文件取得
 * （`timeout 30 node --test out/apply-patch-guard.cjs` → 124 被击杀）。
 * 因此把会挂死的用例放在文件**最后**，让 #144/#148 的红先打印出来。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { constructNewFileContent } from "../../src/core/assistant-message/diff"
import { PatchParser } from "../../src/core/task/tools/utils/PatchParser"

test("#144 低于 0.9 相似度的模糊命中必须拒绝（chunk skipped），不得错位应用", () => {
	// 上下文 "alpha\nbeta\ngamma XY"（19 字符）与文件段 "alpha\nbeta\ngamma"（16 字符）
	// 的相似度 = (19-3)/19 ≈ 0.84：落在旧阈值 0.66 之上、新阈值 0.9 之下。
	// 修复前：按 0.66 命中位置 0（fuzz 1000）直接应用；修复后：警告 + 跳过，模型可重发。
	const parser = new PatchParser(
		["*** Begin Patch", "*** Update File: a.txt", "alpha", "beta", "gamma XY", "+gamma XY!", "*** End Patch"],
		{ "a.txt": "alpha\nbeta\ngamma\ndelta\n" },
	)
	const { patch } = parser.parse()
	const action = patch.actions["a.txt"]
	assert.ok(action, "动作本身应解析出来")
	assert.equal(action.chunks.length, 0, "0.84 相似度不得命中（错位写盘的代价 > 模型重发）")
	assert.ok(
		patch.warnings?.some((w) => w.message.includes("Could not find matching context")),
		"必须产出 chunk skipped 警告",
	)
})

test("#148 V1 流结束时仍停在 SEARCH 态必须抛错，不得静默丢弃编辑", async () => {
	// 修复前：isFinal 只兜 inReplace，未闭合的 SEARCH 块被静默丢掉，模型以为编辑已生效。
	// 抛错文案与 V2 getResult() 的同场景对齐（:591-593），调用方 WriteToFileToolHandler
	// 有 try/catch + diff_error 上报，能优雅接住。
	await assert.rejects(
		constructNewFileContent("------- SEARCH\nfoo\n", "foo\nbar\n", true),
		/SEARCH\/REPLACE operations still active/,
	)
})

test("#138 Update File 头部后跟空行必须抛错，不得原地死循环", { timeout: 3000 }, () => {
	// 空行不是 stop marker → peek 见空行立即 break（零前进）→ findContext 空上下文
	// 返回 start → this.index 原地踏步 → while 永真。文件位置 index===0 时，
	// :124 的 `index !== 0` throw 拦不住这条路径。修复前这里会挂死扩展宿主。
	const parser = new PatchParser(["*** Begin Patch", "*** Update File: a.txt", "", "*** End Patch"], {
		"a.txt": "line1\nline2\n",
	})
	assert.throws(() => parser.parse(), Error)
})

test("#138 Update File 头部后直接 EOF 必须抛错（越界 undefined 行同样零前进）", { timeout: 3000 }, () => {
	const parser = new PatchParser(["*** Begin Patch", "*** Update File: a.txt"], { "a.txt": "line1\nline2\n" })
	assert.throws(() => parser.parse(), Error)
})

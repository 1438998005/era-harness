/**
 * 「更新游戏不分身份」的两道保证。
 *
 * 背景（用户 2026-10-31 需求）：更新时开的那场 AI 合并对话，不该受聊天头部
 * 选的「本体作者 / 口上作者 / 不限制」影响。两处落点：
 *
 * 1. 合并任务提示词自带 `<era-identity mode="unrestricted">` —— 走的是既有机制
 *    （`Controller.initTask` 解析任务文本 → `setCurrentIdentityMode`），
 *    resume 时也能从首条消息重建，所以不需要额外的"锁"。
 * 2. `.era-harness/` 目录豁免身份判定 —— 兜底：合并途中用户若改身份发消息，
 *    webview 会重拼前缀把模式改回去，工作台写盘会被降级成逐条确认、合并卡死。
 *
 * 本测试锁两件事：**该放行的放行**，以及**游戏源码仍按身份拦**（别把豁免做成大洞）。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { resetEraProjectProfileCache } from "../../src/core/era/project-profile"
import {
	isHarnessOwnedPath,
	isWriteAllowedByScope,
	parseIdentityFromText,
	setCurrentIdentityMode,
} from "../../src/core/identity/scope"
import { buildWorkbenchPrompt, workbenchLayout } from "../../src/core/update/mergeWorkbench"
import { UNRESTRICTED_IDENTITY_BLOCK } from "../../src/shared/identity"

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-identity-"))
	try {
		await run(root)
	} finally {
		setCurrentIdentityMode("self")
		resetEraProjectProfileCache()
		await fs.rm(root, { recursive: true, force: true })
	}
}

test("合并任务提示词自带「不限」身份，且能被身份解析器识别", () => {
	const layout = workbenchLayout("/tmp/game", "20261031-1200")
	const prompt = buildWorkbenchPrompt(layout, [{ id: "0001" } as never], "/tmp/game")

	assert.ok(prompt.startsWith(UNRESTRICTED_IDENTITY_BLOCK), "身份块必须位于任务正文最前面（webview 的剥离正则锚定行首）")
	assert.equal(parseIdentityFromText(prompt), "unrestricted")
	assert.ok(prompt.includes("# 任务：把社区新版合并进玩家版本"), "正文不能被身份块吞掉")
})

test("口上作者身份下：工作台目录放行，游戏源码仍拦", async () => {
	await withTempDir(async (root) => {
		await fs.mkdir(path.join(root, "ERB"), { recursive: true })
		await fs.writeFile(path.join(root, "ERB", "main.ERB"), "; x\n", "utf8")
		const layout = workbenchLayout(root, "20261031-1200")
		await fs.mkdir(layout.outDir, { recursive: true })
		await fs.writeFile(path.join(layout.outDir, "0001.md"), "merged\n", "utf8")

		setCurrentIdentityMode("persona")
		resetEraProjectProfileCache()

		assert.equal(
			isWriteAllowedByScope(path.join(layout.outDir, "0001.md"), root),
			true,
			"合并工作台是 harness 自有目录，不该被身份拦",
		)
		assert.equal(
			isWriteAllowedByScope(path.join(root, "ERB", "main.ERB"), root),
			false,
			"游戏源码不在口上目录里，口上作者身份应拦",
		)
	})
})

test("本体作者身份下：口上目录拦、其余放行（豁免不影响原有语义）", async () => {
	await withTempDir(async (root) => {
		setCurrentIdentityMode("self")
		resetEraProjectProfileCache()

		assert.equal(isWriteAllowedByScope(path.join(root, "ERB", "main.ERB"), root), true)
		assert.equal(isWriteAllowedByScope(path.join(root, ".era-harness", "knowledge", "kb-1", "index.md"), root), true)
	})
})

test("工作区外的 .era-harness 不放行", async () => {
	await withTempDir(async (root) => {
		const outside = path.join(root, "..", `${path.basename(root)}-other`, ".era-harness", "x.md")
		setCurrentIdentityMode("persona")
		resetEraProjectProfileCache()

		assert.equal(isHarnessOwnedPath(outside, root), false)
		assert.equal(isWriteAllowedByScope(outside, root), false)
	})
})

test("isHarnessOwnedPath 按路径段判定，不做字符串前缀匹配", () => {
	assert.equal(isHarnessOwnedPath("/w/.era-harness/merge-work/a.md", "/w"), true)
	assert.equal(isHarnessOwnedPath("/w/.era-harness-evil/a.md", "/w"), false)
	assert.equal(isHarnessOwnedPath("/w/sub/.era-harness/knowledge/b.md", "/w"), true)
})

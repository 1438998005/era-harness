/**
 * 上轮「explorer 右键添加到聊天」#209 的回归测试。
 *
 * 取证：右键菜单可能在侧栏从未打开时触发，而 `waitForSidebarVisible()` 只是轮询等待，
 * 不会把侧栏带出来（webview 要可见才创建）；`sendAddToInputEvent` 对空订阅集合是
 * Promise.all([]) 静默成功，用户点了没反应也看不到任何报错。
 *
 * 编排逻辑已抽到无 vscode 依赖的 `src/shared/addToChatFlow.ts`，所以这里是**真跑的行为测试**：
 * 注入假的 showWebview / 等待 / mention / 发送，断言调用顺序、超时告警、多选与目录尾斜杠。
 * extension.ts 与 package.json 只留一条薄薄的「是否仍接上」静态断言。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	type AddToChatDeps,
	type AddToChatTarget,
	NO_TARGET_WARNING,
	runAddResourcesToChat,
	SIDEBAR_NOT_READY_WARNING,
} from "../../src/shared/addToChatFlow"
import { readCode, readRaw } from "./source-probe"

function makeDeps(options: { ready?: boolean; directories?: readonly string[] } = {}) {
	const calls: string[] = []
	let webviewShown = false
	const deps: AddToChatDeps = {
		showWebview: async () => {
			calls.push("showWebview")
			webviewShown = true
		},
		waitForVisible: async () => {
			calls.push("waitForVisible")
			// 模拟真实生命周期：侧栏没被带出来就永远不会有 webview 订阅
			return webviewShown && (options.ready ?? true)
		},
		toMention: async (fsPath) => {
			calls.push(`toMention:${fsPath}`)
			return `@/${fsPath.replace(/\\/g, "/")}`
		},
		sendToInput: async (text) => {
			calls.push(`sendToInput:${text}`)
		},
		showWarning: (message) => {
			calls.push(`showWarning:${message}`)
		},
		logWarning: (message) => {
			calls.push(`logWarning:${message}`)
		},
	}
	return { calls, deps }
}

const target = (fsPath: string, isDirectory?: boolean): AddToChatTarget => ({
	fsPath,
	isDirectory: isDirectory === undefined ? undefined : async () => isDirectory,
})

test("#209 行为：侧栏从未打开时也必须主动带出，再等订阅，最后插入 mention", async () => {
	const h = makeDeps()
	const outcome = await runAddResourcesToChat([target("src/a.ts", false)], h.deps)

	assert.equal(outcome.sent, true)
	assert.equal(outcome.ready, true)
	assert.deepEqual(outcome.mentions, ["@/src/a.ts"])
	assert.deepEqual(h.calls, ["showWebview", "waitForVisible", "toMention:src/a.ts", "sendToInput:@/src/a.ts"])
})

test("#209 行为：等待订阅超时必须告警，且不能静默丢掉插入事件", async () => {
	const h = makeDeps({ ready: false })
	const outcome = await runAddResourcesToChat([target("src/a.ts", false)], h.deps)

	assert.equal(outcome.ready, false)
	assert.equal(outcome.sent, true, "超时后仍尝试插入；用户至少能看到提示")
	assert.ok(h.calls.includes("logWarning:[addResourcesToChat] 等待聊天窗口可见超时"))
	assert.ok(h.calls.includes(`showWarning:${SIDEBAR_NOT_READY_WARNING}`))
	assert.ok(h.calls.includes("sendToInput:@/src/a.ts"))
	const warnAt = h.calls.findIndex((c) => c.startsWith("showWarning:"))
	const sendAt = h.calls.findIndex((c) => c.startsWith("sendToInput:"))
	assert.ok(warnAt < sendAt, "告警要早于插入尝试")
})

test("#209 行为：未选中资源只告警，不打开侧栏也不发事件", async () => {
	const h = makeDeps()
	const outcome = await runAddResourcesToChat([], h.deps)
	assert.deepEqual(outcome, { sent: false, ready: false, mentions: [] })
	assert.deepEqual(h.calls, [`showWarning:${NO_TARGET_WARNING}`])
})

test("#209 行为：文件夹补尾斜杠、文件不补；多选用换行拼接；stat 失败按文件处理", async () => {
	const h = makeDeps()
	const outcome = await runAddResourcesToChat(
		[target("src/a.ts", false), target("src/components", true), target("README.md")],
		h.deps,
	)
	assert.deepEqual(outcome.mentions, ["@/src/a.ts", "@/src/components/", "@/README.md"])
	assert.ok(h.calls.includes("sendToInput:@/src/a.ts\n@/src/components/\n@/README.md"))
})

test("#209 行为：stat 判不出目录时按文件处理；已有尾斜杠不重复补", async () => {
	const h = makeDeps()
	const outcome = await runAddResourcesToChat(
		[target("gone/file.ts", false), { fsPath: "src/components/", isDirectory: async () => true }],
		h.deps,
	)
	assert.deepEqual(outcome.mentions, ["@/gone/file.ts", "@/src/components/"])
	assert.ok(h.calls.includes("sendToInput:@/gone/file.ts\n@/src/components/"))
})

test("#209 源码接线：命令仍接纯模块，manifest/registry 注册齐全", () => {
	const code = readCode("src/extension.ts")
	const start = code.indexOf("const addResourcesToChat")
	assert.ok(start > -1, "共用 handler 仍应存在")
	const end = code.indexOf("context.subscriptions.push", start)
	assert.ok(end > start, "handler 后面应紧接命令注册")
	const handler = code.slice(start, end)

	assert.match(handler, /runAddResourcesToChat\(/, "宿主必须调用可测的纯模块")
	assert.match(handler, /showWebview: \(\) => showWebview\(true\)/, "必须先主动打开侧栏")
	assert.match(handler, /waitForVisible: waitForSidebarVisible/, "再等 webview 订阅")
	assert.match(handler, /sendToInput: sendAddToInputEvent/, "最终仍要把 mention 插入输入框")
	assert.match(handler, /showWarning:/, "分支告警仍由宿主弹窗")
	const showAt = handler.indexOf("showWebview: () => showWebview(true)")
	const waitAt = handler.indexOf("waitForVisible: waitForSidebarVisible")
	assert.ok(waitAt > showAt, "等待订阅必须在带出侧栏之后")

	const manifest = readRaw("package.json")
	assert.match(manifest, /era-harness\.addFileToChat/)
	assert.match(manifest, /era-harness\.addFolderToChat/)
	assert.match(manifest, /"explorer\/context"/)

	const registry = readCode("src/registry.ts")
	assert.match(registry, /AddFileToChat/)
	assert.match(registry, /AddFolderToChat/)
})

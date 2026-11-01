/**
 * #111：`run_game` 的审批必须挡在副作用之前，且卡片要说真话。
 *
 * 为什么用源码断言而不是单测：`RunGameToolHandler` 依赖 vscode（`@integrations/notifications`
 * 与 `@utils/path` 都链到 HostProvider），而插件侧测试默认把 `vscode` 设为 external
 * （`run.mjs:141`），import 链上有它就会在 `require("vscode")` 处炸。
 *
 * 断言的是「顺序」——这类 bug 的本质就是顺序错了，顺序对了才算修好。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { readCode } from "./source-probe"

test("#111 审批必须早于 startEngine：拒绝时不能已经跑过一轮", () => {
	const source = readCode("src/core/task/tools/handlers/RunGameToolHandler.ts")
	const approve = source.indexOf("askApprovalAndPushFeedback")
	const start = source.indexOf("startEngine(")
	const stop = source.indexOf("stopEngine(")

	assert.ok(approve > 0, "必须调用 askApprovalAndPushFeedback")
	assert.ok(start > 0, "必须仍然调用 startEngine")
	assert.ok(stop > 0, "必须仍然调用 stopEngine")
	assert.ok(approve < start, "审批必须在 startEngine 之前（否则用户点拒绝时进程已经起来了）")
	assert.ok(approve < stop, "审批必须在 stopEngine 之前（否则用户点拒绝时游戏已经被强杀）")
})

test("#111 审批载荷不能再伪装成 readFile", () => {
	const source = readCode("src/core/task/tools/handlers/RunGameToolHandler.ts")
	assert.ok(source.includes('tool: "runGame"'), "载荷 tool 必须是 runGame")
	assert.ok(!source.includes('tool: "readFile"'), "不能再用 readFile 伪装（用户会以为在批准读文件）")
	assert.ok(source.includes('action: "run"') && source.includes('action: "stop"'), "载荷要带 action")
	assert.ok(source.includes("command:"), "载荷要带展示用命令行")
})

test("#111 子代理不能调 run_game（它没有审批通道）", () => {
	const source = readCode("src/core/task/tools/handlers/RunGameToolHandler.ts")
	assert.ok(source.includes("config.isSubagentExecution"), "必须有子代理守卫")
	const guard = source.indexOf("config.isSubagentExecution")
	const approve = source.indexOf("askApprovalAndPushFeedback")
	assert.ok(guard < approve, "子代理守卫要在审批之前（提前返回）")
})

test("#111 YOLO / 权限全开也不能自动批准 run_game", () => {
	const source = readCode("src/core/task/tools/autoApprove.ts")
	const gate = source.indexOf("ClineDefaultTool.RUN_GAME")
	assert.ok(gate > 0, "autoApprove 必须有 RUN_GAME 硬闸")

	// 硬闸必须在 yoloModeToggled 判断之前——那个分支会无条件 return true
	const yolo = source.indexOf("yoloModeToggled")
	assert.ok(gate < yolo, "RUN_GAME 硬闸必须在 yoloModeToggled 分支之前，否则 yolo 下仍会自动放行")
})

test("#122 shouldAutoApproveToolWithPath 自己的 yolo 早退也必须被硬闸拦住", () => {
	const source = readCode("src/core/task/tools/autoApprove.ts")
	// run_game 的审批消费点是 WithPath（RunGameToolHandler → shouldAutoApproveToolWithPath）；
	// 该函数内部的 yolo / autoApproveAll 早退在内部闸（shouldAutoApproveTool）之前，
	// 闸只放 shouldAutoApproveTool 里拦不住 yolo——WithPath 函数体最前必须同样硬闸。
	const fnStart = source.indexOf("shouldAutoApproveToolWithPath")
	assert.ok(fnStart > 0, "必须存在 shouldAutoApproveToolWithPath")
	const fnBody = source.slice(fnStart)
	const gate = fnBody.indexOf("ClineDefaultTool.RUN_GAME")
	const yolo = fnBody.indexOf("yoloModeToggled")
	assert.ok(gate > 0, "WithPath 内必须有 RUN_GAME 硬闸")
	assert.ok(yolo > 0, "WithPath 内存在 yolo 早退（否则本断言无意义）")
	assert.ok(gate < yolo, "WithPath 的 RUN_GAME 硬闸必须在其 yolo 早退之前，否则 yolo 下 run_game 零确认直接跑")
})

test("#125 子代理禁用表必须涵盖 MCP / new_task / ask / run_game（YAML 授予也不生效）", () => {
	const source = readCode("src/core/task/tools/subagent/SubagentBuilder.ts")
	const setStart = source.indexOf("SUBAGENT_FORBIDDEN_TOOLS")
	assert.ok(setStart > 0, "必须存在 SUBAGENT_FORBIDDEN_TOOLS")
	const setBody = source.slice(setStart)
	for (const tool of ["MCP_USE", "MCP_ACCESS", "NEW_TASK", "ASK", "RUN_GAME"]) {
		assert.ok(
			new RegExp(`ClineDefaultTool\\.${tool}`).test(setBody),
			`SUBAGENT_FORBIDDEN_TOOLS 必须包含 ClineDefaultTool.${tool}`,
		)
	}
})

test("#111 abort 不能被报成「启动引擎失败」", () => {
	const source = readCode("src/core/task/tools/handlers/RunGameToolHandler.ts")
	assert.ok(source.includes("Cline instance aborted"), "catch 里必须放行 abort 异常")
})

test("#111 webview 必须有 runGame 卡片分支（否则卡片完全不可见）", () => {
	const source = readCode("webview-ui/src/components/chat/ChatRow.tsx")
	assert.ok(source.includes('case "runGame"'), "ChatRow 必须处理 runGame，否则命中 default → InvisibleSpacer")
	assert.ok(source.includes("chatRow.wantsToRunGame"), "审批文案要走 i18n")
	assert.ok(source.includes("chatRow.wantsToStopGame"), "结束进程要有独立文案")
})

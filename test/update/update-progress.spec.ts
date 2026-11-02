/**
 * 08 #181：更新面板在「AI 合并」阶段长时间零活动，看起来像卡死。
 *
 * 合并阶段跑的是**一场真实对话**，模型思考/流式输出期间没有任何 `UpdateEvent`
 * 进面板。修法是两条：合并期间每 10 秒发一条心跳（`describeMergeHeartbeat`），
 * 以及把早就铺好却没接的 `WorkbenchProgress` 通道接上（`describeWorkbenchProgress`）。
 *
 * 另外守一个易踩的坑：`stageReporter(progress)(event)` 每次调用都会新建闭包，
 * 导致内部的 `last` 去重失效（面板被同一句话刷屏）。必须只创建一次。
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { describeMergeHeartbeat, describeWorkbenchProgress, stageText } from "../../src/core/update/progressText"
import type { UpdateEvent } from "../../src/core/update/service"

// run.mjs 会把 cwd 设为仓库根（打包成 CJS 后 import.meta.url 不可用）
const repoRoot = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8")

/** 去掉注释再断言：文件里有用注释解释「不要这么写」，直接搜源码会误判 */
function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

// ---------------------------------------------------------------------------
// 阶段文案（回归：搬家不应改口径）
// ---------------------------------------------------------------------------

test("#181 阶段文案不出现 download/scan/apply 这类词", () => {
	const cases: Array<[UpdateEvent, string]> = [
		[{ stage: "check" }, "正在看看社区有没有新版本…"],
		[{ stage: "download" }, "正在下载社区版本…"],
		[{ stage: "snapshot" }, "正在读取文件清单…"],
		[{ stage: "scan" }, "正在扫描本地的游戏文件…"],
		[{ stage: "labels" }, "正在建函数索引（查有没有人调被删掉的函数）…"],
		[{ stage: "plan" }, "正在比对哪些文件要更新…"],
		[{ stage: "merge" }, "正在合并你改过的文件…"],
		[{ stage: "merge", message: "foo.erb" }, "正在合并 foo.erb…"],
		[{ stage: "apply" }, "正在备份并写入…"],
		[{ stage: "apply", message: "a.erb" }, "正在写入 a.erb…"],
		[{ stage: "apply", message: "a.erb", action: "delete" }, "正在清理 a.erb…"],
		[{ stage: "verify" }, "正在检查有没有写对…"],
	]
	for (const [event, expected] of cases) {
		assert.equal(stageText(event), expected, `${event.stage} 文案变了`)
	}
})

test("#181 删文件时不能说「正在写入」", () => {
	// 用户会以为刚删掉的又被写回来了
	const write = stageText({ stage: "apply", message: "a.erb", action: "write" })
	const del = stageText({ stage: "apply", message: "a.erb", action: "delete" })
	assert.notEqual(write, del)
	assert.ok(del.includes("清理"))
})

// ---------------------------------------------------------------------------
// 心跳文案
// ---------------------------------------------------------------------------

test("#181 心跳把毫秒转成人话（133000ms = 2 分 13 秒）", () => {
	assert.equal(describeMergeHeartbeat(133_000), "仍在等待模型响应（已 2 分 13 秒）")
	assert.equal(describeMergeHeartbeat(45_000), "仍在等待模型响应（已 45 秒）")
	assert.equal(describeMergeHeartbeat(0), "仍在等待模型响应（已 0 秒）")
	// 不足一分钟不带「0 分」
	assert.ok(!describeMergeHeartbeat(59_999).includes("0 分"))
	// 负数（时钟回拨）不能输出「-1 秒」
	assert.equal(describeMergeHeartbeat(-5000), "仍在等待模型响应（已 0 秒）")
})

test("#181 心跳带上最后一行输出，但压成一行并截断", () => {
	assert.equal(describeMergeHeartbeat(1000, "hello"), "仍在等待模型响应（已 1 秒）：hello")
	// 换行/多空格压成单个空格
	assert.equal(describeMergeHeartbeat(1000, "  a\n\n  b  "), "仍在等待模型响应（已 1 秒）：a b")

	const long = "x".repeat(200)
	const text = describeMergeHeartbeat(1000, long)
	assert.ok(text.endsWith("x".repeat(40)), "片段应截断到 40 字")
	assert.ok(!text.includes("x".repeat(41)), "不应超过 40 字")

	// 空白片段等于没有片段
	assert.equal(describeMergeHeartbeat(1000, "   \n "), "仍在等待模型响应（已 1 秒）")
	assert.equal(describeMergeHeartbeat(1000, ""), "仍在等待模型响应（已 1 秒）")
})

// ---------------------------------------------------------------------------
// 工作台进度通道
// ---------------------------------------------------------------------------

test("#181 WorkbenchProgress 三个阶段都有人话", () => {
	assert.equal(describeWorkbenchProgress({ phase: "materialize" }), "正在准备合并工作台…")
	assert.equal(describeWorkbenchProgress({ phase: "materialize", path: "a.erb" }), "正在准备合并工作台：a.erb")
	assert.equal(describeWorkbenchProgress({ phase: "conversation", total: 7 }), "已把 7 个冲突文件交给模型，等它逐个合并…")
	assert.equal(describeWorkbenchProgress({ phase: "conversation" }), "已把冲突文件交给模型，等它逐个合并…")
	assert.equal(describeWorkbenchProgress({ phase: "collect" }), "正在收回模型改过的文件…")
	// 未知阶段也要有话说，不能空白
	assert.equal(describeWorkbenchProgress({ phase: "whatever" }), "正在合并（whatever）…")
})

// ---------------------------------------------------------------------------
// 接线守卫
// ---------------------------------------------------------------------------

test("#181 stageReporter 只创建一次，不得写成 stageReporter(progress)(event)", () => {
	const src = stripComments(read("src/hosts/vscode/updateGame.ts"))
	assert.ok(src.includes("const reportStage = stageReporter(progress)"), "应先把 reporter 取出来复用")
	assert.ok(!/stageReporter\s*\([^)]*\)\s*\(/.test(src), "不得现取现调：每次新建闭包会让去重失效")
})

test("#181 合并阶段的心跳与工作台进度都接到了面板", () => {
	const src = read("src/hosts/vscode/updateGame.ts")
	assert.ok(src.includes("describeMergeHeartbeat"), "应使用心跳文案")
	assert.ok(src.includes("describeWorkbenchProgress"), "应使用工作台进度文案")
	assert.ok(/onProgress:\s*\(progress\)/.test(src), "应把 onProgress 传给工作台合并")
	assert.ok(src.includes('stage: "merge"'), "两条进度都要发到 merge 阶段")
})

test("#181 合并期间的轮询确实按间隔发心跳", () => {
	const src = read("src/hosts/vscode/mergeTask.ts")
	assert.ok(src.includes("HEARTBEAT_INTERVAL_MS"), "应有心跳间隔常量")
	assert.ok(/now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS/.test(src), "应按间隔节流，而不是每轮都发")
	assert.ok(src.includes("onHeartbeat?.("), "心跳应回调给调用方")
})

test("#181 面板要在合并开始前就建好，否则心跳没有地方可发", () => {
	const src = read("src/hosts/vscode/updateGame.ts")
	const panelIdx = src.indexOf("createUpdatePanel(root)")
	const mergeIdx = src.indexOf("runMergeConversation(")
	assert.ok(panelIdx > 0 && mergeIdx > panelIdx, "createUpdatePanel 必须早于 runMergeConversation")
})

test("#181 面板明细去重：连续重复的同一句只留一条", () => {
	const src = read("webview-ui/src/update-center/main.tsx")
	assert.ok(src.includes("prev[prev.length - 1] === next"), "相邻重复消息应被丢弃（心跳文案高度相似，不去重会刷屏）")
})

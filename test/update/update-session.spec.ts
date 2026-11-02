/**
 * 08 #179：更新跑在侧栏对话里，误关后没有入口回去。
 *
 * 这里守的是一个**有破坏性后果**的判定：`focus` 与 `resume` 必须分得开。
 * 任务还活着时如果走 `resume`（`controller.initTask` → `clearTask` → `abortTask`），
 * 用户点「回到更新」反而会把正在跑的合并对话弄死——比没有入口更糟。
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { decideUpdateReturn, parseUpdateSessionRecord, type UpdateSessionRecord } from "../../src/shared/updateSession"

// run.mjs 会把 cwd 设为仓库根（打包成 CJS 后 import.meta.url 不可用）
const repoRoot = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8")

const record: UpdateSessionRecord = {
	taskId: "task-1",
	root: "D:/games/eratw",
	startedAt: "2026-11-02T10:00:00.000Z",
}

test("#179 没有记录 → none", () => {
	assert.equal(decideUpdateReturn({ historyIds: [] }), "none")
	assert.equal(decideUpdateReturn({ record: { ...record, taskId: "" }, historyIds: ["task-1"] }), "none")
})

test("#179 记录的就是当前任务 → focus（只拉侧栏，绝不重开任务）", () => {
	assert.equal(decideUpdateReturn({ record, currentTaskId: "task-1", historyIds: ["task-1"] }), "focus")
	// 关键：即使它同时在历史里，也必须判 focus —— 顺序不能反
	assert.equal(decideUpdateReturn({ record, currentTaskId: "task-1", historyIds: ["x", "task-1", "y"] }), "focus")
})

test("#179 记录在历史里但当前是别的任务 → resume", () => {
	assert.equal(decideUpdateReturn({ record, currentTaskId: "task-2", historyIds: ["task-1", "task-2"] }), "resume")
	assert.equal(decideUpdateReturn({ record, historyIds: ["task-1"] }), "resume")
})

test("#179 记录还在但历史里找不到 → interrupted（重载窗口多半已经把它弄死）", () => {
	assert.equal(decideUpdateReturn({ record, currentTaskId: "task-2", historyIds: ["task-2"] }), "interrupted")
	assert.equal(decideUpdateReturn({ record, historyIds: [] }), "interrupted")
})

test("#179 sidecar 形状校验：脏 JSON 不能当作有效记录", () => {
	assert.equal(parseUpdateSessionRecord(null), undefined)
	assert.equal(parseUpdateSessionRecord("task-1"), undefined)
	assert.equal(parseUpdateSessionRecord({}), undefined)
	assert.equal(parseUpdateSessionRecord({ taskId: "", root: "/ws" }), undefined)
	assert.equal(parseUpdateSessionRecord({ taskId: "task-1" }), undefined)
	assert.equal(parseUpdateSessionRecord({ taskId: "task-1", root: "" }), undefined)
	assert.deepEqual(parseUpdateSessionRecord({ taskId: "task-1", root: "/ws" }), {
		taskId: "task-1",
		root: "/ws",
		startedAt: "",
	})
	// 多余字段被丢掉，不污染记录
	assert.deepEqual(parseUpdateSessionRecord({ taskId: "t", root: "/ws", startedAt: "now", evil: 1 }), {
		taskId: "t",
		root: "/ws",
		startedAt: "now",
	})
})

test("#179 命令入口：focus 分支在 reinit 之前，且 reinit 只有一处", () => {
	const src = read("src/hosts/vscode/updateSession.ts")
	const focusIdx = src.indexOf('action === "focus"')
	const reinitIdx = src.indexOf("reinitExistingTaskFromId")
	assert.ok(focusIdx > 0, "应有 focus 分支")
	assert.ok(reinitIdx > focusIdx, "focus 分支必须排在 reinit 之前（否则会 abort 正在跑的更新）")

	const reinitCalls = src.split("reinitExistingTaskFromId").length - 1
	assert.equal(reinitCalls, 1, "恢复任务只应有一条路径")
})

test("#179 resume 会中止当前对话，必须先让用户确认", () => {
	const src = read("src/hosts/vscode/updateSession.ts")
	const warnIdx = src.indexOf("showWarningMessage")
	const reinitIdx = src.indexOf("reinitExistingTaskFromId")
	assert.ok(warnIdx > 0 && warnIdx < reinitIdx, "确认框必须在 reinit 之前")
	assert.ok(src.includes('choice !== "切回去"'), "用户取消后应直接返回")
})

test("#179 更新开始/结束都登记了 sidecar，且成对出现", () => {
	const src = read("src/hosts/vscode/mergeTask.ts")
	const beginIdx = src.indexOf("beginUpdateSession(")
	const endIdx = src.indexOf("endUpdateSession(")
	assert.ok(beginIdx > 0, "合并开始应登记 sidecar")
	assert.ok(endIdx > beginIdx, "合并结束应清理 sidecar")
	assert.ok(src.includes("await beginUpdateSession({ taskId: started, root })"), "登记时带上真实 taskId")
	assert.ok(src.includes("await endUpdateSession(started)"), "只清理自己那条记录")
})

test("#179 命令与状态栏入口都已注册", () => {
	const registry = read("src/registry.ts")
	assert.ok(registry.includes("ReturnToUpdate"), "ClineCommands 应有 ReturnToUpdate")
	const pkg = read("package.json")
	assert.ok(pkg.includes("era-harness.returnToUpdate"), "package.json 应注册命令")
	assert.ok(read("src/extension.ts").includes("ReturnToUpdate"), "扩展激活时应注册命令")
})

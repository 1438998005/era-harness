/**
 * #136/#137：webview→host 输入校验与 hooks 默认值。
 *
 * 为什么混着「真单测 + 源码断言」：
 * - hooks-utils 是零依赖纯函数，可以真单测（#137 的默认值语义直接锁行为）；
 * - openDiskConversationHistory / updateSettings 都依赖 vscode，进不了默认 SPECS
 *   （run.mjs 把 vscode 设为 external），只能用源码级断言锁「校验有没有接线、顺序对不对」。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { getHooksEnabledSafe } from "../../src/core/hooks/hooks-utils"
import { readCode } from "./source-probe"

test("#137 hooks 未设置时默认关闭（2026-11-01 用户裁定：供应链面 > 便利性）", () => {
	// hooks 脚本（工作区 .clinerules/hooks/ 与系统级 ~/Documents/Cline/Hooks/）
	// 被发现即执行、无确认；默认值必须是「关」，要用的用户去设置里显式打开。
	assert.equal(getHooksEnabledSafe(undefined), false)
	assert.equal(getHooksEnabledSafe(true), true)
	assert.equal(getHooksEnabledSafe(false), false)
})

test("#137 设置更新路径的默认读取必须走 getHooksEnabledSafe 单源，不得再散落 ?? true", () => {
	const source = readCode("src/core/controller/state/updateSettings.ts")
	assert.ok(source.includes("getHooksEnabledSafe("), "updateSettings 里 hooksEnabled 的「上次状态」必须走 getHooksEnabledSafe")
	assert.ok(!source.includes('getGlobalSettingsKey("hooksEnabled") ?? true'), "hooksEnabled 默认不得再是 true（默认已改为关）")
})

test("#137 state 默认值表必须默认关（否则新装用户绕过 getHooksEnabledSafe）", () => {
	// getHooksEnabledSafe 的 ?? false 只兜「存量无值」；state-keys 的 default 才是
	// 新装用户真正拿到的值——getGlobalSettingsKey 返回 true 时 safe 包装拦不住。
	const source = readCode("src/shared/storage/state-keys.ts")
	assert.ok(source.includes("hooksEnabled: { default: false as boolean }"), "hooksEnabled 的 state 默认必须是 false")
})

test("#136 openDiskConversationHistory 的任务号必须过白名单才能拼路径", () => {
	const source = readCode("src/core/controller/file/openDiskConversationHistory.ts")
	const whitelist = source.indexOf("TASK_ID_PATTERN")
	const join = source.indexOf("path.join(")
	assert.ok(whitelist > 0, "必须有任务号白名单校验（webview 传 ../ 能逃出 tasks 目录）")
	assert.ok(join > 0, "仍然要拼 tasks 目录路径")
	assert.ok(whitelist < join, "白名单必须在拼路径之前")
})

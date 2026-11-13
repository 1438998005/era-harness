/**
 * KB 08 #261：CommandPermissionController 的两条 fail-open——
 * ① 配置 env（CLINE_COMMAND_PERMISSIONS）设置了但 JSON 解析失败：原来 parseConfig
 *    返回 null 被当成「未配置」全放行，管理员写错 JSON 就静默失去保护；修复后
 *    标记 configInvalid，validateCommand 一律拒绝（reason: config_parse_error）。
 * ② shell-quote parse() 抛错：原来 catch 返回空 ParsedCommand，被当成「无段、
 *    无操作符」直接放行；修复后返回 null 走保守阻断。
 *
 * 「未配置 = 放行」是上游继承的向后兼容语义，保留不动（三态各有用例钉住）。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { CommandPermissionController } from "../../src/core/permissions/CommandPermissionController"
import { COMMAND_PERMISSIONS_ENV_VAR } from "../../src/core/permissions/types"

/** 临时设置/还原 env，避免测试间串扰 */
function withEnv(value: string | undefined, run: () => void): void {
	const prev = process.env[COMMAND_PERMISSIONS_ENV_VAR]
	try {
		if (value === undefined) {
			delete process.env[COMMAND_PERMISSIONS_ENV_VAR]
		} else {
			process.env[COMMAND_PERMISSIONS_ENV_VAR] = value
		}
		run()
	} finally {
		if (prev === undefined) {
			delete process.env[COMMAND_PERMISSIONS_ENV_VAR]
		} else {
			process.env[COMMAND_PERMISSIONS_ENV_VAR] = prev
		}
	}
}

test("命令权限三态：未配置 env = 放行（向后兼容，KB 08 #261）", () => {
	withEnv(undefined, () => {
		const c = new CommandPermissionController()
		assert.deepEqual(c.validateCommand("anything --flag"), { allowed: true, reason: "no_config" })
	})
})

test("命令权限三态：合法配置 = deny 优先、allow 清单外默认拒绝", () => {
	const c = new CommandPermissionController({ allow: ["npm *"], deny: ["rm *"], allowRedirects: false })
	assert.equal(c.validateCommand("npm test").allowed, true)
	assert.equal(c.validateCommand("rm -rf x").allowed, false)
	assert.equal(c.validateCommand("curl example.com").allowed, false, "allow 清单外默认拒绝")
	assert.equal(c.validateCommand("echo hi > f").allowed, false, "重定向默认拒绝")
})

test("命令权限三态：配置 env 坏 JSON = 一律拒绝，不得静默降级成全放行（KB 08 #261）", () => {
	withEnv('{"deny": ["rm *"', () => {
		// 缺右括号的坏 JSON
		const c = new CommandPermissionController()
		const result = c.validateCommand("npm test")
		assert.equal(result.allowed, false, "守卫不确定时正常命令也必须拒绝")
		assert.equal(result.reason, "config_parse_error")
		assert.equal(c.validateCommand("rm -rf x").allowed, false, "危险命令同样拒绝")
	})
})

test("命令权限：shell-quote parse 抛错 = 保守阻断，不得按空结构放行（KB 08 #261）", () => {
	withEnv(undefined, () => {
		// 必须带真实配置：未配置时 validateCommand 在「无配置」闸门就放行，走不到解析段
		const c = new CommandPermissionController({ allow: ["npm *"] })
		// 不完整的 ${ 替换会让 shell-quote 抛 "Bad substitution"（实测稳定触发器）
		const result = c.validateCommand("echo ${b")
		assert.equal(result.allowed, false, "解析抛错必须阻断")
		assert.equal(result.reason, "shell_operator_detected")
		assert.equal(result.detectedOperator, "parse_error")
	})
})

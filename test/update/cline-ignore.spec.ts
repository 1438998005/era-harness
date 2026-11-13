/**
 * KB 08 #262：validateCommand 不得在「没有 .clineignore」时早退——
 * 探测到 Emuera 工程后注入的内置备份目录规则（_备份/ 等）必须同样约束
 * 终端读文件命令（cat / type / get-content ...），否则 file 工具被拦、
 * 终端绕过。行为测试：最小 Era 工程 fixture + 无 .clineignore。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
// 注册 String.prototype.toPosix——validateAccess 依赖它（生产环境由扩展入口顺带加载，
// 测试环境必须显式 import，否则 toPosix 缺失 → validateAccess 抛错走 catch → 静默放行）
import "@utils/path"
import { resetEraProjectProfileCache } from "../../src/core/era/project-profile"
import { ClineIgnoreController, getBuiltinIgnorePatterns } from "../../src/core/ignore/ClineIgnoreController"

async function withTempEraGame(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-ignore-"))
	try {
		// 最小 EraBasic 工程（探测打分需要：脚本 + 引擎产物），带一个备份目录
		for (let i = 0; i < 12; i++) {
			await fs.mkdir(path.dirname(path.join(root, "ERB", `S${i}.ERB`)), { recursive: true })
			await fs.writeFile(path.join(root, "ERB", `S${i}.ERB`), "; x\n", "utf8")
		}
		await fs.mkdir(path.join(root, "CSV"), { recursive: true })
		await fs.writeFile(path.join(root, "emuera.config"), "USELAZYLOADING:YES\n", "utf8")
		await fs.writeFile(path.join(root, "Emuera.exe"), "MZ", "utf8")
		await fs.mkdir(path.join(root, "_备份"), { recursive: true })
		await fs.writeFile(path.join(root, "_备份", "old.erb"), "; old\n", "utf8")
		await run(root)
	} finally {
		resetEraProjectProfileCache()
		await fs.rm(root, { recursive: true, force: true })
	}
}

test("内置忽略：Era 工程无 .clineignore 时备份目录规则仍然注入", async () => {
	await withTempEraGame(async (root) => {
		const patterns = getBuiltinIgnorePatterns(root)
		assert.ok(patterns.includes("_备份/"), `备份目录应被探测并注入内置规则：${JSON.stringify(patterns)}`)
	})
})

test("validateCommand：无 .clineignore 时终端读备份目录仍被拦（KB 08 #262）", async () => {
	await withTempEraGame(async (root) => {
		const controller = new ClineIgnoreController(root)
		try {
			await controller.initialize()
			assert.equal(controller.clineIgnoreContent, undefined, "fixture 里没有 .clineignore")

			// file 工具侧（validateAccess）一贯拦截
			assert.equal(controller.validateAccess("_备份/old.erb"), false, "备份目录文件读访问应被拒")

			// 终端侧（validateCommand）：修复前在这里早退放行，返回 undefined
			assert.equal(controller.validateCommand("cat _备份/old.erb"), "_备份/old.erb", "cat 备份文件必须被拦")
			assert.equal(controller.validateCommand("type _备份\\old.erb"), "_备份\\old.erb", "PowerShell type 同样拦")
			assert.equal(controller.validateCommand("get-content _备份/old.erb"), "_备份/old.erb")

			// 非忽略路径不受影响
			assert.equal(controller.validateCommand("cat ERB/S0.ERB"), undefined, "正常脚本文件应放行")
			assert.equal(controller.validateCommand("npm test"), undefined, "非读文件命令不检查")
		} finally {
			await controller.dispose()
		}
	})
})

test("validateCommand：非 Era 工程（零规则）行为不变，全部放行", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-ignore-plain-"))
	try {
		await fs.writeFile(path.join(root, "readme.txt"), "hi\n", "utf8")
		const controller = new ClineIgnoreController(root)
		try {
			await controller.initialize()
			assert.equal(controller.validateCommand("cat readme.txt"), undefined)
			assert.equal(controller.validateCommand("cat ../outside.txt"), undefined)
		} finally {
			await controller.dispose()
		}
	} finally {
		resetEraProjectProfileCache()
		await fs.rm(root, { recursive: true, force: true })
	}
})

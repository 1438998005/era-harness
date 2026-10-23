/**
 * 「在系统文件管理器里打开目录」的判定（3.91.4）。
 *
 * 来自真实反馈：点「打开诊断目录」弹出一个裸的「打开外部程序时出错」。
 * 根因不是路径有问题（同路径 explorer.exe / cmd start 都能打开），而是
 * `vscode.env.openExternal` 在 Windows 上打开**目录**会失败，且失败时**不抛错、只 resolve(false)**——
 * 老代码把这个 false 当成了成功，于是既没打开、也没有任何我们自己的提示。
 *
 * 所以这里守两件事：
 * 1. Windows 走 explorer（不经过 VS Code 的 opener），成功就不再碰 openExternal；
 * 2. openExternal 的 false 必须判为失败——这是本 bug 的回归闸。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { createOpenInOsDeps, type OpenInOsDeps, openFolderInOs, spawnDetachedProcess } from "../../src/hosts/vscode/open-in-os"

function deps(opts: {
	platform: NodeJS.Platform
	/** spawn 的返回值：null = 起成功，字符串 = 失败原因 */
	spawnError?: string | null
	/** openExternal 的结果：true / false / "throw" */
	external?: boolean | "throw"
}): { deps: OpenInOsDeps; spawned: string[][]; externalCalls: string[] } {
	const spawned: string[][] = []
	const externalCalls: string[] = []
	const merged: OpenInOsDeps = {
		platform: opts.platform,
		spawnDetached: async (command, args) => {
			spawned.push([command, ...args])
			return opts.spawnError ?? null
		},
		openExternal: async (dir) => {
			externalCalls.push(dir)
			if (opts.external === "throw") {
				throw new Error("no opener available")
			}
			return opts.external ?? true
		},
	}
	return { deps: merged, spawned, externalCalls }
}

test("Windows：用 explorer 打开目录，成功就不再走 openExternal", async () => {
	const h = deps({ platform: "win32" })
	const dir = "C:\\Users\\周远航\\AppData\\Roaming\\Code\\User\\globalStorage\\eraharness.era-harness\\diagnostics"

	assert.equal(await openFolderInOs(dir, h.deps), null, "成功要返回 null")
	assert.deepEqual(h.spawned, [["explorer.exe", dir]], "要原样把目录交给 explorer，不能改写路径")
	assert.deepEqual(h.externalCalls, [], "explorer 已经打开了，不该再叫 VS Code 去开一遍")
})

test("openExternal 返回 false 必须判失败——这正是 3.91.3 的 bug", async () => {
	const h = deps({ platform: "linux", external: false })
	const failure = await openFolderInOs("/tmp/diagnostics", h.deps)

	assert.notEqual(failure, null, "false 被当成成功，用户就只会看到 VS Code 的裸错误框")
	assert.match(String(failure), /openExternal/, "失败原因要说清是哪一步没成")
})

test("非 Windows：不起 explorer，直接交给 VS Code", async () => {
	for (const platform of ["linux", "darwin"] as const) {
		const h = deps({ platform })
		assert.equal(await openFolderInOs("/tmp/x", h.deps), null)
		assert.deepEqual(h.spawned, [], `${platform} 上不该起 explorer.exe`)
		assert.deepEqual(h.externalCalls, ["/tmp/x"])
	}
})

test("explorer 起不来：退回 openExternal，并按它的返回值判成败", async () => {
	const ok = deps({ platform: "win32", spawnError: "spawn explorer.exe ENOENT", external: true })
	assert.equal(await openFolderInOs("C:\\a", ok.deps), null, "退路成功也算成功")
	assert.deepEqual(ok.externalCalls, ["C:\\a"])

	const bad = deps({ platform: "win32", spawnError: "spawn explorer.exe ENOENT", external: false })
	assert.notEqual(await openFolderInOs("C:\\a", bad.deps), null, "两条路都失败必须报失败")
})

test("openExternal 抛异常：把异常消息当失败原因，不往上冒", async () => {
	const h = deps({ platform: "linux", external: "throw" })
	assert.equal(await openFolderInOs("/tmp/x", h.deps), "no opener available")
})

test("spawnDetachedProcess：命令不存在要返回错误，存在就返回 null 且不等它退出", async () => {
	const missing = await spawnDetachedProcess("definitely-not-a-real-command-9f3a", [])
	assert.notEqual(missing, null, "命令不存在必须报错，不能静默成功")
	assert.match(String(missing), /ENOENT|not found/i)

	// 起一个会活 2 秒的进程：必须在 spawn 之后立刻返回，而不是等它退出
	const startedAt = Date.now()
	const ok = await spawnDetachedProcess(process.execPath, ["-e", "setTimeout(() => {}, 2000)"])
	const elapsed = Date.now() - startedAt
	assert.equal(ok, null)
	assert.ok(elapsed < 1500, `不该等子进程退出（实际等了 ${elapsed}ms）`)
})

test("真实依赖：Windows 判定走 explorer，其它平台不走", () => {
	const opened: string[] = []
	const openExternal = async (dir: string) => {
		opened.push(dir)
		return true
	}
	assert.equal(createOpenInOsDeps(openExternal, "win32").platform, "win32")
	assert.equal(typeof createOpenInOsDeps(openExternal, "win32").spawnDetached, "function")
	assert.equal(createOpenInOsDeps(openExternal, "darwin").platform, "darwin")
})

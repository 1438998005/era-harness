/**
 * CliDebug 协议客户端（clidebug）的回归测试。
 *
 * 核心不变式：
 * 1. 握手：hello 必须在超时前收到；进程提前退出要报退出码而不是挂死。
 * 2. request/result 按 id 配对，ok:false 要把引擎的 error 文本抛出来。
 * 3. quit 是干净退出；引擎不理 quit 时按宽限强杀，且 wasKilled() 如实标记。
 * 4. 解析模式看到「文件解析完成」就收尾（引擎解析完不会自行退出）；
 *    启动观察以 wait 事件为「走到标题画面」的信号，log 命令取回控制台缓冲。
 *
 * 假引擎用 node 自身（process.execPath + -e）——不碰真实游戏目录。
 * node 不认 `--CliDebug` 参数，所以经 spawnFn 注入把该参数滤掉后再交给 node。
 */

import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
	CliDebugSession,
	engineMajorVersion,
	findActiveCliDebug,
	findBlockingRun,
	runCliDebugBootWatch,
	runCliDebugParse,
	supportsCliDebug,
} from "../../src/core/era/clidebug"
import { sleep, startEngine, stopEngine, waitForSettle } from "../../src/core/era/game-runner"

/** 假引擎：会处理 stdin 命令（log / quit），echo id */
const FAKE_ENGINE_INTERACTIVE = `
	const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\\n");
	send({ type: "hello", protocol: 1, version: "16.6.13", pid: process.pid });
	send({ type: "ready", });
	let buf = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (d) => {
		buf += d;
		let i;
		while ((i = buf.indexOf("\\n")) >= 0) {
			const line = buf.slice(0, i);
			buf = buf.slice(i + 1);
			if (!line.trim()) continue;
			let cmd;
			try { cmd = JSON.parse(line) } catch { continue }
			if (cmd.cmd === "log") {
				send({ type: "result", id: cmd.id, ok: true, log: "log-for-" + cmd.id });
			} else if (cmd.cmd === "quit") {
				send({ type: "result", id: cmd.id, ok: true });
				send({ type: "exit" });
				process.exit(0);
			} else {
				send({ type: "result", id: cmd.id, ok: false, error: "unknown cmd: " + cmd.cmd });
			}
		}
	});
`

/** 假引擎（stubborn 版）：收到任何命令都只回 result，**绝不退出**——逼 quit 走强杀兜底 */
const FAKE_ENGINE_STUBBORN = `
	const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\\n");
	send({ type: "hello", protocol: 1, version: "16.6.13", pid: process.pid });
	send({ type: "ready" });
	let buf = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (d) => {
		buf += d;
		let i;
		while ((i = buf.indexOf("\\n")) >= 0) {
			const line = buf.slice(0, i);
			buf = buf.slice(i + 1);
			if (!line.trim()) continue;
			let cmd;
			try { cmd = JSON.parse(line) } catch { continue }
			send({ type: "result", id: cmd.id, ok: true });
		}
	});
`

/** 把 `--CliDebug` 滤掉再交给 node（node 不认这个参数） */
function fakeSpawn(script: string) {
	return (exePath: string, args: readonly string[], options: Parameters<typeof spawn>[2]) =>
		spawn(process.execPath, ["-e", script, ...args.filter((arg) => arg !== "--CliDebug")], options)
}

/**
 * 假引擎 exe 放在**独立**临时目录（dirname = 引擎 cwd）。
 * 不能共用一个固定路径：Analysis.log 相关测试靠这个目录隔离，否则会读到别的用例留下的文件。
 */
async function makeFakeExe(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "era-clidebug-"))
	return path.join(dir, "Emuera_fake_engine.exe")
}

// —— 版本闸门 ——

test("engineMajorVersion: V16.6.13 → 16，无版本号 → 0", () => {
	assert.equal(engineMajorVersion("Emuera_skiaV16.6.13_x64.exe"), 16)
	assert.equal(engineMajorVersion("Emuera_skiaV10_x64.exe"), 10)
	assert.equal(engineMajorVersion("Emuera.exe"), 0)
})

test("supportsCliDebug: 15 起支持，14 及以下/无名版本不支持", () => {
	assert.equal(supportsCliDebug("Emuera_skiaV16.6.13_x64.exe"), true)
	assert.equal(supportsCliDebug("Emuera_skiaV15.exe"), true)
	assert.equal(supportsCliDebug("Emuera_skiaV10_x64.exe"), false)
	assert.equal(supportsCliDebug("Emuera.exe"), false)
})

// —— 会话：握手 / request / quit ——

test("CliDebugSession.start: 完成握手并记录 hello", async () => {
	const exePath = await makeFakeExe()
	const session = await CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_INTERACTIVE))
	try {
		const hello = session.getHello()
		assert.ok(hello, "应收到 hello 事件")
		assert.equal(hello.protocol, 1)
		assert.equal(hello.version, "16.6.13")
		assert.equal(typeof session.pid, "number")
	} finally {
		await session.quit(5000)
		session.dispose()
	}
})

test("CliDebugSession.start: 进程握手前退出时报退出码", async () => {
	const exePath = await makeFakeExe()
	await assert.rejects(CliDebugSession.start(exePath, [], fakeSpawn("process.exit(5);")), /退出码 5/)
})

test("CliDebugSession.start: exe 不存在时报 spawn 错误", async () => {
	await assert.rejects(CliDebugSession.start("D:/definitely-not-here/Emuera_nope.exe", [], spawn), /引擎进程启动失败/)
})

test("request: 按 id 配对 result；ok:false 抛出引擎 error 文本", async () => {
	const exePath = await makeFakeExe()
	const session = await CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_INTERACTIVE))
	try {
		const ok = await session.request({ cmd: "log" }, 5000)
		assert.equal(ok.ok, true)

		await assert.rejects(session.request({ cmd: "nope" }, 5000), /unknown cmd: nope/)
	} finally {
		await session.quit(5000)
		session.dispose()
	}
})

test("quit: 引擎配合时干净退出；不理会时按宽限强杀并如实标记", async () => {
	const exePath = await makeFakeExe()
	const wellBehaved = await CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_INTERACTIVE))
	await wellBehaved.quit(5000)
	assert.equal(wellBehaved.isExited(), true)
	assert.equal(wellBehaved.wasKilled(), false)
	assert.equal(wellBehaved.getExitCode(), 0)
	wellBehaved.dispose()

	const stubborn = await CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_STUBBORN))
	await stubborn.quit(800)
	// quit 内部的 2 秒兜底在重负载机器上可能不够：再给一次宽限再断言（复审批 F6）
	await stubborn.waitForExit(5000)
	assert.equal(stubborn.isExited(), true)
	assert.equal(stubborn.wasKilled(), true)
	stubborn.dispose()
})

test("waitForEvent: 先查已缓冲事件，再等新到事件", async () => {
	const exePath = await makeFakeExe()
	const script = `
		${FAKE_ENGINE_INTERACTIVE}
		setTimeout(() => process.stdout.write(JSON.stringify({ type: "wait", inputType: "AnyKey" }) + "\\n"), 150);
	`
	const session = await CliDebugSession.start(exePath, [], fakeSpawn(script))
	try {
		const waitEvent = await session.waitForEvent((event) => event.type === "wait", 5000)
		assert.equal(waitEvent?.inputType, "AnyKey")
		// 第二次调用直接命中缓冲
		const again = await session.waitForEvent((event) => event.type === "wait", 0)
		assert.equal(again?.inputType, "AnyKey")
	} finally {
		await session.quit(5000)
		session.dispose()
	}
})

// —— 两个高层流程 ——

test("runCliDebugParse: 看到解析完成标志就收尾，out 全文被收集", async () => {
	const exePath = await makeFakeExe()
	const script = `
		${FAKE_ENGINE_INTERACTIVE}
		send({ type: "out", text: "警告 Lv1: x.erb 3行目" });
		send({ type: "out", text: "错误: 未定义标识符 hoge" });
		send({ type: "out", text: "文件解析完成：结果输出至Analysis.log" });
	`
	const result = await runCliDebugParse({
		exePath: exePath,
		targetPath: "D:/fake/ERB",
		timeoutMs: 30_000,
		spawnFn: fakeSpawn(script),
	})
	assert.equal(result.completionSeen, true)
	assert.equal(result.endedBy, "quit")
	assert.equal(result.outText.includes("错误: 未定义标识符 hoge"), true)
	assert.equal(result.outText.includes("解析完成"), true)
	// exe 目录（临时目录）里没有 Analysis.log，要如实报 undefined 而不是抛错
	assert.equal(result.analysisLog, undefined)
	assert.equal(result.hello?.version, "16.6.13")
})

test("runCliDebugBootWatch: wait 事件到达后取 log，quit 干净收场", async () => {
	const exePath = await makeFakeExe()
	const script = `
		${FAKE_ENGINE_INTERACTIVE}
		send({ type: "out", text: "（字符画刷屏）" });
		send({ type: "state", state: "Title" });
		send({ type: "dialog", dialog: "MessageBox", title: "错误", text: "ERB 解析失败" });
		setTimeout(() => send({ type: "wait", inputType: "AnyKey" }), 100);
	`
	const result = await runCliDebugBootWatch({
		exePath: exePath,
		settleTimeoutMs: 15_000,
		spawnFn: fakeSpawn(script),
	})
	assert.equal(result.reachedInputWait, true)
	assert.equal(result.stateName, "Title")
	assert.equal(result.logText?.startsWith("log-for-"), true, "log 命令应取回假引擎的应答")
	assert.equal(result.dialogs.length, 1)
	assert.equal(result.dialogs[0]!.title, "错误")
	assert.equal(result.endedBy, "quit")
})

test("runCliDebugBootWatch: 引擎一直不 wait 时超时收场，不挂死", async () => {
	const exePath = await makeFakeExe()
	// 超时场景的假引擎：会答 log 命令，但从不 wait、从不退出
	const script = `
		process.stdout.write(JSON.stringify({type:'hello',protocol:1}) + "\\n");
		process.stdout.write(JSON.stringify({type:'ready'}) + "\\n");
		let buf = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (d) => {
			buf += d;
			let i;
			while ((i = buf.indexOf("\\n")) >= 0) {
				const line = buf.slice(0, i);
				buf = buf.slice(i + 1);
				if (!line.trim()) continue;
				let cmd;
				try { cmd = JSON.parse(line) } catch { continue }
				if (cmd.cmd === "log") {
					process.stdout.write(JSON.stringify({ type: "result", id: cmd.id, ok: true, log: "timeout-scene-console" }) + "\\n");
				} else {
					// quit 也只回 result，绝不退出——逼强杀兜底
					process.stdout.write(JSON.stringify({ type: "result", id: cmd.id, ok: true }) + "\\n");
				}
			}
		});
	`
	const result = await runCliDebugBootWatch({
		exePath: exePath,
		settleTimeoutMs: 15_000,
		quitGraceMs: 800,
		spawnFn: fakeSpawn(script),
	})
	// 假引擎不理 quit：强杀收场，必须如实标记
	assert.equal(result.reachedInputWait, false)
	assert.equal(result.endedBy, "killed")
	// 超时场景恰恰最需要看控制台：进程活着就要取 log（review 修复批 #5）
	assert.equal(result.logText, "timeout-scene-console")
})

// —— review 修复批新增 ——

test("握手失败路径：孤儿进程被强杀，不会永久残留（review 修复批 #1）", async () => {
	const exePath = await makeFakeExe()
	let pid: number | undefined
	const spawnFn = (_exe: string, args: readonly string[], options: Parameters<typeof spawn>[2]) => {
		// 只发呆、永不发 hello 的假引擎
		const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], options)
		pid = child.pid
		return child
	}
	await assert.rejects(CliDebugSession.start(exePath, [], spawnFn, 1000), /握手超时/)
	// TerminateProcess 异步落地：轮询探活（死进程 kill(0) 抛 ESRCH），最多等 3 秒
	// ——固定 sleep 500ms 在慢机器上会飘（复审批 F6）
	let dead = false
	for (let i = 0; i < 30 && !dead; i++) {
		await new Promise((resolve) => setTimeout(resolve, 100))
		try {
			process.kill(pid!, 0)
		} catch {
			dead = true
		}
	}
	assert.ok(dead, "孤儿进程应在宽限内被强杀")
})

test("同 exe 撞键：第二个 start 立刻抛错，不互踢登记（复审批 F4）", async () => {
	const exePath = await makeFakeExe()
	const first = await CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_INTERACTIVE))
	try {
		await assert.rejects(CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_INTERACTIVE)), /已有进行中的 CliDebug 会话/)
		// 第一个会话的登记没有被后到的会话踢掉
		assert.equal(findActiveCliDebug(exePath), first)
	} finally {
		await first.quit(5000)
		first.dispose()
	}
	assert.equal(findActiveCliDebug(exePath), undefined)
})

test("runCliDebugParse: 旧的 Analysis.log 标 stale，不当成本次结果（review 修复批 #3）", async () => {
	const exePath = await makeFakeExe()
	const staleLog = path.join(path.dirname(exePath), "Analysis.log")
	await fs.writeFile(staleLog, "错误: 这是上一轮解析的旧错误")
	const past = new Date(Date.now() - 60_000)
	await fs.utimes(staleLog, past, past)

	const script = `
		${FAKE_ENGINE_INTERACTIVE}
		send({ type: "out", text: "文件解析完成：结果输出至Analysis.log" });
	`
	const result = await runCliDebugParse({
		exePath: exePath,
		targetPath: path.dirname(exePath),
		timeoutMs: 30_000,
		spawnFn: fakeSpawn(script),
	})
	assert.equal(result.completionSeen, true)
	assert.equal(result.analysisLog?.stale, true)
	assert.equal(result.analysisLog?.text.includes("上一轮解析的旧错误"), true)
})

test("runCliDebugParse: 引擎本次写的 Analysis.log 不标 stale（review 修复批 #3 对照）", async () => {
	const exePath = await makeFakeExe()
	const script = `
		${FAKE_ENGINE_INTERACTIVE}
		require("fs").writeFileSync("Analysis.log", "警告 Lv1: fresh.erb 5行目");
		send({ type: "out", text: "文件解析完成：结果输出至Analysis.log" });
	`
	const result = await runCliDebugParse({
		exePath: exePath,
		targetPath: path.dirname(exePath),
		timeoutMs: 30_000,
		spawnFn: fakeSpawn(script),
	})
	assert.equal(result.completionSeen, true)
	assert.equal(result.analysisLog?.stale, false)
	assert.equal(result.analysisLog?.text.includes("fresh.erb"), true)
})

test("活动会话登记：运行中可查到，退出后注销（review 修复批 #4）", async () => {
	const exePath = await makeFakeExe()
	const session = await CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_INTERACTIVE))
	assert.equal(findActiveCliDebug(exePath), session)
	await session.quit(5000)
	session.dispose()
	assert.equal(findActiveCliDebug(exePath), undefined)
})

test("spawn 即登记：start 未 resolve（握手进行中）时互斥查询已可见（review 批 B1）", async () => {
	const exePath = await makeFakeExe()
	// 慢 hello：800ms 才发 —— start() 在此期间一直挂着，登记必须已经生效
	const script = `
		setTimeout(() => {
			process.stdout.write(JSON.stringify({ type: "hello", protocol: 1, version: "16.6.13", pid: process.pid }) + "\\n");
			process.stdout.write(JSON.stringify({ type: "ready" }) + "\\n");
		}, 800);
		setInterval(() => {}, 1000);
	`
	const startPromise = CliDebugSession.start(exePath, [], fakeSpawn(script), 5000)
	// start 还没 resolve，互斥查询就该能看到这个进程
	assert.ok(findActiveCliDebug(exePath), "握手窗口内 findActiveCliDebug 必须能查到")
	const session = await startPromise
	await session.quit(5000)
	session.dispose()
})

test("boot 观察：引擎启动即崩时立刻收场，不干等满超时（review 批 B3）", async () => {
	const exePath = await makeFakeExe()
	// hello+ready 后 150ms 退出（退出码 3），从不发 wait —— 修复前 waitForEvent 只能等满 settleTimeout
	const script = `
		process.stdout.write(JSON.stringify({type:'hello',protocol:1,version:'16.6.13'}) + "\\n");
		process.stdout.write(JSON.stringify({type:'ready'}) + "\\n");
		setTimeout(() => process.exit(3), 150);
	`
	const settleTimeoutMs = 15_000
	const startedAt = Date.now()
	const result = await runCliDebugBootWatch({
		exePath: exePath,
		settleTimeoutMs,
		spawnFn: fakeSpawn(script),
	})
	assert.equal(result.reachedInputWait, false)
	assert.equal(result.endedBy, "exit")
	assert.equal(result.exitCode, 3)
	// 关键断言：远小于 settleTimeout 就返回了（修复前会烧满 15 秒）
	assert.ok(
		Date.now() - startedAt < settleTimeoutMs / 2,
		`崩溃收场应在远小于 settleTimeout 的时间内返回（实际 ${Date.now() - startedAt}ms）`,
	)
})

test("引擎退出后挂起的 request 被 reject，不烧满超时（review 批 B3 对照）", async () => {
	const exePath = await makeFakeExe()
	// 收到 log 先不回 result，200ms 后退出 —— 挂起的 request 只能靠 setExited 放行
	const script = `
		process.stdout.write(JSON.stringify({type:'hello',protocol:1}) + "\\n");
		process.stdout.write(JSON.stringify({type:'ready'}) + "\\n");
		let buf = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (d) => {
			buf += d;
			let i;
			while ((i = buf.indexOf("\\n")) >= 0) {
				const line = buf.slice(0, i);
				buf = buf.slice(i + 1);
				if (!line.trim()) continue;
				let cmd;
				try { cmd = JSON.parse(line) } catch { continue }
				if (cmd.cmd === "log") {
					setTimeout(() => process.exit(1), 200);
				} else {
					process.stdout.write(JSON.stringify({ type: "result", id: cmd.id, ok: true }) + "\\n");
				}
			}
		});
	`
	const session = await CliDebugSession.start(exePath, [], fakeSpawn(script))
	try {
		const startedAt = Date.now()
		await assert.rejects(session.request({ cmd: "log" }, 20_000), /引擎已退出/)
		assert.ok(Date.now() - startedAt < 10_000, "应在进程退出时立刻 reject，而不是等满 20 秒超时")
	} finally {
		session.dispose()
	}
})

test("findBlockingRun：归一化匹配两路互斥来源，统一判据（review 批 B2/B7）", async () => {
	const exePath = await makeFakeExe()
	// verify 路：CliDebug 会话活着时，大小写 / 斜杠方向不同的路径都能命中
	const session = await CliDebugSession.start(exePath, [], fakeSpawn(FAKE_ENGINE_INTERACTIVE))
	try {
		assert.equal(findBlockingRun(exePath)?.kind, "verify")
		assert.equal(findBlockingRun(exePath.toUpperCase())?.kind, "verify")
		assert.equal(findBlockingRun(exePath.replace(/\\/g, "/"))?.kind, "verify")
	} finally {
		await session.quit(5000)
		session.dispose()
	}
	assert.equal(findBlockingRun(exePath), undefined, "会话退出后不再阻塞")

	// game 路：真实拉起一个长驻进程（node 自身当假引擎，startEngine 无注入点）
	const run = startEngine(process.execPath, ["-e", "setTimeout(() => {}, 20000)"])
	try {
		await sleep(200)
		assert.equal(run.exited, false)
		assert.equal(findBlockingRun(process.execPath)?.kind, "game")
		assert.equal(findBlockingRun(process.execPath.replace(/\\/g, "/"))?.kind, "game")
		assert.equal(findBlockingRun("D:/definitely-not-running/Emuera.exe"), undefined, "无关路径不阻塞")
	} finally {
		stopEngine(run)
		await waitForSettle(run, 5000)
	}
})

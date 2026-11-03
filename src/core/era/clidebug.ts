import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { listRunningGames, type RunningGame, sleep } from "./game-runner"

/**
 * Emuera `--CliDebug` 协议客户端（era_verify 的底座，KB 17 §17.6）。
 *
 * 引擎 ≥15.0.0 自带该模式：stdin/stdout 走 JSON Lines（双方均 UTF-8 无 BOM，
 * 引擎在 WinExe 下显式强制 UTF-8，防回退 GBK），专为 agent 驱动设计——
 * 模态对话框转 stdout `dialog` 事件（无人值守不卡死），`log` 命令能取回
 * 控制台缓冲全文（被开头字符画刷掉的报错也在），`quit` 命令干净退出并刷日志。
 * 窗口照常显示（非 headless），命令经 UI 线程派发。
 *
 * 解析模式 = 位置参数传 .ERB/目录：强制编译、警告全量（Lv1/Lv2 不过滤）、
 * 不进游戏，结果落 exe 目录 `Analysis.log`，完成标志是「文件解析完成」。
 *
 * 协议事实均出自引擎源码 `Emuera/UI/CliDebug/CliDebugHost.cs`（仓库见 KB 07 §7.2）。
 */

export interface CliDebugEvent {
	type: string
	[key: string]: unknown
}

export interface CliDebugHello {
	type: "hello"
	protocol: number
	version?: string
	pid?: number
}

export interface CliDebugDialogEvent extends CliDebugEvent {
	type: "dialog"
	dialog?: string
	title?: string
	text?: string
}

export interface CliDebugWaitEvent extends CliDebugEvent {
	type: "wait"
	inputType?: string
}

/** 解析模式完成标志（引擎打印「文件解析完成：结果输出至Analysis.log」；收紧到整词防误匹配正文里偶尔出现的「解析完成」字样） */
const PARSE_COMPLETION_RE = /文件解析完成/
/** CliDebug 于引擎 15.0.0 引入 */
export const CLI_DEBUG_MIN_MAJOR_VERSION = 15
/** quit 后等引擎自行关闭的宽限时长，超时强杀 */
export const QUIT_GRACE_MS = 15_000

/** 从引擎文件名取主版本号（Emuera_skiaV16.6.13_x64.exe → 16）；解析失败返回 0 */
export function engineMajorVersion(fileName: string): number {
	const match = /v(\d+)/i.exec(fileName)
	return match ? Number.parseInt(match[1] ?? "0", 10) : 0
}

/** 引擎版本是否支持 CliDebug（<15 时工具须降级提示） */
export function supportsCliDebug(fileName: string): boolean {
	return engineMajorVersion(fileName) >= CLI_DEBUG_MIN_MAJOR_VERSION
}

type SpawnFn = typeof spawn

/** 握手等待默认时长：引擎启动 + 配置加载（大工程 lazyloading 索引也在这一段） */
const HANDSHAKE_TIMEOUT_MS = 30_000

// —— 活动会话登记（互斥用，review 修复批 #4）——
//
// CliDebug 会话不进 game-runner 的 runningGames（那是「启动游戏」的 GUI 实例台账），
// 但互斥必须双向可见：verify 跑着时不能再起 run_game / 快捷启动，反之亦然——
// Emuera 双开互相抢写 sav/ 与懒加载索引，不管谁先谁后都不行。
const activeSessions = new Map<string, { exePath: string; session: CliDebugSession }>()

function keyOfExe(exePath: string): string {
	return exePath.replace(/\\/g, "/").toLowerCase()
}

/** 查某个引擎是否有正在进行的 CliDebug 会话（era_verify 与各启动入口的互斥判据） */
export function findActiveCliDebug(exePath: string): CliDebugSession | undefined {
	return activeSessions.get(keyOfExe(exePath))?.session
}

/** 全部活动中的 CliDebug 会话（「结束游戏」命令靠它把 verify 进程也列进可结束清单） */
export function listActiveCliDebugSessions(): ReadonlyArray<{ exePath: string; session: CliDebugSession }> {
	return [...activeSessions.values()]
}

/** 互斥冲突：要么有活着的 GUI 实例，要么有进行中的 CliDebug 会话 */
export type BlockingRun = { kind: "game"; run: RunningGame } | { kind: "verify"; session: CliDebugSession }

/**
 * 统一互斥判据（全项目 review 批 B2）：斜杠归一 + 小写后同时查 GUI 实例台账
 * 与 CliDebug 会话。放在 clidebug 而不是 game-runner，是因为依赖必须单向
 * （clidebug → game-runner，反向会成环）；plan 阶段与执行前复查都必须走它，
 * 消灭各 handler 手写的归一逻辑。
 */
export function findBlockingRun(exePath: string): BlockingRun | undefined {
	const key = keyOfExe(exePath)
	const run = listRunningGames().find((candidate) => keyOfExe(candidate.exePath) === key)
	if (run && !run.exited) {
		return { kind: "game", run }
	}
	const session = activeSessions.get(key)?.session
	if (session) {
		return { kind: "verify", session }
	}
	return undefined
}

export class CliDebugSession {
	private readonly child: ChildProcess
	private readonly events: CliDebugEvent[] = []
	private readonly outTexts: string[] = []
	private readonly resultWaiters = new Map<
		number,
		{ resolve: (event: CliDebugEvent) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
	>()
	private readonly eventWaiters: Array<{
		predicate: (event: CliDebugEvent) => boolean
		resolve: (event: CliDebugEvent | undefined) => void
		timer: NodeJS.Timeout
	}> = []
	private buffer = ""
	private nextId = 1
	/** 解析模式完成标志（handleLine 在收到匹配的 out 行时置位，轮询只读这个布尔——原实现对全量 outText 反复 join+正则是 O(n²)） */
	private completionMarkSeen = false
	private hello: CliDebugHello | undefined
	private exited = false
	private exitCode: number | null | undefined
	private killed = false
	private spawnError: string | undefined
	private exitWaiters: Array<{ resolve: () => void }> = []
	/** 互斥登记键（登记时的 exePath）。注销必须用同一把键——spawnFn 注入时 child.spawnfile 与它不同源 */
	private registryKey: string | undefined

	private constructor(child: ChildProcess) {
		this.child = child
		child.stdout?.setEncoding("utf8")
		child.stdout?.on("data", (chunk: string) => {
			this.buffer += chunk
			this.drainBuffer()
		})
		// 引擎先死而 exit 事件未落地时，stdin.write 会触发 EPIPE——没有监听器的
		// error 事件 = uncaught exception，会把扩展宿主带崩。send() 的
		// destroyed/exited 检查只防常规路径，这里兜的是竞态窗口。
		child.stdin?.on("error", () => {})
		child.on("error", (error: Error) => {
			this.spawnError = error.message
			this.setExited(null)
		})
		child.on("exit", (code) => {
			this.setExited(code)
		})
	}

	/** spawn + 等握手（hello → ready）。握手前退出/超时/spawn 失败都直接抛错。 */
	static async start(
		exePath: string,
		args: readonly string[],
		spawnFn: SpawnFn = spawn,
		handshakeTimeoutMs = HANDSHAKE_TIMEOUT_MS,
	): Promise<CliDebugSession> {
		const options: SpawnOptions = {
			cwd: path.dirname(exePath),
			// stderr 不要（引擎会往里写运行时噪音）；stdin/stdout 必须是管道
			stdio: ["pipe", "pipe", "ignore"],
			windowsHide: false,
		}
		const child = spawnFn(exePath, ["--CliDebug", ...args], options)
		const session = new CliDebugSession(child)
		// spawn 即登记，不等握手：spawn→hello 之间最长 30s 的窗口里互斥查询也必须能看到
		// 这个进程，否则第二个入口会趁机双开（全项目 review 批 B1）。
		// 撞键即抛（复审批 F4）：同 exe 已有活着的会话时，覆盖式 set 会互踢登记——
		// 先退出的一方 delete 键会把还活着的一方从登记表里删掉，互斥失明。
		// 这里把冲突收口为原子检查：新会话立刻 dispose（杀掉刚 spawn 的进程）并抛错。
		const registryKey = keyOfExe(exePath)
		const existing = activeSessions.get(registryKey)
		if (existing && !existing.session.isExited()) {
			session.dispose()
			throw new Error(`该引擎已有进行中的 CliDebug 会话（PID ${existing.session.pid ?? "未知"}），不能同时两路驱动`)
		}
		session.registryKey = registryKey
		activeSessions.set(registryKey, { exePath, session })

		const deadline = Date.now() + handshakeTimeoutMs
		while (session.hello === undefined && !session.exited && Date.now() < deadline) {
			await sleep(50)
		}
		if (session.spawnError) {
			session.dispose()
			throw new Error(`引擎进程启动失败：${session.spawnError}`)
		}
		if (session.hello === undefined) {
			const reason = session.exited
				? `进程在握手前退出（退出码 ${session.exitCode ?? "无"}）——引擎可能不支持 --CliDebug（需 15.0.0+）或加载阶段直接崩了`
				: `握手超时（${Math.round(handshakeTimeoutMs / 1000)} 秒内未收到 hello 事件）`
			session.dispose()
			throw new Error(reason)
		}
		// 握手成功后的 ready 等待（引擎紧随 hello 发出；个别版本可能不发，超时不视为失败）
		const readyDeadline = Date.now() + 10_000
		while (!session.exited && Date.now() < readyDeadline) {
			if (session.hasEvent((event) => event.type === "ready")) {
				break
			}
			await sleep(50)
		}
		return session
	}

	get pid(): number | undefined {
		return this.child.pid
	}

	getHello(): CliDebugHello | undefined {
		return this.hello
	}

	isExited(): boolean {
		return this.exited
	}

	wasKilled(): boolean {
		return this.killed
	}

	getExitCode(): number | null | undefined {
		return this.exitCode
	}

	getSpawnError(): string | undefined {
		return this.spawnError
	}

	/** 全部 out 事件文本（按到达顺序拼接，事件间以换行分隔） */
	getOutText(): string {
		return this.outTexts.join("\n")
	}

	/** 事件快照（含 dialog/wait/state 等） */
	getEvents(): readonly CliDebugEvent[] {
		return [...this.events]
	}

	/** 是否收到过匹配的事件（boot 报告用它确认输入等待信号） */
	hasEvent(predicate: (event: CliDebugEvent) => boolean): boolean {
		return this.events.some(predicate)
	}

	/** 解析模式是否已看到「文件解析完成」标志 */
	hasCompletionMark(): boolean {
		return this.completionMarkSeen
	}

	/** 发送命令（自动带自增 id）。stdin 已关闭时静默丢弃——上层靠超时兜底。 */
	send(cmd: Record<string, unknown>): number {
		const id = this.nextId++
		if (this.child.stdin && !this.child.stdin.destroyed && this.exited === false) {
			this.child.stdin.write(`${JSON.stringify({ ...cmd, id })}\n`, "utf8")
		}
		return id
	}

	/** 发命令并等对应 result。失败（ok:false）抛出引擎给的 error 文本。 */
	async request(cmd: Record<string, unknown>, timeoutMs: number): Promise<CliDebugEvent> {
		// 会话已死就别等了：send 会被丢弃，这里只能烧满超时（review 批 P3）
		if (this.exited) {
			throw new Error("引擎已退出")
		}
		const id = this.send(cmd)
		return new Promise<CliDebugEvent>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.resultWaiters.delete(id)
				reject(new Error(`命令 ${String(cmd.cmd)} 超时（${timeoutMs}ms）`))
			}, timeoutMs)
			this.resultWaiters.set(id, { resolve, reject, timer })
		})
	}

	/** 等待首个匹配的事件（先查已缓冲的，再等新到的）。 */
	async waitForEvent(predicate: (event: CliDebugEvent) => boolean, timeoutMs: number): Promise<CliDebugEvent | undefined> {
		const buffered = this.events.find(predicate)
		if (buffered) {
			return buffered
		}
		return new Promise<CliDebugEvent | undefined>((resolve) => {
			const timer = setTimeout(() => {
				const index = this.eventWaiters.findIndex((waiter) => waiter.timer === timer)
				if (index >= 0) {
					this.eventWaiters.splice(index, 1)
				}
				resolve(undefined)
			}, timeoutMs)
			this.eventWaiters.push({ predicate, resolve, timer })
		})
	}

	/** 等进程退出。已退出立刻返回。 */
	async waitForExit(timeoutMs: number): Promise<boolean> {
		if (this.exited) {
			return true
		}
		const deadline = Date.now() + timeoutMs
		while (!this.exited && Date.now() < deadline) {
			await sleep(100)
		}
		return this.exited
	}

	/** 干净退出：发 quit，等引擎自行关闭；超时强杀（TerminateProcess）。 */
	async quit(graceMs = QUIT_GRACE_MS): Promise<void> {
		if (this.exited) {
			return
		}
		this.send({ cmd: "quit" })
		const exited = await this.waitForExit(graceMs)
		if (!exited) {
			this.kill()
			// TerminateProcess 是异步的：exit 事件要下一拍才落地，不等待的话
			// 调用方紧跟着查 isExited() 会拿到 false
			await this.waitForExit(2000)
		}
	}

	/** 强杀（丢未保存进度；只在 quit 超时或调用方明确要求时用） */
	kill(): void {
		if (this.exited) {
			return
		}
		this.killed = true
		try {
			this.child.kill()
		} catch {
			// 已死的进程 kill 会抛，忽略
		}
	}

	/** 解绑全部监听与挂起等待者；进程还活着先强杀（review 修复批：握手失败的孤儿 GUI 窗口就是这么泄漏的） */
	dispose(): void {
		// kill() 自带 exited 守卫：正常 quit 后调用是 no-op，只有异常路径会真杀
		this.kill()
		// 强杀后 exit 监听会被下面 removeAllListeners 摘掉，setExited 里的注销不会再跑——这里同步兜底。
		// 所有权检查（复审批 F4）：并发重叠会话时不能误删别人的登记
		if (this.registryKey !== undefined && activeSessions.get(this.registryKey)?.session === this) {
			activeSessions.delete(this.registryKey)
		}
		for (const [, waiter] of this.resultWaiters) {
			clearTimeout(waiter.timer)
			waiter.reject(new Error("会话已关闭"))
		}
		this.resultWaiters.clear()
		for (const waiter of this.eventWaiters) {
			clearTimeout(waiter.timer)
			waiter.resolve(undefined)
		}
		this.eventWaiters.length = 0
		this.child.removeAllListeners()
		this.child.stdout?.removeAllListeners()
	}

	private setExited(code: number | null): void {
		this.exited = true
		this.exitCode = code
		// 从互斥登记里注销（用登记时的键，spawnfile 在注入 spawn 时不同源）。
		// 所有权检查（复审批 F4）：登记键被更新的会话占走时不得误删
		if (this.registryKey !== undefined && activeSessions.get(this.registryKey)?.session === this) {
			activeSessions.delete(this.registryKey)
		}
		for (const waiter of this.exitWaiters) {
			waiter.resolve()
		}
		this.exitWaiters.length = 0
		// 进程死了就不会再有新事件/应答：先刷尾缓冲（引擎最后一口气发的 result
		// 还能正常配对），再放行所有挂起的等待者——否则 boot 观察碰到「引擎启动
		// 即崩」会干等满 settleTimeoutMs（全项目 review 批 B3）。
		this.flushBufferTail()
		for (const waiter of this.eventWaiters) {
			clearTimeout(waiter.timer)
			waiter.resolve(undefined)
		}
		this.eventWaiters.length = 0
		for (const [, waiter] of this.resultWaiters) {
			clearTimeout(waiter.timer)
			waiter.reject(new Error("引擎已退出"))
		}
		this.resultWaiters.clear()
	}

	private drainBuffer(): void {
		let newlineIndex = this.buffer.indexOf("\n")
		while (newlineIndex >= 0) {
			const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, "")
			this.buffer = this.buffer.slice(newlineIndex + 1)
			this.handleLine(line)
			newlineIndex = this.buffer.indexOf("\n")
		}
	}

	private flushBufferTail(): void {
		const tail = this.buffer.replace(/\r$/, "")
		this.buffer = ""
		if (tail.trim()) {
			this.handleLine(tail)
		}
	}

	private handleLine(line: string): void {
		if (!line.trim()) {
			return
		}
		let parsed: unknown
		try {
			parsed = JSON.parse(line)
		} catch {
			// 非 JSON 行（引擎异常输出）忽略——协议要求所有事件都是 JSON 行
			return
		}
		if (typeof parsed !== "object" || parsed === null) {
			return
		}
		const event = parsed as CliDebugEvent
		if (event.type === "hello") {
			this.hello = event as unknown as CliDebugHello
			return
		}
		if (event.type === "result") {
			const rawId = event.id
			const id = typeof rawId === "number" ? rawId : undefined
			if (id !== undefined) {
				const waiter = this.resultWaiters.get(id)
				if (waiter) {
					clearTimeout(waiter.timer)
					this.resultWaiters.delete(id)
					if (event.ok === false) {
						waiter.reject(new Error(String(event.error ?? "命令失败")))
					} else {
						waiter.resolve(event)
					}
					return
				}
			}
			// 无 id / 无等待者的 result 也记录（quit 的回执等）
			this.events.push(event)
			return
		}
		if (event.type === "out" && typeof event.text === "string") {
			this.outTexts.push(event.text)
			if (PARSE_COMPLETION_RE.test(event.text)) {
				this.completionMarkSeen = true
			}
		}
		this.events.push(event)
		// 唤醒等这个事件的人
		for (let i = this.eventWaiters.length - 1; i >= 0; i--) {
			const waiter = this.eventWaiters[i]
			if (waiter && waiter.predicate(event)) {
				clearTimeout(waiter.timer)
				this.eventWaiters.splice(i, 1)
				waiter.resolve(event)
			}
		}
	}
}

// —— 两个高层流程 ——

export interface ParseVerificationResult {
	/** 引擎文件名 */
	engineFile: string
	/** 解析目标（.ERB 文件或目录） */
	target: string
	durationMs: number
	/** 是否看到「文件解析完成」标志 */
	completionSeen: boolean
	/** 进程如何收场：cleanly=自行退出 / quit=干净退出 / killed=强杀 / spawn-error */
	endedBy: "cleanly" | "quit" | "killed" | "spawn-error"
	/** 全部 stdout out 文本（调用方负责再截断） */
	outText: string
	/** exe 目录的 Analysis.log（引擎解析模式产物；不存在则 undefined）。`stale`=上一次解析留下的旧文件 */
	analysisLog:
		| { path: string; text: string; byteLength: number; truncated: boolean; mtimeMs: number; stale: boolean }
		| undefined
	hello: CliDebugHello | undefined
}

/** 解析模式默认总时长；全仓级实测 120 秒起步，超大工程给足余量 */
export const PARSE_DEFAULT_TIMEOUT_MS = 300_000
export const PARSE_MAX_TIMEOUT_MS = 900_000
/** 解析模式读 Analysis.log 的限流（与 LogDiagnoseToolHandler 同款） */
const ANALYSIS_LOG_MAX_BYTES = 8 * 1024 * 1024

/**
 * 解析验证：`--CliDebug <target>`，强制编译目标并全量收警告。
 * 看到「解析完成」标志即收尾（引擎解析完不会自行退出）；总超时兜底。
 */
export async function runCliDebugParse(options: {
	exePath: string
	targetPath: string
	timeoutMs?: number
	/** 测试注入点：默认真 spawn（测试用 node 当假引擎时替换参数） */
	spawnFn?: SpawnFn
}): Promise<ParseVerificationResult> {
	const timeoutMs = Math.min(PARSE_MAX_TIMEOUT_MS, Math.max(10_000, options.timeoutMs ?? PARSE_DEFAULT_TIMEOUT_MS))
	const startedAt = Date.now()
	const session = await CliDebugSession.start(options.exePath, [options.targetPath], options.spawnFn)

	let completionSeen = false
	let endedBy: ParseVerificationResult["endedBy"] = "killed"
	try {
		const deadline = startedAt + timeoutMs
		while (Date.now() < deadline) {
			if (session.isExited()) {
				endedBy = "cleanly"
				break
			}
			if (session.hasCompletionMark()) {
				completionSeen = true
				endedBy = "quit"
				break
			}
			await sleep(250)
		}
		if (!session.isExited()) {
			await session.quit()
			endedBy = session.wasKilled() ? "killed" : "quit"
		}
	} finally {
		session.dispose()
	}

	// Analysis.log 在 exe 目录（引擎的 cwd），每次解析都会重写。
	// stale：文件存在但修改时间早于本次启动——上一次跑留下的旧文件，
	// 超时强杀/未完成的场景会碰到，报告里必须区分（review 修复批 #3）
	const analysisLogPath = path.join(path.dirname(options.exePath), "Analysis.log")
	let analysisLog: ParseVerificationResult["analysisLog"]
	try {
		const stat = await fs.stat(analysisLogPath)
		const readResult = await readTextFileUtf8(analysisLogPath, ANALYSIS_LOG_MAX_BYTES)
		analysisLog = {
			path: analysisLogPath,
			text: readResult.text,
			byteLength: stat.size,
			truncated: readResult.truncated,
			mtimeMs: stat.mtimeMs,
			stale: stat.mtimeMs < startedAt,
		}
	} catch {
		analysisLog = undefined
	}

	return {
		engineFile: path.basename(options.exePath),
		target: options.targetPath,
		durationMs: Date.now() - startedAt,
		completionSeen,
		endedBy,
		outText: session.getOutText(),
		analysisLog,
		hello: session.getHello(),
	}
}

export interface BootWatchResult {
	engineFile: string
	durationMs: number
	hello: CliDebugHello | undefined
	/** 收到过 wait 事件 = 引擎在等输入（标题画面/加载完成的强信号） */
	reachedInputWait: boolean
	/** 最后一次 state 事件的状态名 */
	stateName: string | undefined
	/** 全部 stdout out 文本（调用方负责再截断） */
	outText: string
	/** log 命令取回的控制台缓冲全文（已按行截尾） */
	logText: string | undefined
	/** 模态对话框事件——GUI 下会弹窗卡死的东西在这里，是最可靠的出错信号 */
	dialogs: Array<{ dialog: string | undefined; title: string | undefined; text: string | undefined }>
	endedBy: "quit" | "killed" | "exit" | "spawn-error"
	exitCode: number | null | undefined
}

/** 启动观察默认等待时长（等引擎走到输入等待；大工程首次建索引要 12 秒+） */
export const BOOT_DEFAULT_TIMEOUT_MS = 90_000
export const BOOT_MAX_TIMEOUT_MS = 300_000
/** log 命令取回的行数上限（MAX HISTORY LOG LINES 默认 1500，取尾部足够） */
const BOOT_LOG_TAIL_LINES = 500
/** log 命令本身的超时 */
const LOG_REQUEST_TIMEOUT_MS = 20_000

/**
 * 启动观察：`--CliDebug` 完整启动到等待输入（标题画面），取控制台缓冲全文，再干净退出。
 * 这是「窗口里报了错但日志文件不存在」场景的正路——报错在控制台缓冲里，`log` 命令直接拿。
 */
export async function runCliDebugBootWatch(options: {
	exePath: string
	settleTimeoutMs?: number
	/** 测试注入点：默认真 spawn（测试用 node 当假引擎时替换参数） */
	spawnFn?: SpawnFn
	/** 测试注入点：quit 宽限（默认 15 秒，超时强杀） */
	quitGraceMs?: number
}): Promise<BootWatchResult> {
	const settleTimeoutMs = Math.min(BOOT_MAX_TIMEOUT_MS, Math.max(10_000, options.settleTimeoutMs ?? BOOT_DEFAULT_TIMEOUT_MS))
	const startedAt = Date.now()
	const session = await CliDebugSession.start(options.exePath, [], options.spawnFn)

	let endedBy: BootWatchResult["endedBy"] = "killed"
	let logText: string | undefined
	try {
		// 等引擎走到输入等待（标题画面的按键等待/主菜单）或超时
		await session.waitForEvent((event) => event.type === "wait", settleTimeoutMs)
		if (!session.isExited()) {
			// 取控制台缓冲全文——报错行在缓冲里，不依赖日志文件。
			// 超时/卡死的场景恰恰最需要看引擎停在哪、报了什么（review 修复批 #5）：
			// console.GetLog 不要求等待状态，进程活着就试取，取不到还有 out 流与 dialog 兜底
			try {
				const result = await session.request({ cmd: "log", lines: BOOT_LOG_TAIL_LINES }, LOG_REQUEST_TIMEOUT_MS)
				const payload = result as { log?: unknown }
				if (typeof payload.log === "string") {
					logText = payload.log
				}
			} catch {
				// log 失败不致命
			}
		}
		if (!session.isExited()) {
			await session.quit(options.quitGraceMs ?? QUIT_GRACE_MS)
			endedBy = session.wasKilled() ? "killed" : "quit"
		} else {
			endedBy = session.getSpawnError() ? "spawn-error" : "exit"
		}
	} finally {
		session.dispose()
	}

	const dialogs = session
		.getEvents()
		.filter((event): event is CliDebugDialogEvent => event.type === "dialog")
		.map((event) => ({ dialog: event.dialog, title: event.title, text: event.text }))
	const stateEvents = session.getEvents().filter((event) => event.type === "state")
	const lastState = stateEvents[stateEvents.length - 1] as { state?: string } | undefined

	return {
		engineFile: path.basename(options.exePath),
		durationMs: Date.now() - startedAt,
		hello: session.getHello(),
		reachedInputWait: session.hasEvent((event) => event.type === "wait"),
		stateName: lastState?.state,
		outText: session.getOutText(),
		logText,
		dialogs,
		endedBy,
		exitCode: session.getExitCode(),
	}
}

/** UTF-8 读文件并限流（BOM 由引擎侧保证不出现；防御性剥一次） */
async function readTextFileUtf8(filePath: string, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
	const handle = await fs.open(filePath, "r")
	try {
		const { size } = await handle.stat()
		const readLength = Math.min(size, maxBytes)
		const buffer = Buffer.alloc(readLength)
		await handle.read(buffer, 0, readLength, 0)
		let text = buffer.toString("utf8")
		if (text.charCodeAt(0) === 0xfeff) {
			text = text.slice(1)
		}
		return { text, truncated: size > maxBytes }
	} finally {
		await handle.close()
	}
}

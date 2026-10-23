import fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { recordAudit } from "@/core/logging/auditLog"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { fetch } from "@/shared/net"
import { ShowMessageType } from "@/shared/proto/index.host"
import { Logger } from "@/shared/services/Logger"
import {
	DownloadError,
	type DownloadErrorKind,
	describeDownload,
	type FetchLike,
	streamDownloadToPart,
} from "@/shared/utils/download"
import {
	formatBytes,
	isNewerVersion,
	MAX_VSIX_BYTES,
	matchesSha256,
	parseSha256Digest,
	pickDownloadUrl,
	pickVsixAsset,
	type ReleaseAsset,
} from "@/shared/utils/version"

/**
 * 检查更新 + 分步安装。
 *
 * 交互约束（用户明确要求，不要改成自动）：
 * 1. 只有用户点「检查更新」（命令面板或设置 → 关于）才发起检查，启动时**不**联网；
 * 2. 检查只负责「查」，查到新版本后必须由用户选一种下载方式才落盘安装；
 * 3. 装完提示重载，重载也要用户点。
 *
 * 3.91.1 起的两条硬规矩（上一版在这里栽过，别再改回去）：
 * - **所有弹窗都在 `withProgress` 之外**。进度条还开着时弹 `showMessage`，通知区只剩
 *   最后一条，用户看到的就是"点了没反应"。
 * - **下载绝不能挂在命令的 await 链上**。`runCommand` 会 `await executeCommand`，
 *   一 await 就是几分钟的"按钮假死"；这里 `void runUserApprovedUpdate(...)` 立刻返回。
 *
 * 安全边界：
 * - 只查本仓库的 GitHub Release，只装官方 assets 里、下载域名对得上的 `.vsix`；
 * - 镜像**只是传输**：域名白名单一个字都不放宽，镜像来的字节必须通过 sha256 校验才落盘，
 *   没有 digest 就根本不给镜像选项（无法验证就不引入第三方）；
 * - 下载先写 `.part`，全部校验通过才改名；失败/取消一律删掉 `.part`，不破坏当前版本。
 */

const RELEASES_API = "https://api.github.com/repos/1438998005/era-harness/releases/latest"
export const RELEASES_PAGE = "https://github.com/1438998005/era-harness/releases/latest"

/** 镜像前缀只是「用镜像下载」按钮背后的地址，不点按钮永远走直连 */
export const MIRROR_PREFIX_SETTING = "eraHarness.update.mirrorPrefix"
const DEFAULT_MIRROR_PREFIX = "https://gh-proxy.com"

/** 首字节 15s：连接建立了却一个字节都不来，基本是墙/代理在挂 */
const FIRST_BYTE_TIMEOUT_MS = 15_000
/** 停滞 30s：收到过数据之后突然不动，多半是连接被中途掐了 */
const STALL_TIMEOUT_MS = 30_000
/** 总计 10min：34 KB/s 那种速度不该让用户等 40 分钟 */
const TOTAL_TIMEOUT_MS = 10 * 60_000
/** 装正在运行的扩展时 installExtension 可能永远不 resolve，用 90s 兜住 */
const INSTALL_TIMEOUT_MS = 90_000
/** 查 GitHub API 也要有超时，否则「检查更新」会一直转圈且锁不释放 */
const CHECK_TIMEOUT_MS = 20_000
/** updates/ 里超过一小时的 vsix 视为残留（90s 超时那次的可能还在被 VS Code 读） */
const STALE_VSIX_MS = 60 * 60_000

/** 进度条百分比分配：下载 0–90，校验/改名 90–94，安装 94–100 */
const DOWNLOAD_END_PERCENT = 90
const VERIFY_PERCENT = 94
const INSTALL_PERCENT = 96

/** 三档超时（真正的实现与单测在 `@/shared/utils/download`） */
const DOWNLOAD_TIMEOUTS = {
	firstByteMs: FIRST_BYTE_TIMEOUT_MS,
	stallMs: STALL_TIMEOUT_MS,
	totalMs: TOTAL_TIMEOUT_MS,
}

const DOWNLOAD_DIRECT = "直接下载"
const DOWNLOAD_MIRROR = "用镜像下载"
const COPY_LINK = "复制下载链接"
const OPEN_RELEASES = "打开 Release 页面"

interface GithubRelease {
	tag_name?: string
	draft?: boolean
	prerelease?: boolean
	assets?: ReleaseAsset[]
}

// ————————————————————————————————————————————————
// 错误分类：不同失败给不同文案，也决定"要不要改走直连"
// ————————————————————————————————————————————————

type UpdateErrorKind = DownloadErrorKind

class UpdateError extends Error {
	readonly kind: UpdateErrorKind

	constructor(kind: UpdateErrorKind, message: string) {
		super(message)
		this.kind = kind
		this.name = "UpdateError"
	}
}

/**
 * 把底层错误翻成人话。
 *
 * 不按"文案匹配"做判断（这个项目已经栽过四次），但这里必须读 message：undici 的
 * `terminated` / `other side closed` 没有结构化 code 可拿，只能看文本；即便如此，
 * 只用于**选文案**，不用于任何安全判断。
 */
function toUpdateError(error: unknown): UpdateError {
	if (error instanceof UpdateError) {
		return error
	}
	if (error instanceof DownloadError) {
		return new UpdateError(error.kind, error.message)
	}

	const message = error instanceof Error ? error.message : String(error)
	if (/aborted/i.test(message)) {
		return new UpdateError("cancelled", "已取消")
	}
	if (/terminated|other side closed|ECONNRESET|socket hang up|ECONNREFUSED/i.test(message)) {
		return new UpdateError("network", "网络连接被中断（代理或防火墙），可以重试或改用镜像")
	}
	if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
		return new UpdateError("network", "域名解析失败，检查网络或代理设置")
	}
	if (/ETIMEDOUT|timeout/i.test(message)) {
		return new UpdateError("timeout", "网络超时")
	}
	if (/ENOSPC|EACCES|EPERM|EROFS/i.test(message)) {
		return new UpdateError("io", `写入临时文件失败：${message}`)
	}
	return new UpdateError("network", message)
}

// ————————————————————————————————————————————————
// 进度上报
// ————————————————————————————————————————————————

interface Reporter {
	/** 把进度推到 `percent`（0–100，单调不回退），并更新文案 */
	report(percent: number, message: string): void
	/** 当前已上报到的百分比 */
	current(): number
}

type Progress = vscode.Progress<{ message?: string; increment?: number }>

/**
 * 造一个单调递增的上报器。
 *
 * VS Code 的通知进度条只有在 `increment` 累加到 100 时才显示"确定进度"，所以
 * 这里自己记住已经报了多少，只报差值；回退的请求降级成"只改文案不动条"。
 */
function createReporter(progress: Progress): Reporter {
	let reported = 0
	let lastMessage = ""

	return {
		current: () => reported,
		report(percent: number, message: string) {
			const target = Math.max(0, Math.min(100, Math.round(percent)))
			if (target > reported) {
				progress.report({ increment: target - reported, message })
				reported = target
				lastMessage = message
				return
			}
			if (message !== lastMessage) {
				progress.report({ increment: 0, message })
				lastMessage = message
			}
		},
	}
}

// ————————————————————————————————————————————————
// 配置与网络
// ————————————————————————————————————————————————

/** 读镜像前缀。空串 = 用户明确关掉了镜像选项（此时连按钮都不出现） */
function readMirrorPrefix(): string {
	const configured = vscode.workspace.getConfiguration().get<string>(MIRROR_PREFIX_SETTING)
	if (typeof configured !== "string") {
		return DEFAULT_MIRROR_PREFIX
	}
	return configured.trim()
}

async function fetchLatestRelease(signal: AbortSignal): Promise<GithubRelease> {
	const response = await fetch(RELEASES_API, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": `era-harness/${ExtensionRegistryInfo.version}`,
		},
		signal,
	})

	if (!response.ok) {
		throw new Error(`GitHub API ${response.status} ${response.statusText}`)
	}

	return (await response.json()) as GithubRelease
}

async function openReleasePage(): Promise<void> {
	await vscode.env.openExternal(vscode.Uri.parse(RELEASES_PAGE))
}

/**
 * 清 updates/ 里的残留。
 *
 * `.part` 是上次没下完的，一律删；`.vsix` 只删一小时前的——90 秒超时那次的包
 * 可能还在被 VS Code 读取，立刻删会让"其实已经装上"变成真的装不上。
 */
async function cleanupUpdatesDir(updatesDir: string): Promise<void> {
	try {
		const entries = await fs.readdir(updatesDir, { withFileTypes: true })
		const now = Date.now()
		await Promise.all(
			entries
				.filter((entry) => entry.isFile())
				.map(async (entry) => {
					const full = path.join(updatesDir, entry.name)
					if (entry.name.endsWith(".part")) {
						await fs.unlink(full).catch(() => {})
						return
					}
					if (!entry.name.toLowerCase().endsWith(".vsix")) {
						return
					}
					const stat = await fs.stat(full).catch(() => undefined)
					if (stat && now - stat.mtimeMs > STALE_VSIX_MS) {
						await fs.unlink(full).catch(() => {})
					}
				}),
		)
	} catch {
		// 目录还不存在：下面 mkdir 会建
	}
}

interface StreamOptions {
	url: string
	partPath: string
	asset: ReleaseAsset
	reporter: Reporter
	spanFrom: number
	spanTo: number
	token: vscode.CancellationToken
}

/**
 * 把 VS Code 的 `CancellationToken` 桥成 `AbortSignal` 后交给 `@/shared/utils/download`。
 *
 * 下载循环本身刻意不 import vscode，好让 `test/update/download.spec.ts` 能直接跑它。
 */
async function streamToPart(options: StreamOptions): Promise<{ bytes: number; sha256: string }> {
	const { asset, reporter, token } = options
	const controller = new AbortController()
	const cancelSub = token.onCancellationRequested(() => controller.abort())
	const total = asset.size > 0 ? asset.size : 0
	const span = options.spanTo - options.spanFrom

	try {
		return await streamDownloadToPart({
			fetchImpl: fetch as unknown as FetchLike,
			url: options.url,
			partPath: options.partPath,
			expectedSize: asset.size,
			maxBytes: MAX_VSIX_BYTES,
			userAgent: `era-harness/${ExtensionRegistryInfo.version}`,
			signal: controller.signal,
			timeouts: DOWNLOAD_TIMEOUTS,
			onProgress: (received, _total, bytesPerSecond) => {
				const fraction = total > 0 ? Math.min(1, received / total) : 0
				reporter.report(options.spanFrom + fraction * span, describeDownload(received, total, bytesPerSecond))
			},
		})
	} finally {
		cancelSub.dispose()
	}
}

interface DownloadResult {
	vsixPath: string
	bytes: number
	via: DownloadVia
}

type DownloadVia = "direct" | "mirror"

/**
 * 下载 → 校验 → 改名。
 *
 * 镜像只在用户点了「用镜像下载」时走；失败**不在镜像之间重试**，直接回到官方源
 * （回到官方源不算"惊喜"），并把文案写清楚。摘要不匹配属于安全事件，**不自动回退**。
 */
async function downloadVsix(options: {
	asset: ReleaseAsset
	updatesDir: string
	via: DownloadVia
	reporter: Reporter
	token: vscode.CancellationToken
}): Promise<DownloadResult> {
	const { asset, reporter, token } = options
	const mirrorPrefix = readMirrorPrefix()

	let via: DownloadVia = options.via
	let url = pickDownloadUrl(asset, mirrorPrefix, via)
	if (!url && via === "mirror") {
		reporter.report(0, "没有可用的校验摘要，改走直连…")
		via = "direct"
		url = pickDownloadUrl(asset, mirrorPrefix, "direct")
	}
	if (!url) {
		throw new UpdateError("integrity", "Release 资产不在官方域名下，已放弃下载")
	}

	await fs.mkdir(options.updatesDir, { recursive: true })
	await cleanupUpdatesDir(options.updatesDir)

	const finalPath = path.join(options.updatesDir, path.basename(asset.name))
	const partPath = `${finalPath}.part`
	const expected = parseSha256Digest(asset.digest)

	let spanFrom = 0
	let spanTo = DOWNLOAD_END_PERCENT

	for (let attempt = 1; ; attempt++) {
		try {
			const { bytes, sha256 } = await streamToPart({
				url,
				partPath,
				asset,
				reporter,
				spanFrom,
				spanTo,
				token,
			})

			// 有摘要就必须对得上；镜像场景下摘要是"必须存在"的前置条件（见 pickDownloadUrl）
			if (expected && !matchesSha256(expected, sha256)) {
				throw new UpdateError("integrity", "下载内容的 sha256 与 Release 声明不一致，已丢弃")
			}

			reporter.report(DOWNLOAD_END_PERCENT, `下载完成 · ${formatBytes(bytes)}，正在校验…`)
			await fs.rename(partPath, finalPath)
			reporter.report(VERIFY_PERCENT, "校验通过")
			Logger.log(`[update] 已下载 ${finalPath}（${bytes} bytes，via=${via}）`)
			return { vsixPath: finalPath, bytes, via }
		} catch (error) {
			await fs.unlink(partPath).catch(() => {})
			const failure = toUpdateError(error)

			// 镜像的"网络层"失败可以退回官方源；摘要不匹配 / 用户取消都不退
			const retryDirect =
				via === "mirror" &&
				attempt === 1 &&
				(failure.kind === "network" || failure.kind === "http" || failure.kind === "timeout")
			if (!retryDirect) {
				throw failure
			}

			Logger.warn(`[update] 镜像下载失败（${failure.message}），改走直连`)
			via = "direct"
			url = pickDownloadUrl(asset, mirrorPrefix, "direct") ?? ""
			if (!url) {
				throw failure
			}
			spanFrom = Math.max(reporter.current(), Math.round(DOWNLOAD_END_PERCENT / 2))
			spanTo = DOWNLOAD_END_PERCENT
			reporter.report(spanFrom, "镜像不可用，改走直连…")
		}
	}
}

// ————————————————————————————————————————————————
// 安装
// ————————————————————————————————————————————————

/**
 * 给一个 Promise 加超时，**不取消**原操作。
 *
 * 装正在运行的扩展时 `installExtension` 可能一直不 resolve（VS Code 在等窗口重载），
 * 超时只代表"我们不等了"，不代表失败——所以调用方不能删 vsix。
 */
async function raceTimeout<T>(work: Promise<T>, ms: number): Promise<{ timedOut: false; value: T } | { timedOut: true }> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			work.then((value) => ({ timedOut: false as const, value })),
			new Promise<{ timedOut: true }>((resolve) => {
				timer = setTimeout(() => resolve({ timedOut: true }), ms)
			}),
		])
	} finally {
		if (timer) {
			clearTimeout(timer)
		}
	}
}

type UpdateOutcome =
	| { kind: "installed"; bytes: number; via: DownloadVia }
	| { kind: "unconfirmed"; bytes: number; via: DownloadVia }
	| { kind: "failed"; error: UpdateError }

const NEXT_STEP_HINT = "进度显示在右下角通知区，可随时点「取消」。"

/**
 * 第二步：用户选定下载方式后真正下载并安装。
 *
 * 调用方一律 `void runUserApprovedUpdate(...)`：这里自己兜住所有异常与终态提示，
 * 绝不把错误抛回命令链（否则按钮会一直转圈）。
 */
async function runUserApprovedUpdate(
	context: vscode.ExtensionContext,
	asset: ReleaseAsset,
	tag: string,
	via: DownloadVia,
): Promise<void> {
	if (installInFlight) {
		await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: `正在下载 ${installInFlight}，${NEXT_STEP_HINT}`,
		})
		return
	}

	installInFlight = tag
	let outcome: UpdateOutcome | undefined
	try {
		outcome = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `era harness 更新 ${tag}`, cancellable: true },
			async (progress, token): Promise<UpdateOutcome> => {
				const reporter = createReporter(progress)
				const updatesDir = path.join(context.globalStorageUri.fsPath, "updates")
				try {
					reporter.report(0, via === "mirror" ? "正在连接镜像…" : "正在连接 GitHub…")
					const downloaded = await downloadVsix({ asset, updatesDir, via, reporter, token })

					// 先报"正在安装"再调：installExtension 一旦卡住，文案已经在那里了
					reporter.report(INSTALL_PERCENT, "正在安装（VS Code 可能提示重载）…")
					const raced = await raceTimeout(
						Promise.resolve(
							vscode.commands.executeCommand(
								"workbench.extensions.installExtension",
								vscode.Uri.file(downloaded.vsixPath),
							),
						),
						INSTALL_TIMEOUT_MS,
					)

					if (raced.timedOut) {
						// 不删 vsix：VS Code 可能还在读
						Logger.warn(`[update] installExtension ${INSTALL_TIMEOUT_MS / 1000}s 未返回，交给 VS Code 继续`)
						return { kind: "unconfirmed", bytes: downloaded.bytes, via: downloaded.via }
					}

					await fs.unlink(downloaded.vsixPath).catch(() => {})
					reporter.report(100, "安装完成")
					return { kind: "installed", bytes: downloaded.bytes, via: downloaded.via }
				} catch (error) {
					return { kind: "failed", error: toUpdateError(error) }
				}
			},
		)
	} catch (error) {
		// withProgress 自身出错（极少）：也走统一的失败提示
		outcome = { kind: "failed", error: toUpdateError(error) }
	} finally {
		// 先解锁再弹窗：否则用户在失败弹窗里点「重试」会被自己挡住
		installInFlight = null
	}

	if (!outcome) {
		return
	}

	if (outcome.kind === "failed") {
		await reportUpdateFailure(context, asset, tag, via, outcome.error)
		return
	}

	if (outcome.kind === "unconfirmed") {
		recordAudit({ event: "update", action: "install", target: asset.name, outcome: "info" })
		const answer = await HostProvider.window.showMessage({
			type: ShowMessageType.WARNING,
			message: `已把 ${tag} 的安装包交给 VS Code，但 ${INSTALL_TIMEOUT_MS / 1000} 秒内没等到结果。请到扩展面板确认是否已装上；若版本没变，检查这个扩展是不是被「固定」了。`,
			options: { items: ["打开扩展面板"] },
		})
		if (answer.selectedOption === "打开扩展面板") {
			await vscode.commands.executeCommand("workbench.view.extensions")
		}
		return
	}

	recordAudit({ event: "update", action: "install", target: asset.name, outcome: "ok" })
	const reload = await HostProvider.window.showMessage({
		type: ShowMessageType.INFORMATION,
		message: `已安装 era harness ${tag}（${formatBytes(outcome.bytes)}），重载窗口后生效。`,
		options: { items: ["重新加载"] },
	})
	if (reload.selectedOption === "重新加载") {
		await vscode.commands.executeCommand("workbench.action.reloadWindow")
	}
}

async function reportUpdateFailure(
	context: vscode.ExtensionContext,
	asset: ReleaseAsset,
	tag: string,
	via: DownloadVia,
	error: UpdateError,
): Promise<void> {
	if (error.kind === "cancelled") {
		recordAudit({ event: "update", action: "install", target: asset.name, outcome: "info", message: "用户取消" })
		await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: "已取消更新，当前版本没有被改动。",
		})
		return
	}

	Logger.error("[update] 更新失败：", error)
	recordAudit({ event: "update", action: "install", target: asset.name, outcome: "error", message: error.message })

	const retry = via === "mirror" ? "用直连重试" : "重试"
	const answer = await HostProvider.window.showMessage({
		type: ShowMessageType.ERROR,
		message: `更新失败：${error.message}（当前版本未被改动）`,
		options: { items: [retry, OPEN_RELEASES] },
	})

	if (answer.selectedOption === retry) {
		void runUserApprovedUpdate(context, asset, tag, "direct")
		return
	}
	if (answer.selectedOption === OPEN_RELEASES) {
		await openReleasePage()
	}
}

// ————————————————————————————————————————————————
// 第一步：检查
// ————————————————————————————————————————————————

/** 双击按钮 / 命令面板重复触发时只跑一次检查，避免弹两个对话框 */
let checkInFlight = false
/** 正在下载的 tag；与检查分开，下载挂住时不该让「检查更新」也变成"没反应" */
let installInFlight: string | null = null

/**
 * 检查更新（只检查，不安装）。
 *
 * 由命令 `era-harness.checkForUpdates` 或设置 → 关于的按钮触发；**没有**自动触发入口。
 */
export async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
	if (installInFlight) {
		await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: `正在下载 ${installInFlight}，${NEXT_STEP_HINT}`,
		})
		return
	}

	if (checkInFlight) {
		await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: "正在检查更新，请稍候。",
		})
		return
	}

	checkInFlight = true
	try {
		// 进度条作用域 A：只罩"查 API"。必须在下一次弹窗之前退出，否则进度条会压住对话框
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
		let release: GithubRelease
		try {
			release = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: "era harness：正在检查更新…" },
				() => fetchLatestRelease(controller.signal),
			)
		} catch (error) {
			// 超时必须说人话，并把锁放掉；否则再点只会得到"正在检查更新"
			if (controller.signal.aborted) {
				throw new Error(`检查更新超时（${CHECK_TIMEOUT_MS / 1000} 秒没有响应）`)
			}
			throw error
		} finally {
			clearTimeout(timer)
		}

		if (!release.tag_name || release.draft || release.prerelease) {
			await HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: "当前没有可用的正式版本（草稿/预发布会被忽略）。",
				options: { items: [OPEN_RELEASES] },
			})
			return
		}

		const tag = release.tag_name
		recordAudit({ event: "update", action: "check", target: tag, outcome: "info" })
		if (!isNewerVersion(ExtensionRegistryInfo.version, tag)) {
			await HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: `当前已是最新版本 v${ExtensionRegistryInfo.version}`,
			})
			return
		}

		const displayTag = tag.replace(/^v/i, "")
		const asset = pickVsixAsset(release.assets, tag)
		if (!asset) {
			await HostProvider.window.showMessage({
				type: ShowMessageType.WARNING,
				message: `发现 ${tag}，但这个 Release 里没有可用的 vsix 资产，只能去页面手动下载。`,
				options: { items: [OPEN_RELEASES] },
			})
			return
		}

		// 镜像按钮只在「配了前缀 + 资产带 sha256」时出现：无法验证就不引入第三方
		const mirrorAvailable = pickDownloadUrl(asset, readMirrorPrefix(), "mirror") !== undefined
		const items = mirrorAvailable ? [DOWNLOAD_DIRECT, DOWNLOAD_MIRROR, COPY_LINK] : [DOWNLOAD_DIRECT, COPY_LINK]

		const answer = await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: `发现新版本 era harness v${displayTag}（当前 v${ExtensionRegistryInfo.version}，${formatBytes(asset.size)}）。直接下载只走 GitHub 官方地址${mirrorAvailable ? "；直连慢可以改用镜像（内容仍需通过 sha256 校验）" : ""}。${NEXT_STEP_HINT}`,
			options: { items },
		})

		const via: DownloadVia | undefined =
			answer.selectedOption === DOWNLOAD_MIRROR
				? "mirror"
				: answer.selectedOption === DOWNLOAD_DIRECT
					? "direct"
					: undefined

		if (via) {
			// 关键：不 await。命令链（含 gRPC）立刻返回，锁也立刻释放
			void runUserApprovedUpdate(context, asset, tag, via)
			return
		}

		if (answer.selectedOption === COPY_LINK) {
			await vscode.env.clipboard.writeText(asset.browser_download_url)
			await HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: "下载链接已复制。用浏览器或下载器拉下来后，在扩展面板右上角「…」→「从 VSIX 安装」里选它即可。",
			})
		}
	} catch (error) {
		Logger.warn("[update] 检查更新失败：", error)

		const message = error instanceof Error ? error.message : String(error)
		recordAudit({ event: "update", action: "check", outcome: "error", message })
		const answer = await HostProvider.window.showMessage({
			type: ShowMessageType.ERROR,
			message: `检查更新失败：${message}。可稍后重试，或直接打开 Release 页面手动下载。`,
			options: { items: [OPEN_RELEASES] },
		})
		if (answer.selectedOption === OPEN_RELEASES) {
			await openReleasePage()
		}
	} finally {
		checkInFlight = false
	}
}

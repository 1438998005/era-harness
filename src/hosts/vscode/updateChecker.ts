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
	compareVersions,
	findChecksumAsset,
	formatBytes,
	isNewerVersion,
	MAX_VSIX_BYTES,
	matchesSha256,
	parseSha256Digest,
	pickDownloadUrl,
	pickVsixAsset,
	RELEASE_SOURCE_ORDER,
	RELEASE_SOURCES,
	type ReleaseAsset,
	type ReleaseSource,
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
 * - 两条渠道（GitHub / jihulab）**各自独立**：下载地址必须落在该渠道的受信前缀下，否则不认；
 * - 校验按渠道各自来：GitHub 用接口返回的 `digest`，jihulab 用同一 Release 里配套的
 *   `<vsix>.sha256`；拿不到校验依据就不给那个按钮（无法验证就不下载）；
 * - 下载先写 `.part`，全部校验通过才改名；失败/取消一律删掉 `.part`，不破坏当前版本。
 */

const COPY_LINK = "复制下载链接"
const OPEN_RELEASES = "打开 Release 页面"

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
/** 单个渠道的查询上限：两条渠道各 8s，留足余量给另一条 */
const PER_SOURCE_TIMEOUT_MS = 8_000
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

/** 按钮文案跟着渠道走：两个按钮 = 两条互不相干的下载链路 */
function downloadLabel(source: ReleaseSource): string {
	return `从 ${RELEASE_SOURCES[source].label} 下载`
}

interface GithubRelease {
	tag_name?: string
	draft?: boolean
	prerelease?: boolean
	assets?: ReleaseAsset[]
}

/** GitLab（含 jihulab）Release 的资产链接：`direct_asset_url` 才是固定直链 */
interface GitlabReleaseLink {
	name?: string
	url?: string
	direct_asset_url?: string
}

interface GitlabRelease {
	tag_name?: string
	upcoming_release?: boolean
	assets?: { links?: GitlabReleaseLink[] }
}

/** 一条渠道查到的结果，已归一成两渠道通用的形状 */
interface ReleaseInfo {
	tag: string
	assets: ReleaseAsset[]
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
		return new UpdateError("network", "网络连接被中断（代理或防火墙），可以重试或换另一个渠道")
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

/**
 * 拉一条渠道的 Release，归一成两渠道通用的 `{ tag, assets }`。
 *
 * GitHub 返回单个对象；GitLab（jihulab）返回数组，取第一条非 upcoming 的（接口按时间倒序）。
 * GitLab 的资产既没有体积也没有 digest：`size` 记 0 表示未知，校验改由同一 Release 里
 * 配套的 `<vsix>.sha256` 承担。
 */
async function fetchRelease(source: ReleaseSource, signal: AbortSignal): Promise<ReleaseInfo | undefined> {
	const meta = RELEASE_SOURCES[source]
	const headers: Record<string, string> = { "User-Agent": `era-harness/${ExtensionRegistryInfo.version}` }
	if (source === "github") {
		headers.Accept = "application/vnd.github+json"
	}

	const response = await fetch(meta.apiUrl, { headers, signal })
	if (!response.ok) {
		throw new Error(`${meta.label} API ${response.status} ${response.statusText}`)
	}

	if (source === "github") {
		const release = (await response.json()) as GithubRelease
		if (!release.tag_name || release.draft || release.prerelease) {
			return undefined
		}
		return { tag: release.tag_name, assets: release.assets ?? [] }
	}

	const releases = (await response.json()) as GitlabRelease[]
	const release = releases.find((item) => item.tag_name && !item.upcoming_release)
	if (!release?.tag_name) {
		return undefined
	}

	const links = release.assets?.links ?? []
	return {
		tag: release.tag_name,
		assets: links
			.filter((link): link is GitlabReleaseLink & { name: string } => Boolean(link.name))
			.map((link) => ({
				name: link.name,
				browser_download_url: link.direct_asset_url ?? link.url ?? "",
				size: 0,
			})),
	}
}

async function openReleasePage(source: ReleaseSource): Promise<void> {
	await vscode.env.openExternal(vscode.Uri.parse(RELEASE_SOURCES[source].releasesPage))
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
	source: ReleaseSource
}

/** 取 `.sha256` 校验文件也要有超时，否则会卡在"正在取校验文件" */
const CHECKSUM_TIMEOUT_MS = 15_000

/**
 * 校验依据按渠道各自取。
 *
 * - GitHub：接口里的 `assets[].digest`；
 * - jihulab：同一 Release 里配套的 `<vsix>.sha256`（GitLab 不返回摘要，只能自己发一份）。
 *
 * 拿不到就抛错——**无法验证的包一律不装**，这是两条渠道共同的前提。
 */
async function resolveExpectedSha256(
	asset: ReleaseAsset,
	checksum: ReleaseAsset | undefined,
	source: ReleaseSource,
	reporter: Reporter,
	token: vscode.CancellationToken,
): Promise<string> {
	if (source === "github") {
		const digest = parseSha256Digest(asset.digest)
		if (!digest) {
			throw new UpdateError("integrity", "Release 没有提供 sha256 摘要，无法验证，已放弃下载")
		}
		return digest
	}

	if (!checksum) {
		throw new UpdateError("integrity", `jihulab 的 Release 里没有 ${asset.name}.sha256，无法验证，已放弃下载`)
	}
	return readChecksumFile(checksum, reporter, token)
}

async function readChecksumFile(asset: ReleaseAsset, reporter: Reporter, token: vscode.CancellationToken): Promise<string> {
	const controller = new AbortController()
	const cancelSub = token.onCancellationRequested(() => controller.abort())
	const timer = setTimeout(() => controller.abort(), CHECKSUM_TIMEOUT_MS)

	try {
		reporter.report(0, "正在取校验文件…")
		const response = await fetch(asset.browser_download_url, {
			headers: { "User-Agent": `era-harness/${ExtensionRegistryInfo.version}` },
			signal: controller.signal,
		})
		if (!response.ok) {
			throw new UpdateError("http", `校验文件下载失败（HTTP ${response.status}）`)
		}

		const text = (await response.text()).trim()
		const digest = parseSha256Digest(text.split(/\s+/)[0] ?? "")
		if (!digest) {
			throw new UpdateError("integrity", "校验文件内容不是合法的 sha256")
		}
		return digest
	} finally {
		clearTimeout(timer)
		cancelSub.dispose()
	}
}

/**
 * 下载 → 校验 → 改名。
 *
 * 渠道完全由用户点的按钮决定，**不在两条渠道之间自动切换**：那是替用户决定信任谁。
 * 下载失败就把失败原因说清楚，让用户自己点另一个按钮。
 */
async function downloadVsix(options: {
	asset: ReleaseAsset
	checksum?: ReleaseAsset
	source: ReleaseSource
	updatesDir: string
	reporter: Reporter
	token: vscode.CancellationToken
}): Promise<DownloadResult> {
	const { asset, source, reporter, token } = options
	const url = pickDownloadUrl(asset, source)
	if (!url) {
		throw new UpdateError("integrity", `${RELEASE_SOURCES[source].label} 的资产地址不在受信范围内，已放弃下载`)
	}

	const expected = await resolveExpectedSha256(asset, options.checksum, source, reporter, token)

	await fs.mkdir(options.updatesDir, { recursive: true })
	await cleanupUpdatesDir(options.updatesDir)

	const finalPath = path.join(options.updatesDir, path.basename(asset.name))
	const partPath = `${finalPath}.part`

	try {
		const { bytes, sha256 } = await streamToPart({
			url,
			partPath,
			asset,
			reporter,
			spanFrom: 0,
			spanTo: DOWNLOAD_END_PERCENT,
			token,
		})

		if (!matchesSha256(expected, sha256)) {
			throw new UpdateError("integrity", "下载内容的 sha256 与 Release 声明不一致，已丢弃")
		}

		reporter.report(DOWNLOAD_END_PERCENT, `下载完成 · ${formatBytes(bytes)}，正在校验…`)
		await fs.rename(partPath, finalPath)
		reporter.report(VERIFY_PERCENT, "校验通过")
		Logger.log(`[update] 已下载 ${finalPath}（${bytes} bytes，source=${source}）`)
		return { vsixPath: finalPath, bytes, source }
	} catch (error) {
		await fs.unlink(partPath).catch(() => {})
		throw toUpdateError(error)
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
	| { kind: "installed"; bytes: number; source: ReleaseSource }
	| { kind: "unconfirmed"; bytes: number; source: ReleaseSource }
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
	checksum: ReleaseAsset | undefined,
	tag: string,
	source: ReleaseSource,
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
					reporter.report(0, `正在连接 ${RELEASE_SOURCES[source].label}…`)
					const downloaded = await downloadVsix({ asset, checksum, source, updatesDir, reporter, token })

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
						return { kind: "unconfirmed", bytes: downloaded.bytes, source: downloaded.source }
					}

					await fs.unlink(downloaded.vsixPath).catch(() => {})
					reporter.report(100, "安装完成")
					return { kind: "installed", bytes: downloaded.bytes, source: downloaded.source }
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
		await reportUpdateFailure(context, asset, checksum, tag, source, outcome.error)
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
	checksum: ReleaseAsset | undefined,
	tag: string,
	source: ReleaseSource,
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

	const retry = "重试"
	const answer = await HostProvider.window.showMessage({
		type: ShowMessageType.ERROR,
		message: `更新失败：${error.message}（当前版本未被改动）`,
		options: { items: [retry, OPEN_RELEASES] },
	})

	if (answer.selectedOption === retry) {
		void runUserApprovedUpdate(context, asset, checksum, tag, source)
		return
	}
	if (answer.selectedOption === OPEN_RELEASES) {
		await openReleasePage(source)
	}
}

// ————————————————————————————————————————————————
// 第一步：检查
// ————————————————————————————————————————————————

/** 一个渠道查到的可用候选 */
interface UpdateCandidate {
	source: ReleaseSource
	tag: string
	asset: ReleaseAsset
	/** jihulab 侧配套的 `<vsix>.sha256`；GitHub 用资产自带的 digest，这里为空 */
	checksum?: ReleaseAsset
}

interface SourceScan {
	candidates: UpdateCandidate[]
	failures: { source: ReleaseSource; message: string }[]
	/** 至少有一条渠道明确返回了不高于当前版本 —— 用于区分"已是最新"和"全部失败" */
	sawOlder: boolean
}

/**
 * 两条渠道各查一遍。
 *
 * 一条挂了不影响另一条：GitHub 被墙/账号受限时，jihulab 照样能给出候选。
 * 每个候选都要自带校验依据，拿不到就不进候选列表（= 那个按钮不出现）。
 */
async function scanSources(signal: AbortSignal): Promise<SourceScan> {
	const candidates: UpdateCandidate[] = []
	const failures: { source: ReleaseSource; message: string }[] = []
	let sawOlder = false

	for (const source of RELEASE_SOURCE_ORDER) {
		// 每个渠道单独限时：GitHub 被墙时请求会一直挂着，不设上限就会把总预算吃光，
		// jihulab 那一轮根本轮不到。
		const controller = new AbortController()
		const forwardAbort = () => controller.abort()
		signal.addEventListener("abort", forwardAbort, { once: true })
		const timer = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT_MS)
		try {
			const release = await fetchRelease(source, controller.signal)
			if (!release) {
				failures.push({ source, message: "没有可用的正式版本" })
				continue
			}
			if (!isNewerVersion(ExtensionRegistryInfo.version, release.tag)) {
				sawOlder = true
				continue
			}

			const asset = pickVsixAsset(release.assets, release.tag, source)
			if (!asset) {
				failures.push({ source, message: `${release.tag} 里没有可用的 vsix` })
				continue
			}

			if (source === "github" && !parseSha256Digest(asset.digest)) {
				failures.push({ source, message: `${asset.name} 没有 sha256 摘要` })
				continue
			}

			const checksum = source === "jihulab" ? findChecksumAsset(release.assets, asset.name) : undefined
			if (source === "jihulab" && !checksum) {
				failures.push({ source, message: `${asset.name} 缺少配套的 .sha256` })
				continue
			}

			candidates.push({ source, tag: release.tag, asset, checksum })
		} catch (error) {
			const timedOut = controller.signal.aborted && !signal.aborted
			failures.push({
				source,
				message: timedOut
					? `连接超时（${PER_SOURCE_TIMEOUT_MS / 1000} 秒）`
					: error instanceof Error
						? error.message
						: String(error),
			})
		} finally {
			clearTimeout(timer)
			signal.removeEventListener("abort", forwardAbort)
		}
	}

	return { candidates, failures, sawOlder }
}

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
		// 进度条作用域 A：只罩"查两个渠道"。必须在下一次弹窗之前退出，否则进度条会压住对话框
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
		let scan: SourceScan
		try {
			scan = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: "era harness：正在检查更新…" },
				() => scanSources(controller.signal),
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

		const { candidates, failures, sawOlder } = scan

		if (!candidates.length) {
			if (sawOlder) {
				await HostProvider.window.showMessage({
					type: ShowMessageType.INFORMATION,
					message: `当前已是最新版本 v${ExtensionRegistryInfo.version}`,
				})
				return
			}
			const detail = failures.map((item) => `${RELEASE_SOURCES[item.source].label}：${item.message}`).join("；")
			await HostProvider.window.showMessage({
				type: ShowMessageType.WARNING,
				message: `没能从任何渠道取到可用的更新（${detail}）。可以稍后重试，或直接打开 Release 页面手动下载。`,
				options: { items: [OPEN_RELEASES] },
			})
			return
		}

		const first = candidates[0]
		if (!first) {
			return
		}
		const newestTag = candidates.reduce((best, item) => (compareVersions(item.tag, best) > 0 ? item.tag : best), first.tag)
		const usable = candidates.filter((item) => compareVersions(item.tag, newestTag) === 0)
		recordAudit({ event: "update", action: "check", target: newestTag, outcome: "info" })

		const displayTag = newestTag.replace(/^v/i, "")
		const preferred = usable[0] ?? first
		const sizeHint = preferred.asset.size > 0 ? `，${formatBytes(preferred.asset.size)}` : ""
		const channels = usable.map((item) => RELEASE_SOURCES[item.source].label).join(" / ")

		const answer = await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: `发现新版本 era harness v${displayTag}（当前 v${ExtensionRegistryInfo.version}${sizeHint}）。可用渠道：${channels}——两个按钮走的是两条互不相干的下载链路，挑一条能连通的即可。${NEXT_STEP_HINT}`,
			options: { items: [...usable.map((item) => downloadLabel(item.source)), COPY_LINK] },
		})

		const chosen = usable.find((item) => downloadLabel(item.source) === answer.selectedOption)
		if (chosen) {
			// 关键：不 await。命令链（含 gRPC）立刻返回，锁也立刻释放
			void runUserApprovedUpdate(context, chosen.asset, chosen.checksum, chosen.tag, chosen.source)
			return
		}

		if (answer.selectedOption === COPY_LINK) {
			await vscode.env.clipboard.writeText(preferred.asset.browser_download_url)
			await HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: `已复制 ${RELEASE_SOURCES[preferred.source].label} 的下载链接。用浏览器或下载器拉下来后，在扩展面板右上角「…」→「从 VSIX 安装」里选它即可。`,
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
			await openReleasePage(RELEASE_SOURCE_ORDER[0] ?? "github")
		}
	} finally {
		checkInFlight = false
	}
}

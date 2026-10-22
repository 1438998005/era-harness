import fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { recordAudit } from "@/core/logging/auditLog"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { fetch } from "@/shared/net"
import { ShowMessageType } from "@/shared/proto/index.host"
import { Logger } from "@/shared/services/Logger"
import { isNewerVersion, isValidDownloadedVsix, pickVsixAsset, type ReleaseAsset } from "@/shared/utils/version"

/**
 * 检查更新 + 分步安装。
 *
 * 交互约束（用户明确要求，不要改成自动）：
 * 1. 只有用户点「检查更新」（命令面板或设置 → 关于）才发起检查，启动时**不**联网；
 * 2. 检查只负责「查」，查到新版本后必须再点一次「下一步：下载并安装」才落盘安装；
 * 3. 装完提示重载，重载也要用户点。
 *
 * 安全边界：
 * - 只查本仓库的 GitHub Release，只装官方 assets 里、下载域名对得上的 `.vsix`；
 * - 下载后校验 ZIP 头再交给 VS Code 安装；失败不破坏当前版本。
 */

const RELEASES_API = "https://api.github.com/repos/1438998005/era-harness/releases/latest"
export const RELEASES_PAGE = "https://github.com/1438998005/era-harness/releases/latest"

interface GithubRelease {
	tag_name?: string
	draft?: boolean
	prerelease?: boolean
	assets?: ReleaseAsset[]
}

async function fetchLatestRelease(): Promise<GithubRelease> {
	const response = await fetch(RELEASES_API, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": `era-harness/${ExtensionRegistryInfo.version}`,
		},
	})

	if (!response.ok) {
		throw new Error(`GitHub API ${response.status} ${response.statusText}`)
	}

	return (await response.json()) as GithubRelease
}

async function openReleasePage(): Promise<void> {
	await vscode.env.openExternal(vscode.Uri.parse(RELEASES_PAGE))
}

async function downloadAndInstall(context: vscode.ExtensionContext, asset: ReleaseAsset): Promise<void> {
	const updatesDir = path.join(context.globalStorageUri.fsPath, "updates")
	await fs.mkdir(updatesDir, { recursive: true })

	const vsixPath = path.join(updatesDir, path.basename(asset.name))
	const response = await fetch(asset.browser_download_url, {
		headers: { "User-Agent": `era-harness/${ExtensionRegistryInfo.version}` },
	})
	if (!response.ok) {
		throw new Error(`下载失败：HTTP ${response.status}`)
	}

	const buffer = Buffer.from(await response.arrayBuffer())
	if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
		throw new Error("下载内容不是合法的 vsix（ZIP 头校验失败）")
	}

	if (!isValidDownloadedVsix(buffer.length, asset.size)) {
		throw new Error("下载体积与 Release 元数据不一致，已放弃安装")
	}

	await fs.writeFile(vsixPath, buffer)
	Logger.log(`[update] 已下载 ${vsixPath}（${buffer.length} bytes）`)

	await vscode.commands.executeCommand("workbench.extensions.installExtension", vscode.Uri.file(vsixPath))
	// 安装完成即清理临时 vsix，避免 globalStorage 越积越多
	await fs.unlink(vsixPath).catch(() => {})

	const reload = await HostProvider.window.showMessage({
		type: ShowMessageType.INFORMATION,
		message: "era harness 更新已安装，重载窗口后生效。",
		options: { items: ["重新加载"] },
	})
	if (reload.selectedOption === "重新加载") {
		await vscode.commands.executeCommand("workbench.action.reloadWindow")
	}
}

const NEXT_STEP = "下一步：下载并安装"

/** 双击按钮 / 命令面板重复触发时只跑一次，避免弹两个对话框、下载两次 */
let checkInFlight = false

/**
 * 第二步：用户点了「下一步」才真正下载并安装。
 */
async function runUserApprovedUpdate(context: vscode.ExtensionContext, asset: ReleaseAsset): Promise<void> {
	try {
		await downloadAndInstall(context, asset)
		recordAudit({ event: "update", action: "install", target: asset.name, outcome: "ok" })
	} catch (error) {
		Logger.error("[update] 安装失败：", error)
		const message = error instanceof Error ? error.message : String(error)
		recordAudit({ event: "update", action: "install", target: asset.name, outcome: "error", message })
		const retry = await HostProvider.window.showMessage({
			type: ShowMessageType.ERROR,
			message: `更新安装失败：${message}（当前版本未被改动）`,
			options: { items: ["打开 Release 页面"] },
		})
		if (retry.selectedOption === "打开 Release 页面") {
			await openReleasePage()
		}
	}
}

/**
 * 检查更新（只检查，不安装）。
 *
 * 由命令 `era-harness.checkForUpdates` 或设置 → 关于的按钮触发；**没有**自动触发入口。
 */
export async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
	if (checkInFlight) {
		await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: "正在检查更新，请稍候。",
		})
		return
	}

	checkInFlight = true
	try {
		const release = await fetchLatestRelease()

		if (!release.tag_name || release.draft || release.prerelease) {
			await HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: "当前没有可用的正式版本（草稿/预发布会被忽略）。",
				options: { items: ["打开 Release 页面"] },
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

		const asset = pickVsixAsset(release.assets, tag)
		const answer = await HostProvider.window.showMessage({
			type: ShowMessageType.INFORMATION,
			message: `发现新版本 era harness v${tag.replace(/^v/i, "")}（当前 v${ExtensionRegistryInfo.version}）。点击「${NEXT_STEP}」才会下载并安装。`,
			options: {
				items: asset ? [NEXT_STEP, "打开 Release 页面", "取消"] : ["打开 Release 页面", "取消"],
			},
		})

		if (answer.selectedOption === NEXT_STEP && asset) {
			await runUserApprovedUpdate(context, asset)
			return
		}

		if (answer.selectedOption === "打开 Release 页面") {
			await openReleasePage()
		}
	} catch (error) {
		Logger.warn("[update] 检查更新失败：", error)

		const message = error instanceof Error ? error.message : String(error)
		recordAudit({ event: "update", action: "check", outcome: "error", message })
		const answer = await HostProvider.window.showMessage({
			type: ShowMessageType.ERROR,
			message: `检查更新失败：${message}。可稍后重试，或直接打开 Release 页面手动下载。`,
			options: { items: ["打开 Release 页面"] },
		})
		if (answer.selectedOption === "打开 Release 页面") {
			await openReleasePage()
		}
	} finally {
		checkInFlight = false
	}
}

/**
 * 版本号与 Release 资产的纯函数（任务 D1）。
 *
 * 只做字符串/数字比较，不依赖 vscode 与网络，便于单测与复用。
 */

export interface ReleaseAsset {
	name: string
	browser_download_url: string
	size: number
	/** GitHub API 的 `assets[].digest`，形如 `sha256:<hex>`。旧版本 API 可能没有该字段 */
	digest?: string
}

/**
 * 两条**互相独立**的发布渠道：各自查、各自下，下载地址都来自各自接口。
 *
 * 刻意不做「一个源 + 一个加速前缀」的拼接——jihulab 的地址不是 GitHub 地址的变形，
 * 而且账号受限时 GitHub 整条链路都不通，前缀方案救不了。
 */
export type ReleaseSource = "github" | "jihulab"

export interface ReleaseSourceMeta {
	/** 按钮与文案里显示的名字 */
	label: string
	/** 取 Release 列表的 REST 接口 */
	apiUrl: string
	/** 资产下载地址的受信前缀：不在这个前缀下一律不认 */
	assetPrefix: string
	/** 给人看的 Release 页面 */
	releasesPage: string
}

export const GITHUB_REPO = "1438998005/era-harness"
export const JIHULAB_PROJECT = "eraharness/era-harness"

export const RELEASE_SOURCES: Record<ReleaseSource, ReleaseSourceMeta> = {
	github: {
		label: "GitHub",
		apiUrl: `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
		assetPrefix: `https://github.com/${GITHUB_REPO}/releases/download/`,
		releasesPage: `https://github.com/${GITHUB_REPO}/releases/latest`,
	},
	jihulab: {
		label: "jihulab",
		apiUrl: `https://jihulab.com/api/v4/projects/${encodeURIComponent(JIHULAB_PROJECT)}/releases?per_page=20`,
		assetPrefix: `https://jihulab.com/${JIHULAB_PROJECT}/-/releases/`,
		releasesPage: `https://jihulab.com/${JIHULAB_PROJECT}/-/releases`,
	},
}

/** 检查顺序：先 GitHub，连不上再问 jihulab */
export const RELEASE_SOURCE_ORDER: readonly ReleaseSource[] = ["github", "jihulab"]

/** 单个 vsix 的体积上限：超过即视为异常资产 */
export const MAX_VSIX_BYTES = 200 * 1024 * 1024

/**
 * 解析版本号：去掉 `v` 前缀与 prerelease/build 后缀，返回数字段。
 * 解析失败返回 null（调用方据此跳过而不是误判为「更新」）。
 */
export function parseVersion(version: string): number[] | null {
	const trimmed = version.trim().replace(/^v/i, "")
	if (!trimmed) {
		return null
	}

	const core = trimmed.split(/[-+]/, 1)[0]
	if (!/^\d+(\.\d+)*$/.test(core)) {
		return null
	}

	return core.split(".").map((part) => Number(part))
}

/**
 * 比较版本：`a > b` 返回正数，`a < b` 返回负数，相等返回 0。
 * 任一侧无法解析时返回 0（宁可不提示更新，也不把用户带向错误版本）。
 */
export function compareVersions(a: string, b: string): number {
	const left = parseVersion(a)
	const right = parseVersion(b)
	if (!left || !right) {
		return 0
	}

	const length = Math.max(left.length, right.length)
	for (let index = 0; index < length; index++) {
		const diff = (left[index] ?? 0) - (right[index] ?? 0)
		if (diff !== 0) {
			return diff
		}
	}

	return 0
}

export function isNewerVersion(current: string, latest: string): boolean {
	return compareVersions(latest, current) > 0
}

/**
 * 资产是否来自指定渠道的受信地址。
 *
 * `size` 允许为 0：GitLab 的 Release 资产不返回体积，只能用 0 表示「未知」，
 * 真实体积在下载完成后由 `isValidDownloadedVsix` 兜底（上限仍然卡死）。
 */
export function isTrustedReleaseAsset(asset: ReleaseAsset, source: ReleaseSource): boolean {
	return (
		asset.name.toLowerCase().endsWith(".vsix") &&
		asset.browser_download_url.startsWith(RELEASE_SOURCES[source].assetPrefix) &&
		Number.isFinite(asset.size) &&
		asset.size >= 0 &&
		asset.size <= MAX_VSIX_BYTES
	)
}

/**
 * 下载完成后的真实体积校验。
 *
 * 只信 Release 元数据（asset.size）不够：响应实际内容可能远超声明。
 * 因此要求：非空、不超上限，且声明了大小时必须完全一致。
 */
export function isValidDownloadedVsix(byteLength: number, assetSize?: number): boolean {
	if (!Number.isFinite(byteLength) || byteLength <= 0 || byteLength > MAX_VSIX_BYTES) {
		return false
	}

	return typeof assetSize !== "number" || assetSize <= 0 || byteLength === assetSize
}

/**
 * 挑要下载的 vsix：优先 `era-harness-<tag>.vsix`（tag 带不带 v 都试），
 * 否则取第一个受信任的通用 `.vsix`。没有合格资产返回 undefined（只给 Release 页面）。
 *
 * 兜底时会排除带平台后缀的资产：体积/域名/ZIP 头都挡不住“装错平台的包”，
 * 那种情况只能到运行期才报错。
 */
const PLATFORM_SPECIFIC_ASSET = /-(linux|win32|darwin|darwin-arm64|android|web)(-[a-z0-9_]+)?\.vsix$/i

export function pickVsixAsset(
	assets: ReadonlyArray<ReleaseAsset> | undefined,
	tag: string,
	source: ReleaseSource,
): ReleaseAsset | undefined {
	if (!assets?.length) {
		return undefined
	}

	const trusted = assets.filter((asset) => isTrustedReleaseAsset(asset, source))
	const generic = trusted.filter((candidate) => !PLATFORM_SPECIFIC_ASSET.test(candidate.name))
	const normalizedTag = tag.trim().replace(/^v/i, "")
	const preferredNames = [`era-harness-${normalizedTag}.vsix`, `era-harness-v${normalizedTag}.vsix`]

	for (const name of preferredNames) {
		const match = trusted.find((asset) => asset.name.toLowerCase() === name.toLowerCase())
		if (match) {
			return match
		}
	}

	return generic[0] ?? trusted[0]
}

// ————————————————————————————————————————————————
// 摘要校验（3.91.1）：镜像来的字节必须自证身份
// ————————————————————————————————————————————————

const SHA256_HEX = /^[0-9a-f]{64}$/

/**
 * 从 GitHub 的 `digest` 字段取出裸 sha256 十六进制。
 *
 * 只认 `sha256:` 前缀（或干脆没前缀的 64 位十六进制）：其它算法（sha512 等）
 * 我们没法拿来校验，返回 undefined 让调用方放弃校验，而不是"跳过校验"。
 */
export function parseSha256Digest(digest?: string): string | undefined {
	if (typeof digest !== "string") {
		return undefined
	}

	const trimmed = digest.trim().toLowerCase()
	const hex = trimmed.startsWith("sha256:") ? trimmed.slice("sha256:".length) : trimmed
	return SHA256_HEX.test(hex) ? hex : undefined
}

/**
 * 常量时间比较两个 sha256 十六进制串（大小写不敏感）。
 *
 * 任一侧不是合法摘要就返回 false：空 vs 空必须是"不匹配"，
 * 否则缺失摘要会被当成校验通过。
 */
export function matchesSha256(expectedHex: string, actualHex: string): boolean {
	const expected = parseSha256Digest(expectedHex)
	const actual = parseSha256Digest(actualHex)
	if (!expected || !actual) {
		return false
	}

	let diff = 0
	for (let index = 0; index < expected.length; index++) {
		diff |= expected.charCodeAt(index) ^ actual.charCodeAt(index)
	}
	return diff === 0
}

// ————————————————————————————————————————————————
// 渠道选择：两个按钮 = 两条互不相干的渠道
// ————————————————————————————————————————————————

/**
 * 这个资产能不能从指定渠道下载；不能就返回 undefined（调用方据此连按钮都不给）。
 *
 * 只判断「地址是否落在该渠道的受信前缀下」。摘要的前置条件按渠道各自处理：
 * GitHub 看接口返回的 `digest`，jihulab 看同一 Release 里配套的 `.sha256` 资产。
 */
export function pickDownloadUrl(asset: ReleaseAsset, source: ReleaseSource): string | undefined {
	return isTrustedReleaseAsset(asset, source) ? asset.browser_download_url : undefined
}

/** 同一 Release 里配套的 `<vsix>.sha256` 校验文件 */
export function findChecksumAsset(assets: ReadonlyArray<ReleaseAsset> | undefined, vsixName: string): ReleaseAsset | undefined {
	const wanted = `${vsixName}.sha256`.toLowerCase()
	return assets?.find((asset) => asset.name.toLowerCase() === wanted)
}

// ————————————————————————————————————————————————
// 进度文案里的体积 / 速率
// ————————————————————————————————————————————————

const SIZE_UNITS = ["B", "KB", "MB", "GB"] as const

function formatScaled(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return `0 ${SIZE_UNITS[0]}`
	}

	let value = bytes
	let unit = 0
	while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
		value /= 1024
		unit += 1
	}

	if (unit === 0) {
		return `${Math.round(value)} ${SIZE_UNITS[0]}`
	}

	const text = value.toFixed(1)
	return `${text.endsWith(".0") ? text.slice(0, -2) : text} ${SIZE_UNITS[unit]}`
}

/** 3.2 MB / 1023 B / 0 B —— 进度条与对话框里的体积文案 */
export function formatBytes(bytes: number): string {
	return formatScaled(bytes)
}

/** 812 KB/s / 34 KB/s / 0 B/s —— 下载速率文案 */
export function formatSpeed(bytesPerSecond: number): string {
	return `${formatScaled(bytesPerSecond)}/s`
}

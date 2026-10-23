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

/** 只接受本仓库 Release 的下载地址，防止被引导去装任意 vsix */
export const TRUSTED_RELEASE_PREFIX = "https://github.com/1438998005/era-harness/releases/download/"

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

export function isTrustedReleaseAsset(asset: ReleaseAsset): boolean {
	return (
		asset.name.toLowerCase().endsWith(".vsix") &&
		asset.browser_download_url.startsWith(TRUSTED_RELEASE_PREFIX) &&
		asset.size > 0 &&
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

export function pickVsixAsset(assets: ReadonlyArray<ReleaseAsset> | undefined, tag: string): ReleaseAsset | undefined {
	if (!assets?.length) {
		return undefined
	}

	const trusted = assets.filter(isTrustedReleaseAsset)
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
// 镜像（3.91.1）：只在用户点了「用镜像下载」时才拼地址
// ————————————————————————————————————————————————

/**
 * 把官方下载地址拼到镜像前缀后面。
 *
 * 刻意不提供"按速度自动切镜像"的判据：那等于替用户决定把 8MB 交给第三方。
 * 因此这里只做纯拼接，是否使用完全由调用方（=用户点没点按钮）决定。
 *
 * 拒绝的情况：前缀为空/非 http(s)、原地址不在 `TRUSTED_RELEASE_PREFIX` 下。
 */
export function buildMirrorUrl(mirrorPrefix: string, trustedUrl: string): string | undefined {
	const prefix = mirrorPrefix.trim().replace(/\/+$/, "")
	if (!prefix || !trustedUrl.startsWith(TRUSTED_RELEASE_PREFIX)) {
		return undefined
	}

	let parsed: URL
	try {
		parsed = new URL(prefix)
	} catch {
		return undefined
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return undefined
	}

	return `${prefix}/${trustedUrl}`
}

/**
 * 决定这一跳到底从哪下。
 *
 * - `direct`：永远官方地址，永不改道。
 * - `mirror`：仅当前缀非空**且**资产带可用 digest 时给出地址。没有 digest 就
 *   无法验证镜像给的字节，此时返回 undefined → 调用方连「用镜像下载」按钮都不显示。
 */
export function pickDownloadUrl(asset: ReleaseAsset, mirrorPrefix: string, via: "direct" | "mirror"): string | undefined {
	if (!isTrustedReleaseAsset(asset)) {
		return undefined
	}
	if (via === "direct") {
		return asset.browser_download_url
	}
	if (!parseSha256Digest(asset.digest)) {
		return undefined
	}

	return buildMirrorUrl(mirrorPrefix, asset.browser_download_url)
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

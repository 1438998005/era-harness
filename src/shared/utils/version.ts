/**
 * 版本号与 Release 资产的纯函数（任务 D1）。
 *
 * 只做字符串/数字比较，不依赖 vscode 与网络，便于单测与复用。
 */

export interface ReleaseAsset {
	name: string
	browser_download_url: string
	size: number
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

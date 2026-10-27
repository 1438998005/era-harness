/**
 * 自更新的版本比较与资产挑选（任务 D1/D5）。
 *
 * 纪律：宁可不提示，也不能把用户带向错误版本或非官方 vsix。
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import {
	compareVersions,
	findChecksumAsset,
	formatBytes,
	formatSpeed,
	isNewerVersion,
	isTrustedReleaseAsset,
	isValidDownloadedVsix,
	MAX_VSIX_BYTES,
	matchesSha256,
	parseSha256Digest,
	parseVersion,
	pickDownloadUrl,
	pickVsixAsset,
	RELEASE_SOURCES,
	type ReleaseAsset,
} from "../../src/shared/utils/version"

const GOOD_DIGEST = "sha256:c33f205bb5e7fb2a94b74fbc155df790900e0f1c2deb9f2d741ef4b15b16000f"

const GITHUB_PREFIX = RELEASE_SOURCES.github.assetPrefix
const JIHULAB_PREFIX = RELEASE_SOURCES.jihulab.assetPrefix

function asset(name: string, url?: string, size = 1024, digest?: string): ReleaseAsset {
	return {
		name,
		browser_download_url: url ?? `${GITHUB_PREFIX}v3.90.0/${name}`,
		size,
		digest,
	}
}

/** jihulab 的资产：GitLab 不返回体积，也没有 digest（校验靠配套的 .sha256） */
function jihulabAsset(name: string, tag = "v3.90.0"): ReleaseAsset {
	return {
		name,
		browser_download_url: `${JIHULAB_PREFIX}${tag}/downloads/${name}`,
		size: 0,
	}
}

function sha256Of(data: Buffer | string): string {
	return createHash("sha256").update(data).digest("hex")
}

// ————————————————————————————————————————————————
// 版本比较
// ————————————————————————————————————————————————

test("解析版本号：去 v 前缀、忽略 prerelease/build 后缀", () => {
	assert.deepEqual(parseVersion("v3.90.0"), [3, 90, 0])
	assert.deepEqual(parseVersion("3.90.0-beta.1"), [3, 90, 0])
	assert.deepEqual(parseVersion(" 3.90.0+build.5 "), [3, 90, 0])
	assert.equal(parseVersion("not-a-version"), null)
	assert.equal(parseVersion(""), null)
})

test("按数字段比较，3.10.0 > 3.9.9", () => {
	assert.ok(compareVersions("3.10.0", "3.9.9") > 0)
	assert.ok(compareVersions("3.9.9", "3.10.0") < 0)
	assert.equal(compareVersions("v3.90.0", "3.90.0"), 0)
	assert.equal(compareVersions("3.90", "3.90.0"), 0, "缺省段按 0 处理")
})

test("isNewerVersion：只有严格更新才算更新", () => {
	assert.equal(isNewerVersion("3.89.6", "v3.90.0"), true)
	assert.equal(isNewerVersion("3.90.0", "v3.90.0"), false)
	assert.equal(isNewerVersion("3.90.1", "v3.90.0"), false)
	assert.equal(isNewerVersion("3.89.6", "garbage"), false, "解析失败不提示更新")
})

// ————————————————————————————————————————————————
// 资产挑选与安全检查
// ————————————————————————————————————————————————

test("优先挑 era-harness-<tag>.vsix", () => {
	const picked = pickVsixAsset([asset("other.vsix"), asset("era-harness-3.90.0.vsix")], "v3.90.0", "github")
	assert.equal(picked?.name, "era-harness-3.90.0.vsix")
})

test("没有约定名时取第一个受信任的 vsix", () => {
	const picked = pickVsixAsset([asset("era-harness.vsix"), asset("second.vsix")], "v3.90.0", "github")
	assert.equal(picked?.name, "era-harness.vsix")
})

test("非官方域名一律拒绝", () => {
	const evil = asset("era-harness-3.90.0.vsix", "https://evil.example.com/era-harness-3.90.0.vsix")
	assert.equal(isTrustedReleaseAsset(evil, "github"), false)
	assert.equal(pickVsixAsset([evil], "v3.90.0", "github"), undefined)
})

test("超过体积上限的资产被拒绝", () => {
	const huge = asset("era-harness-3.90.0.vsix", undefined, MAX_VSIX_BYTES + 1)
	assert.equal(isTrustedReleaseAsset(huge, "github"), false)
	assert.equal(pickVsixAsset([huge], "v3.90.0", "github"), undefined)
})

test("非 vsix 资产被忽略", () => {
	const zip = asset("source.zip")
	assert.equal(isTrustedReleaseAsset(zip, "github"), false)
	assert.equal(pickVsixAsset([zip], "v3.90.0", "github"), undefined)
})

test("空资产列表返回 undefined（只给 Release 页面）", () => {
	assert.equal(pickVsixAsset([], "v3.90.0", "github"), undefined)
	assert.equal(pickVsixAsset(undefined, "v3.90.0", "github"), undefined)
})

test("下载后体积校验：与元数据不一致、为空或超上限都拒绝", () => {
	assert.equal(isValidDownloadedVsix(1024, 1024), true)
	assert.equal(isValidDownloadedVsix(1024, undefined), true)
	assert.equal(isValidDownloadedVsix(1024, 2048), false)
	assert.equal(isValidDownloadedVsix(0, 1024), false)
	assert.equal(isValidDownloadedVsix(MAX_VSIX_BYTES + 1, undefined), false)
})

// ————————————————————————————————————————————————
// sha256 摘要（3.91.1）
// ————————————————————————————————————————————————

test("解析 digest：只认 sha256，裸十六进制也接受，大小写归一", () => {
	assert.equal(parseSha256Digest(GOOD_DIGEST), GOOD_DIGEST.slice("sha256:".length))
	assert.equal(parseSha256Digest(GOOD_DIGEST.slice("sha256:".length)), GOOD_DIGEST.slice("sha256:".length), "无前缀也接受")
	assert.equal(parseSha256Digest(GOOD_DIGEST.toUpperCase()), GOOD_DIGEST.slice("sha256:".length), "大小写归一为小写")
	assert.equal(parseSha256Digest(`  ${GOOD_DIGEST}  `), GOOD_DIGEST.slice("sha256:".length), "两端空白不影响")
})

test("解析 digest：缺失、空串、其它算法、长度不对一律 undefined", () => {
	assert.equal(parseSha256Digest(undefined), undefined)
	assert.equal(parseSha256Digest(""), undefined)
	assert.equal(parseSha256Digest("sha256:"), undefined)
	assert.equal(parseSha256Digest("sha512:" + "a".repeat(128)), undefined, "换算法等于没有可用的校验")
	assert.equal(parseSha256Digest("sha256:" + "a".repeat(63)), undefined, "长度不足")
	assert.equal(parseSha256Digest("sha256:" + "g".repeat(64)), undefined, "非十六进制")
})

test("matchesSha256：一致才通过，大小写不敏感", () => {
	const hex = GOOD_DIGEST.slice("sha256:".length)
	assert.equal(matchesSha256(hex, hex), true)
	assert.equal(matchesSha256(GOOD_DIGEST, hex), true, "带前缀也能比")
	assert.equal(matchesSha256(hex.toUpperCase(), hex), true)
	assert.equal(matchesSha256(hex, hex.slice(0, -1) + "0"), false)
	assert.equal(matchesSha256(hex, sha256Of("tampered")), false)
})

test("matchesSha256：两侧都非法时不匹配（空 vs 空不能算通过）", () => {
	assert.equal(matchesSha256("", ""), false)
	assert.equal(matchesSha256("", GOOD_DIGEST), false)
	assert.equal(matchesSha256(GOOD_DIGEST, ""), false)
})

// ————————————————————————————————————————————————
// 渠道（两条独立链路）：各自只认自己的前缀
// ————————————————————————————————————————————————

test("GitHub 与 jihulab 各自只认自己的前缀", () => {
	const gh = asset("era-harness-3.91.1.vsix")
	const jh = jihulabAsset("era-harness-3.91.1.vsix", "v3.91.1")

	assert.equal(isTrustedReleaseAsset(gh, "github"), true)
	assert.equal(isTrustedReleaseAsset(gh, "jihulab"), false, "GitHub 地址不能冒充 jihulab")
	assert.equal(isTrustedReleaseAsset(jh, "jihulab"), true)
	assert.equal(isTrustedReleaseAsset(jh, "github"), false, "jihulab 地址不能冒充 GitHub")
})

test("jihulab 资产体积未知（0）也接受，超上限仍然拒绝", () => {
	assert.equal(isTrustedReleaseAsset(jihulabAsset("era-harness-3.91.1.vsix"), "jihulab"), true)
	const huge = { ...jihulabAsset("era-harness-3.91.1.vsix"), size: MAX_VSIX_BYTES + 1 }
	assert.equal(isTrustedReleaseAsset(huge, "jihulab"), false)
})

test("pickDownloadUrl：只返回该渠道自己的地址", () => {
	const gh = asset("era-harness-3.91.1.vsix")
	const jh = jihulabAsset("era-harness-3.91.1.vsix")

	assert.equal(pickDownloadUrl(gh, "github"), gh.browser_download_url)
	assert.equal(pickDownloadUrl(gh, "jihulab"), undefined)
	assert.equal(pickDownloadUrl(jh, "jihulab"), jh.browser_download_url)
	assert.equal(pickDownloadUrl(jh, "github"), undefined)
})

test("pickDownloadUrl：第三方域名两条渠道都不认", () => {
	const evil = asset("era-harness-3.90.0.vsix", "https://evil.example.com/era-harness-3.90.0.vsix")
	assert.equal(pickDownloadUrl(evil, "github"), undefined)
	assert.equal(pickDownloadUrl(evil, "jihulab"), undefined)
})

test("findChecksumAsset：只认同名的 <vsix>.sha256", () => {
	const assets = [jihulabAsset("era-harness-3.91.1.vsix"), jihulabAsset("era-harness-3.91.1.vsix.sha256")]
	assert.equal(findChecksumAsset(assets, "era-harness-3.91.1.vsix")?.name, "era-harness-3.91.1.vsix.sha256")
	assert.equal(findChecksumAsset(assets, "era-harness-3.90.0.vsix"), undefined)
	assert.equal(findChecksumAsset(undefined, "era-harness-3.91.1.vsix"), undefined)
})

test("摘要不匹配 → 拒绝落盘（两条渠道同一套判据）", () => {
	const realVsix = Buffer.from("PK\u0003\u0004real vsix bytes")
	const badBody = Buffer.from("<html>429 Too Many Requests</html>")
	const realDigest = `sha256:${sha256Of(realVsix)}`

	assert.equal(matchesSha256(parseSha256Digest(realDigest) ?? "", sha256Of(badBody)), false, "错误字节必须被拒")
	assert.equal(matchesSha256(parseSha256Digest(realDigest) ?? "", sha256Of(realVsix)), true, "正确字节必须通过")
})

// ————————————————————————————————————————————————
// 体积 / 速率文案
// ————————————————————————————————————————————————

test("formatBytes：0、1023、1024、7.9MB 的边界", () => {
	assert.equal(formatBytes(0), "0 B")
	assert.equal(formatBytes(-1), "0 B")
	assert.equal(formatBytes(Number.NaN), "0 B")
	assert.equal(formatBytes(Number.POSITIVE_INFINITY), "0 B")
	assert.equal(formatBytes(1), "1 B")
	assert.equal(formatBytes(1023), "1023 B")
	assert.equal(formatBytes(1024), "1 KB")
	assert.equal(formatBytes(1024 * 1024), "1 MB")
	assert.equal(formatBytes(7.9 * 1024 * 1024), "7.9 MB")
	assert.equal(formatBytes(1024 * 1024 * 1024), "1 GB")
	assert.equal(formatBytes(4096 * 1024 * 1024 * 1024), "4096 GB", "单位封顶在 GB，不引入 TB 导致文案跳档")
})

test("formatSpeed：812 KB/s、34 KB/s、0 B/s", () => {
	assert.equal(formatSpeed(0), "0 B/s")
	assert.equal(formatSpeed(Number.NaN), "0 B/s")
	assert.equal(formatSpeed(512), "512 B/s")
	assert.equal(formatSpeed(812 * 1024), "812 KB/s")
	assert.equal(formatSpeed(34 * 1024), "34 KB/s")
	assert.equal(formatSpeed(3.2 * 1024 * 1024), "3.2 MB/s")
})

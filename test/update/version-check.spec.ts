/**
 * 自更新的版本比较与资产挑选（任务 D1/D5）。
 *
 * 纪律：宁可不提示，也不能把用户带向错误版本或非官方 vsix。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	compareVersions,
	isNewerVersion,
	isTrustedReleaseAsset,
	isValidDownloadedVsix,
	MAX_VSIX_BYTES,
	parseVersion,
	pickVsixAsset,
	type ReleaseAsset,
} from "../../src/shared/utils/version"

function asset(name: string, url?: string, size = 1024): ReleaseAsset {
	return {
		name,
		browser_download_url: url ?? `https://github.com/1438998005/era-harness/releases/download/v3.90.0/${name}`,
		size,
	}
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
	const picked = pickVsixAsset([asset("other.vsix"), asset("era-harness-3.90.0.vsix")], "v3.90.0")
	assert.equal(picked?.name, "era-harness-3.90.0.vsix")
})

test("没有约定名时取第一个受信任的 vsix", () => {
	const picked = pickVsixAsset([asset("era-harness.vsix"), asset("second.vsix")], "v3.90.0")
	assert.equal(picked?.name, "era-harness.vsix")
})

test("非官方域名一律拒绝", () => {
	const evil = asset("era-harness-3.90.0.vsix", "https://evil.example.com/era-harness-3.90.0.vsix")
	assert.equal(isTrustedReleaseAsset(evil), false)
	assert.equal(pickVsixAsset([evil], "v3.90.0"), undefined)
})

test("超过体积上限的资产被拒绝", () => {
	const huge = asset("era-harness-3.90.0.vsix", undefined, MAX_VSIX_BYTES + 1)
	assert.equal(isTrustedReleaseAsset(huge), false)
	assert.equal(pickVsixAsset([huge], "v3.90.0"), undefined)
})

test("非 vsix 资产被忽略", () => {
	const zip = asset("source.zip")
	assert.equal(isTrustedReleaseAsset(zip), false)
	assert.equal(pickVsixAsset([zip], "v3.90.0"), undefined)
})

test("空资产列表返回 undefined（只给 Release 页面）", () => {
	assert.equal(pickVsixAsset([], "v3.90.0"), undefined)
	assert.equal(pickVsixAsset(undefined, "v3.90.0"), undefined)
})

test("下载后体积校验：与元数据不一致、为空或超上限都拒绝", () => {
	assert.equal(isValidDownloadedVsix(1024, 1024), true)
	assert.equal(isValidDownloadedVsix(1024, undefined), true)
	assert.equal(isValidDownloadedVsix(1024, 2048), false)
	assert.equal(isValidDownloadedVsix(0, 1024), false)
	assert.equal(isValidDownloadedVsix(MAX_VSIX_BYTES + 1, undefined), false)
})

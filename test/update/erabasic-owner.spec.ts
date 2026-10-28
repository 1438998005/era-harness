/**
 * 「EraBasic 语法归属」三态的纯逻辑（associations.ts）。
 *
 * 来自 3.92.0 的两条真实反馈：
 * 1. off 态原绑 plaintext（纯文本），用户抱怨「把自带的高亮一并关了」——原始诉求是
 *    「用回原版颜色」，故改为绑内置 Ruby（保留 VS Code 原版配色）；
 * 2. 白名单 bug（本文件不覆盖，gate 反向检查覆盖）。
 *
 * 硬纪律：只动 *.erb/*.erh 两键；只清本扩展写过的值；用户自己的映射不碰。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	computeAssociationsForOwner,
	healAssociations,
	isManagedValue,
	PLAINTEXT_LANGUAGE_ID,
	RUBY_LANGUAGE_ID,
	SASAMI_LANGUAGE_ID,
} from "../../src/hosts/vscode/erabasic/associations"

const ERB_KEYS = ["*.erb", "*.erh"]

test("off 态：绑到内置 Ruby，已是 ruby 则不重复写", () => {
	const { next, changed } = computeAssociationsForOwner("off", { "*.erh": "some-other" }, undefined)
	assert.deepEqual(next, { "*.erb": RUBY_LANGUAGE_ID, "*.erh": RUBY_LANGUAGE_ID })
	assert.deepEqual(changed, ERB_KEYS)

	// 幂等：已经是 ruby → 零改动，不写盘
	const again = computeAssociationsForOwner("off", { "*.erb": RUBY_LANGUAGE_ID, "*.erh": RUBY_LANGUAGE_ID }, undefined)
	assert.deepEqual(again.changed, [])
	assert.deepEqual(again.next, { "*.erb": RUBY_LANGUAGE_ID, "*.erh": RUBY_LANGUAGE_ID })
})

test("sasami 态：写到对方语言 id；拿不到 id 时不落值", () => {
	// 让位 = 两个管理键都归对方（未设置的键也要落值，与 index.ts 旧实现一致）
	const { next, changed } = computeAssociationsForOwner("sasami", { "*.erb": RUBY_LANGUAGE_ID }, "erabasic")
	assert.equal(next["*.erb"], SASAMI_LANGUAGE_ID)
	assert.equal(next["*.erh"], SASAMI_LANGUAGE_ID)
	assert.deepEqual(changed, ERB_KEYS)

	// sasami 被卸载（target=undefined）：不动用户设置，由调用方提示
	const idle = computeAssociationsForOwner("sasami", { "*.erb": RUBY_LANGUAGE_ID }, undefined)
	assert.deepEqual(idle.changed, [])
})

test("era 态：清掉本扩展写过的所有值，不碰用户自己的映射", () => {
	// 本扩展写过的：era-erb / sasami 的 id / ruby（off 写的）/ plaintext（旧 off 写的）/ 对方声明的 id
	const ours = {
		"*.erb": "era-erb",
		"*.erh": "erabasic",
		"*.erd": "ruby", // 非管理键：即使值是 ruby 也绝不动
	}
	const { next, changed } = computeAssociationsForOwner("era", ours, "erabasic")
	assert.equal(next["*.erb"], undefined)
	assert.equal(next["*.erh"], undefined)
	assert.equal(next["*.erd"], "ruby", "管理键之外的用户映射必须原样保留")
	assert.deepEqual(changed, ["*.erb", "*.erh"])

	// 用户手写的陌生语言 id 不清
	const untouched = computeAssociationsForOwner("era", { "*.erb": "my-own-lang" }, undefined)
	assert.equal(untouched.next["*.erb"], "my-own-lang")
	assert.deepEqual(untouched.changed, [])

	// plaintext（旧 off 残留）与 ruby（现 off）切回 era 时都要清干净
	const cleaned = computeAssociationsForOwner("era", { "*.erb": PLAINTEXT_LANGUAGE_ID, "*.erh": RUBY_LANGUAGE_ID }, undefined)
	assert.equal(cleaned.next["*.erb"], undefined)
	assert.equal(cleaned.next["*.erh"], undefined)
})

test("isManagedValue：内置 ruby/plaintext/erabasic 与对方声明 id 都算本扩展写的", () => {
	assert.equal(isManagedValue(RUBY_LANGUAGE_ID, undefined), true)
	assert.equal(isManagedValue(PLAINTEXT_LANGUAGE_ID, undefined), true)
	assert.equal(isManagedValue(SASAMI_LANGUAGE_ID, undefined), true)
	assert.equal(isManagedValue("erabasic-alt", "erabasic-alt"), true)
	assert.equal(isManagedValue("my-own-lang", undefined), false)
	assert.equal(isManagedValue(undefined, undefined), false)
})

test("自愈：era-erb 脏值删除；plaintext 按 owner 迁移或清理", () => {
	// ≤3.88.0 的 era-erb 脏值 → 删
	const legacy = healAssociations({ "*.erb": "era-erb", "*.erh": "user-thing" }, "era")
	assert.equal(legacy.next["*.erb"], undefined)
	assert.equal(legacy.next["*.erh"], "user-thing")
	assert.deepEqual(legacy.changed, ["*.erb"])

	// 当前仍是 off → plaintext 迁移成 ruby（语义升级，不掉回无色）
	const migrated = healAssociations({ "*.erb": PLAINTEXT_LANGUAGE_ID }, "off")
	assert.equal(migrated.next["*.erb"], RUBY_LANGUAGE_ID)

	// 已不是 off → 残留直接清，恢复静态声明
	const stale = healAssociations({ "*.erh": PLAINTEXT_LANGUAGE_ID }, "era")
	assert.equal(stale.next["*.erh"], undefined)

	// 干净配置零改动
	const clean = healAssociations({ "*.erb": RUBY_LANGUAGE_ID }, "off")
	assert.deepEqual(clean.changed, [])
})

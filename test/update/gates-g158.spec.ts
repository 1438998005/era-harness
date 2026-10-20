/**
 * G1 / G5 / G8 三个闸门的用例。
 *
 * 与 gates.spec.ts 同源的纪律：**保守不误报**优先——每条用例都要能说清
 * "为什么这条该报 / 为什么那条不该报"，宁可漏也不许误报。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { type BugPattern, type GateTexts, regressionFindings, runContentGates } from "../../src/core/update/gates"
import {
	extractFsynCalls,
	extractLiteralKeys,
	fsynKeyFindings,
	glyphCollisionFindings,
	unknownKeyFindings,
} from "../../src/core/update/keys"

const PATH = "ERB/K1.ERB"

// ————————————————————————————————————————————————
// G1 回归扫描
// ————————————————————————————————————————————————

const BUGS: BugPattern[] = [{ id: "hph", pattern: "HPH_PRINT", hint: "老式半角 HPH 写法，本地早换成全角排版" }]

test("G1: 上游带来本地没有的既知 bug 串 ⇒ 报回归", () => {
	const texts: GateTexts = { local: "PRINTFORML 全角排版\n", theirs: "PRINTFORML HPH_PRINT 还在\n" }
	const out = regressionFindings(PATH, texts, BUGS)
	assert.equal(out.length, 1)
	assert.equal(out[0].gate, "G1")
	assert.equal(out[0].code, "regression-reintroduced")
	assert.equal(out[0].line, 1)
	assert.ok(out[0].detail.includes("本地已修"))
})

test("G1: 两边都有 ⇒ 存量，不算本次回归（与 G2 同口径）", () => {
	const texts: GateTexts = { local: "HPH_PRINT 本地也有\n", theirs: "HPH_PRINT 上游也有\n" }
	assert.equal(regressionFindings(PATH, texts, BUGS).length, 0)
})

test("G1: 本地有、上游没有 ⇒ 上游也修了，不报", () => {
	const texts: GateTexts = { local: "HPH_PRINT 只有本地\n", theirs: "PRINTFORML 干净\n" }
	assert.equal(regressionFindings(PATH, texts, BUGS).length, 0)
})

test("G1: 没给 bug 串清单 ⇒ 如实不跑（⛔ 不拿通用串兜底）", () => {
	const texts: GateTexts = { local: "干净\n", theirs: "HPH_PRINT 混进来\n" }
	assert.equal(regressionFindings(PATH, texts, []).length, 0)
})

test("G1: 坏正则不报（配置问题不是内容问题）", () => {
	const texts: GateTexts = { local: "a\n", theirs: "b\n" }
	assert.equal(regressionFindings(PATH, texts, [{ id: "bad", pattern: "([", hint: "x" }]).length, 0)
})

test("G1: 新增文件（local 为 null）时上游带 bug 串 ⇒ 报", () => {
	const texts: GateTexts = { local: null, theirs: "HPH_PRINT 新文件里就有\n" }
	assert.equal(regressionFindings(PATH, texts, BUGS).length, 1)
})

// ————————————————————————————————————————————————
// G5 FSYN 键
// ————————————————————————————————————————————————

test("G5 提取: FSYN 与 FSYN_CN 都要抓到（⛔ 别写成 FSYN_CN? 把纯 FSYN 漏掉）", () => {
	const calls = extractFsynCalls('PRINTFORML %FSYN("melt")% 与 %FSYN_CN("融化")%\n')
	assert.equal(calls.length, 2)
	assert.deepEqual(
		calls.map((c) => c.fn),
		["FSYN", "FSYN_CN"],
	)
	assert.deepEqual(
		calls.map((c) => c.key),
		["melt", "融化"],
	)
})

test("G5 提取: 动态键记 null，交由调用方跳过", () => {
	const calls = extractFsynCalls('LOCALS = FSYN_CN("%LOCALS:1%")\n')
	assert.equal(calls.length, 1)
	assert.equal(calls[0].key, null)
})

test("G5 提取: 注释行不参与", () => {
	assert.equal(extractFsynCalls('; FSYN_CN("注释里的")\n').length, 0)
})

test("G5: 键在键表里（中文或英文原文并列都算）⇒ 不报", () => {
	const ledger = new Set(["融化", "melt"])
	assert.equal(fsynKeyFindings(PATH, 'PRINTFORML %FSYN_CN("融化")% %FSYN("melt")%', ledger).length, 0)
})

test("G5: 键不在键表 ⇒ 报，并明确写「不要新增 CASE」", () => {
	const out = fsynKeyFindings(PATH, 'PRINTFORML %FSYN_CN("不存在的词")%', new Set(["融化"]))
	assert.equal(out.length, 1)
	assert.equal(out[0].code, "fsyn-unknown-key")
	assert.ok(out[0].detail.includes("不存在的词"))
	assert.ok(out[0].detail.includes("不要新增 CASE"))
})

test("G5: 没给键表 ⇒ 如实不跑", () => {
	assert.equal(fsynKeyFindings(PATH, 'PRINTFORML %FSYN_CN("随便")%').length, 0)
})

// ————————————————————————————————————————————————
// G8 标识符键预检
// ————————————————————————————————————————————————

test("G8 提取: CASE 多值里的每个字面串都要抓到，数值 CASE 不算键", () => {
	const hits = extractLiteralKeys('  CASE 0, 1\n  CASE "融化","melt"\n  IF A == "文本"\n')
	assert.deepEqual(
		hits.map((h) => h.key),
		["融化", "melt", "文本"],
	)
})

test("G8: 同一份文本里出现颜/顔两种字形 ⇒ 报撞名（引擎不做字形归一）", () => {
	const out = glyphCollisionFindings(PATH, 'CASE "颜"\nCASE "顔"\n')
	assert.equal(out.length, 1)
	assert.equal(out[0].code, "key-glyph-collision")
	assert.ok(out[0].detail.includes("颜/顔"))
})

test("G8: 只有一种字形 ⇒ 不报", () => {
	assert.equal(glyphCollisionFindings(PATH, 'CASE "颜"\nCASE "颜"\n').length, 0)
})

test("G8 撞名: 字形对要整词出现在键里，无关文本不算", () => {
	// "颜色" 含 "颜" 但没有 "顔" ⇒ 不成对
	assert.equal(glyphCollisionFindings(PATH, 'CASE "颜色"\n').length, 0)
})

test("G8: 新键不在既有键集 ⇒ 列待办", () => {
	const out = unknownKeyFindings(PATH, 'CASE "新出现的键"\n', new Set(["老键"]))
	assert.equal(out.length, 1)
	assert.equal(out[0].code, "key-unknown")
	assert.ok(out[0].detail.includes("逐条列本地化待办"))
})

test("G8: 没给键集 ⇒ 未知键部分不跑，但字形撞名仍跑", () => {
	assert.equal(unknownKeyFindings(PATH, 'CASE "新键"\n').length, 0)
	assert.equal(glyphCollisionFindings(PATH, 'CASE "覚"\nCASE "觉"\n').length, 1)
})

// ————————————————————————————————————————————————
// 接线：runContentGates 带上输入后 G1/G5/G8 一起跑
// ————————————————————————————————————————————————

test("runContentGates: 给了输入就同时过 G1/G5/G8，没给就只剩老闸门", () => {
	const theirs = [
		"@K1_EVENT",
		"PRINTFORML HPH_PRINT 回来了",
		'PRINTFORML %FSYN_CN("没这个词")%',
		'CASE "颜"',
		'CASE "顔"',
	].join("\n")
	const texts: GateTexts = { local: "@K1_EVENT\nPRINTFORML 干净\n", theirs }
	const ledgers = { bugPatterns: BUGS, fsynKeys: new Set(["融化"]), literalKeys: new Set(["老键"]) }

	const withInputs = runContentGates(PATH, texts, new Set(), ledgers)
	const gates = new Set(withInputs.map((f) => f.gate))
	assert.ok(gates.has("G1"), "G1 应命中")
	assert.ok(gates.has("G5"), "G5 应命中")
	assert.ok(gates.has("G8"), "G8 应命中")

	const without = runContentGates(PATH, texts, new Set())
	const withoutGates = new Set(without.map((f) => f.gate))
	assert.ok(!withoutGates.has("G1") && !withoutGates.has("G5"), "没给输入时 G1/G5 不跑")
	assert.ok(withoutGates.has("G8"), "G8 的字形撞名不需要键表，仍应命中")
})

test("runContentGates: 没给输入时不产生 G6 之外的噪音（本例 theirs 含 HPH ⇒ G6 必报）", () => {
	const texts: GateTexts = { local: "干净\n", theirs: "HPH 残留\n" }
	const out = runContentGates(PATH, texts, new Set())
	assert.deepEqual([...new Set(out.map((f) => f.gate))], ["G6"])
})

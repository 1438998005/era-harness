/**
 * 三方合并（窗口化）回归测试。
 *
 * 重点覆盖三件在真实数据上踩过的坑：
 * 1. `NEXTインデクス値` 这种日文变量名不能被当成 NEXT 语句；
 * 2. 上游原版就有块不配平的文件，校验必须相对比较；
 * 3. BOM / CRLF 必须原样保留（3877/4282 个 ERB 带 BOM）。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	analyzeErb,
	buildMergePrompt,
	decodeText,
	encodeText,
	extractMergeOutput,
	MAX_WINDOW_LINES,
	planMergeWindows,
	runMerge,
	sniffEncoding,
	stripNonCode,
	validateMerge,
} from "../../src/core/update/merge"

// ── 一、编码 ────────────────────────────────────────────────────────────────

test("编码：BOM + CRLF 能原样还原", () => {
	const src = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("A\r\nB\r\n", "utf8")])
	const decoded = decodeText(src)
	assert.ok(decoded)
	assert.equal(decoded.text, "A\nB\n")
	assert.deepEqual(decoded.encoding, { bom: true, eol: "\r\n" })
	assert.deepEqual(encodeText(decoded.text, decoded.encoding), src)
})

test("编码：无 BOM 的 LF 文件不会被偷偷加上 BOM", () => {
	const src = Buffer.from("@FOO\nRETURN\n", "utf8")
	const decoded = decodeText(src)
	assert.ok(decoded)
	assert.deepEqual(decoded.encoding, { bom: false, eol: "\n" })
	assert.deepEqual(encodeText(decoded.text, decoded.encoding), src)
})

test("编码：非 UTF-8 返回 null（CP932 不许瞎猜）", () => {
	// 0x82 0xA0 = CP932 的「あ」，作为 UTF-8 是非法的
	assert.equal(decodeText(Buffer.from([0x82, 0xa0, 0x82, 0xa2])), null)
})

test("编码：混合行尾按主流归一，还原时不产生 \\r\\r\\n", () => {
	const src = Buffer.from("A\r\nB\r\nC\n", "utf8")
	const decoded = decodeText(src)
	assert.ok(decoded)
	assert.equal(decoded.encoding.eol, "\r\n")
	assert.equal(decoded.text, "A\nB\nC\n")
	const back = encodeText(decoded.text, decoded.encoding)
	assert.equal(back.toString("utf8"), "A\r\nB\r\nC\r\n")
})

test("编码：sniffEncoding 只看换行与 BOM", () => {
	assert.deepEqual(sniffEncoding(Buffer.from("A\nB\n", "utf8")), { bom: false, eol: "\n" })
})

// ── 二、结构分析 ────────────────────────────────────────────────────────────

test("结构：日文变量名 NEXTインデクス値 不算 NEXT 语句", () => {
	const text = ["FOR LOCAL, 1, 10", "\tNEXTインデクス値 = 1", "\tNEXTBPB値 = 2", "NEXT"].join("\n")
	assert.equal(analyzeErb(text).blockDelta.FOR, 0)
})

test("结构：;[SKIPSTART] 注释块与 PRINTDATA 体不参与解析", () => {
	const text = ["IF A", ";[SKIPSTART]", "IF B", "[SKIPEND]", "ENDIF", "PRINTDATA", "IF 这行只是要打印的文字", "ENDDATA"].join(
		"\n",
	)
	assert.deepEqual(stripNonCode(text), ["IF A", "ENDIF"])
	assert.equal(analyzeErb(text).blockDelta.IF, 0)
})

test("结构：#FUNCTION 不是块开头，ERB 没有 #END", () => {
	const text = ["@FOO(A)", "#FUNCTION", "#LOCALSIZE 1", "SIF A", "\tRETURNF 0", "RETURNF 1"].join("\n")
	const s = analyzeErb(text)
	assert.deepEqual(s.labels, ["FOO"])
	assert.equal(s.blockDelta.IF, 0)
	assert.equal(s.blockDelta.FOR, 0)
})

test("结构：标签与调用目标提取，动态目标不做静态判断", () => {
	const text = [
		"@MAIN",
		"CALL SUB, 1",
		"TRYCALLFORM %NAME%",
		"JUMP LOOP_TOP",
		"CALLFORM 動的関数, 2",
		"$LOCAL1",
		"GOTO LOCAL1",
	].join("\n")
	const s = analyzeErb(text)
	assert.deepEqual(s.labels, ["MAIN"])
	assert.deepEqual(s.localLabels, ["LOCAL1"])
	assert.deepEqual(s.callTargets, ["SUB", "LOOP_TOP", "動的関数", "LOCAL1"])
})

test("结构：注释行不会被当成语句", () => {
	const text = [";IF A", "; IF B", "IF C", "ENDIF"].join("\n")
	assert.equal(analyzeErb(text).blockDelta.IF, 0)
})

// ── 三、模型输出抽取 ────────────────────────────────────────────────────────

test("抽取：剥掉 Markdown 围栏", () => {
	const raw = "```erb\nIF A\nENDIF\n```"
	assert.deepEqual(extractMergeOutput(raw), { text: "IF A\nENDIF", hadFence: true })
})

test("抽取：没有围栏时原样返回（只去首尾空行）", () => {
	assert.deepEqual(extractMergeOutput("\n\nIF A\nENDIF\n\n"), { text: "IF A\nENDIF", hadFence: false })
})

// ── 四、校验 ────────────────────────────────────────────────────────────────

const BASE = ["@FOO", "IF A", "\tPRINTL 1", "ENDIF", "RETURN"].join("\n")

function check(merged: string, local = BASE, theirs = BASE, base: string | null = BASE) {
	return validateMerge({ path: "ERB/t.ERB", base, local, theirs, merged })
}

test("校验：完全一致时通过", () => {
	assert.deepEqual(check(BASE), { ok: true, issues: [] })
})

test("校验：丢了函数 → missing-label", () => {
	const merged = ["IF A", "\tPRINTL 1", "ENDIF", "RETURN"].join("\n")
	const issues = check(merged).issues
	assert.ok(issues.some((i) => i.code === "missing-label"))
})

test("校验：凭空造出调用 → extra-call", () => {
	const merged = [...BASE.split("\n"), "CALL 不存在的函数"].join("\n")
	const issues = check(merged).issues
	assert.ok(issues.some((i) => i.code === "extra-call"))
})

test("校验：多一个 IF → block-imbalance", () => {
	const merged = [...BASE.split("\n"), "IF B"].join("\n")
	const issues = check(merged).issues
	assert.ok(issues.some((i) => i.code === "block-imbalance"))
})

test("校验：上游原版就不配平时，保持一致即可通过（相对比较）", () => {
	// 模拟 COUNTER_PUNISHMENT.ERB 那种「少一个 ENDIF」的真实文件
	const unbalanced = ["@FOO", "IF A", "\tPRINTL 1", "RETURN"].join("\n")
	assert.deepEqual(check(unbalanced, unbalanced, unbalanced, unbalanced), { ok: true, issues: [] })
})

test("校验：出现乱码 → mojibake", () => {
	const merged = BASE.replace("PRINTL 1", "PRINTL \uFFFD")
	const issues = check(merged).issues
	assert.ok(issues.some((i) => i.code === "mojibake"))
})

test("校验：被截断 → truncated", () => {
	const long = Array.from({ length: 20 }, (_, i) => `PRINTL ${i}`).join("\n")
	const merged = ["PRINTL 0", "PRINTL 1"].join("\n")
	const issues = check(merged, long, long, long).issues
	assert.ok(issues.some((i) => i.code === "truncated"))
})

test("校验：空结果直接失败", () => {
	assert.deepEqual(check("   "), { ok: false, issues: [{ code: "empty", detail: "合并结果为空" }] })
})

test("校验：window 范围跳过块/括号平衡", () => {
	const merged = "IF B"
	const result = validateMerge({
		path: "ERB/t.ERB",
		base: "IF A",
		local: "IF A",
		theirs: "IF A",
		merged,
		scope: "window",
	})
	assert.equal(result.ok, true)
})

// ── 五、窗口划分 ────────────────────────────────────────────────────────────

const LINES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]

function replaceAt(lines: string[], index: number, value: string): string[] {
	const copy = [...lines]
	copy[index] = value
	return copy
}

test("窗口：两边改不同位置 → 两个独立窗口，都不需要模型", () => {
	const local = replaceAt(LINES, 2, "L3")
	const theirs = replaceAt(LINES, 7, "T8")
	const windows = planMergeWindows(LINES, local, theirs)
	assert.equal(windows.length, 2)
	assert.equal(windows[0].kind, "local")
	assert.deepEqual(windows[0].base, ["3"])
	assert.deepEqual(windows[0].local, ["L3"])
	assert.equal(windows[1].kind, "theirs")
	assert.deepEqual(windows[1].theirs, ["T8"])
})

test("窗口：两边改同一行 → 一个 conflict 窗口", () => {
	const windows = planMergeWindows(LINES, replaceAt(LINES, 2, "L3"), replaceAt(LINES, 2, "T3"))
	assert.equal(windows.length, 1)
	assert.equal(windows[0].kind, "conflict")
	assert.deepEqual(windows[0].base, ["3"])
	assert.deepEqual(windows[0].local, ["L3"])
	assert.deepEqual(windows[0].theirs, ["T3"])
})

test("窗口：同一点各插一行 → conflict，窗口不含 base 行", () => {
	const local = ["1", "2", "L", "3", "4", "5", "6", "7", "8", "9", "10"]
	const theirs = ["1", "2", "T", "3", "4", "5", "6", "7", "8", "9", "10"]
	const windows = planMergeWindows(LINES, local, theirs)
	assert.equal(windows.length, 1)
	assert.equal(windows[0].kind, "conflict")
	assert.deepEqual(windows[0].base, [])
	assert.deepEqual(windows[0].local, ["L"])
	assert.deepEqual(windows[0].theirs, ["T"])
})

test("窗口：把两行换成两行，窗口文本不能漏掉插入的行", () => {
	const base = ["a", "b", "c", "d"]
	const local = ["a", "X", "Y", "d"]
	const theirs = ["a", "b", "c", "Z"]
	const windows = planMergeWindows(base, local, theirs)
	assert.equal(windows.length, 2)
	assert.equal(windows[0].kind, "local")
	assert.deepEqual(windows[0].local, ["X", "Y"])
	assert.equal(windows[1].kind, "theirs")
	assert.deepEqual(windows[1].theirs, ["Z"])
})

test("窗口：一方改动更宽时，窄的一方也要给出完整窗口文本", () => {
	const base = ["a", "b", "c", "d", "e"]
	const local = ["a", "B", "C", "d", "e"]
	const theirs = ["a", "b", "X", "d", "e"]
	const windows = planMergeWindows(base, local, theirs)
	assert.equal(windows.length, 1)
	assert.equal(windows[0].kind, "conflict")
	assert.deepEqual(windows[0].base, ["b", "c"])
	assert.deepEqual(windows[0].local, ["B", "C"])
	assert.deepEqual(windows[0].theirs, ["b", "X"])
})

test("窗口：相邻但不相交的改动不合并成冲突", () => {
	const base = ["a", "b", "c", "d", "e"]
	const local = ["a", "B", "c", "d", "e"]
	const theirs = ["a", "b", "C", "D", "e"]
	const windows = planMergeWindows(base, local, theirs)
	assert.equal(windows.length, 2)
	assert.equal(windows[0].kind, "local")
	assert.equal(windows[1].kind, "theirs")
})

// ── 六、编排 ────────────────────────────────────────────────────────────────

const ERB_BASE = ["@FOO", "IF A", "\tPRINTL 1", "ENDIF", "RETURN"].join("\n")

test("编排：没有冲突时一次都不调模型", async () => {
	const local = ERB_BASE.replace("PRINTL 1", "PRINTL 本地改的")
	const theirs = [...ERB_BASE.split("\n"), "@BAR", "RETURN"].join("\n")
	let called = 0
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local,
		theirs,
		ask: async () => {
			called++
			throw new Error("不该调用模型")
		},
	})
	assert.equal(called, 0)
	assert.equal(result.ok, true)
	assert.equal(result.usedModel, false)
	assert.equal(result.conflicts, 0)
	assert.ok(result.text.includes("PRINTL 本地改的"))
	assert.ok(result.text.includes("@BAR"))
})

test("编排：冲突窗口交给模型，结果被采用", async () => {
	const local = ERB_BASE.replace("PRINTL 1", "PRINTL 本地改的")
	const theirs = ERB_BASE.replace("PRINTL 1", "PRINTL 上游改的")
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local,
		theirs,
		ask: async () => "PRINTL 合并后的",
	})
	assert.equal(result.ok, true)
	assert.equal(result.usedModel, true)
	assert.equal(result.conflicts, 1)
	assert.ok(result.text.includes("PRINTL 合并后的"))
	assert.ok(result.text.includes("@FOO"))
})

test("编排：模型带 Markdown 围栏也能自动剥掉", async () => {
	const local = ERB_BASE.replace("PRINTL 1", "PRINTL 本地")
	const theirs = ERB_BASE.replace("PRINTL 1", "PRINTL 上游")
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local,
		theirs,
		ask: async () => "```erb\nPRINTL 合并\n```",
	})
	assert.equal(result.ok, true)
	assert.ok(result.text.includes("PRINTL 合并"))
	assert.ok(!result.text.includes("```"))
})

test("编排：模型第一次跑偏会带着原因重试，第二次正确即通过", async () => {
	const local = ERB_BASE.replace("PRINTL 1", "PRINTL 本地")
	const theirs = ERB_BASE.replace("PRINTL 1", "PRINTL 上游")
	const seen: string[] = []
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local,
		theirs,
		ask: async ({ user }) => {
			seen.push(user)
			// 第一次故意造出一个不存在的调用，第二次给正确答案
			return seen.length === 1 ? "CALL 不存在" : "PRINTL 合并"
		},
	})
	assert.equal(seen.length, 2)
	assert.ok(seen[1].includes("没有通过程序校验"))
	assert.equal(result.ok, true)
	assert.ok(result.text.includes("PRINTL 合并"))
})

test("编排：模型两次都失败 → ok=false，且不产生可写盘的结论", async () => {
	const local = ERB_BASE.replace("PRINTL 1", "PRINTL 本地")
	const theirs = ERB_BASE.replace("PRINTL 1", "PRINTL 上游")
	let called = 0
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local,
		theirs,
		ask: async () => {
			called++
			return "CALL 不存在"
		},
	})
	assert.equal(called, 2)
	assert.equal(result.ok, false)
	assert.ok(result.issues.some((i) => i.code === "model-failed"))
})

test("编排：模型抛错不会让整件事崩掉", async () => {
	const local = ERB_BASE.replace("PRINTL 1", "PRINTL 本地")
	const theirs = ERB_BASE.replace("PRINTL 1", "PRINTL 上游")
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local,
		theirs,
		ask: async () => {
			throw new Error("网络断了")
		},
	})
	assert.equal(result.ok, false)
	assert.ok(result.issues.some((i) => i.code === "model-failed" && i.detail.includes("网络断了")))
})

test("编排：窗口过大直接放弃，不浪费一次模型调用", async () => {
	const lines = Array.from({ length: MAX_WINDOW_LINES + 10 }, (_, i) => `PRINTL ${i}`)
	const base = lines.join("\n")
	const local = lines.map((l) => `${l} ;本地`).join("\n")
	const theirs = lines.map((l) => `${l} ;上游`).join("\n")
	let called = 0
	const result = await runMerge({
		path: "ERB/big.ERB",
		base,
		local,
		theirs,
		ask: async () => {
			called++
			return ""
		},
	})
	assert.equal(called, 0)
	assert.equal(result.ok, false)
	assert.ok(result.issues.some((i) => i.code === "window-too-large"))
})

test("编排：端到端保留 BOM 与 CRLF", async () => {
	const src = Buffer.concat([
		Buffer.from([0xef, 0xbb, 0xbf]),
		Buffer.from("@FOO\r\nIF A\r\n\tPRINTL 1\r\nENDIF\r\nRETURN\r\n", "utf8"),
	])
	const decoded = decodeText(src)
	assert.ok(decoded)
	const local = decoded.text.replace("PRINTL 1", "PRINTL 本地台词")
	const theirs = decoded.text.replace("RETURN", "@BAR\r\nRETURN".replace("\r\n", "\n"))
	const result = await runMerge({ path: "ERB/t.ERB", base: decoded.text, local, theirs, ask: async () => "" })
	assert.equal(result.ok, true)
	const written = encodeText(result.text, decoded.encoding)
	assert.equal(written[0], 0xef)
	assert.ok(written.toString("utf8").includes("\r\n"))
	const again = decodeText(written)
	assert.ok(again)
	assert.ok(again.text.includes("PRINTL 本地台词"))
	assert.ok(again.text.includes("@BAR"))
})

test("编排：本地与上游改成了同一内容时直接返回，不问模型", async () => {
	const same = ERB_BASE.replace("PRINTL 1", "PRINTL 一样的改动")
	let called = 0
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local: same,
		theirs: same,
		ask: async () => {
			called++
			return ""
		},
	})
	assert.equal(called, 0)
	assert.equal(result.ok, true)
	assert.equal(result.text, same)
})

test("编排：本地没动过时直接用上游版本", async () => {
	let called = 0
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local: ERB_BASE,
		theirs: `${ERB_BASE}\n@BAR`,
		ask: async () => {
			called++
			return ""
		},
	})
	assert.equal(called, 0)
	assert.equal(result.text, `${ERB_BASE}\n@BAR`)
})

test("编排：上游没动过时直接保留本地版本", async () => {
	let called = 0
	const local = ERB_BASE.replace("PRINTL 1", "PRINTL 本地")
	const result = await runMerge({
		path: "ERB/t.ERB",
		base: ERB_BASE,
		local,
		theirs: ERB_BASE,
		ask: async () => {
			called++
			return ""
		},
	})
	assert.equal(called, 0)
	assert.equal(result.text, local)
})

test("提示词：带上文件路径与三方分隔标记", () => {
	const prompt = buildMergePrompt({
		path: "ERB/口上/053/てゐ.ERB",
		base: ["A"],
		local: ["L"],
		theirs: ["T"],
	})
	assert.ok(prompt.user.includes("ERB/口上/053/てゐ.ERB"))
	assert.ok(prompt.user.includes("<<<BASE>>>"))
	assert.ok(prompt.user.includes("<<<LOCAL>>>"))
	assert.ok(prompt.user.includes("<<<THEIRS>>>"))
	assert.ok(prompt.system.includes("ERB 没有 #END"))
})

test("提示词：base 为空时明确告知模型这是新增文件", () => {
	const prompt = buildMergePrompt({ path: "ERB/new.ERB", base: null, local: ["L"], theirs: ["T"] })
	assert.ok(prompt.user.includes("社区版以前没有这个文件"))
})

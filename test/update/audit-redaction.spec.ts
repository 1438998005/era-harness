/**
 * 审计日志的脱敏与形状（工作流 B1）。
 *
 * 纪律：日志要能被用户**直接发给陌生人**。所以这里测的不是"好看"，
 * 而是"绝不可能带出正文/密钥"，以及一条记录必须能安全地压成一行 JSONL。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	AUDIT_MAX_TEXT_CHARS,
	auditFileName,
	buildDiagnosticsHeader,
	cleanAuditText,
	diagnosticsFileName,
	parseAuditFileDate,
	sanitizeAuditEntry,
	scrubSecrets,
	serializeAuditEntry,
} from "../../src/core/logging/audit-log-format"

test("只保留白名单字段：未知键（含正文/参数）一律丢弃", () => {
	const dirty = {
		event: "tool" as const,
		tool: "read_file",
		target: "ERB/A.ERB",
		// 下面这些是"被误传的真实对话内容"，必须一个都不能落盘
		block: { params: { path: "ERB/A.ERB", content: "【角色台词】" } },
		text: "【角色台词】不该出现",
		apiKey: "sk-abcdef0123456789abcdef",
	} as unknown as Parameters<typeof serializeAuditEntry>[0]

	const line = serializeAuditEntry(dirty, 1_700_000_000_000)
	assert.ok(line, "合法 entry 必须能序列化")

	const parsed = JSON.parse(line as string)
	assert.equal(parsed.event, "tool")
	assert.equal(parsed.tool, "read_file")
	assert.equal(parsed.target, "ERB/A.ERB")
	for (const forbidden of ["block", "text", "apiKey"]) {
		assert.equal(forbidden in parsed, false, `${forbidden} 不该被写入`)
	}
	assert.equal((line as string).includes("角色台词"), false)
	assert.equal((line as string).includes("sk-"), false)
})

test("缺 event 或 event 非法时拒绝写入", () => {
	assert.equal(serializeAuditEntry({ event: "nope" as never }), null)
	assert.equal(serializeAuditEntry(undefined as never), null)
})

test("scrubSecrets 擦除常见密钥形态", () => {
	const cases = [
		"sk-abcdef0123456789abcdef",
		"Authorization: Bearer abcdefghijklmnop1234",
		"api_key=superSecretValue1234",
		"access_token: zzzzyyyyxxxx1222",
		"token ghp_abcdefghijklmnopqrstuvwxyz0123",
		"0123456789abcdef0123456789abcdef",
	]

	for (const raw of cases) {
		const scrubbed = scrubSecrets(raw)
		assert.equal(scrubbed.includes("abcdef0123456789abcdef"), false, `未擦除: ${raw}`)
	}
	assert.match(scrubSecrets("api_key=superSecretValue1234"), /\[redacted\]/)
})

test("字符串截断到上限并压成单行", () => {
	// 注意：纯字母/数字长串会被当成 base64 密钥整段擦除，所以用中文构造「长文本」
	const long = `${"路径/片段 ".repeat(80)}\n第二行`
	const cleaned = cleanAuditText(long)

	assert.ok(cleaned)
	assert.equal(cleaned?.endsWith("…"), true)
	assert.equal(cleaned?.includes("\n"), false)
	assert.ok((cleaned as string).length <= AUDIT_MAX_TEXT_CHARS + 1)
})

test("空串与非字符串不写入", () => {
	assert.equal(cleanAuditText("   "), undefined)
	assert.equal(cleanAuditText(123 as unknown as string), undefined)
	assert.equal(cleanAuditText(undefined), undefined)
})

test("range 只接受两个有限数字", () => {
	const withValid = sanitizeAuditEntry({ event: "tool", range: [1, 100] }, 1)
	assert.deepEqual(withValid?.range, [1, 100])

	const withBad = sanitizeAuditEntry({ event: "tool", range: [Number.NaN, 3] as unknown as [number, number] }, 1)
	assert.equal("range" in (withBad ?? {}), false)

	const withShort = sanitizeAuditEntry({ event: "tool", range: [1] as unknown as [number, number] }, 1)
	assert.equal("range" in (withShort ?? {}), false)
})

test("耗时取整且不为负", () => {
	const parsed = sanitizeAuditEntry({ event: "tool", ms: -12.6, turn: 3 }, 1)
	assert.equal(parsed?.ms, 0)
	assert.equal(parsed?.turn, 3)
})

test("审计文件名按天且可解析回日期", () => {
	const day = new Date(2026, 9, 22, 15, 30, 0)

	assert.equal(auditFileName(day), "audit-2026-10-22.jsonl")
	assert.equal(auditFileName(day, 2), "audit-2026-10-22-2.jsonl")

	const parsed = parseAuditFileDate("audit-2026-10-22-3.jsonl")
	assert.ok(parsed)
	assert.equal(parsed?.getFullYear(), 2026)
	assert.equal(parsed?.getMonth(), 9)
	assert.equal(parsed?.getDate(), 22)

	assert.equal(parseAuditFileDate("diagnostics-20261022-153000.txt"), undefined)
	assert.equal(parseAuditFileDate("audit-xxx.jsonl"), undefined)
})

test("诊断包文件名带年月日时分秒", () => {
	const name = diagnosticsFileName(new Date(2026, 0, 5, 7, 8, 9))
	assert.equal(name, "diagnostics-20260105-070809.txt")
})

test("诊断包头部：含版本与设置摘要，但不含密钥值", () => {
	const header = buildDiagnosticsHeader({
		extensionVersion: "3.91.0",
		platform: "win32 10.0.26100",
		vscodeVersion: "1.104.0",
		generatedAt: new Date(2026, 9, 22, 12, 0, 0),
		settings: {
			provider: "deepseek",
			model: "deepseek-chat",
			"deepSeekApiKey(是否有值)": "已设置",
			// 有人把密钥塞进了 baseUrl 或别的字段也必须被擦
			openAiBaseUrl: "https://example.com/?key=sk-abcdef0123456789abcdef",
		},
	})

	assert.match(header, /era harness 诊断包/)
	assert.match(header, /插件版本: 3\.91\.0/)
	assert.match(header, /provider: deepseek/)
	assert.match(header, /deepSeekApiKey\(是否有值\): 已设置/)
	assert.equal(header.includes("sk-abcdef"), false, "密钥值必须被擦除")
})

test("诊断包头部：空设置时不输出摘要段", () => {
	const header = buildDiagnosticsHeader({ extensionVersion: "3.91.0" })
	assert.equal(header.includes("设置摘要"), false)
})

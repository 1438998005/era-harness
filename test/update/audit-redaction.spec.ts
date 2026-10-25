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
	auditFileChunkIndex,
	auditFileName,
	buildDiagnosticsHeader,
	cleanAuditMessage,
	cleanAuditText,
	collectRecentLines,
	compareAuditFilesDesc,
	diagnosticsFileName,
	foldUpdateEventsForExport,
	parseAuditFileDate,
	sanitizeAuditEntry,
	scrubSecrets,
	serializeAuditEntry,
} from "../../src/core/logging/audit-log-format"
import { buildToolParamSnapshot, findDialectResidueParam } from "../../src/core/task/dialect-guard"
import {
	extractToolErrorMessage,
	isToolDenied,
	outcomeFromToolResponse,
	TOOL_DENIED_TEXT,
} from "../../src/core/task/tool-outcome"

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

test("审计 message 剥离正文块：diffError / SEARCH 原文 / initial_task 都不能落盘", () => {
	const body = "【角色台词】这是绝对不能被带出去的正文"
	const toolError =
		"The tool execution failed with the following error:\n<error>\n" +
		`The SEARCH block:\n${body}\n...does not match anything in the file.\n\n` +
		`<file_content path="ERB/A.ERB">\n${body}\n</file_content>\n</error>`

	const outcome = outcomeFromToolResponse(toolError)
	assert.equal(outcome.outcome, "error")

	const line = serializeAuditEntry({ event: "tool", tool: "replace_in_file", message: outcome.message }, 1)
	assert.ok(line)
	assert.equal((line as string).includes("角色台词"), false, "正文不能进审计")
	assert.equal((line as string).includes("file_content"), false, "标签本身也不该留下")
	assert.equal(JSON.parse(line as string).message, "The SEARCH block does not match the file content.")

	// 没有闭合标签（错误文本被截断）时整段丢弃
	assert.equal(cleanAuditMessage('<file_content path="ERB/A.ERB">未闭合的正文'), "[omitted]")
	assert.equal(cleanAuditMessage("Before completing\n<initial_task>\n秘密任务\n</initial_task>")?.includes("秘密任务"), false)

	// message 上限 80 字，且压成单行
	const cleaned = cleanAuditMessage(`EACCES: ${"长".repeat(200)}\n第二行`)
	assert.ok(cleaned)
	assert.ok((cleaned as string).length <= 81)
	assert.equal((cleaned as string).includes("\n"), false)
})

/**
 * `diff.ts` 有 4 处 throw、**3 种结尾**（375/707 同文案、399 malformatted、715 incorrect content），
 * 全都把模型给的 SEARCH 块（就是文件内容）拼进 message。只认其中一种结尾，
 * 另外两种就会把最多 80 字的正文送进「可以直接发给陌生人」的诊断包。
 *
 * 所以判据必须钉在**头部** `The SEARCH block:` 上，而不是枚举结尾。
 * 结尾表里刻意放一个**目前不存在**的第 4 种：将来新增 throw 时不会有人回来补正则，
 * 钉头部的写法必须天然覆盖它。
 */
test("SEARCH 不匹配的四种结尾都要归一：正文一个字都不能留在 message 里", () => {
	const body = "【角色台词】这是绝对不能被带出去的正文"
	const endings = [
		"...does not match anything in the file.", // diff.ts:375 / :707
		"...is malformatted.", // diff.ts:399
		"...matched an incorrect content in the file.", // diff.ts:715
		"...failed the pre-write sanity check.", // 目前不存在：锁「钉头部」而不是「枚举结尾」
	]

	for (const ending of endings) {
		const cleaned = cleanAuditMessage(`The SEARCH block:\n${body}\n${ending}`)
		assert.equal(cleaned, "The SEARCH block does not match the file content.", `${ending} 必须归一`)
		assert.equal(cleaned?.includes("角色台词"), false, `${ending} 不能漏正文`)
	}

	// ToolExecutor.handleError 拼的是 `Error executing <tool>: `（两段），同样要认
	assert.equal(
		cleanAuditMessage(`Error executing replace_in_file: The SEARCH block:\n${body}\n...is malformatted.`),
		"The SEARCH block does not match the file content.",
	)
	// 前缀段数不是判据：单段写法（旧版生产形状）也不能把正文漏出去
	assert.equal(
		cleanAuditMessage(`Error replace_in_file: The SEARCH block:\n${body}\n...is malformatted.`),
		"The SEARCH block does not match the file content.",
		"前缀剥不干净就等于正文泄漏，所以不枚举段数",
	)

	// 完整链路（toolError → outcome → JSONL）也要干净
	const toolError =
		"The tool execution failed with the following error:\n<error>\n" +
		`The SEARCH block:\n${body}\n...matched an incorrect content in the file.\n</error>`
	const outcome = outcomeFromToolResponse(toolError)
	assert.equal(outcome.outcome, "error")
	const line = serializeAuditEntry({ event: "tool", tool: "replace_in_file", message: outcome.message }, 1)
	assert.ok(line)
	assert.equal((line as string).includes("角色台词"), false, "第三种结尾同样不能漏正文")
})

/**
 * MCP 的 `isError` 文本是服务端返回的**任意**内容（可能是整段 JSON 或文件正文），
 * 只截 80 字挡不住：前 80 字就是正文。审计只能留「哪一类失败」，不能留失败内容。
 */
test("MCP 自由文本错误只留结构化头：正文与密钥都不落盘", () => {
	const payload = `{"api_key":"sk-live-0123456789abcdef","rows":[${'"角色台词",'.repeat(80)}]}`
	const toolError =
		"The tool execution failed with the following error:\n<error>\n" +
		`MCP tool returned an error (fs/read_file): ${payload}\n</error>`

	const outcome = outcomeFromToolResponse(toolError)
	assert.equal(outcome.outcome, "error")

	const line = serializeAuditEntry({ event: "tool", tool: "use_mcp_tool", message: outcome.message }, 1)
	assert.ok(line)
	assert.equal(JSON.parse(line as string).message, "MCP tool returned an error (fs/read_file)")
	assert.equal((line as string).includes("角色台词"), false, "MCP 返回正文不能进审计")
	assert.equal((line as string).includes("sk-"), false, "密钥不能进审计")
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

test("审计文件降序：先日期后分片号，不靠字典序", () => {
	// 字典序会把 `-2.jsonl` 排在 `-.jsonl` 前面（'-' < '.'），导出时就会取到最旧的一段
	const files = ["audit-2026-10-21.jsonl", "audit-2026-10-22.jsonl", "audit-2026-10-22-2.jsonl", "audit-2026-10-22-10.jsonl"]

	const sorted = [...files].sort(compareAuditFilesDesc)

	assert.deepEqual(sorted, [
		"audit-2026-10-22-10.jsonl",
		"audit-2026-10-22-2.jsonl",
		"audit-2026-10-22.jsonl",
		"audit-2026-10-21.jsonl",
	])

	assert.equal(auditFileChunkIndex("audit-2026-10-22.jsonl"), 1)
	assert.equal(auditFileChunkIndex("audit-2026-10-22-7.jsonl"), 7)
	assert.equal(auditFileChunkIndex("diagnostics-20261022-153000.txt"), 1)
})

test("导出合并：保留最新 limit 行，且输出为旧→新", () => {
	// 入参是「从新到旧」的文件内容（readRecentAuditLines 的读取顺序）
	const newest = ["n1", "n2", "n3"].join("\n")
	const older = ["o1", "o2", "o3"].join("\n")

	// 最新 4 行 = o3, n1, n2, n3
	assert.deepEqual(collectRecentLines([newest, older], 4), ["o3", "n1", "n2", "n3"])
	// 只取最新 2 行：必须来自最新的那个文件，不能是最早的
	assert.deepEqual(collectRecentLines([newest, older], 2), ["n2", "n3"])
	// 空行不算行
	assert.deepEqual(collectRecentLines(["a\n\n b\n"], 10), ["a", " b"])
	assert.deepEqual(collectRecentLines([], 10), [])
})

test("工具拒绝与失败都能落到 outcome（只认抛异常会漏掉最高频的两种）", () => {
	const resolvedError = "The tool execution failed with the following error:\n<error>\nEACCES: permission denied\n</error>"

	assert.equal(extractToolErrorMessage(resolvedError), "EACCES: permission denied")
	assert.equal(
		extractToolErrorMessage([{ type: "text", text: resolvedError }]),
		"EACCES: permission denied",
		"内容块形式的 toolError 也要能识别",
	)
	assert.equal(extractToolErrorMessage("File read successfully."), undefined)
	assert.equal(extractToolErrorMessage(undefined), undefined)
	assert.equal(
		extractToolErrorMessage("The tool execution failed with the following error:\n<error>\n\n</error>"),
		undefined,
		"空错误文本不产生空消息",
	)

	// 用户在审批里点「拒绝」：handler 正常 resolve 固定文案，不抛异常
	assert.equal(isToolDenied(TOOL_DENIED_TEXT), true)
	assert.equal(isToolDenied([{ type: "text", text: TOOL_DENIED_TEXT }]), true)
	assert.equal(isToolDenied("The user approved this operation."), false)

	// handler 会在标准文案后追加说明：WriteToFile 带「文件未更新/未创建」，ApplyPatch 带「补丁未应用」。
	// 只做全等比较会把这两个最高频的拒绝记成 ok。
	const deniedWithNote = `${TOOL_DENIED_TEXT} The file was not updated, and maintains its original contents.`
	assert.equal(isToolDenied(deniedWithNote), true, "带后缀的拒绝文案必须识别")
	assert.deepEqual(outcomeFromToolResponse(deniedWithNote), { outcome: "denied", message: TOOL_DENIED_TEXT })
	assert.equal(isToolDenied("The user denied this operation. The patch was not applied."), true)
	assert.equal(isToolDenied("The user denied this patch operation."), true, "兼容 ApplyPatch 的历史文案")
	assert.equal(isToolDenied("The user denied this operation"), false, "缺句号不能误判")

	assert.deepEqual(outcomeFromToolResponse(TOOL_DENIED_TEXT), { outcome: "denied", message: TOOL_DENIED_TEXT })
	assert.deepEqual(outcomeFromToolResponse(resolvedError), { outcome: "error", message: "EACCES: permission denied" })
	assert.deepEqual(outcomeFromToolResponse("文件读取成功"), { outcome: "ok" })
	// attempt_completion 的「完成前复核」是流程控制，不是工具失败（用普通 tool result 返回）
	assert.deepEqual(outcomeFromToolResponse("Before completing, re-verify your work against the original task requirements."), {
		outcome: "ok",
	})
	assert.deepEqual(outcomeFromToolResponse(undefined), { outcome: "ok" }, "拿不准时不误报失败")
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

// —— Stage 2（3.91.12）新增 ——

test("D1：api/parse 是合法事件类型，用量与修复字段进白名单", () => {
	const usage = sanitizeAuditEntry(
		{
			event: "api",
			action: "usage",
			taskId: "1790000000000",
			turn: 5,
			provider: "deepseek",
			model: "deepseek-flash",
			inputTokens: 84_100,
			outputTokens: 2_200,
			cacheReadTokens: 82_200,
			cost: 0.1865,
		},
		1_700_000_000_000,
	)
	assert.ok(usage)
	assert.equal(usage.event, "api")
	assert.equal(usage.inputTokens, 84_100)
	assert.equal(usage.cacheReadTokens, 82_200)
	assert.equal(usage.cost, 0.1865)

	const repair = sanitizeAuditEntry(
		{ event: "parse", action: "repair", taskId: "t", turn: 3, repairs: "dsml=3,dots=1" },
		1_700_000_000_000,
	)
	assert.ok(repair)
	assert.equal(repairsOf(repair), "dsml=3,dots=1")
})

function repairsOf(record: Record<string, unknown>): string | undefined {
	return record.repairs as string | undefined
}

test("D5：审计条目带 ISO 时间戳，且与 epoch 同源", () => {
	const parsed = JSON.parse(serializeAuditEntry({ event: "tool", tool: "read_file" }, 1_700_000_000_000)!)
	assert.equal(typeof parsed.ts, "number")
	assert.equal(parsed.iso, new Date(1_700_000_000_000).toISOString())
})

test("S4/D2：snapshot 进白名单、过密钥擦洗、cap 1000", () => {
	const dirty = "path=ERB ｜｜DSML｜｜ key=sk-abcdef0123456789abcdef " + "x".repeat(1500)
	const parsed = JSON.parse(serializeAuditEntry({ event: "tool", tool: "search_files", outcome: "error", snapshot: dirty }, 1)!)
	const snapshot = parsed.snapshot as string
	assert.ok(snapshot.length <= 1100, "snapshot 不得超过 1000+省略号")
	assert.equal(snapshot.includes("sk-abcdef"), false, "snapshot 里的密钥必须被擦")
	assert.ok(snapshot.includes("path=ERB"), "残片形状必须保留供排障")
})

test("D5：update 事件折叠——超限时保留最近 10 条、其余折成摘要、时间序恢复", () => {
	const lines: string[] = []
	// 550 条 update + 20 条 tool = 570 行，超过 500 上限
	for (let i = 0; i < 550; i++) {
		lines.push(JSON.stringify({ ts: 1_700_000_000_000 + i * 2, event: "update", action: "check", target: `v3.9${i}` }))
	}
	for (let i = 0; i < 20; i++) {
		lines.splice(
			10 + i * 27,
			0,
			JSON.stringify({ ts: 1_700_000_000_000 + i * 2 + 1, event: "tool", tool: "search_files", outcome: "error" }),
		)
	}
	const folded = foldUpdateEventsForExport(lines, 500)
	const parsed = folded.map((l) => JSON.parse(l) as { event: string; action?: string; folded?: number })
	const updateRows = parsed.filter((p) => p.event === "update" && p.action !== "folded")
	const toolRows = parsed.filter((p) => p.event === "tool")
	const summaryRows = parsed.filter((p) => p.event === "update" && p.action === "folded")
	assert.equal(updateRows.length, 10, "只保留最近 10 条 update")
	assert.equal(toolRows.length, 20, "tool 事件全保留")
	assert.equal(summaryRows.length, 1, "折叠摘要一行")
	assert.equal(summaryRows[0].folded, 540, "折叠计数正确（550 - 保留 10）")
	assert.equal(folded.length, 31, "总行数 = 20 tool + 10 update + 1 摘要")
	// 时间序：首行应是「被保留事件中最早」的一条——最早的 update 已被折叠，
	// 轮到夹在第 10 条 update 后的第一个 tool 事件（ts=...001）
	const firstTs = (JSON.parse(folded[0]) as { ts: number }).ts
	assert.equal(firstTs, 1_700_000_000_001, "时间序恢复：保留集内最早事件在最前")
})

test("D5：不超 limit 时折叠函数原样返回", () => {
	const lines = [JSON.stringify({ ts: 1, event: "update", action: "check" })]
	assert.equal(foldUpdateEventsForExport(lines, 500), lines)
})

test("S4：dialect-guard——定位类参数含 DSML/方言标签语法时拒执行并产出快照", () => {
	assert.equal(findDialectResidueParam({ path: "ERB", regex: "中文词" }), undefined, "干净参数不拦截")
	assert.equal(findDialectResidueParam({ path: "ERB</｜｜DSML｜｜ parameter>" }), "path")
	assert.equal(findDialectResidueParam({ file_pattern: '*.erb</｜DSML｜ parameter name="task_progress>' }), "file_pattern")
	assert.equal(findDialectResidueParam({ regex: "A|B</parameter>" }), "regex")
	assert.equal(findDialectResidueParam({ regex: '<parameter name="regex">' }), "regex")
	// content/diff/command 不在定位类名单：合法讨论 XML 的文件内容不受影响
	assert.equal(findDialectResidueParam({ content: '用法：<parameter name="path">x</parameter>' }), undefined)
	assert.equal(findDialectResidueParam({}), undefined)
	assert.equal(findDialectResidueParam(undefined), undefined)

	const snapshot = buildToolParamSnapshot({ path: "ERB", regex: "A".repeat(300), content: "【文件正文】" })
	assert.ok(snapshot)
	assert.ok(snapshot!.includes('path="ERB"'), "快照含短参数值")
	assert.ok(snapshot!.includes("…"), "长值被截断")
	assert.equal(snapshot!.includes("【文件正文】"), false, "content 不进快照（正文剥离纪律）")
})

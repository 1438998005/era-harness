/**
 * 审计日志的脱敏与形状（工作流 B1）。
 *
 * 纪律：日志要能被用户**直接发给陌生人**。所以这里测的不是"好看"，
 * 而是"绝不可能带出正文/密钥"，以及一条记录必须能安全地压成一行 JSONL。
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import {
	AUDIT_EXPORT_DEFAULT_WINDOW_MS,
	AUDIT_MAX_TEXT_CHARS,
	auditFileChunkIndex,
	auditFileName,
	buildDiagnosticsHeader,
	cleanAuditMessage,
	cleanAuditText,
	collectRecentLines,
	compareAuditFilesDesc,
	describeModelHealth,
	diagnosticsFileName,
	exportWindowStart,
	filterLinesWithinWindow,
	foldEventsForExport,
	MODEL_HEALTH_COMMAND_TOOL,
	parseAuditFileDate,
	parseExportMarker,
	sanitizeAuditEntry,
	scrubSecrets,
	serializeAuditEntry,
	summarizeErrorEvents,
	summarizeModelHealth,
	summarizeSilentSuspects,
} from "../../src/core/logging/audit-log-format"
import {
	buildToolParamSnapshot,
	buildUnclosedTagFailureMessage,
	findDialectResidueParam,
	findUnclosedTagResidueParam,
	GUARDED_PARAMS,
} from "../../src/core/task/dialect-guard"
import {
	type CommandExecutionMeta,
	collectCommandStderrHints,
	commandOutcomeFromMeta,
	extractToolErrorMessage,
	isToolDenied,
	outcomeFromToolResponse,
	STDERR_HINT_PATTERNS,
	TOOL_DENIED_TEXT,
	type ToolExecutionResult,
} from "../../src/core/task/tool-outcome"
import { planAuditDetail } from "../../src/core/update/describe"
import type { UpdatePlan } from "../../src/core/update/types"

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

test("#116 带固定前缀的云厂商密钥也要擦（AIza / AKIA / hf_ / glpat-）", () => {
	// 这几种长度都够不上上面那两条「长十六进制 / 长 Base64」规则：
	// AIza 共 39 字符（差 1 位不满足 {40,}）、AKIA 含非 hex 字母、hf_/glpat- 同理。
	// 而 provider 的 401 文案常回显 key 片段，诊断包又是要发给别人排障的。
	//
	// ⚠️ 下面 4 条**全部是测试夹具用的假 key / 官方文档示例，不是真实凭据**：
	//   google      —— `AIza` 前缀 + 顺序数字 + 顺序字母，确定性构造、没有随机性（真实 Google API key
	//                  是随机 base64url 串，仅前缀与长度相同）；
	//   aws         —— AWS 官方文档通用的 `AKIA…EXAMPLE` 示例 Access Key ID，EXAMPLE 后缀即占位标记；
	//   huggingface —— `hf_` + 字母表顺序串；gitlab —— `glpat-` + 顺序字符；两者真实 token 均为随机串。
	//   本文件其余 `sk-` / `ghp_` 样本同样是顺序占位串，均非真实凭据。
	// 用途仅限验证 scrubSecrets 的前缀规则覆盖；GitHub secret scanning 只按前缀形态匹配会误报，
	// 该告警属 false positive（关闭理由选 Used in tests / False positive），**无需轮换或撤销任何密钥**。
	// ⛔ 本文件禁止放入真实密钥：审计文本会被回显进诊断包，写进来就等于外发凭证。
	const cases: Array<[string, string]> = [
		["google", `Incorrect API key provided: AIzaSyD-1234567890abcdefghijklmnopqrstu`],
		["aws", `The security token included in the request is invalid: AKIAIOSFODNN7EXAMPLE`],
		["huggingface", `invalid token: hf_abcdefghijklmnopqrstuvwxyz012345`],
		["gitlab", `401 Unauthorized: glpat-abcdefghij0123456789`],
	]

	for (const [name, raw] of cases) {
		const scrubbed = scrubSecrets(raw)
		assert.match(scrubbed, /\[redacted\]/, `${name} 的密钥没有被擦除：${scrubbed}`)
	}

	// 反例：普通单词不能被误擦（避免把审计日志擦成一片星号）
	assert.equal(scrubSecrets("this is a normal log line").includes("[redacted]"), false)
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
	const folded = foldEventsForExport(lines, 500)
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
	assert.equal(foldEventsForExport(lines, 500), lines)
})

test("3.92.0：error 事件进白名单（source/errorKind）且密钥擦洗、正文剥离照常生效", () => {
	const line = serializeAuditEntry(
		{
			event: "error",
			source: "host",
			errorKind: "grpc",
			tool: "cline.UiService.runCommand",
			outcome: "error",
			message: "命令不在允许列表里：x. apiKey=sk-abcdef0123456789abcdef <file_content>【整段正文】</file_content>",
			snapshot: "Error: boom\n    at f (/c:/x/y.ts:1:1)",
		},
		1_700_000_000_000,
	)!
	const parsed = JSON.parse(line) as Record<string, unknown>
	assert.equal(parsed.event, "error")
	assert.equal(parsed.source, "host")
	assert.equal(parsed.errorKind, "grpc")
	assert.equal(parsed.tool, "cline.UiService.runCommand")
	// message 走 cleanAuditMessage：剥正文块 + 擦密钥 + 80 字截断
	const message = parsed.message as string
	assert.equal(message.includes("sk-abcdef"), false, "message 里的密钥必须被擦")
	assert.equal(message.includes("【整段正文】"), false, "message 里的正文块必须被剥")
	// 非法 source 不落盘
	const bad = JSON.parse(serializeAuditEntry({ event: "error", source: "hacker" as never }, 1)!) as Record<string, unknown>
	assert.equal(bad.source, undefined)
})

test("3.92.0：error 事件折叠——保留最近 50 条、更早折成摘要，与 update 折叠互不干扰", () => {
	const lines: string[] = []
	for (let i = 0; i < 80; i++) {
		lines.push(JSON.stringify({ ts: 1_700_000_000_000 + i, event: "error", errorKind: "grpc" }))
	}
	for (let i = 0; i < 480; i++) {
		lines.push(JSON.stringify({ ts: 1_700_000_100_000 + i, event: "tool", tool: "read_file" }))
	}
	for (let i = 0; i < 3; i++) {
		lines.push(JSON.stringify({ ts: 1_700_000_200_000 + i, event: "update", action: "check" }))
	}
	const folded = foldEventsForExport(lines, 500)
	const parsed = folded.map((l) => JSON.parse(l) as { event: string; action?: string; folded?: number })
	const errorRows = parsed.filter((p) => p.event === "error" && p.action !== "folded")
	const errorSummary = parsed.filter((p) => p.event === "error" && p.action === "folded")
	const toolRows = parsed.filter((p) => p.event === "tool")
	const updateRows = parsed.filter((p) => p.event === "update")
	// 折叠先保留最近 50 条 error；随后 limit 切片按时间序再丢掉最老的 33 条（全是 error）
	// → 非折叠 error 行只剩 17 条。摘要是「至少丢了多少」的底标，与 D5 的既有交互一致。
	assert.equal(errorRows.length, 17)
	assert.equal(errorSummary.length, 1, "折叠摘要一行")
	assert.equal(errorSummary[0].folded, 30, "error 折叠计数 = 80 - 50")
	assert.equal(toolRows.length, 480, "tool 全保留（error 是更旧的事件，被切掉的是 error）")
	assert.equal(updateRows.length, 3, "少量 update 不折叠")
	// 533 kept（480 tool + 50 error + 3 update）→ slice(-500) → 500 行 + 1 条摘要
	assert.equal(folded.length, 501)
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

// —— #63（2026-10-29）：诊断包「全局错误」不可见 ——
// 用户抱怨「还是老样子、诊断不了全局错误」：功能在，但包里没有汇总，
// 拿到包的人无法一眼确认错误到底有没有被记到。下面锁住三件事：
// ① 统计口径是**包内**（头部数字必须能在正文里数出来）；
// ② 0 条也要有这一行（否则「没错误」和「没做」长得一样）；
// ③ 折叠摘要行（action:"folded"）不重复计入。

function errorLine(fields: Record<string, unknown>): string {
	return JSON.stringify({ ts: 1_700_000_000_000, iso: "2023-11-14T22:13:20.000Z", event: "error", outcome: "error", ...fields })
}

test("#63 错误小计：按来源与种类分别计数，0 条也返回 0", () => {
	const stats = summarizeErrorEvents([
		errorLine({ source: "host", errorKind: "grpc", message: "boom" }),
		errorLine({ source: "host", errorKind: "grpc", message: "boom2" }),
		errorLine({ source: "webview", errorKind: "react-error-boundary", message: "render" }),
		JSON.stringify({ event: "tool", tool: "read_file" }),
	])
	assert.equal(stats.total, 3)
	assert.deepEqual(stats.bySource, [
		{ source: "host", count: 2 },
		{ source: "webview", count: 1 },
	])
	assert.deepEqual(stats.byKind, [
		{ source: "host", kind: "grpc", count: 2 },
		{ source: "webview", kind: "react-error-boundary", count: 1 },
	])

	const empty = summarizeErrorEvents([JSON.stringify({ event: "tool", tool: "read_file" })])
	assert.equal(empty.total, 0)
	assert.deepEqual(empty.bySource, [])
})

test("#63 折叠摘要行不重复计入（它自己也带 event:error）", () => {
	const folded = JSON.stringify({ event: "error", action: "folded", folded: 12, note: "另有 12 条更早的 error 事件已折叠" })
	const stats = summarizeErrorEvents([errorLine({ source: "host", errorKind: "uncaughtException" }), folded])
	assert.equal(stats.total, 1, "摘要行不是一条真实错误")
})

test("#63 半行/非法 JSON 不能让导出失败（跳过即可）", () => {
	const stats = summarizeErrorEvents(["not json", "{}", "", errorLine({ source: "host", errorKind: "grpc" })])
	assert.equal(stats.total, 1)
})

test("#63 头部：0 条也明写 0，并给出「怎么验证」的判据", () => {
	const header = buildDiagnosticsHeader({
		extensionVersion: "3.92.2",
		errorStats: summarizeErrorEvents([JSON.stringify({ event: "tool", tool: "read_file" })]),
	})
	assert.match(header, /运行时错误: 0 条/)
	// 关键：不能因为 0 条就整行消失，否则用户无法区分「没错误」与「功能没做」
	assert.match(header, /若刚触发过失败操作仍为 0/)
})

test("#63 头部：有错误时给出总数 + 分来源小计 + 逐类明细（含人话与原始 kind）", () => {
	const lines = [
		errorLine({ source: "host", errorKind: "grpc" }),
		errorLine({ source: "host", errorKind: "grpc" }),
		errorLine({ source: "webview", errorKind: "react-error-boundary" }),
	]
	const header = buildDiagnosticsHeader({ extensionVersion: "3.92.2", errorStats: summarizeErrorEvents(lines) })
	assert.match(header, /运行时错误: 3 条（宿主 2 \/ 界面 1）/)
	assert.match(header, /宿主 · 界面调用宿主失败\(grpc\): 2/)
	assert.match(header, /界面 · 界面渲染崩溃\(react-error-boundary\): 1/)
})

test("#63 头部：不传 errorStats 时整段不出现（老调用方零改动）", () => {
	const header = buildDiagnosticsHeader({ extensionVersion: "3.92.2" })
	assert.equal(header.includes("运行时错误"), false)
})

test("#63 统计口径是包内：头部数字必须能在正文里数出来", () => {
	// 600 条 error 超过 500 行窗口 → 折叠后只留 50 条 + 1 行摘要
	const many = Array.from({ length: 600 }, (_, i) => errorLine({ source: "host", errorKind: "grpc", message: `e${i}` }))
	const exported = foldEventsForExport(many, 500)
	const stats = summarizeErrorEvents(exported)
	const bodyErrorRows = exported.filter((line) => JSON.parse(line).event === "error" && JSON.parse(line).action !== "folded")
	assert.equal(stats.total, bodyErrorRows.length, "头部条数与正文可数的行数必须一致")
	assert.equal(stats.total, 50, "保留最近 50 条（EXPORT_ERROR_KEEP）")
	assert.ok(
		exported.some((line) => JSON.parse(line).action === "folded"),
		"折叠摘要行仍在包里说明折叠了多少",
	)
})

/**
 * #95（2026-10-31）：子代理的费用行必须能落盘。
 *
 * 事故现场：主任务审计只记了 ¥0.09，真正花掉的 ¥102.43 全在子代理里看不见——
 * 诊断包发给谁都查不出钱花在哪。所以 `AuditEntry` 新增了 `source:"subagent"` 与
 * `subagentIndex`；两者都要同时进白名单，否则会被 sanitize 静默丢掉（比不写更难查）。
 */
test("#95 子代理费用行：source=subagent 与 subagentIndex 能落盘", () => {
	const line = serializeAuditEntry(
		{
			event: "api",
			action: "usage",
			tool: "use_subagents",
			taskId: "1793429640849",
			turn: 6,
			provider: "bigmodel",
			model: "glm-5.3-flash",
			inputTokens: 293_000,
			outputTokens: 93_924,
			cacheReadTokens: 90_000,
			cacheWriteTokens: 1_200,
			cost: 96.86300448,
			source: "subagent",
			subagentIndex: 2,
			message: "failed",
		},
		1_700_000_000_000,
	)!
	const parsed = JSON.parse(line) as Record<string, unknown>

	assert.equal(parsed.event, "api")
	assert.equal(parsed.source, "subagent", "source 必须是三值之一，否则会被丢弃")
	assert.equal(parsed.subagentIndex, 2)
	assert.equal(parsed.tool, "use_subagents")
	assert.equal(parsed.cost, 96.86300448)
	assert.equal(parsed.message, "failed")
})

test("#95 子代理字段的边界：非法 source 丢弃、subagentIndex 取整且不为负", () => {
	const badSource = JSON.parse(serializeAuditEntry({ event: "api", source: "robot" as never }, 1)!) as Record<string, unknown>
	assert.equal(badSource.source, undefined, "未知 source 不能落盘")

	const badIndex = JSON.parse(
		serializeAuditEntry({ event: "api", source: "subagent", subagentIndex: Number.NaN }, 1)!,
	) as Record<string, unknown>
	assert.equal("subagentIndex" in badIndex, false, "NaN 不能当索引写进去")

	const rounded = JSON.parse(serializeAuditEntry({ event: "api", source: "subagent", subagentIndex: 3.7 }, 1)!) as Record<
		string,
		unknown
	>
	assert.equal(rounded.subagentIndex, 4, "索引取整（与 cleanNumber 同口径）")
})

test("#95 子代理审计同样不能把正文带出去", () => {
	// 子代理的 prompt/工具结果都是整段正文：这里的纪律与主循环一致——
	// 只剥「已知的结构化正文块」，自由文本靠 80 字截断 + 脱敏。
	const line = serializeAuditEntry(
		{
			event: "api",
			tool: "use_subagents",
			source: "subagent",
			subagentIndex: 1,
			message: '子代理输出：<file_content path="ERB/A.ERB">【角色台词】</file_content>',
		},
		1,
	)!
	assert.equal(line.includes("角色台词"), false, "file_content 正文块必须被剥掉")
})

// —— #184（2026-11-03）：诊断包导出窗口（不再每次从留存期起点累加） ——

test("#184 导出水位：last-export.json 内容解析，损坏返回 undefined", () => {
	const ok = parseExportMarker(JSON.stringify({ iso: "2026-11-03T11:46:12.275Z" }))
	assert.equal(ok?.getTime(), Date.parse("2026-11-03T11:46:12.275Z"))
	assert.equal(parseExportMarker("not json"), undefined)
	assert.equal(parseExportMarker("{}"), undefined)
	assert.equal(parseExportMarker(JSON.stringify({ iso: "abc" })), undefined)
})

test("#184 窗口起点：有水位跟水位，没有走默认 24h；未来水位视为损坏", () => {
	const now = new Date("2026-11-03T12:00:00.000Z")
	const marker = new Date("2026-11-01T08:00:00.000Z")

	const withMarker = exportWindowStart(marker, now)
	assert.equal(withMarker.sinceMs, marker.getTime())
	assert.equal(withMarker.source, "last-export")

	const fallback = exportWindowStart(undefined, now)
	assert.equal(fallback.sinceMs, now.getTime() - AUDIT_EXPORT_DEFAULT_WINDOW_MS)
	assert.equal(fallback.source, "default")

	// 时钟回拨：水位在未来 = 损坏，走默认窗口而不是给出一个空包
	const future = exportWindowStart(new Date("2026-11-04T00:00:00.000Z"), now)
	assert.equal(future.source, "default")
})

test("#184 窗口过滤：只留 ts 在窗口内的行，解析不了的行保守保留", () => {
	const lines = [
		JSON.stringify({ ts: 1000, event: "tool" }),
		JSON.stringify({ ts: 2000, event: "updateGame", action: "plan" }),
		"not json", // 半行：可能是崩溃现场，宁多勿丢
		JSON.stringify({ event: "tool" }), // 没 ts：无法判定，保守保留
	]
	const kept = filterLinesWithinWindow([lines.join("\n")], 1500)
	const all = kept.flatMap((chunk) => chunk.split("\n"))
	assert.equal(all.length, 3)
	// 「not json」行会保留但不能拿去 parse——只验证可解析行的窗口判定
	const parsed = all
		.map((l) => {
			try {
				return JSON.parse(l) as { ts?: number }
			} catch {
				return undefined
			}
		})
		.filter((p): p is { ts?: number } => p !== undefined)
	assert.equal(
		parsed.some((p) => p.ts === 1000),
		false,
		"窗口前的行必须被滤掉",
	)
	assert.equal(
		parsed.some((p) => p.ts === 2000),
		true,
		"窗口内的行必须保留",
	)
})

test("#184 头部：记录窗口明写进包（自上次导出 / 默认 24h 两种措辞），不传不输出", () => {
	const sinceIso = "2026-11-01T08:00:00.000Z"
	const fromMarker = buildDiagnosticsHeader({
		extensionVersion: "3.97.0",
		auditWindow: { sinceIso, source: "last-export" },
	})
	assert.match(fromMarker, /记录窗口: 2026-11-01T08:00:00\.000Z 起（自上次导出）\n/)

	const fromDefault = buildDiagnosticsHeader({
		extensionVersion: "3.97.0",
		auditWindow: { sinceIso, source: "default" },
	})
	assert.match(fromDefault, /记录窗口: .*起（默认最近 24 小时，未找到上次导出记录）\n/)

	// 不传不输出（老调用方零改动）
	assert.equal(buildDiagnosticsHeader({ extensionVersion: "3.97.0" }).includes("记录窗口"), false)
})

// —— #185（2026-11-03）：updateGame 事件与 detail 字段进白名单 ——

test("#185 updateGame 是合法事件类型；detail 进白名单且脱敏/截断", () => {
	const line = serializeAuditEntry(
		{
			event: "updateGame",
			action: "plan",
			target: "d:/R18/游戏/eratw-sub-modding-develop纯净版",
			outcome: "info",
			detail: "mode=first-sync; conflict=15; conflictBy=first-sync-human:15",
		},
		1_700_000_000_000,
	)!
	const parsed = JSON.parse(line) as Record<string, unknown>
	assert.equal(parsed.event, "updateGame")
	assert.equal(parsed.action, "plan")
	assert.equal(parsed.detail, "mode=first-sync; conflict=15; conflictBy=first-sync-human:15")

	// detail 里的密钥形态照样要擦
	const dirty = serializeAuditEntry({ event: "updateGame", detail: "key=sk-abcdef0123456789abcdef" }, 1)!
	assert.equal(dirty.includes("sk-abcdef"), false, "detail 里的密钥必须被擦")

	// 超长截断到 300+省略号（用中文构造长文本，避免被当成长密钥整段擦除）
	const long = serializeAuditEntry({ event: "updateGame", detail: "路径/片段 ".repeat(60) }, 1)!
	const parsedLong = JSON.parse(long) as { detail: string }
	assert.ok(parsedLong.detail.length <= 301)
})

test("#185 updateGame 事件不参与导出折叠（折叠只针对 update/error）", () => {
	const lines = Array.from({ length: 600 }, (_, i) =>
		JSON.stringify({ ts: 1_700_000_000_000 + i, event: "updateGame", action: "plan" }),
	)
	const folded = foldEventsForExport(lines, 500)
	assert.equal(folded.length, 500, "超限只按时间序截断")
	assert.equal(folded.filter((l) => l.includes('"action":"folded"')).length, 0, "不允许出现折叠摘要行")
})

test("#185 planAuditDetail：模式/计数/警告/基线/reason 分布都在一行里", () => {
	const plan: UpdatePlan = {
		mode: "first-sync",
		entries: [
			{ path: "a", action: "conflict", reason: "first-sync-human" },
			{ path: "b", action: "conflict", reason: "first-sync-human" },
			{ path: "c", action: "write", reason: "first-sync-bulk" },
			{ path: "d", action: "keep", reason: "local-only" },
		],
		groups: [],
		summary: { write: 1, delete: 0, keep: 1, conflict: 2, unchanged: 5000, keepByReason: {} },
		warnings: ["first-sync", "first-sync-unreliable"],
	}
	const detail = planAuditDetail(plan)
	assert.match(detail, /mode=first-sync/)
	assert.match(detail, /write=1/)
	assert.match(detail, /conflict=2/)
	assert.match(detail, /unchanged=5000/)
	assert.match(detail, /warnings=first-sync,first-sync-unreliable/)
	assert.match(detail, /baseline=none/)
	assert.match(detail, /conflictBy=first-sync-human:2/)
	assert.match(detail, /keepBy=local-only:1/)

	// 增量模式带基线：level 如实出现
	const incremental = planAuditDetail({
		...plan,
		mode: "incremental",
		warnings: [],
		baseline: { level: "suspect", sample: 2000, agreement: 0.5, coverage: 0.6 },
	})
	assert.match(incremental, /mode=incremental/)
	assert.match(incremental, /baseline=suspect/)
	assert.equal(incremental.includes("warnings="), false, "没有警告就不出 warnings 键")
})

// —— 08 #238：命令结果判定的单源纯函数（先加测试再实现） ——

/** 正常成功命令的 meta：exit 0、有输出、无 stderr 特征、未转储。 */
const cleanCommandMeta: CommandExecutionMeta = {
	exitCode: 0,
	signal: undefined,
	outputLength: 57,
	stderrHints: [],
	truncated: false,
}

test("#238 commandOutcomeFromMeta：四类回放 + 优先级 + 正常命令无误判", () => {
	const ok: ToolExecutionResult = { outcome: "ok" }

	// exit 255 / exit 1 → error，message 脱敏（只含退出码，绝不含命令输出正文）
	for (const code of [255, 1]) {
		const out = commandOutcomeFromMeta({ ...cleanCommandMeta, exitCode: code }, ok)
		assert.equal(out.outcome, "error")
		assert.equal(out.message, `Command failed with exit code ${code}.`)
		assert.equal("suspect" in out, false)
		assert.equal(out.message?.includes("Output"), false, "message 不得携带输出正文")
	}

	// 无 exitCode 但有 signal → error
	const sig = commandOutcomeFromMeta({ ...cleanCommandMeta, exitCode: undefined, signal: "SIGTERM" }, ok)
	assert.equal(sig.outcome, "error")
	assert.equal(sig.message, "Command terminated by signal SIGTERM.")

	// 管道 stderr（exit 0 + stderr 特征）→ 保持 ok + suspect，绝不判 error
	const stderr = commandOutcomeFromMeta({ ...cleanCommandMeta, stderrHints: ["FINDSTR:"] }, ok)
	assert.equal(stderr.outcome, "ok")
	assert.equal(stderr.suspect, true)

	// exit 0 零输出 → 保持 ok + suspect
	const empty = commandOutcomeFromMeta({ ...cleanCommandMeta, outputLength: 0 }, ok)
	assert.equal(empty.outcome, "ok")
	assert.equal(empty.suspect, true)

	// 输出被转储（未完整回传）→ 保持 ok + suspect
	const truncated = commandOutcomeFromMeta({ ...cleanCommandMeta, truncated: true }, ok)
	assert.equal(truncated.outcome, "ok")
	assert.equal(truncated.suspect, true)

	// 正常成功命令：不带 suspect（原样返回）
	assert.equal(commandOutcomeFromMeta(cleanCommandMeta, ok), ok)
	assert.equal("suspect" in commandOutcomeFromMeta(cleanCommandMeta, ok), false)
	// meta 缺失时原样返回，拿不准不误报
	assert.equal(commandOutcomeFromMeta(undefined, ok), ok)

	// denied / error / cancelled 优先级不可被覆盖（即使 exitCode 非 0 或带 stderr 特征）
	for (const base of [
		{ outcome: "denied" as const, message: "denied" },
		{ outcome: "error" as const, message: "err" },
		{ outcome: "cancelled" as const, message: "cancel" },
	]) {
		assert.equal(commandOutcomeFromMeta({ ...cleanCommandMeta, exitCode: 255 }, base), base)
		assert.equal(commandOutcomeFromMeta({ ...cleanCommandMeta, stderrHints: ["Traceback"] }, base), base)
	}
})

test("#238 stderr 特征单源：只给 suspect 提示，不泛化到任意错误词", () => {
	for (const pattern of ["FINDSTR:", "SyntaxError", "Traceback", "系统找不到指定的路径", "'head' 不是内部或外部命令"]) {
		assert.ok(STDERR_HINT_PATTERNS.includes(pattern), `缺少特征: ${pattern}`)
	}
	assert.deepEqual(collectCommandStderrHints("FINDSTR: not found\nTraceback (most recent call last):"), [
		"FINDSTR:",
		"Traceback",
	])
	assert.deepEqual(collectCommandStderrHints("all good, warnings and errors are just prose"), [])
	assert.equal(collectCommandStderrHints("").length, 0)
})

test("#238 suspect 落盘：只写真值、过白名单，正常命令不带字段", () => {
	const hit = serializeAuditEntry({ event: "tool", tool: "execute_command", outcome: "ok", suspect: true }, 1)!
	assert.equal(JSON.parse(hit).suspect, true)
	const clean = serializeAuditEntry({ event: "tool", tool: "execute_command", outcome: "ok" }, 1)!
	assert.equal("suspect" in JSON.parse(clean), false)
	// 非布尔值不落盘
	const bad = serializeAuditEntry({ event: "tool", suspect: "yes" as never }, 1)!
	assert.equal("suspect" in JSON.parse(bad), false)
})

test("#238 summarizeSilentSuspects：只数 event=tool 且 suspect=true，不与工具失败混算", () => {
	const lines = [
		JSON.stringify({ event: "tool", tool: "execute_command", outcome: "ok", suspect: true }),
		JSON.stringify({ event: "tool", tool: "execute_command", outcome: "ok" }),
		JSON.stringify({ event: "tool", tool: "execute_command", outcome: "error" }),
		JSON.stringify({ event: "tool", action: "folded", suspect: true }),
		JSON.stringify({ event: "api", suspect: true }),
		"not json",
	]
	assert.equal(summarizeSilentSuspects(lines), 1)
	assert.equal(summarizeSilentSuspects([]), 0)
})

// —— 08 #239：标签残片单源防线 ——

test("#239 findDialectResidueParam：畸形 regex 命中、合法正则不命中", () => {
	// 畸形：参数值吞进了未闭合标签的闭/开残片
	assert.equal(findDialectResidueParam({ path: ".", regex: "net</search_files>" }), "regex")
	assert.equal(findDialectResidueParam({ path: ".", regex: "net</regex>" }), "regex")
	assert.equal(findDialectResidueParam({ path: ".", regex: "<regex>net" }), "regex")
	assert.equal(findDialectResidueParam({ path: "ERB</path>", regex: "net" }), "path")
	assert.equal(findDialectResidueParam({ path: ".", file_pattern: "*.ERB</file_pattern>" }), "file_pattern")
	assert.equal(findDialectResidueParam({ path: ".", regex: "net</parameter>" }), "regex")
	// 既有 DSML / parameter 判据不能回归
	assert.equal(findDialectResidueParam({ path: "ERB</｜｜DSML｜｜ parameter>" }), "path")

	// 合法：⛔ 绝不泛化到任意 `<`
	assert.equal(findDialectResidueParam({ path: ".", regex: "\\<word\\>" }), undefined, "grep 词边界正则")
	assert.equal(findDialectResidueParam({ path: ".", regex: "<div>" }), undefined, "HTML 文本搜索")
	assert.equal(findDialectResidueParam({ path: ".", regex: "(?s)<div>.*</div>" }), undefined, "HTML 正则")
	assert.equal(findDialectResidueParam({ path: ".", regex: "foo\nbar\nbaz" }), undefined, "含换行合法正则")
	assert.equal(findDialectResidueParam({ path: ".", regex: "net|foo" }), undefined, "普通多选正则")
	// content/diff/command 正文类参数不在定位类名单：合法讨论 XML 不受影响
	assert.equal(findDialectResidueParam({ content: "用法：<path>x</path>" }), undefined)
})

test("#239 findUnclosedTagResidueParam：与 findDialectResidueParam 同源，只认标签残片", () => {
	assert.equal(findUnclosedTagResidueParam({ path: ".", regex: "net</search_files>" }), "regex")
	assert.equal(findUnclosedTagResidueParam({ path: ".", regex: "net" }), undefined)
	assert.equal(findUnclosedTagResidueParam({ path: ".", regex: "\\<word\\>" }), undefined)
	assert.equal(findUnclosedTagResidueParam(undefined), undefined)
	// DSML 残片不算「标签未闭合」，但仍是方言残片（两个函数职责分明、共用判据）
	assert.equal(findUnclosedTagResidueParam({ path: "ERB</｜｜DSML｜｜ parameter>" }), undefined)
	assert.equal(findDialectResidueParam({ path: "ERB</｜｜DSML｜｜ parameter>" }), "path")
})

test("#239 buildUnclosedTagFailureMessage：归因 + 脱敏回显 + 正确写法一步改对", () => {
	assert.equal(buildUnclosedTagFailureMessage({ path: ".", regex: "net" }), undefined)
	const msg = buildUnclosedTagFailureMessage({ path: ".", regex: "net</search_files>" })!
	assert.match(msg, /疑似工具标签未闭合/)
	assert.match(msg, /<regex>net<\/regex>/, "给一条正确写法示例")
	assert.match(msg, /regex=/, "回显脱敏后的实际参数")
	// 回显复用 buildToolParamSnapshot：content 正文整段排除
	const withBody = buildUnclosedTagFailureMessage({ path: ".", regex: "net</regex>", content: "【文件正文】" })!
	assert.equal(withBody.includes("【文件正文】"), false, "正文类参数不得进回显")
	// 实测现场形态：整段后续标签被吞进 regex，示例仍给出剥干净的第一行真实值
	const real = buildUnclosedTagFailureMessage(
		{ path: ".", regex: "净土</path>\n<file_pattern>*.erb\n</search_files>" },
		"regex",
	)!
	assert.match(real, /<regex>净土<\/regex>/, "一步改对的示例用真实值，不给占位符")
})

test("#239 结构性：GUARDED_PARAMS 覆盖 search_files 的三个定位类参数", () => {
	const names: readonly string[] = GUARDED_PARAMS
	for (const key of ["path", "regex", "file_pattern"]) {
		assert.ok(names.includes(key), `${key} 必须在 GUARDED_PARAMS 单源名单里`)
	}
})

test("#239 expectedParam：通用防线的归因必须指向被拦下的那个参数", () => {
	const params = { path: ".", regex: "net</search_files>" }
	const msg = buildUnclosedTagFailureMessage(params, "regex")!
	assert.match(msg, /'regex'/, "归因指名 regex")
	assert.match(msg, /疑似工具标签未闭合/)
	// 多参数同时污染：通用防线拦下的是 path（DSML），标签残片在 regex，
	// 此时不能把归因错记到 regex 上，应返回 undefined 让通用防线落回 #45 文案。
	const mixed = { path: "ERB</｜｜DSML｜｜ parameter>", regex: "net</search_files>" }
	assert.equal(findDialectResidueParam(mixed), "path")
	assert.equal(findUnclosedTagResidueParam(mixed), "regex")
	assert.equal(buildUnclosedTagFailureMessage(mixed, "path"), undefined)
	// 不传 expectedParam 时（handler 防御性兜底）仍按标签残片自身归因
	assert.match(buildUnclosedTagFailureMessage(mixed)!, /'regex'/)
})

test("review #239：归因文案在生成处 scrub 密钥（直推模型/UI，不过 audit 层）", () => {
	const secret = "sk-abcdefghijklmnopqrstuvwxyz0123456789"
	const msg = buildUnclosedTagFailureMessage({
		path: `/tmp/${secret}.erb`,
		regex: "net</search_files>",
		url: `https://x.test/?key=AIza${"B".repeat(35)}`,
	})!
	assert.equal(msg.includes(secret), false, "快照里的 sk- 密钥不得原样外发")
	assert.match(msg, /\[redacted\]/, "必须复用审计层同一份 scrubSecrets（单源）")
	assert.match(msg, /secrets scrubbed/, "措辞必须与实现一致")
	assert.doesNotMatch(msg, /Actual parameters \(redacted\)/, "旧的不实措辞不得回归")
	// 「正确写法示例」同样取自参数值，也必须擦
	const sampleMsg = buildUnclosedTagFailureMessage({ path: ".", regex: `${secret}</search_files>` })!
	assert.equal(sampleMsg.includes(secret), false, "示例值不得带密钥")
	assert.match(sampleMsg, /<regex>\[redacted\]<\/regex>/)
	// 结构性：脱敏发生在 dialect-guard 生成处，不能只靠调用方/audit 层兜底
	const guard = fs.readFileSync("src/core/task/dialect-guard.ts", "utf8")
	assert.match(guard, /scrubSecrets\(buildToolParamSnapshot\(params\)/)
	assert.match(guard, /scrubSecrets\(sample\)/)
})

// —— 08 #240：按模型健康度聚合（只可观测，不改路由） ——

/** 造一条真实白名单序列化后的审计行（与诊断包正文同源）。 */
function healthLine(entry: Record<string, unknown>): string {
	return serializeAuditEntry(entry as never, 1)!
}

test("#240 summarizeModelHealth：按 model 聚合工具失败 / 命令失败 / 疑似静默 / parse repair", () => {
	const bad = "nvidia/nemotron-3.5-super-vl:free"
	const good = "reflection/beam-free"
	const lines = [
		healthLine({ event: "tool", tool: "execute_command", model: bad, outcome: "error" }),
		healthLine({ event: "tool", tool: "execute_command", model: bad, outcome: "ok", suspect: true }),
		healthLine({ event: "tool", tool: "search_files", model: bad, outcome: "error" }),
		healthLine({ event: "tool", tool: "read_file", model: bad, outcome: "ok" }),
		healthLine({ event: "parse", action: "repair", model: bad }),
		healthLine({ event: "parse", action: "repair", model: bad }),
		healthLine({ event: "tool", tool: "execute_command", model: good, outcome: "ok" }),
		healthLine({ event: "tool", tool: "read_file", model: good, outcome: "ok" }),
	]
	const rows = summarizeModelHealth(lines)
	assert.equal(rows.length, 2)
	assert.equal(rows[0].model, bad, "失败多的排前面")
	assert.deepEqual(rows[0], {
		model: bad,
		toolCalls: 4,
		toolErrors: 2,
		commandCalls: 2,
		commandFailures: 2, // 一条 exit!=0 判 error，一条 suspect 静默失败
		parseRepairs: 2,
		silentSuspects: 1,
	})
	assert.deepEqual(rows[1], {
		model: good,
		toolCalls: 2,
		toolErrors: 0,
		commandCalls: 1,
		commandFailures: 0,
		parseRepairs: 0,
		silentSuspects: 0,
	})
	assert.equal(MODEL_HEALTH_COMMAND_TOOL, "execute_command", "命令工具 id 与 ClineDefaultTool.BASH 同源")
})

test("#240 口径边界：折叠摘要/半行 JSON/非 tool-parse 事件不计数，model 缺失回落 provider", () => {
	const lines = [
		healthLine({ event: "tool", tool: "read_file", model: "m1", outcome: "error" }),
		JSON.stringify({ event: "tool", tool: "read_file", model: "m1", outcome: "error", action: "folded" }),
		"not json",
		"{}",
		healthLine({ event: "api", model: "m1", outcome: "error" }),
		healthLine({ event: "parse", action: "repair", provider: "kilo" }),
		healthLine({ event: "tool", tool: "read_file", outcome: "ok" }),
	]
	const rows = summarizeModelHealth(lines)
	assert.equal(rows.find((r) => r.model === "m1")?.toolErrors, 1, "折叠/畸形/api 事件都不得计入")
	assert.equal(rows.find((r) => r.model === "kilo:(模型未标注)")?.parseRepairs, 1, "缺 model 回落 provider，不丢事件")
	assert.equal(rows.find((r) => r.model === "(未标注模型)")?.toolCalls, 1, "两者都缺也不丢事件")
	assert.equal(summarizeModelHealth([]).length, 0)
	assert.deepEqual(describeModelHealth([]), [], "0 行时整段不出现")
})

test("#240 诊断包头部：健康度表紧跟错误小计，且明确「仅可观测、不影响路由」", () => {
	const rows = summarizeModelHealth([
		healthLine({ event: "tool", tool: "execute_command", model: "m-bad", outcome: "error" }),
		healthLine({ event: "parse", action: "repair", model: "m-bad" }),
	])
	const header = buildDiagnosticsHeader({ extensionVersion: "3.101.0", modelHealth: rows })
	assert.match(header, /按模型健康度（仅可观测，不影响路由/)
	assert.match(header, /m-bad: 工具 1 次 \/ 失败 1（100\.0%）/)
	assert.match(header, /parse repair 1/)
	const without = buildDiagnosticsHeader({ extensionVersion: "3.101.0" })
	assert.equal(without.includes("按模型健康度"), false, "老调用方零改动")
})

/**
 * 操作审计日志（工作流 B）——落盘与导出。
 *
 * 目标：任何人拿到 `<globalStorage>/diagnostics/` 里的文件就能回答
 * 「模型到底调了几次 read_file、命中的是哪个文件、耗时多少、什么错误」，
 * 而不需要用户复述、也不需要开 verbose 日志。
 *
 * 边界：
 * - 只写**元数据**（工具名/路径/区间/结果/耗时/模型），不写消息正文、不写密钥；
 *   白名单在 audit-log-format.ts，本文件不做任何「原样透传」。
 * - 写盘失败只 `Logger.warn`，绝不冒泡到任务流程。
 * - 串行队列 + 每日轮转（单文件 8MB）+ 14 天保留。
 */
import fs from "node:fs/promises"
import path from "node:path"
import { HostProvider } from "@/hosts/host-provider"
import { Logger } from "@/shared/services/Logger"
import {
	AUDIT_EXPORT_LINE_LIMIT,
	AUDIT_MAX_FILE_BYTES,
	AUDIT_RETENTION_DAYS,
	type AuditEntry,
	auditFileName,
	buildDiagnosticsHeader,
	collectRecentLines,
	compareAuditFilesDesc,
	type DiagnosticsHeader,
	diagnosticsFileName,
	exportWindowStart,
	filterLinesWithinWindow,
	foldEventsForExport,
	parseAuditFileDate,
	parseExportMarker,
	serializeAuditEntry,
	summarizeErrorEvents,
	summarizeModelHealth,
	summarizeSilentSuspects,
	summarizeToolFailures,
} from "./audit-log-format"

/** `<globalStorage>/diagnostics` —— 用户只需要发这一个目录里的东西。 */
export function getDiagnosticsDir(): string {
	return path.join(HostProvider.get().globalStorageFsPath, "diagnostics")
}

/** #184：导出水位的落点文件。命名刻意不匹配 `audit-*.jsonl`，不会被当成审计文件读走/清掉。 */
const EXPORT_MARKER_FILE = "last-export.json"

async function readExportMarker(dir: string): Promise<Date | undefined> {
	try {
		return parseExportMarker(await fs.readFile(path.join(dir, EXPORT_MARKER_FILE), "utf8"))
	} catch {
		return undefined
	}
}

async function writeExportMarker(dir: string, at: Date): Promise<void> {
	try {
		await fs.writeFile(path.join(dir, EXPORT_MARKER_FILE), JSON.stringify({ iso: at.toISOString() }), "utf8")
	} catch (error) {
		// 水位写失败只影响「下次导出从哪算」，不该让导出本身报错
		Logger.warn("[audit] 记录导出水位失败（已忽略）:", error instanceof Error ? error.message : error)
	}
}

let writeChain: Promise<void> = Promise.resolve()
let retainedOnce = false
let writesSinceSizeCheck = 0
const SIZE_CHECK_INTERVAL = 25

/**
 * 记录一条审计事件。**同步返回、永不抛错**——审计不能影响任务。
 */
export function recordAudit(entry: AuditEntry): void {
	let line: string | null
	try {
		line = serializeAuditEntry(entry)
	} catch {
		return
	}
	if (!line) {
		return
	}

	writeChain = writeChain
		.then(() => appendLine(line as string))
		.catch((error) => {
			Logger.warn("[audit] 写入审计日志失败（已忽略）:", error instanceof Error ? error.message : error)
		})
}

/**
 * 等队列里的审计行落盘。**只在进程退出时用**（`deactivate`）。
 *
 * `recordAudit` 是 fire-and-forget：abort 之后用户立刻重载窗口，最后那条 `task/abort`
 * 与 `api/usage` 可能还在队列里没写出去（#117）。这里把链 await 掉；
 * 异常只 warn——审计不能阻塞扩展退出。
 */
export async function flushAudit(): Promise<void> {
	try {
		await writeChain
	} catch (error) {
		Logger.warn("[audit] 退出前落盘失败（已忽略）:", error instanceof Error ? error.message : error)
	}
}

async function appendLine(line: string): Promise<void> {
	const dir = getDiagnosticsDir()
	await fs.mkdir(dir, { recursive: true })
	await pruneAuditLogsOnce(dir)

	const now = new Date()
	const filePath = await pickAuditFile(dir, now)
	await fs.appendFile(filePath, `${line}\n`, "utf8")
}

/** 同日文件超过上限时切到 `-2`、`-3`…，避免单文件无限增长。 */
async function pickAuditFile(dir: string, now: Date): Promise<string> {
	writesSinceSizeCheck++
	for (let index = 1; index < 100; index++) {
		const candidate = path.join(dir, auditFileName(now, index))
		let size = 0
		try {
			size = (await fs.stat(candidate)).size
		} catch {
			return candidate // 不存在 → 用它
		}
		const needsSizeCheck = writesSinceSizeCheck >= SIZE_CHECK_INTERVAL || size >= AUDIT_MAX_FILE_BYTES
		if (!needsSizeCheck || size < AUDIT_MAX_FILE_BYTES) {
			return candidate
		}
	}
	return path.join(dir, auditFileName(now, 99))
}

/** 每个进程只清理一次：删掉超过 14 天的审计文件。 */
async function pruneAuditLogsOnce(dir: string): Promise<void> {
	if (retainedOnce) {
		return
	}
	retainedOnce = true

	try {
		const now = Date.now()
		const cutoff = now - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
		const entries = await fs.readdir(dir, { withFileTypes: true })
		for (const entry of entries) {
			if (!entry.isFile()) continue
			const date = parseAuditFileDate(entry.name)
			if (!date || date.getTime() >= cutoff) continue
			await fs.unlink(path.join(dir, entry.name)).catch(() => {})
		}
	} catch (error) {
		Logger.warn("[audit] 清理过期审计日志失败（已忽略）:", error instanceof Error ? error.message : error)
	}
}

/** 按日期倒序读取最近 `limit` 行审计（跨天文件拼接）。给了 `sinceMs` 就只取窗口内的行。 */
export async function readRecentAuditLines(limit = AUDIT_EXPORT_LINE_LIMIT, sinceMs?: number): Promise<string[]> {
	const dir = getDiagnosticsDir()
	let files: string[]
	try {
		files = (await fs.readdir(dir)).filter((name) => parseAuditFileDate(name) !== undefined)
	} catch {
		return []
	}

	// 按「日期 + 分片号」降序，不能依赖文件名排序（见 compareAuditFilesDesc 注释）
	files.sort(compareAuditFilesDesc)
	const contents: string[] = []

	if (sinceMs === undefined) {
		let seenLines = 0
		for (const name of files) {
			if (seenLines >= limit) {
				break
			}
			try {
				const content = await fs.readFile(path.join(dir, name), "utf8")
				contents.push(content)
				// 与 collectRecentLines 同口径（\r?\n + 丢弃空行）：行尾换行会让 split("\n") 多计一行，
				// 累计后会提前 break，导致导出少于 limit 行。
				seenLines += content.split(/\r?\n/).filter((line) => line.trim().length > 0).length
			} catch {
				// 单个分片读失败不影响导出其余部分
			}
		}
		return collectRecentLines(contents, limit)
	}

	// #184 窗口模式：凑行数的提前 break 不能用——行要按 ts 过滤后才计数，
	// 较老的文件里可能还有窗口内的行。只跳过「整天都在窗口前」的文件兜住 IO。
	const dayMs = 24 * 60 * 60 * 1000
	for (const name of files) {
		const dayEnd = (parseAuditFileDate(name)?.getTime() ?? 0) + dayMs
		if (dayEnd <= sinceMs) {
			continue
		}
		try {
			contents.push(await fs.readFile(path.join(dir, name), "utf8"))
		} catch {
			// 单个分片读失败不影响导出其余部分
		}
	}
	return collectRecentLines(filterLinesWithinWindow(contents, sinceMs), limit)
}

export interface DiagnosticsExportResult {
	filePath: string
	auditLineCount: number
	/** #63：包内运行时错误条数（0 也是有效值，导出提示要明写「0 条」） */
	errorCount: number
}

/**
 * 生成单文件诊断包：环境 + 脱敏设置摘要 + 运行时错误小计 + 最近审计行。
 * 返回文件路径（供命令提示用户），失败时抛错由命令层提示。
 */
export async function exportDiagnostics(header: DiagnosticsHeader): Promise<DiagnosticsExportResult> {
	const dir = getDiagnosticsDir()
	await fs.mkdir(dir, { recursive: true })
	// #184：窗口从「上次导出的水位」起算；没有水位（首次导出/标记丢失）退回最近 24 小时。
	// 多读一倍再折叠高频事件（update / error）的既有策略不变。
	const now = new Date()
	const auditWindow = exportWindowStart(await readExportMarker(dir), now)
	const rawLines = await readRecentAuditLines(AUDIT_EXPORT_LINE_LIMIT * 2, auditWindow.sinceMs)
	const lines = foldEventsForExport(rawLines, AUDIT_EXPORT_LINE_LIMIT)

	// #63：统计口径是**包内**（折叠之后）——头部说几条，正文就得能数出几条。
	// 折叠摘要行自己写了「另有 N 条已折叠」，不在小计里重复计入。
	const errorStats = {
		...summarizeErrorEvents(lines),
		toolFailures: summarizeToolFailures(lines),
		silentSuspects: summarizeSilentSuspects(lines),
	}
	// 08 #240：健康度表同样只统计**包内**（折叠之后）的行，与上面三个小计同源；
	// 纯展示，不参与 failover / 候选链 / 池序决策。
	const modelHealth = summarizeModelHealth(lines)

	const body = [
		buildDiagnosticsHeader({
			...header,
			generatedAt: now,
			errorStats,
			modelHealth,
			auditWindow: { sinceIso: new Date(auditWindow.sinceMs).toISOString(), source: auditWindow.source },
		}),
		"",
		`最近审计事件（最多 ${AUDIT_EXPORT_LINE_LIMIT} 条，JSONL）:`,
		lines.length > 0 ? lines.join("\n") : "(暂无记录)",
		"",
	].join("\n")

	const filePath = path.join(dir, diagnosticsFileName(now))
	await fs.writeFile(filePath, body, "utf8")
	// 包写成功后才推水位：导出失败时下次还能把这段窗口完整带走
	await writeExportMarker(dir, now)
	return { filePath, auditLineCount: lines.length, errorCount: errorStats.total }
}

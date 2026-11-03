import fs from "node:fs/promises"
import path from "node:path"
import type { ToolUse } from "@core/assistant-message"
import {
	type BlockingRun,
	BOOT_DEFAULT_TIMEOUT_MS,
	BOOT_MAX_TIMEOUT_MS,
	type BootWatchResult,
	findBlockingRun,
	PARSE_DEFAULT_TIMEOUT_MS,
	PARSE_MAX_TIMEOUT_MS,
	type ParseVerificationResult,
	runCliDebugBootWatch,
	runCliDebugParse,
	supportsCliDebug,
} from "@core/era/clidebug"
import { type EngineCandidate, listEngineCandidates, pickEngine } from "@core/era/game-runner"
import { getEraProjectProfile } from "@core/era/project-profile"
import { getExtraWorkspaceRoots } from "@core/era/workspace-extra-roots"
import { formatResponse } from "@core/prompts/responses"
import type { ClineSayTool } from "@shared/ExtensionMessage"
import { getReadablePath, isLocatedInWorkspace } from "@utils/path"
import { showApprovalNotification } from "@/integrations/notifications"
import { telemetryService } from "@/services/telemetry"
import { formatBytes, truncateContent } from "@/shared/content-limits"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

const MAX_OUTPUT_BYTES = 10 * 1024
const MIN_TIMEOUT_SECONDS = 5
const MAX_TIMEOUT_SECONDS = 900
/** 报告里展示的错误/警告行样本上限 */
const MAX_DIAGNOSTIC_SAMPLES = 10
/** out 流尾部节选长度（完整流可能几 MB，模型只需要能看清结尾发生了什么） */
const OUT_TAIL_CHARS = 1200
/** 控制台缓冲尾部节选长度 */
const LOG_TAIL_CHARS = 1600

/**
 * 一次 `era_verify` 调用的「计划」：只描述会发生什么，不产生任何副作用。
 * 审批读它，执行阶段消费它（与 run_game 同款 #111 三段式）。
 */
type VerifyPlan =
	| { kind: "message"; text: string }
	| {
			kind: "verify"
			engine: EngineCandidate
			candidates: readonly EngineCandidate[]
			mode: "parse"
			/** planVerify 保证 parse 模式必有一个存在的目标 */
			targetPath: string
			timeoutSeconds: number
	  }
	| {
			kind: "verify"
			engine: EngineCandidate
			candidates: readonly EngineCandidate[]
			mode: "boot"
			targetPath?: undefined
			timeoutSeconds: number
	  }

/** 报错行的启发式特征：CliDebug 的 out 事件没有 level 字段，只能按文本认 */
const ERROR_HINT_RE = /エラー|错误|error|exception|异常/i
const WARNING_HINT_RE = /警告|warning/i

function countMatchingLines(text: string, regex: RegExp): number {
	let count = 0
	for (const line of text.split(/\r?\n/)) {
		if (regex.test(line)) {
			count++
		}
	}
	return count
}

function collectMatchingLines(text: string, regex: RegExp, limit: number): string[] {
	const hits: string[] = []
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim()
		if (trimmed && regex.test(trimmed)) {
			hits.push(trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed)
			if (hits.length >= limit) {
				break
			}
		}
	}
	return hits
}

function tail(text: string, maxChars: number): string {
	const condensed = text.replace(/\n{3,}/g, "\n\n").trimEnd()
	if (condensed.length <= maxChars) {
		return condensed
	}
	return `……（前面已略）\n${condensed.slice(-maxChars)}`
}

function formatCandidate(candidate: EngineCandidate): string {
	const version = candidate.version ? ` V${candidate.version}` : ""
	return `- ${candidate.fileName}${version}（${formatBytes(candidate.sizeBytes)}）`
}

function parseTimeoutSeconds(raw: string | undefined, mode: "parse" | "boot"): number {
	const value = Number.parseInt((raw || "").trim(), 10)
	const defaultValue = mode === "parse" ? PARSE_DEFAULT_TIMEOUT_MS / 1000 : BOOT_DEFAULT_TIMEOUT_MS / 1000
	const maxValue = mode === "parse" ? PARSE_MAX_TIMEOUT_MS / 1000 : BOOT_MAX_TIMEOUT_MS / 1000
	if (!Number.isFinite(value)) {
		return defaultValue
	}
	return Math.min(Math.max(MIN_TIMEOUT_SECONDS, value), Math.min(MAX_TIMEOUT_SECONDS, maxValue))
}

/** 解析模式报告：启发式计数 + 样本 + out 尾部。启发式不可靠时靠尾部原文兜底。 */
function formatParseResult(engine: EngineCandidate, result: ParseVerificationResult, displayTarget: string): string {
	const sections: string[] = []

	const lines = [
		"## 引擎",
		`${engine.fileName}（${formatBytes(engine.sizeBytes)}）`,
		`路径：${engine.filePath.replace(/\\/g, "/")}`,
		`模式：解析验证（--CliDebug ${displayTarget}）`,
		`耗时：${(result.durationMs / 1000).toFixed(1)} 秒`,
	]
	sections.push(lines.join("\n"))

	const statusLines: string[] = []
	if (result.endedBy === "spawn-error") {
		statusLines.push("- 引擎进程启动失败，没有产生任何解析结果。")
	} else {
		statusLines.push(
			result.completionSeen
				? "- 解析已跑完（看到「文件解析完成」标志）。"
				: "- ⚠️ 没有看到「文件解析完成」标志——解析超时或中途崩溃，下面的结果**不完整**，考虑加大 timeout_seconds 或缩小 target 再跑。",
		)
		statusLines.push(
			`- 结束方式：${result.endedBy === "cleanly" ? "解析完自行退出" : result.endedBy === "quit" ? "干净退出（quit）" : "超时强杀（进度无损，解析模式不写存档）"}`,
		)
	}
	sections.push(`## 结果\n${statusLines.join("\n")}`)

	// stale 的 Analysis.log 是上一次解析留下的旧文件，不能计入本次统计（review 修复批 #3）
	const analysisUsable = result.analysisLog !== undefined && !result.analysisLog.stale
	const sourceText = analysisUsable ? `${result.analysisLog?.text}\n${result.outText}` : result.outText
	const errorCount = countMatchingLines(sourceText, ERROR_HINT_RE)
	const warningCount = countMatchingLines(sourceText, WARNING_HINT_RE)
	const errorSamples = collectMatchingLines(sourceText, ERROR_HINT_RE, MAX_DIAGNOSTIC_SAMPLES)

	const diagLines = [`- 错误特征行：约 ${errorCount} 条；警告特征行：约 ${warningCount} 条（按文本启发式计数，仅供排序参考）`]
	if (errorSamples.length > 0) {
		diagLines.push("", "### 错误样本")
		diagLines.push(...errorSamples.map((line) => `- ${line}`))
	}
	if (result.analysisLog && result.analysisLog.stale) {
		diagLines.push(
			"",
			`⚠️ exe 目录的 Analysis.log 是**上一次**解析留下的旧文件（修改时间早于本次启动），⛔ 不要当成本次结果分析：${result.analysisLog.path.replace(/\\/g, "/")}。本次没看到解析完成标志，旧文件里的错误大概率已经修过。`,
		)
	} else if (result.analysisLog) {
		diagLines.push(
			"",
			`完整结果在 Analysis.log：${result.analysisLog.path.replace(/\\/g, "/")}（${formatBytes(result.analysisLog.byteLength)}${result.analysisLog.truncated ? "，报告里只读了开头" : ""}）`,
			"",
			"⚠️ 解析模式会输出**存量全量警告**：孤立的裸标识符警告多为伪阳性（符号在别的文件里），数值⇔字符串类型不匹配与 csv 缺定义才值得优先修。",
		)
	} else if (result.endedBy !== "spawn-error") {
		diagLines.push("", "exe 目录没有生成 Analysis.log（解析可能没走到写报告那一步）。")
	}
	sections.push(`## 诊断\n${diagLines.join("\n")}`)

	if (result.outText.trim()) {
		sections.push(`## 引擎输出尾部\n\`\`\`\n${tail(result.outText, OUT_TAIL_CHARS)}\n\`\`\``)
	}

	return sections.join("\n\n")
}

function formatBootResult(engine: EngineCandidate, result: BootWatchResult): string {
	const sections: string[] = []

	sections.push(
		[
			"## 引擎",
			`${engine.fileName}（${formatBytes(engine.sizeBytes)}）`,
			`路径：${engine.filePath.replace(/\\/g, "/")}`,
			`模式：启动观察（--CliDebug，完整启动到标题画面）`,
			`耗时：${(result.durationMs / 1000).toFixed(1)} 秒`,
		].join("\n"),
	)

	const bootLines = [
		result.reachedInputWait
			? "- 引擎已走到**输入等待**（标题画面/主菜单），启动流程走完了。"
			: "- ⚠️ 等待超时，没有看到输入等待事件——引擎可能停在加载中、报错对话框或直接崩溃。看下面的控制台内容。",
	]
	if (result.stateName) {
		bootLines.push(`- 最后状态：${result.stateName}`)
	}
	bootLines.push(
		`- 结束方式：${result.endedBy === "quit" ? "干净退出（quit，日志已刷盘）" : result.endedBy === "exit" ? `自行退出（退出码 ${result.exitCode ?? "无"}）` : result.endedBy === "killed" ? "超时强杀（不会保存进度）" : "引擎进程启动失败"}`,
	)
	sections.push(`## 结果\n${bootLines.join("\n")}`)

	if (result.dialogs.length > 0) {
		const dialogLines = result.dialogs
			.slice(0, MAX_DIAGNOSTIC_SAMPLES)
			.map((dialog) => `- [${dialog.title ?? dialog.dialog ?? "对话框"}] ${(dialog.text ?? "").trim()}`)
		sections.push(
			`## 模态对话框（${result.dialogs.length} 个）\n这是 GUI 下会弹窗卡死的东西，**最可靠的出错信号**：\n${dialogLines.join("\n")}`,
		)
	}

	const consoleSections: string[] = []
	if (result.logText?.trim()) {
		consoleSections.push(
			`### 控制台缓冲尾部（log 命令，窗口里被字符画刷掉的报错也在这里）\n\`\`\`\n${tail(result.logText, LOG_TAIL_CHARS)}\n\`\`\``,
		)
	} else if (result.reachedInputWait) {
		consoleSections.push("### 控制台缓冲\nlog 命令没有返回内容（缓冲为空或请求失败），只有 out 流可用。")
	}
	if (result.outText.trim()) {
		consoleSections.push(`### stdout 输出尾部\n\`\`\`\n${tail(result.outText, OUT_TAIL_CHARS)}\n\`\`\``)
	}
	if (consoleSections.length > 0) {
		sections.push(`## 控制台\n${consoleSections.join("\n\n")}`)
	}

	return sections.join("\n\n")
}

export class EraVerifyToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.ERA_VERIFY

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const mode = (block.params.mode || "parse").trim()
		const target = (block.params.target || "自动选择 ERB 目录").trim()
		return `[${block.name} for '${mode} ${target}']`
	}

	async handlePartialBlock(_block: ToolUse, _uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// 与 run_game 同理：验证有副作用，等完整块再说
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const rawMode = (block.params.mode || "parse").trim().toLowerCase()
		const mode = rawMode === "boot" ? "boot" : "parse"

		// 子代理没有审批通道；era_verify 与 run_game 同级（拉起引擎进程、引擎写自身产物）
		if (config.isSubagentExecution) {
			return formatResponse.toolError("era_verify 需要用户当面确认，不能在子代理里使用。请回到主对话执行。")
		}

		try {
			// ── 阶段一：只读探查，无副作用 ──────────────
			const plan = await this.planVerify(config, block, mode)

			if (plan.kind === "message") {
				const text = truncateContent(plan.text, MAX_OUTPUT_BYTES)
				await config.callbacks.say("tool", JSON.stringify(await this.buildPayload(config, plan, text)))
				config.taskState.consecutiveMistakeCount = 0
				return text
			}

			// ── 阶段二：审批（autoApprove 对本工具是硬闸，必然弹卡片）──────────
			const approvalBody = JSON.stringify(await this.buildPayload(config, plan))
			if (!(await config.callbacks.shouldAutoApproveToolWithPath(block.name, plan.engine.filePath))) {
				void showApprovalNotification(
					{
						message: `era harness 想要${plan.mode === "parse" ? "解析验证" : "启动验证"} ${plan.engine.fileName}`,
						requiresExplicitApproval: true,
					},
					config.autoApprovalSettings.enableNotifications,
				)
				await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "tool")
				const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("tool", approvalBody, config)
				if (!didApprove) {
					return formatResponse.toolDenied()
				}
			}

			// ── 阶段三：执行（从这里开始才有副作用）─────────────
			// 审批（可能长达数分钟）期间状态可能已变：用户手动拉起了游戏、另一路
			// 验证先占上了。执行前复查互斥，别让「计划说能跑」变成双开（review 批 B2）。
			{
				const blocking = findBlockingRun(plan.engine.filePath)
				if (blocking) {
					const text = truncateContent(this.blockingVerifyMessage(blocking, plan.engine), MAX_OUTPUT_BYTES)
					await config.callbacks.say("tool", JSON.stringify(await this.buildPayload(config, plan, text)))
					config.taskState.consecutiveMistakeCount = 0
					return text
				}
			}
			const body =
				plan.mode === "parse"
					? formatParseResult(
							plan.engine,
							await runCliDebugParse({
								exePath: plan.engine.filePath,
								targetPath: plan.targetPath,
								timeoutMs: plan.timeoutSeconds * 1000,
							}),
							plan.targetPath.replace(/\\/g, "/"),
						)
					: formatBootResult(
							plan.engine,
							await runCliDebugBootWatch({
								exePath: plan.engine.filePath,
								settleTimeoutMs: plan.timeoutSeconds * 1000,
							}),
						)

			const result = truncateContent(body, MAX_OUTPUT_BYTES)
			await config.callbacks.say("tool", JSON.stringify(await this.buildPayload(config, plan, result)))

			telemetryService.captureToolUsage(
				config.ulid,
				block.name,
				config.api.getModel().id,
				config.services.stateManager.getApiConfiguration().actModeApiProvider as string,
				true,
				true,
				{
					isMultiRootEnabled: config.isMultiRootEnabled || false,
					usedWorkspaceHint: false,
					resolvedToNonPrimary: false,
					resolutionMethod: "primary_fallback",
				},
				block.isNativeToolCall,
			)

			config.taskState.consecutiveMistakeCount = 0
			return result
		} catch (error) {
			if (error instanceof Error && error.message === "Cline instance aborted") {
				throw error
			}
			config.taskState.consecutiveMistakeCount++
			const errorMessage = error instanceof Error ? error.message : String(error)
			return formatResponse.toolError(`验证失败：${errorMessage}`)
		}
	}

	/** 审批卡片与结果卡片共用的载荷。`content` 只有结果阶段才有。 */
	private async buildPayload(config: TaskConfig, plan: VerifyPlan, content?: string): Promise<ClineSayTool> {
		const withContent = content === undefined ? {} : { content }
		if (plan.kind === "message") {
			return {
				tool: "runGame",
				action: "verify",
				// 与 run_game 的 status 同款：正文显示 command ?? path，不补就只显示「.」（review 批 B5）
				command: "action=verify",
				path: getReadablePath(config.cwd, "."),
				operationIsLocatedInWorkspace: true,
				...withContent,
			}
		}
		const commandLine =
			plan.mode === "parse"
				? `${plan.engine.fileName} --CliDebug ${plan.targetPath ?? ""}`.trim()
				: `${plan.engine.fileName} --CliDebug`
		return {
			tool: "runGame",
			action: "verify",
			path: getReadablePath(config.cwd, plan.engine.filePath),
			command: commandLine,
			cwd: path.dirname(plan.engine.filePath).replace(/\\/g, "/"),
			operationIsLocatedInWorkspace: await isLocatedInWorkspace(plan.engine.filePath),
			note:
				plan.mode === "parse"
					? `解析验证：强制编译并全量收警告，最长等 ${plan.timeoutSeconds} 秒，结束时自动关闭引擎`
					: `启动观察：跑到标题画面取控制台报错再自动关闭，最长等 ${plan.timeoutSeconds} 秒`,
			...withContent,
		}
	}

	/** 解析目标：显式参数 > 探测到的 ERB 目录 > 工程根（兜底时在报告里提示备份噪音风险） */
	private async resolveParseTarget(config: TaskConfig, explicitTarget: string | undefined): Promise<string | undefined> {
		if (explicitTarget) {
			return path.isAbsolute(explicitTarget) ? explicitTarget : path.resolve(config.cwd, explicitTarget)
		}
		const extraRoots = await getExtraWorkspaceRoots(config.cwd)
		const profile = getEraProjectProfile(config.cwd, extraRoots)
		const root = profile.roots[0]
		if (!root) {
			return undefined
		}
		for (const dirName of profile.scriptDirNames) {
			const candidate = path.join(root, dirName)
			try {
				if ((await fs.stat(candidate)).isDirectory()) {
					return candidate
				}
			} catch {
				// 探测出的目录名不存在（结构变过）就试下一个
			}
		}
		return root
	}

	/** 互斥冲突的用户可读消息。plan 阶段与执行前复查共用（review 批 B2）。 */
	private blockingVerifyMessage(blocking: BlockingRun, engine: EngineCandidate): string {
		if (blocking.kind === "verify") {
			return [
				"## 已有验证在运行",
				`${engine.fileName} 正在被一次 era_verify 驱动（解析/启动验证，跑完会自动关闭）。`,
				"",
				"同一个引擎不能同时两路驱动。等这次验证结束再发起新的；卡住时用户可用「era harness: 结束游戏」命令结束它。",
			].join("\n")
		}
		return [
			"## 游戏正在运行，无法验证",
			`${engine.fileName} 已有一个活着的实例（PID ${blocking.run.pid ?? "未知"}，由 run_game 或「启动游戏」命令拉起）。`,
			"",
			"验证需要独占引擎（避免互抢写存档与懒加载索引）。请先用 run_game 的 `action=stop` 或「era harness: 结束游戏」命令结束它，再发起验证。",
		].join("\n")
	}

	/** 只读探查：算出「这次调用会发生什么」。与执行拆开让审批挡在副作用之前（#111）。 */
	private async planVerify(config: TaskConfig, block: ToolUse, mode: "parse" | "boot"): Promise<VerifyPlan> {
		const extraRoots = await getExtraWorkspaceRoots(config.cwd)
		const candidates = await listEngineCandidates(config.cwd, extraRoots)

		if (candidates.length === 0) {
			return {
				kind: "message",
				text: [
					"## 没有找到引擎",
					"已在探测到的工程根下按 `Emuera*.exe` 查找，没有匹配。请确认：",
					"- 引擎 exe 确实在工程根或其一层子目录里；",
					"- 文件名以 Emuera 开头（必要时用 exe 参数给出完整路径）。",
				].join("\n"),
			}
		}

		const preferred = (block.params.exe || "").trim()
		const engine = pickEngine(candidates, preferred || undefined)
		if (!engine) {
			return {
				kind: "message",
				text: [
					`## 找到 ${candidates.length} 个引擎，但「${preferred}」无法唯一匹配`,
					candidates.map(formatCandidate).join("\n"),
					"",
					"用 exe 参数指定其中一个的文件名（或更精确的片段）再试。",
				].join("\n"),
			}
		}

		// 版本闸门：--CliDebug 是引擎 15.0.0 新增的；老引擎收到这个参数不会按协议走
		if (!supportsCliDebug(engine.fileName)) {
			return {
				kind: "message",
				text: [
					`## 引擎版本过旧，无法验证`,
					`${engine.fileName} 的主版本号低于 15。\`--CliDebug\` 协议（era_verify 的底座）是引擎 **15.0.0** 才引入的，`,
					"老引擎收到这个参数只会当未知参数处理，拿不到任何报错数据。",
					"",
					"解决：把引擎换成 `Emuera_skiaV15` 以上（当前游戏仓库用的是 V16.6.13），或用 `exe` 参数指定新版本引擎。",
				].join("\n"),
			}
		}

		// 互斥（统一走 findBlockingRun 的归一化判定）：同一个引擎不能两路同时驱动——
		// ① era_verify 自己已经在跑这个 exe；② run_game / 快捷启动拉起的实例还活着。
		// 双向都要拦，否则两边互相抢写 sav/ 与懒加载索引。
		const blocking = findBlockingRun(engine.filePath)
		if (blocking) {
			return { kind: "message", text: this.blockingVerifyMessage(blocking, engine) }
		}

		if (mode === "parse") {
			const target = await this.resolveParseTarget(config, (block.params.target || "").trim() || undefined)
			const targetExists = target
				? await fs.stat(target).then(
						(stat) => stat.isDirectory() || stat.isFile(),
						() => false,
					)
				: false
			if (!target || !targetExists) {
				return {
					kind: "message",
					text: [
						"## 解析目标不存在",
						target ? `\`${target.replace(/\\/g, "/")}\` 不存在。` : "没有探测到 era 工程根，无法自动选择 ERB 目录。",
						"用 target 参数指定一个 .ERB 文件或包含 ERB 的目录（解析模式会递归编译目录下全部 *.ERB）。",
					].join("\n"),
				}
			}
			return {
				kind: "verify",
				engine,
				candidates,
				mode: "parse",
				targetPath: target,
				timeoutSeconds: parseTimeoutSeconds(block.params.timeout_seconds, "parse"),
			}
		}

		return {
			kind: "verify",
			engine,
			candidates,
			mode: "boot",
			timeoutSeconds: parseTimeoutSeconds(block.params.timeout_seconds, "boot"),
		}
	}
}

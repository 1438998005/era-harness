/**
 * 方言残片防线（纯函数，可单测，不引入宿主依赖）。
 *
 * 背景（2026-10-25 任务 1792900662485 msg9 取证）：解析器修复覆盖已知形态后，仍可能有
 * 未知方言变体把 DSML/parameter 标记残片留在定位类参数值里。红字报错（缺参/Invalid path）
 * 模型下轮能自纠，但**污染值静默执行**最危险——file_pattern 带 DSML 残片仍 outcome ok，
 * rg 得 "Found 0 results"，模型误信空结果继续推进。
 *
 * 修复目标升级（08 #45）：红字归零 + 污染值不得静默执行。本模块在工具执行前检测
 * 定位类参数里的方言残片，命中即拒绝执行并给出指名参数的可读报错。
 *
 * 判据按结构（19 §19.1）：DSML 分隔符字面量、parameter/invoke 标签语法——这些在
 * 定位类参数的合法值里不会出现；不枚举任何模型文案。
 */

import { scrubSecrets } from "../logging/audit-log-format"

/** 定位类参数：值直接决定工具作用于哪里/搜什么，污染会导致静默错行为。 */
export const GUARDED_PARAMS = [
	"path",
	"absolutePath",
	"url",
	"regex",
	"file_pattern",
	"query",
	"log_path",
	"server_name",
	"tool_name",
] as const

/**
 * 值为文件/命令本体的参数**不检测**：content/diff/command 里合法讨论 XML/DSML 的内容
 * 不得误伤（隐私上也不进 snapshot）。
 */
const SNAPSHOT_EXCLUDED_PARAMS = new Set(["content", "diff", "command", "task_progress"])

/** DSML 分隔符（1-3 根全角/ASCII 竖线）与方言标签语法。与解析层同族判据。 */
const DIALECT_RESIDUE_RE =
	/[｜|]{1,3}\s*DSML\s*[｜|]{1,3}|<\/?\s*parameter[\s>=]|<\/?\s*invoke\s*>|<\/?\s*(?:dots_function_call|function_calls?)\s*>/

/**
 * 08 #239：已知工具/参数标签名（**单源**）。只认这些名字的标签残片，
 * 绝不泛化到任意 `<`——合法正则 `\<word\>`、HTML 文本搜索 `<div>`、含换行的合法模式
 * 都不在名单里，因此不会命中。
 */
const KNOWN_TAG_NAMES = [
	"path",
	"regex",
	"file_pattern",
	"search_files",
	"parameter",
	"invoke",
	"content",
	"diff",
	"command",
	"recursive",
	"task_progress",
	"read_file",
	"write_to_file",
	"list_files",
	"apply_patch",
	"replace_in_file",
	"execute_command",
	"attempt_completion",
]

/**
 * 08 #239：已知标签残片（疑似标签未闭合）。解析层按 `</${paramName}>` 收口，标签未闭合时
 * 后续标签会被吞进参数值。两类形状：
 * 1) 值里任意位置出现已知闭合标签（如 regex=`net</search_files>`）；
 * 2) 值以已知开标签开头（如 regex=`<regex>net`，允许前导空白/换行）。
 * 刻意**不**认「任意位置的开标签」：合法正则里 `<div>` 等不在名单，避免误伤正文类正则。
 */
const KNOWN_TAG_RESIDUE_RE = new RegExp(
	`<\\/\\s*(?:${KNOWN_TAG_NAMES.join("|")})\\s*>|^\\s*<\\s*(?:${KNOWN_TAG_NAMES.join("|")})\\s*>`,
	"i",
)

/**
 * 08 #239：只为「正确写法示例」剥离标签残片，不参与任何判定（判定仍只看上面的锚定式）。
 * 例：regex=`net</search_files>` → 示例 `<regex>net</regex>`，模型照抄即可一步改对。
 */
const KNOWN_TAG_STRIP_RE = new RegExp(`<\\/?\\s*(?:${KNOWN_TAG_NAMES.join("|")})\\s*>`, "gi")

/** 在 GUARDED_PARAMS 里找第一个值命中判据的参数名（单源循环，避免两份检测逻辑）。 */
function findGuardedParam(
	params: Record<string, string | undefined> | undefined,
	matches: (value: string) => boolean,
): string | undefined {
	if (!params) {
		return undefined
	}
	for (const name of GUARDED_PARAMS) {
		const value = params[name]
		if (value && matches(value)) {
			return name
		}
	}
	return undefined
}

/** 返回第一个含方言残片（DSML/parameter/invoke 或已知标签残片）的定位类参数名；无污染返回 undefined。 */
export function findDialectResidueParam(params: Record<string, string | undefined> | undefined): string | undefined {
	return findGuardedParam(params, (value) => DIALECT_RESIDUE_RE.test(value) || KNOWN_TAG_RESIDUE_RE.test(value))
}

/** 08 #239：只判「已知标签残片」（疑似标签未闭合），供失败归因精确措辞；判据与上面同源。 */
export function findUnclosedTagResidueParam(params: Record<string, string | undefined> | undefined): string | undefined {
	return findGuardedParam(params, (value) => KNOWN_TAG_RESIDUE_RE.test(value))
}

/**
 * 报错调用的参数快照（审计现场，诊断包排障用）。
 * 逐参数 `名=JSON(值)` 拼接，单参数截 200 字符、总长截 1000 字符；content/diff/command
 * 等正文类参数整段排除（19 §19.6 正文剥离纪律）。进审计事件时由 `serializeAuditEntry`
 * 统一 scrub；但 `buildUnclosedTagFailureMessage` 直推模型/UI，已在生成处复用 `scrubSecrets`。
 */
export function buildToolParamSnapshot(params: Record<string, string | undefined> | undefined): string | undefined {
	if (!params) {
		return undefined
	}
	const parts: string[] = []
	for (const [key, value] of Object.entries(params)) {
		if (typeof value !== "string" || !value || SNAPSHOT_EXCLUDED_PARAMS.has(key)) {
			continue
		}
		const clipped = value.length > 200 ? `${value.slice(0, 200)}…` : value
		parts.push(`${key}=${JSON.stringify(clipped)}`)
	}
	if (parts.length === 0) {
		return undefined
	}
	const text = parts.join(" ")
	return text.length > 1000 ? `${text.slice(0, 1000)}…` : text
}

/**
 * 08 #239：命中「疑似标签未闭合」时生成一步改对的可读归因（纯文本，未命中返回 undefined）。
 * 检测复用 `findUnclosedTagResidueParam`、回显复用 `buildToolParamSnapshot`，
 * 不另写第二份检测/回显逻辑；由 ToolExecutor 通用防线 / handler 用 `toolError` 包装后返回模型。
 *
 * `expectedParam` 给通用防线用：它被 `findDialectResidueParam` 拦下的那个参数必须与这里归因的
 * 参数一致，否则多参数同时污染时归因会再次指错方向（#239 的病根），此时退回 #45 通用文案。
 */
export function buildUnclosedTagFailureMessage(
	params: Record<string, string | undefined> | undefined,
	expectedParam?: string,
): string | undefined {
	const unclosed = findUnclosedTagResidueParam(params)
	if (!unclosed || (expectedParam && unclosed !== expectedParam)) {
		return undefined
	}
	// 08 #239（review 修订）：本 message 经 formatResponse.toolError 直推模型与 UI，
	// 不经过 serializeAuditEntry。旧版只截断参数就写 "(redacted)"，密钥明文会原样外发。
	// 这里复用审计层同一份 scrubSecrets（单源），让文案名副其实。
	const snapshot = scrubSecrets(buildToolParamSnapshot(params) ?? "[content omitted]")
	// 剥掉吞进来的标签，取第一行非空内容作为「本来要写的值」；过长或剥空才退回占位符。
	// 先切行再 scrub（scrubSecrets 会把换行压成空格，反过来做会把后续标签吞进示例）。
	const sample = (params?.[unclosed] ?? "").replace(KNOWN_TAG_STRIP_RE, "").split(/\r?\n/)[0].trim().slice(0, 80)
	const exampleValue = scrubSecrets(sample) || "value"
	return `疑似工具标签未闭合 (unclosed tool tag) in the '${unclosed}' parameter — its value still contains tool-call markup such as </${unclosed}> or <${unclosed}>. The tool was NOT run with that polluted value. Actual parameters (secrets scrubbed, values clipped): ${snapshot}. Re-issue the call with a clean value, for example <${unclosed}>${exampleValue}</${unclosed}>.`
}

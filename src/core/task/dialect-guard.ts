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

/** 定位类参数：值直接决定工具作用于哪里/搜什么，污染会导致静默错行为。 */
const GUARDED_PARAMS = [
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

/** 返回第一个含方言残片的定位类参数名；无污染返回 undefined。 */
export function findDialectResidueParam(params: Record<string, string | undefined> | undefined): string | undefined {
	if (!params) {
		return undefined
	}
	for (const name of GUARDED_PARAMS) {
		const value = params[name]
		if (value && DIALECT_RESIDUE_RE.test(value)) {
			return name
		}
	}
	return undefined
}

/**
 * 报错调用的参数快照（审计现场，诊断包排障用）。
 * 逐参数 `名=JSON(值)` 拼接，单参数截 200 字符、总长截 1000 字符；content/diff/command
 * 等正文类参数整段排除（19 §19.6 正文剥离纪律）。外发脱敏由 audit 层统一 scrub。
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

/**
 * 08 #207：发送按钮旁「增强提示词」的两端共用 JSON 契约。
 *
 * 与 `getGlobalMemory` / `knowledgeBaseAction` 同款：proto 只有 StringRequest / String，
 * 结构化数据塞 JSON。刻意不放任何宿主/webview 依赖，宿主、webview、node:test 三处都能 import。
 *
 * 交互基线（Qoder 官方文档「One-click prompt optimization」、Trae「优化输入内容」、
 * WorkBuddy「增强提示词」、CodeBuddy「Boost Prompt」）：就地替换输入、可编辑、可撤销、
 * 不自动发送、不另起对话；生成失败保留用户原文。
 */

export interface EnhancePromptRequest {
	text: string
	/** 可选上下文摘要（如工作区类型）；只注入提示词，不落日志 */
	context?: string
}

export interface EnhancePromptResult {
	ok: boolean
	enhancedText?: string
	message?: string
}

export const ENHANCE_PROMPT_MAX_INPUT_CHARS = 4000
export const ENHANCE_PROMPT_MAX_OUTPUT_CHARS = 8000
export const ENHANCE_PROMPT_TIMEOUT_MS = 60_000

export function buildEnhancePromptSystemPrompt(): string {
	return [
		"你是 era harness 的提示词改写助手。用户是 eraTW（画蛇添足版）的口上撰写作者或本体开发者，很多是不懂 AI 的 0 基础用户。",
		"把用户输入的原始需求改写成一条清晰、可直接发送的结构化提示词，必须包含三段：",
		"1. 目标：要做什么、涉及哪些文件或目录（用户没说就写「待确认」，不要编造）。",
		"2. 边界：不做什么（尤其是不得改动目标游戏目录以外的文件、不得顺手改版本号或提交）。",
		"3. 验收标准：做完怎么算通过，尽量给可执行的验证命令或可观察现象。",
		"规则：",
		"- 只输出改写后的提示词正文，不要解释、不要问好、不要 Markdown 代码围栏、不要 XML 或工具标签。",
		"- 不臆造用户没提过的技术栈、路径或事实；信息不足时用「需要确认：…」列出待确认项。",
		"- 用中文，保留用户原意与语气，长度控制在原文的 2–4 倍以内。",
		"- 不要调用任何工具，不要输出进度清单或 todo 列表。",
	].join("\n")
}

/** 宿主侧解析 webview 传来的 JSON；任何形状不合法都给可展示的中文原因。 */
export function parseEnhancePromptRequest(
	value: string,
): { ok: true; request: EnhancePromptRequest } | { ok: false; message: string } {
	let parsed: unknown
	try {
		parsed = value ? JSON.parse(value) : undefined
	} catch {
		return { ok: false, message: "请求不是合法的 JSON" }
	}
	if (!parsed || typeof parsed !== "object") {
		return { ok: false, message: "请求为空" }
	}
	const record = parsed as Record<string, unknown>
	const text = typeof record.text === "string" ? record.text.trim() : ""
	if (!text) {
		return { ok: false, message: "请先输入要增强的内容" }
	}
	if (text.length > ENHANCE_PROMPT_MAX_INPUT_CHARS) {
		return { ok: false, message: `输入过长（最多 ${ENHANCE_PROMPT_MAX_INPUT_CHARS} 字），请先精简` }
	}
	const context = typeof record.context === "string" ? record.context.slice(0, 2000) : undefined
	return { ok: true, request: { text, context } }
}

/** 模型偶尔会裹代码围栏或残留思考标签；清洗后再回填输入框。 */
export function sanitizeEnhancedText(raw: string): string {
	let text = raw
		.trim()
		.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
		.trim()
	// 允许空围栏（模型偶尔只吐一对 ```）：剥掉首尾两行再 trim，空结果交给调用方判失败。
	if (/^```/.test(text) && /```\s*$/.test(text)) {
		text = text.replace(/^```[^\n]*\n?/, "").replace(/\n?```\s*$/, "")
	}
	return text.trim().slice(0, ENHANCE_PROMPT_MAX_OUTPUT_CHARS).trim()
}

/** webview 侧解析宿主响应；坏 JSON 一律按失败处理，绝不覆盖用户原文。 */
export function parseEnhancePromptResponse(value: string | undefined): EnhancePromptResult {
	if (!value) {
		return { ok: false, message: "提示词增强没有返回结果" }
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(value)
	} catch {
		return { ok: false, message: "提示词增强返回了无法解析的结果" }
	}
	if (!parsed || typeof parsed !== "object") {
		return { ok: false, message: "提示词增强返回了无法解析的结果" }
	}
	const record = parsed as Record<string, unknown>
	if (record.ok === true && typeof record.enhancedText === "string") {
		const enhancedText = sanitizeEnhancedText(record.enhancedText)
		if (enhancedText) {
			return { ok: true, enhancedText }
		}
	}
	return {
		ok: false,
		message: typeof record.message === "string" ? record.message : "提示词增强失败，请稍后再试",
	}
}

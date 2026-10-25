import { ClineDefaultTool, getToolUseNames } from "@shared/tools"
import { nanoid } from "nanoid"
import { AssistantMessageContent, TextStreamContent, ToolParamName, ToolUse, toolParamNames } from "." // Assuming types are defined in index.ts or a similar file

// parseAssistantmessageV1 removed in https://github.com/cline/cline/pull/5425

// era harness: some models (observed GLM-5.3-Flash) leak native tool-call wrappers like
// `<tool_call>read_file<path>...</read_file>` in the text channel. Normalize the wrapper
// back to a Cline open tag so the parser below can execute it. No-op on well-formed XML.
// 2026-10-24（真实任务 1792824509987 取证）：MiMo/Qwen 系还会吐 `<tool_call><function=NAME>`
// 变体（训练内部方言），同样归一成 `<NAME>`；`</function>`/`</invoke>` 残留由下方的
// dialect 参数归一器负责清理。开包裹被还原后，成对的 `</tool_call>` 闭包裹会残留在
// 正文里（MiMo 官方训练模板就是成对发出的），一并清掉。
function normalizeLeakedToolMarkup(text: string): string {
	if (!text) return text
	// 只有闭包裹（流式截断残留）也要清，所以证据判定包含闭包裹
	if (!/<\/?tool_call>|<\/?tool-call>/.test(text)) return text
	const known = new Set(getToolUseNames())
	return text
		.replace(/<(?:tool_call|tool-call)>\s*(?:<function=)?([a-z_][a-z0-9_]*)\s*>?/g, (_m, name) =>
			known.has(name) ? "<" + name + ">" : _m,
		)
		.replace(/<\/\s*(?:tool_call|tool-call)\s*>/g, "")
}

// era harness: some models (observed GLM-5.3-Flash) XML-escape shell commands, writing
// `&amp;` / `&gt;` instead of raw `&` / `>`. Passed verbatim to the shell this breaks the
// command (e.g. `... &amp;&amp; echo OK` is not valid cmd.exe). Decode the standard XML entities
// for the `command` parameter ONLY — file-content params (content/new_content) must keep
// literal `&amp;` because the files being written may legitimately contain it.
function decodeCommandEntities(text: string): string {
	if (!text || text.indexOf("&") === -1) return text
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(Number.parseInt(h, 16)))
		.replace(/&amp;/g, "&")
}

// era harness: some models (observed GLM-5.3-Flash) emit <task_progress>...</task_progress>
// as standalone body text instead of a tool parameter. The focus-chain routing reads the raw
// text separately (see task/index.ts), but the parser would otherwise render these tags as
// plain text in the chat. Strip them from the parsed text so they never surface to the user;
// surrounding prose is preserved. Also drops a trailing unclosed block during streaming.
function stripTaskProgressMarkup(text: string): string {
	if (!text || text.indexOf("<task_progress>") === -1) return text
	return text.replace(/<task_progress>[\s\S]*?<\/task_progress>/g, "").replace(/<task_progress>[\s\S]*$/, "")
}

// era harness: DeepSeek 系推理服务（实测 GLM-5.3-Flash）有时不吐 Cline 的 XML，而是把
// **原生工具调用标记连同控制分隔符一起泄漏成正文**：
//
//   <｜｜DSML｜｜ calls>
//   <｜｜DSML｜｜ invoke name="search_files">
//   <｜｜DSML｜｜ parameter name="path" string="true">ERB/xxx</｜｜DSML｜｜ parameter>
//   </｜｜DSML｜｜ invoke>
//   </｜｜DSML｜｜ calls>
//
// 这里的 `｜｜DSML｜｜` 本该被推理服务当成控制 token 吞掉，泄漏成文本后有两个后果：
// 1. 整块不被识别成工具调用，**原样显示给用户**，工具根本没执行；
// 2. 即使前后混用了 Cline 的 XML，`</｜｜DSML｜｜ parameter>` 也不会被 `</path>` 匹配，
//    于是把后面的 `<regex>` 吞进 path 值里 → 报 "missing required parameter 'regex'" 反复重试。
//
// 这里按出现顺序扫一遍，把 invoke/parameter 还原成 Cline 的 `<tool>` / `<param>`，
// 并清掉残留分隔符。必须是单趟扫描：参数的开/闭标签交替出现，分几趟 replace 会把
// 所有闭合都错配到最后一次打开的标签上。
const DSML_DELIMITER = String.raw`[｜|]{2}\s*DSML\s*[｜|]{2}`

function normalizeDsmlMarkup(text: string): string {
	if (!text || !text.includes("DSML")) return text

	let openTool: string | null = null
	let openParam: string | null = null
	const knownTools = new Set(getToolUseNames())

	const pattern = new RegExp(
		[
			`<${DSML_DELIMITER}\\s*invoke\\s+name="([^"]+)"\\s*>`, // 1: 开工具
			`</${DSML_DELIMITER}\\s*invoke\\s*>`, // 2: 关工具
			// 3: 开参数。引号残缺（实测 name="path>，2026-10-24 真实任务取证）也能配对：
			//    开/闭引号都可省略，参数名必须是不含引号/空白/尖括号的标识符。
			`<${DSML_DELIMITER}\\s*parameter\\s+name="?([^">\\s>]+)"?[^>]*>`,
			`</${DSML_DELIMITER}\\s*parameter\\s*>`, // 4: 关参数
			`</?${DSML_DELIMITER}\\s*calls\\s*>`, // 5: calls 包裹
			`<([a-z_][a-z0-9_]*)\\s*>`, // 6: Cline 开标签（工具或参数）
			`</([a-z_][a-z0-9_]*)\\s*>`, // 7: Cline 关标签
			DSML_DELIMITER, // 8: 兜底，清残留分隔符
		].join("|"),
		"g",
	)

	const normalized = text.replace(
		pattern,
		(match, invokeName?: string, dsmlParamName?: string, openTagName?: string, closeTagName?: string) => {
			// 1: DSML 开工具
			if (invokeName) {
				openTool = invokeName
				return `<${invokeName}>`
			}
			// 3: DSML 开参数
			if (dsmlParamName) {
				openParam = dsmlParamName
				return `<${dsmlParamName}>`
			}
			// 2: DSML 关工具
			if (/invoke/.test(match)) {
				const tool = openTool
				openTool = null
				return tool ? `</${tool}>` : ""
			}
			// 4: DSML 关参数
			if (/parameter/.test(match)) {
				const param = openParam
				openParam = null
				return param ? `</${param}>` : ""
			}
			// 5: calls 包裹
			if (/calls/.test(match)) {
				return ""
			}
			// 6/7: Cline 自己的标签，原样返回。但**必须登记** openParam：实测同一段里
			// 模型会 `<path>`（Cline）开、`</｜｜DSML｜｜ parameter>`（DSML）关两种格式混用。
			// 不登记的话 DSML 关标签来时 openParam 是 null，会把闭合标签**删掉**，
			// 反而让 path 吞掉后面的 <regex>，比不修更糟。
			// 工具闭标签（2026-10-25 任务 1792887990433 msg67 取证）：普通 `</tool>` 先到时
			// 必须清 openTool，否则紧随的 `</invoke>` 会再还原一个重复闭标签落进正文。
			// 注意**不能**对「普通闭标签」再做重复删除——早闭合孤儿参数形态（同一任务 msg1）
			// 的第二个 `</write_to_file>` 是模型自我纠正后的真实闭标签，删掉它孤儿归并就失效了。
			if (openTagName && toolParamNames.includes(openTagName as never)) {
				openParam = openTagName
			} else if (closeTagName && toolParamNames.includes(closeTagName as never)) {
				openParam = null
			} else if (openTagName && knownTools.has(openTagName)) {
				openTool = openTool ?? openTagName
			} else if (closeTagName && knownTools.has(closeTagName) && openTool === closeTagName) {
				openTool = null
			}
			return match
		},
	)

	// 清掉可能因此产生的 `</ parameter>`（分隔符被移除后残留的空格）
	return normalized.replace(/<\/\s+(parameter|tool_name|server_name)>/g, "</$1>")
}

// era harness: 模型把原生 function-call 标记泄漏成正文时，参数常用 Anthropic 风格
// `<parameter name="X">…</parameter>`（或小米官方训练模板的 `<parameter=X>` 等号形式，
// 见 知识库/18 §18.15）而不是 Cline 的 `<X>…</X>`，闭合标签也常错配（</parameter> 关
// <regex>、孤儿 </invoke>、重复 </工具> 等）。已观测到三类来源：
//
//   ① Kilo 免费候选 dots-3-note：`<dots_function_call>` 包裹 + Anthropic 参数标签
//     （2026-10-19 真实任务 1792367599710 取证）；
//   ② MiMo/Qwen 方言：`<tool_call><function=NAME>` 包裹 + `</parameter>` 错配闭合
//     （2026-10-24 真实任务 1792824509987 取证，包裹本身由 normalizeLeakedToolMarkup 还原）；
//   ③ 同一任务里 `</parameter>`/`</invoke>` 与包裹并存、闭合错配的残缺形态。
//
// 三个后果（与当初 dots 取证一致）：整块原样显示给用户；参数拿不到，报 missing
// required parameter 每回合重试；连续 3 次即 mistake_limit 中断。
//
// **激活必须以方言包裹证据为前提**（2026-10-24 自查收紧）：`<parameter name="...">`
// 在合法文件内容里完全可能出现，用 `<parameter` 本身做激活条件会把正文改坏。
// 证据取自**原始消息**（parseAssistantMessageV2 传入），因为开包裹可能已被
// normalizeLeakedToolMarkup 先行消费掉。无包裹的孤儿 `</parameter>`/`</invoke>`
// 因此保持原样（显示为文本）——宁可漏救也不腐蚀文件。
//
// 单趟扫描 + 参数栈：`<parameter name="X">`/`<parameter=X>` 与规范 `<X>` 开标签统一
// 压栈，`</parameter>` 弹栈顶还原成对应闭标签（栈空则删除），规范闭标签对称弹栈。
// 工具闭合同样记账：`</invoke>` 与 MiMo 模板的 `</function>` 都还原成当前工具闭标签；
// 其后再出现字面重复的 `</工具>` 时删除（2026-10-24 任务第 3-8 回合实测两者并存，
// 不删会留正文残留）。实现约束同 normalizeDsmlMarkup：必须单趟扫描，分几趟 replace
// 会把所有闭合都错配到最后一次打开的标签上。
function normalizeDotsFunctionCallMarkup(text: string, hasDialectWrapper: boolean): string {
	if (!text || !hasDialectWrapper) {
		return text
	}

	const knownParams = new Set<string>(toolParamNames)
	const knownTools = new Set<string>(getToolUseNames())

	let openTool: string | null = null
	let emittedToolClose: string | null = null
	const paramStack: string[] = []

	const pattern = new RegExp(
		[
			`</?\\s*dots_function_call\\s*>`,
			`<parameter\\s+name="([^"\\s>]+)[^>]*>`,
			`</\\s*parameter\\s*>`,
			`</?\\s*invoke\\s*>`,
			`<([a-z_][a-z0-9_]*)\\s*>`,
			`</([a-z_][a-z0-9_]*)\\s*>`,
			// 小米官方训练模板的参数开标签（等号、无引号）：<parameter=path>
			`<parameter=([A-Za-z_][A-Za-z0-9_]*)\\s*>`,
		].join("|"),
		"g",
	)

	const normalized = text.replace(
		pattern,
		(match, paramName?: string, openTagName?: string, closeTagName?: string, eqParamName?: string) => {
			if (match.includes("dots_function_call")) {
				return ""
			}
			// <parameter name="X"> → <X>，压栈
			if (paramName) {
				if (knownParams.has(paramName)) {
					paramStack.push(paramName)
					return `<${paramName}>`
				}
				return match
			}
			// <parameter=X>（等号形式）→ <X>，压栈；规则与上同
			if (eqParamName) {
				if (knownParams.has(eqParamName)) {
					paramStack.push(eqParamName)
					return `<${eqParamName}>`
				}
				return match
			}
			// </parameter> → 还原成栈顶参数的闭标签；栈空说明是孤儿闭合，删掉
			if (/^<\/\s*parameter/.test(match)) {
				const param = paramStack.pop()
				return param ? `</${param}>` : ""
			}
			// <invoke> 开包裹直接剥掉；</invoke> 还原成当前工具的闭标签
			if (/invoke/.test(match)) {
				if (match.startsWith("</")) {
					const tool = openTool
					openTool = null
					emittedToolClose = tool
					paramStack.length = 0
					return tool ? `</${tool}>` : ""
				}
				return ""
			}
			if (openTagName) {
				if (knownParams.has(openTagName)) {
					paramStack.push(openTagName)
				} else if (knownTools.has(openTagName)) {
					openTool = openTagName
					emittedToolClose = null
				}
				return match
			}
			if (closeTagName) {
				if (closeTagName === "function") {
					// MiMo 官方训练模板用 </function> 收口（开标签 <function=NAME> 已被
					// normalizeLeakedToolMarkup 还原，尾部的 </tool_call> 也在那里清掉）。
					// 按闭工具处理，官方模板形态的工具块才能完整闭合（回归测试要求非 partial）。
					const tool = openTool
					openTool = null
					emittedToolClose = tool
					paramStack.length = 0
					return tool ? `</${tool}>` : ""
				}
				if (knownParams.has(closeTagName)) {
					// 规范参数闭标签：对称弹栈（栈顶是别的参数=错配，同样弹掉、保留原样）。
					// 栈空是孤儿闭合（</invoke> 已代还过工具闭标签，其后残留的 </task_progress> 等），
					// 删掉避免落进正文。
					const param = paramStack.pop()
					return param === undefined ? "" : match
				}
				if (knownTools.has(closeTagName)) {
					if (emittedToolClose === closeTagName && openTool === null) {
						// </invoke>/</function> 已还原过同一个工具闭标签：这是重复闭合，删除
						return ""
					}
					if (openTool === closeTagName) {
						openTool = null
						emittedToolClose = closeTagName
						paramStack.length = 0
					}
					return match
				}
			}
			return match
		},
	)

	// 清掉可能因此产生的 `</ parameter>`（分隔符被移除后残留的空格），
	// 以及 `<function>`/`</function>` 方言包裹残留（`<function=未知名>` 带 `=`，不受影响）
	return normalized.replace(/<\/\s+(parameter|tool_name|server_name)>/g, "</$1>").replace(/<\/?\s*function\s*>/g, "")
}

// era harness（2026-10-25 真实任务 1792887990433 取证）：DeepSeek 把参数闭标签写成 DSML
// token（`</｜｜DSML｜｜ parameter>`）后**提前收口**了 write_to_file，随后把
// `<path>/<content>` 裸写在工具块外面、再补一个重复的 `</write_to_file>`。参数留在孤儿区
// 解析不进工具块 → 报 missing required parameter 反复重试。
// 修复：同一工具闭标签出现两次、且两次之间**只有已知参数标签对**时，删掉第一个闭标签，
// 让孤儿参数归回工具块。两道安全门：①孤儿区必须是纯参数对序列（含任何别的内容一律不动，
// 模型三次自我重试混着正文与残码的真实 msg1 就因此不触发，走原有报错自纠路径）；
// ②孤儿区必须带来首个块**缺失**的参数才值得并回，两次完全独立的正常调用不受影响。
// 孤儿区必须是「纯参数对序列」：状态机逐对扫描（开标签 → 字面 indexOf 找第一个对应的
// 闭标签 → 只允许空白间隔）。不能用单个正则 `^(?:<p>[\s\S]*?</p>)+$` 判定——实测
// （2026-10-25 msg1 全文形态）回溯会让惰性 `[\s\S]*?` 跨过第一个 `</path>`、吞掉正文与
// `<write_to_file>` 一直找到远处另一个 `</path>` 才闭合，纯度判定被击穿导致误归并。
function isPureParamPairRegion(region: string): boolean {
	const paramNames = (toolParamNames as readonly string[]).slice().sort((a, b) => b.length - a.length)
	let i = 0
	while (i < region.length) {
		while (i < region.length && /\s/.test(region[i])) i++
		if (i >= region.length) break
		let matched: string | undefined
		for (const p of paramNames) {
			if (region.startsWith(`<${p}>`, i)) {
				matched = p
				break
			}
		}
		if (!matched) return false
		i += matched.length + 2
		const closeIdx = region.indexOf(`</${matched}>`, i)
		if (closeIdx === -1) return false
		i = closeIdx + matched.length + 3
	}
	return true
}

function repairEarlyCloseOrphanParams(text: string): string {
	const toolNames = getToolUseNames()
	const paramNames = toolParamNames as readonly string[]
	const paramOpen = new RegExp(`<(${paramNames.join("|")})>`, "g")

	for (const tool of toolNames) {
		const closeTag = `</${tool}>`
		for (let first = text.indexOf(closeTag); first !== -1; first = text.indexOf(closeTag, first + 1)) {
			const second = text.indexOf(closeTag, first + closeTag.length)
			if (second === -1) break
			const region = text.slice(first + closeTag.length, second)
			if (!isPureParamPairRegion(region)) continue

			// 孤儿区带来的参数必须有一个是首块没有的
			const head = text.slice(0, first)
			const headOpenIdx = head.lastIndexOf(`<${tool}>`)
			if (headOpenIdx === -1) continue
			const headParams = new Set<string>()
			for (const m of head.slice(headOpenIdx).matchAll(paramOpen)) headParams.add(m[1])
			let brings = false
			for (const m of region.matchAll(paramOpen)) {
				if (!headParams.has(m[1])) brings = true
			}
			if (!brings) continue

			return text.slice(0, first) + text.slice(first + closeTag.length)
		}
	}
	return text
}

// era harness: 模型偶尔在开标签里多吐一个引号（实测 `<search_files">`），
// 而解析器用的是精确 `startsWith("<search_files>")`，于是整块退化成正文。
// 只对**已知的工具名/参数名**做这个修复，避免误伤 write_to_file 的正文内容。
function repairStrayQuoteInOpenTag(text: string): string {
	if (!text || text.indexOf('">') === -1) {
		return text
	}
	const known = new Set<string>([...getToolUseNames(), ...toolParamNames])
	return text.replace(/<([a-z_][a-z0-9_]*)\s*["'»]\s*>/g, (match, name: string) => (known.has(name) ? `<${name}>` : match))
}

/**
 * @description **Version 2**
 * Parses an assistant message string potentially containing mixed text and tool usage blocks
 * marked with XML-like tags into an array of structured content objects.
 *
 * This version aims for efficiency by avoiding the character-by-character accumulator of V1.
 * It iterates through the string using an index `i`. At each position, it checks if the substring
 * *ending* at `i` matches any known opening or closing tags for tools or parameters using `startsWith`
 * with an offset.
 * It uses pre-computed Maps (`toolUseOpenTags`, `toolParamOpenTags`) for quick tag lookups.
 * State is managed using indices (`currentTextContentStart`, `currentToolUseStart`, `currentParamValueStart`)
 * pointing to the start of the current block within the original `assistantMessage` string.
 * Slicing is used to extract content only when a block (text, parameter, or tool use) is completed.
 * Special handling for `write_to_file` and `new_rule` content parameters is included, using `indexOf`
 * and `lastIndexOf` on the relevant slice to handle potentially nested closing tags.
 * If the input string ends mid-block, the last open block is added and marked as partial.
 *
 * @param assistantMessage The raw string output from the assistant.
 * @returns An array of `AssistantMessageContent` objects, which can be `TextContent` or `ToolUse`.
 *          Blocks that were not fully closed by the end of the input string will have their `partial` flag set to `true`.
 */
export function parseAssistantMessageV2(rawMessage: string): AssistantMessageContent[] {
	// 方言包裹证据必须取自**原始消息**：normalizeLeakedToolMarkup 可能已把
	// `<tool_call><function=NAME>` 开包裹消费掉，事后再查就漏判了。
	// 闭包裹单独出现（流式截断残留）也算证据——闭包裹清理与参数归一都要它放行。
	const hasDialectWrapper = /<dots_function_call>|<\/?tool_call>|<\/?tool-call>|<function=/.test(rawMessage)
	// 顺序有讲究：
	// 1) leaked 包装（</tool_call>）先归一成 Cline 开标签；
	// 2) DSML 原生标记转 Cline XML —— 必须早于 task_progress 剥离，因为 DSML 里的
	//    <｜｜DSML｜｜ parameter name="task_progress"> 转出来正是 <task_progress>；
	// 3) dots-3-note 的 <dots_function_call> 包裹 + <parameter name="X"> 还原（同理必须早于 task_progress 剥离）；
	// 4) 剥离独立成段的 task_progress；
	// 5) 早闭合孤儿参数归并（必须在 task_progress 剥离之后：孤儿区里的 task_progress
	//    会破坏「纯参数对」判定）；
	// 6) 最后修开标签里多出来的引号（此时前面转出的标签也一并被照顾到）。
	const assistantMessage = repairStrayQuoteInOpenTag(
		repairEarlyCloseOrphanParams(
			stripTaskProgressMarkup(
				normalizeDotsFunctionCallMarkup(normalizeDsmlMarkup(normalizeLeakedToolMarkup(rawMessage)), hasDialectWrapper),
			),
		),
	)
	const contentBlocks: AssistantMessageContent[] = []
	let currentTextContentStart = 0 // Index where the current text block started
	let currentTextContent: TextStreamContent | undefined
	let currentToolUseStart = 0 // Index *after* the opening tag of the current tool use
	let currentToolUse: ToolUse | undefined
	let currentParamValueStart = 0 // Index *after* the opening tag of the current param
	let currentParamName: ToolParamName | undefined

	// Precompute tags for faster lookups
	const toolUseOpenTags = new Map<string, string>()
	const toolParamOpenTags = new Map<string, ToolParamName>()
	for (const name of getToolUseNames()) {
		toolUseOpenTags.set(`<${name}>`, name)
	}
	for (const name of toolParamNames) {
		toolParamOpenTags.set(`<${name}>`, name)
	}

	const len = assistantMessage.length
	for (let i = 0; i < len; i++) {
		const currentCharIndex = i

		// --- State: Parsing a Tool Parameter ---
		if (currentToolUse && currentParamName) {
			const closeTag = `</${currentParamName}>`
			// Check if the string *ending* at index `i` matches the closing tag
			if (
				currentCharIndex >= closeTag.length - 1 &&
				assistantMessage.startsWith(
					closeTag,
					currentCharIndex - closeTag.length + 1, // Start checking from potential start of tag
				)
			) {
				// Found the closing tag for the parameter
				let value = assistantMessage
					.slice(
						currentParamValueStart, // Start after the opening tag
						currentCharIndex - closeTag.length + 1, // End before the closing tag
					)
					.trim()
				// era harness: undo XML escaping for shell commands so they execute correctly.
				if (currentParamName === "command") {
					value = decodeCommandEntities(value)
				}
				currentToolUse.params[currentParamName] = value
				currentParamName = undefined // Go back to parsing tool content
				// We don't continue loop here, need to check for tool close or other params at index i
			} else {
				continue // Still inside param value, move to next char
			}
		}

		// --- State: Parsing a Tool Use (but not a specific parameter) ---
		if (currentToolUse && !currentParamName) {
			// Ensure we are not inside a parameter already
			// Check if starting a new parameter
			let startedNewParam = false
			for (const [tag, paramName] of toolParamOpenTags.entries()) {
				if (currentCharIndex >= tag.length - 1 && assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)) {
					currentParamName = paramName
					currentParamValueStart = currentCharIndex + 1 // Value starts after the tag
					startedNewParam = true
					break
				}
			}
			if (startedNewParam) {
				continue // Handled start of param, move to next char
			}

			// Check if closing the current tool use
			const toolCloseTag = `</${currentToolUse.name}>`
			if (
				currentCharIndex >= toolCloseTag.length - 1 &&
				assistantMessage.startsWith(toolCloseTag, currentCharIndex - toolCloseTag.length + 1)
			) {
				// End of the tool use found
				// Special handling for content params *before* finalizing the tool
				const toolContentSlice = assistantMessage.slice(
					currentToolUseStart, // From after the tool opening tag
					currentCharIndex - toolCloseTag.length + 1, // To before the tool closing tag
				)

				// Check if content parameter needs special handling (write_to_file/new_rule)
				// This check is important if the closing </content> tag was missed by the parameter parsing logic
				// (e.g., if content is empty or parsing logic prioritizes tool close)
				const contentParamName: ToolParamName = "content"
				if (
					currentToolUse.name === "write_to_file" /* || currentToolUse.name === "new_rule" */ &&
					toolContentSlice.includes(`<${contentParamName}>`)
				) {
					const contentStartTag = `<${contentParamName}>`
					const contentEndTag = `</${contentParamName}>`
					const contentStart = toolContentSlice.indexOf(contentStartTag)
					// Use lastIndexOf for robustness against nested tags
					const contentEnd = toolContentSlice.lastIndexOf(contentEndTag)

					if (contentStart !== -1 && contentEnd !== -1 && contentEnd > contentStart) {
						const contentValue = toolContentSlice.slice(contentStart + contentStartTag.length, contentEnd).trim()
						currentToolUse.params[contentParamName] = contentValue
					}
				}

				currentToolUse.partial = false // Mark as complete
				contentBlocks.push(currentToolUse)
				currentToolUse = undefined // Reset state
				currentTextContentStart = currentCharIndex + 1 // Potential text starts after this tag
				continue // Move to next char
			}
			// If not starting a param and not closing the tool, continue accumulating tool content implicitly
			continue
		}

		// --- State: Parsing Text / Looking for Tool Start ---
		if (!currentToolUse) {
			// Check if starting a new tool use
			let startedNewTool = false
			for (const [tag, toolName] of toolUseOpenTags.entries()) {
				if (currentCharIndex >= tag.length - 1 && assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)) {
					// End current text block if one was active
					if (currentTextContent) {
						currentTextContent.content = assistantMessage
							.slice(
								currentTextContentStart, // From where text started
								currentCharIndex - tag.length + 1, // To before the tool tag starts
							)
							.trim()
						currentTextContent.partial = false // Ended because tool started
						if (currentTextContent.content.length > 0) {
							contentBlocks.push(currentTextContent)
						}
						currentTextContent = undefined
					} else {
						// Check for any text between the last block and this tag
						const potentialText = assistantMessage
							.slice(
								currentTextContentStart, // From where text *might* have started
								currentCharIndex - tag.length + 1, // To before the tool tag starts
							)
							.trim()
						if (potentialText.length > 0) {
							contentBlocks.push({
								type: "text",
								content: potentialText,
								partial: false,
							})
						}
					}

					// Start the new tool use
					currentToolUse = {
						type: "tool_use",
						name: toolName as ClineDefaultTool,
						params: {},
						partial: true, // Assume partial until closing tag is found
						call_id: nanoid(8),
						isNativeToolCall: false,
					}
					currentToolUseStart = currentCharIndex + 1 // Tool content starts after the opening tag
					startedNewTool = true
					break
				}
			}

			if (startedNewTool) {
				continue // Handled start of tool, move to next char
			}

			// If not starting a tool, it must be text content
			if (!currentTextContent) {
				// Start a new text block if we aren't already in one
				currentTextContentStart = currentCharIndex // Text starts at the current character
				// Check if the current char is the start of potential text *immediately* after a tag
				// This needs the previous state - simpler to let slicing handle it later.
				// Resetting start index accurately is key.
				// It should be the index *after* the last processed tag.
				// The logic managing currentTextContentStart after closing tags handles this.

				currentTextContent = {
					type: "text",
					content: "", // Will be determined by slicing at the end or when a tool starts
					partial: true,
				}
			}
			// Continue accumulating text implicitly; content is extracted later.
		}
	} // End of loop

	// --- Finalization after loop ---

	// Finalize any open parameter within an open tool use
	if (currentToolUse && currentParamName) {
		let partialValue = assistantMessage.slice(currentParamValueStart) // From param start to end of string
		// era harness（2026-10-25 真实任务 1792887990433 取证）：流尾停在闭合标签中间时
		// （如 path 参数已收到 `_tmp_search6.py</path` 而 `>` 未到），半截闭标签残片会混进
		// 参数值，流式预览拿着脏路径去 mkdir 直接 EINVAL。只剥「当前参数闭标签的严格前缀」
		// 残片；最终值由主循环在闭标签完整到达时精确截取，不受此影响。
		const closeTag = `</${currentParamName}>`
		const lt = partialValue.lastIndexOf("<")
		if (lt !== -1) {
			const tail = partialValue.slice(lt)
			if (tail.length < closeTag.length && closeTag.startsWith(tail)) {
				partialValue = partialValue.slice(0, lt)
			}
		}
		currentToolUse.params[currentParamName] = partialValue.trim()
		// Tool use remains partial
	}

	// Finalize any open tool use (which might contain the finalized partial param)
	if (currentToolUse) {
		// Tool use is partial because the loop finished before its closing tag
		contentBlocks.push(currentToolUse)
	}
	// Finalize any trailing text content
	// Only possible if a tool use wasn't open at the very end
	else if (currentTextContent) {
		currentTextContent.content = assistantMessage
			.slice(currentTextContentStart) // From text start to end of string
			.trim()
		// Text is partial because the loop finished
		if (currentTextContent.content.length > 0) {
			contentBlocks.push(currentTextContent)
		}
	}

	return contentBlocks
}

import { ClineDefaultTool, getToolUseNames } from "@shared/tools"
import { nanoid } from "nanoid"
import { AssistantMessageContent, TextStreamContent, ToolParamName, ToolUse, toolParamNames } from "." // Assuming types are defined in index.ts or a similar file

// parseAssistantmessageV1 removed in https://github.com/cline/cline/pull/5425

// era harness: some models (observed GLM-5.3-Flash) leak native tool-call wrappers like
// `<tool_call>read_file<path>...</read_file>` in the text channel. Normalize the wrapper
// back to a Cline open tag so the parser below can execute it. No-op on well-formed XML.
function normalizeLeakedToolMarkup(text: string): string {
	if (!text) return text
	if (text.indexOf("<tool_call>") === -1 && text.indexOf("<tool-call>") === -1) return text
	const known = new Set(getToolUseNames())
	return text.replace(/<(?:tool_call|tool-call)>\s*([a-z_][a-z0-9_]*)\s*>?/g, (_m, name) =>
		known.has(name) ? "<" + name + ">" : _m,
	)
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

	const pattern = new RegExp(
		[
			`<${DSML_DELIMITER}\\s*invoke\\s+name="([^"]+)"\\s*>`, // 1: 开工具
			`</${DSML_DELIMITER}\\s*invoke\\s*>`, // 2: 关工具
			`<${DSML_DELIMITER}\\s*parameter\\s+name="([^"]+)"[^>]*>`, // 3: 开参数
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
			if (openTagName && toolParamNames.includes(openTagName as never)) {
				openParam = openTagName
			} else if (closeTagName && toolParamNames.includes(closeTagName as never)) {
				openParam = null
			}
			return match
		},
	)

	// 清掉可能因此产生的 `</ parameter>`（分隔符被移除后残留的空格）
	return normalized.replace(/<\/\s+(parameter|tool_name|server_name)>/g, "</$1>")
}

// era harness: Kilo 免费车道候选 dots-3-note（2026-10-19 真实任务 1792367599710 取证）把原生
// function_call 标记连同 Anthropic 风格参数标签一起泄漏成正文，形如：
//
//   <dots_function_call>
//   <read_file>
//   <parameter name="path">d:\...\x.ERB</parameter>
//   </invoke>
//   </dots_function_call>
//
// 三个后果：① 整块原样显示给用户；② 参数开标签不是 Cline 的 <path>，解析器拿不到参数，
// 报 missing required parameter 'path' 每回合重试；③ 连续 3 次即 mistake_limit 中断。
// 实测同一消息里会与规范 Cline XML 混用（<recursive> 与 <parameter> 并存），也可能一条消息
// 带多个 dots_function_call 块（真实任务第 2 回合即两块 read_file）。
//
// 按出现顺序单趟扫描：剥 dots_function_call 包裹、把参数开/闭标签还原成 Cline 的 <X>…</X>、
// 把 invoke 闭标签还原成当前工具闭标签。实现约束同 normalizeDsmlMarkup：单趟扫描 + 登记
// Cline 自身开/关标签（混用时若丢闭合，比不修更糟）。
function normalizeDotsFunctionCallMarkup(text: string): string {
	if (!text || !text.includes("<dots_function_call>")) return text

	let openTool: string | null = null
	let openParam: string | null = null
	const knownParams = new Set<string>(toolParamNames)
	const knownTools = new Set<string>(getToolUseNames())

	const pattern = new RegExp(
		[
			`</?\\s*dots_function_call\\s*>`,
			`<parameter\\s+name="([^"\\s>]+)[^>]*>`,
			`</\\s*parameter\\s*>`,
			`</?\\s*invoke\\s*>`,
			`<([a-z_][a-z0-9_]*)\\s*>`,
			`</([a-z_][a-z0-9_]*)\\s*>`,
		].join("|"),
		"g",
	)

	return text.replace(pattern, (match, paramName?: string, openTagName?: string, closeTagName?: string) => {
		if (match.includes("dots_function_call")) {
			return ""
		}
		if (paramName) {
			if (knownParams.has(paramName)) {
				openParam = paramName
				return `<${paramName}>`
			}
			return match
		}
		if (/^<\/\s*parameter/.test(match)) {
			const param = openParam
			openParam = null
			return param ? `</${param}>` : ""
		}
		if (/invoke/.test(match)) {
			if (match.startsWith("</")) {
				const tool = openTool
				openTool = null
				return tool ? `</${tool}>` : ""
			}
			return ""
		}
		if (openTagName) {
			if (knownParams.has(openTagName)) {
				openParam = openTagName
			} else if (knownTools.has(openTagName)) {
				openTool = openTagName
			}
			return match
		}
		if (closeTagName) {
			if (knownParams.has(closeTagName)) {
				openParam = null
			} else if (knownTools.has(closeTagName)) {
				openTool = null
			}
			return match
		}
		return match
	})
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
	// 顺序有讲究：
	// 1) leaked 包装（</tool_call>）先归一成 Cline 开标签；
	// 2) DSML 原生标记转 Cline XML —— 必须早于 task_progress 剥离，因为 DSML 里的
	//    <｜｜DSML｜｜ parameter name="task_progress"> 转出来正是 <task_progress>；
	// 3) dots-3-note 的 <dots_function_call> 包裹 + <parameter name="X"> 还原（同理必须早于 task_progress 剥离）；
	// 4) 剥离独立成段的 task_progress；
	// 5) 最后修开标签里多出来的引号（此时前面转出的标签也一并被照顾到）。
	const assistantMessage = repairStrayQuoteInOpenTag(
		stripTaskProgressMarkup(normalizeDotsFunctionCallMarkup(normalizeDsmlMarkup(normalizeLeakedToolMarkup(rawMessage)))),
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
		currentToolUse.params[currentParamName] = assistantMessage
			.slice(currentParamValueStart) // From param start to end of string
			.trim()
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

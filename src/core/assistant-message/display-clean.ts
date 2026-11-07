// era harness: 正文展示净化（presentAssistantMessage 的 text 分支专用纯函数，便于单测）。
//
// 2026-10-25 真实任务 1792888515757 取证（MiMo）：方言工具调用在流式截断点把
// `<tool_call><function=search` 原样 say 成了正文。两个缺口：
// 1. 既有的「尾部不完整标签裁剪」只认纯字母标签名（/^[a-zA-Z_]+$/），带 `=` 的
//    `<function=search` 不匹配，裁不掉；
// 2. 完整的 `<tool_call>` 开包裹残片全程无人清理（解析层只处理已知工具名的组合）。
// 另外已渲染的 partial say:text 在文本块变成工具块后无人回收，所以必须在**渲染前**
// 就把残片清干净，而不是事后撤回。
//
// 政策与解析层归一化对齐：`</tool_call>` 无条件删除（normalizeLeakedToolMarkup 同款），
// `<function=NAME>`/`</function>` 方言包裹删除（normalizeDotsFunctionCallMarkup 尾部同款），
// thinking/function_calls 清理维持原行为。
//
// 2026-10-25 追加（任务 1792900662485 turn 27/29/32 取证）：模型补发上一个工具的迟到
// 闭标签（`</era_symbols>`），整段落成独立文本块反复出现在聊天区；同任务第三方端点
// （08 #46）整块 DSML 标记落正文。两类残片在此清理，解析层不管展示。
import { getToolUseNames } from "@shared/tools"

const KNOWN_TOOL_NAMES = new Set(getToolUseNames())

/**
 * 清理 `<reasoning>` 段（08 #83）。
 *
 * 背景：GLM / hermes 变体的提示词明确要求模型「在 <reasoning> 里思考」，而这两家
 * （实测 GLM-4.6V-Flash）不返回 `reasoning_content`，思考全落在正文里，标签与内容一起
 * 渲染到聊天区——用户看到的是一大段「自己跟自己说话」，还会把模型幻觉当成事实读。
 *
 * 只要不是行首的 `<reasoning>` 都不动：`<thinking>` 那套「只去标签」在这里不够——
 * 内容留在正文才是问题；但反过来把代码里讨论标签的文字整段删掉同样是事故。
 */
export function stripReasoningSegments(text: string): string {
	// 1) 行首开始的完整段：连内容一起删（顺带吃掉段尾换行，避免留空行）
	let out = text.replace(/(^|\n)[ \t]*<reasoning>[\s\S]*?<\/reasoning>[ \t]*\r?\n?/g, "$1")
	// 2) 行首开始但没闭合（流式截断 / 模型漏闭）：连同前导换行一起删到正文末尾
	out = out.replace(/(^|\n)[ \t]*<reasoning>[\s\S]*$/g, "")
	// 3) 单独成行的孤立闭标签（块已在上一步被删时它常单独残留）
	out = out.replace(/^[ \t]*<\/reasoning>[ \t]*\r?\n?/gm, "")
	return out
}

export function cleanAssistantTextForDisplay(rawContent: string, isPartial: boolean): string {
	let content = rawContent
	if (!content) {
		return content
	}

	// 方言包裹残片：完整的 <tool_call>/<tool-call>/</tool_call>/… 与 <function=NAME> 开标记。
	// 流式半截形态（`<function=search` 无 `>`）交给尾部裁剪处理。
	content = content.replace(/<\/?tool_call>|<\/?tool-call>|<\/?\s*function\s*>|<function=[a-zA-Z0-9_]+>/g, "")

	// DSML 控制分隔符的标签形态（含单/双竖线与属性）：解析层修复失败时的展示兜底。
	// 只清理 `<...>` 包住的形态，正文里孤立讨论 DSML 字样的文本不动。
	content = content.replace(/<\/?[｜|│\u2502]{1,3}\s*DSML\s*[｜|│\u2502]{1,3}[^>]*>/g, "")

	// 整块恰为已知工具的闭标签（如 `</era_symbols>`）：迟到闭标签残片，无信息量，清掉。
	const trimmed = content.trim()
	if (/^<\/[a-z_][a-z0-9_]*>$/.test(trimmed) && KNOWN_TOOL_NAMES.has(trimmed.slice(2, -1))) {
		return ""
	}

	// (have to do this for partial and complete since sending content in thinking tags to markdown renderer will automatically be removed)
	content = content.replace(/<thinking>\s?/g, "")
	content = content.replace(/\s?<\/thinking>/g, "")

	// 08 #83：GLM / hermes 的 `<reasoning>` 段（内容不能留，见 stripReasoningSegments）
	content = stripReasoningSegments(content)

	// Remove all instances of <think> tags (alternative to <thinking>, some models are trained to use this tag instead)
	content = content.replace(/<think>\s?/g, "")
	content = content.replace(/\s?<\/think>/g, "")

	// New claude models tend to output <function_calls> tags which we don't want to show in the chat
	content = content.replace(/<function_calls>\s?/g, "")
	content = content.replace(/\s?<\/function_calls>/g, "")

	// Remove partial XML tag at the very end of the content (for tool use and thinking tags)
	// (prevents scrollview from jumping when tags are automatically removed)
	const lastOpenBracketIndex = content.lastIndexOf("<")
	if (lastOpenBracketIndex !== -1) {
		const possibleTag = content.slice(lastOpenBracketIndex)
		// Check if there's a '>' after the last '<' (i.e., if the tag is complete) (complete thinking and tool tags will have been removed by now)
		const hasCloseBracket = possibleTag.includes(">")
		if (!hasCloseBracket) {
			// Extract the potential tag name
			let tagContent: string
			if (possibleTag.startsWith("</")) {
				tagContent = possibleTag.slice(2).trim()
			} else {
				tagContent = possibleTag.slice(1).trim()
			}
			// 扩展（2026-10-25 MiMo 取证）：兼容方言等号形态的半截开标签（`<function=search`），
			// 纯字母的既有判定保留。
			// 扩展（2026-10-25 DSML 单竖线取证，08 #46）：分隔符以竖线开头，截断在
			// `<｜DS`/`</｜` 时不是 ASCII 标签名，须按「标签起始 + 竖线」识别为半截标签。
			const isLikelyTagName =
				/^[a-zA-Z_][a-zA-Z0-9_]*(?:=[a-zA-Z0-9_]*)?$/.test(tagContent) || /^<\/?[｜|│\u2502]/.test(possibleTag)
			// Preemptively remove < or </ to keep from these artifacts showing up in chat (also handles closing thinking tags)
			const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"
			// If the tag is incomplete and at the end, remove it from the content
			if (isOpeningOrClosing || isLikelyTagName) {
				content = content.slice(0, lastOpenBracketIndex).trim()
			}
		}
	}

	if (!isPartial) {
		// Some models add code block artifacts (around the tool calls) which show up at the end of text content
		// matches ``` with at least one char after the last backtick, at the end of the string
		const match = content.trimEnd().match(/```[a-zA-Z0-9_-]+$/)
		if (match) {
			const matchLength = match[0].length
			content = content.trimEnd().slice(0, -matchLength)
		}
	}

	return content
}

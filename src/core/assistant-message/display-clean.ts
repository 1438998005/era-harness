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
export function cleanAssistantTextForDisplay(rawContent: string, isPartial: boolean): string {
	let content = rawContent
	if (!content) {
		return content
	}

	// 方言包裹残片：完整的 <tool_call>/<tool-call>/</tool_call>/… 与 <function=NAME> 开标记。
	// 流式半截形态（`<function=search` 无 `>`）交给尾部裁剪处理。
	content = content.replace(/<\/?tool_call>|<\/?tool-call>|<\/?\s*function\s*>|<function=[a-zA-Z0-9_]+>/g, "")

	// (have to do this for partial and complete since sending content in thinking tags to markdown renderer will automatically be removed)
	content = content.replace(/<thinking>\s?/g, "")
	content = content.replace(/\s?<\/thinking>/g, "")

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
			const isLikelyTagName = /^[a-zA-Z_][a-zA-Z0-9_]*(?:=[a-zA-Z0-9_]*)?$/.test(tagContent)
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

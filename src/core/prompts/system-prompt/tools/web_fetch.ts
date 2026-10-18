import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const DESCRIPTION_GENERIC_EN = `Fetches content from a specified URL and returns it as markdown
- Takes a URL as input and returns the page's markdown content
- The returned content is for you to read and analyze directly
- Use this tool when you need to retrieve web content (documentation, articles, error pages)
- IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions.
- The URL must be a fully-formed valid http(s) URL
- This tool is read-only and does not modify any files`

const DESCRIPTION_GENERIC_ZH_CN = `从指定的 URL 获取内容并返回 markdown 正文
- 接受 URL 作为输入，返回网页的 markdown 正文
- 返回的内容由你自己阅读和分析
- 当您需要检索网络内容（文档、文章、报错页面）时，请使用此工具
- 重要提示：如果提供了 MCP 提供的网络获取工具，请优先使用该工具而不是此工具，因为它可能具有更少的限制。
- URL 必须是完整格式的有效 http(s) URL
- 此工具是只读的，不会修改任何文件`

const DESCRIPTION_NATIVE_EN =
	"Fetches content from a specified URL and returns it as markdown. IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions."

const DESCRIPTION_NATIVE_ZH_CN =
	"从指定的 URL 获取内容并返回 markdown 正文。重要提示：如果提供了 MCP 提供的网络获取工具，请优先使用该工具而不是此工具，因为它可能具有更少的限制。"

const INSTRUCTION_URL_EN = "The URL to fetch content from"
const INSTRUCTION_URL_ZH_CN = "要从中获取内容的 URL"

const INSTRUCTION_PROMPT_GENERIC_EN = "The prompt to use for analyzing the webpage content"
const INSTRUCTION_PROMPT_GENERIC_ZH_CN = "用于分析网页内容的提示"

const INSTRUCTION_PROMPT_NATIVE_EN = "Prompt for analyzing the webpage content"
const INSTRUCTION_PROMPT_NATIVE_ZH_CN = "用于分析网页内容的提示"

const GENERIC: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id: ClineDefaultTool.WEB_FETCH,
	name: "web_fetch",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_GENERIC_ZH_CN : DESCRIPTION_GENERIC_EN),
	contextRequirements: (context) => context.providerInfo.providerId === "deepseek",
	parameters: [
		{
			name: "url",
			required: true,
			instruction: (context: SystemPromptContext) => (isZhCN(context.locale) ? INSTRUCTION_URL_ZH_CN : INSTRUCTION_URL_EN),
			usage: "https://example.com/docs",
		},
		{
			name: "prompt",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_PROMPT_GENERIC_ZH_CN : INSTRUCTION_PROMPT_GENERIC_EN,
			usage: "Summarize the main points and key takeaways",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	variant: ModelFamily.NATIVE_NEXT_GEN,
	id: ClineDefaultTool.WEB_FETCH,
	name: "web_fetch",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_NATIVE_ZH_CN : DESCRIPTION_NATIVE_EN),
	contextRequirements: (context) => context.providerInfo.providerId === "deepseek",
	parameters: [
		{
			name: "url",
			required: true,
			instruction: (context: SystemPromptContext) => (isZhCN(context.locale) ? INSTRUCTION_URL_ZH_CN : INSTRUCTION_URL_EN),
		},
		{
			name: "prompt",
			required: true,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_PROMPT_NATIVE_ZH_CN : INSTRUCTION_PROMPT_NATIVE_EN,
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NATIVE_GPT_5: ClineToolSpec = {
	...NATIVE_NEXT_GEN,
	variant: ModelFamily.NATIVE_GPT_5,
}

export const web_fetch_variants = [GENERIC, NATIVE_GPT_5, NATIVE_NEXT_GEN]

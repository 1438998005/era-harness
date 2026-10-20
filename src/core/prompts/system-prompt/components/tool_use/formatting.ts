import { isZhCN } from "../../i18n/getLocaleText"
import { TemplateEngine } from "../../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../../types"

export async function getToolUseFormattingSection(_variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	// Return the placeholder that will be replaced with actual tools
	const isZh = isZhCN(context.locale)
	const template = isZh ? TOOL_USE_FORMATTING_TEMPLATE_TEXT_ZH_CN : TOOL_USE_FORMATTING_TEMPLATE_TEXT

	const focusChainEnabled = context.focusChainSettings?.enabled

	const templateEngine = new TemplateEngine()
	return templateEngine.resolve(template, context, {
		FOCUS_CHATIN_FORMATTING: focusChainEnabled ? FOCUS_CHATIN_FORMATTING_TEMPLATE : "",
	})
}

const FOCUS_CHATIN_FORMATTING_TEMPLATE = `<task_progress>
Checklist here (optional)
</task_progress>
`

const TOOL_USE_FORMATTING_TEMPLATE_TEXT = `# Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is the outer tag; each parameter is an inner tag whose name must exactly match the parameter name declared by that tool.

Real example with two required parameters:

<execute_command>
<command>npm run build</command>
<requires_approval>false</requires_approval>
</execute_command>

Real example with one required parameter:

<read_file>
<path>src/main.js</path>
{{FOCUS_CHATIN_FORMATTING}}</read_file>

Never emit placeholder tags such as <tool_name> or <parameter1_name> — those are documentation wording, not real tags. Every parameter the tool declares as required must appear as its own tag.

Always adhere to this format for the tool use to ensure proper parsing and execution.`

const TOOL_USE_FORMATTING_TEMPLATE_TEXT_ZH_CN = `# 工具使用格式

工具使用使用 XML 风格的标签。工具名是最外层标签；每个参数是一个内层标签，标签名必须与该工具声明的参数名完全一致。

含两个必填参数的真实示例：

<execute_command>
<command>npm run build</command>
<requires_approval>false</requires_approval>
</execute_command>

含一个必填参数的真实示例：

<read_file>
<path>src/main.js</path>
{{FOCUS_CHATIN_FORMATTING}}</read_file>

绝不要输出 <tool_name>、<parameter1_name> 这类占位标签——它们只是文档措辞，不是真实标签。工具声明的每个必填参数都要以自己的标签出现。

始终遵循此格式进行工具使用，以确保正确的解析和执行。`

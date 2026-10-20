import { isZhCN } from "../i18n/getLocaleText"
import { SystemPromptSection } from "../templates/placeholders"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const FEEDBACK_TEMPLATE_TEXT = `
If the user asks for help or wants to give feedback inform them of the following:
- To give feedback, users should report the issue using the /reportbug slash command in the chat.`

const FEEDBACK_TEMPLATE_TEXT_ZH_CN = `
如果用户寻求帮助或想要提供反馈，请告知他们以下信息：
- 如需提供反馈，用户应在聊天中使用 /reportbug 斜杠命令报告问题。`

export async function getFeedbackSection(variant: PromptVariant, context: SystemPromptContext): Promise<string | undefined> {
	if (!context.focusChainSettings?.enabled) {
		return undefined
	}

	const defaultTemplate = isZhCN(context.locale) ? FEEDBACK_TEMPLATE_TEXT_ZH_CN : FEEDBACK_TEMPLATE_TEXT
	const template = variant.componentOverrides?.[SystemPromptSection.FEEDBACK]?.template || defaultTemplate

	return new TemplateEngine().resolve(template, context, {})
}

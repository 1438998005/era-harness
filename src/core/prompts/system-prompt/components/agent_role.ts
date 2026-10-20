import { isZhCN } from "../i18n/getLocaleText"
import { SystemPromptSection } from "../templates/placeholders"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const AGENT_ROLE_EN = [
	"You are era harness,",
	"an AI development assistant purpose-built for eraTW 画蛇添足版 (the Emuera engine),",
	"skilled at safely reading and writing CP932/UTF-8 ERB/ERH/CSV scripts, parsing engine logs, and following reviewable, minimal-diff change workflows.",
]

const AGENT_ROLE_ZH_CN = [
	"你是 era harness，",
	"一个专为 eraTW 画蛇添足版（Emuera 引擎）打造的 AI 开发助手，",
	"擅长安全读写 CP932/UTF-8 的 ERB/ERH/CSV 脚本、解析引擎日志，并遵循可审、最小差异的改动流程。",
]

export async function getAgentRoleSection(variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const roleText = isZhCN(context.locale) ? AGENT_ROLE_ZH_CN.join("") : AGENT_ROLE_EN.join(" ")
	const template = variant.componentOverrides?.[SystemPromptSection.AGENT_ROLE]?.template || roleText

	return new TemplateEngine().resolve(template, context, {})
}

import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"

const id = ClineDefaultTool.GLOBAL_MEMORY

const DESCRIPTION_EN = `Read or write the user's GLOBAL memory: long-lived preferences that apply across every project (how they want to be addressed, answer language, working style, general conventions).
This is NOT project knowledge. Never store project paths, file names, variable names, task details or one-off decisions here - those belong in the project itself. NEVER store secrets, passwords, tokens, emails, phone numbers or any personal identifier.
mode=list shows every entry; mode=add appends a new entry; mode=update rewrites an existing entry (needs entry_id); mode=remove deletes one entry (needs entry_id). There is no clear-all: only the user can wipe everything from Settings.
Always list before adding: if a similar entry already exists, update it instead of adding a duplicate.`

const DESCRIPTION_ZH_CN = `读写用户的「全局记忆」：跨所有项目长期有效的偏好（称呼、回答语言、工作习惯、通用约定）。
⛔ 这不是项目知识：不要记项目路径、文件名、变量名、任务细节或一次性决定，那些属于项目自身。⛔ 绝不记密钥、密码、token、邮箱、电话等任何个人信息。
mode=list 列出全部条目；mode=add 新增一条；mode=update 改写已有条目（需要 entry_id）；mode=remove 删除一条（需要 entry_id）。没有「清空」：只有用户能在设置页清空全部。
新增前先 list：已有相近条目就用 update，不要重复添加。`

const INSTRUCTION_MODE_EN = "One of: list, add, update, remove."
const INSTRUCTION_MODE_ZH_CN = "取值：list、add、update、remove。"

const INSTRUCTION_ENTRY_ID_EN = "Exact entry id from mode=list. Required for update and remove."
const INSTRUCTION_ENTRY_ID_ZH_CN = "mode=list 返回的条目 id，update / remove 必填。"

const INSTRUCTION_TEXT_EN =
	"Entry text, at most 200 characters, one self-contained sentence stating a durable preference (e.g. 'Answer language: Simplified Chinese'). Required for add and update."
const INSTRUCTION_TEXT_ZH_CN = "条目正文，最多 200 字，一句话说清一条长期偏好（如「回答语言：简体中文」）。add / update 必填。"

const INSTRUCTION_TAGS_EN = "Optional comma-separated tags, e.g. 'preference,style'. Keep to 1-3 short tags."
const INSTRUCTION_TAGS_ZH_CN = "可选标签，用逗号分隔，如「偏好,风格」。1-3 个短标签即可。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "global_memory",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	// 关闭记忆或子代理运行时模型看不到该工具（关闭后既不读也不写）
	contextRequirements: (context: SystemPromptContext) => context.globalMemoryEnabled === true && !context.isSubagentRun,
	parameters: [
		{
			name: "mode",
			required: true,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_MODE_ZH_CN : INSTRUCTION_MODE_EN,
			usage: "list",
		},
		{
			name: "entry_id",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_ENTRY_ID_ZH_CN : INSTRUCTION_ENTRY_ID_EN,
			usage: "mem-abc123",
		},
		{
			name: "text",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_TEXT_ZH_CN : INSTRUCTION_TEXT_EN,
			usage: "回答语言：简体中文",
		},
		{
			name: "tags",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_TAGS_ZH_CN : INSTRUCTION_TAGS_EN,
			usage: "偏好,风格",
		},
	],
}

export const global_memory_variants = [generic]

import { SETTINGS_CATALOG } from "@eraharness/settings/index"
import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.SETTING_HELP

const DESCRIPTION_EN = `Look up what this extension's own settings do — "what is this toggle for", its default, its values, and what breaks when it is off. Only about era harness itself (not the EraBasic game project). Built into the extension, works offline, ${SETTINGS_CATALOG.length} entries. Pass key for one exact setting, query for keyword search, neither for the grouped catalog. Use it whenever the user asks about a switch, a default, or why an option is greyed out — do not guess from the UI text alone.`

const DESCRIPTION_ZH_CN = `查本扩展**自己**的设置项说明：「这个开关有什么用」、默认值、取值范围、关掉会怎样。只讲 era harness 自身，不讲 EraBasic 游戏工程。随插件内置、离线可用，共 ${SETTINGS_CATALOG.length} 项。给 key 查单个设置，给 query 按关键词检索，都不给则返回分组目录。使用者问某个开关 / 默认值 / 为什么不能点 / 关掉有什么影响时先查这里——⛔ 不要只看界面文案就猜。`

const INSTRUCTION_KEY_EN =
	"Setting key. Both feature ids (e.g. subagents, checkpoints, yolo, hooks) and full VS Code config keys (e.g. eraHarness.erabasic.autoTakeover) work; a unique suffix is enough."
const INSTRUCTION_KEY_ZH_CN =
	"设置键。功能开关的 id（如 subagents、checkpoints、yolo、hooks）和完整的 VS Code 配置键（如 eraHarness.erabasic.autoTakeover）都能用，写唯一后缀即可。"

const INSTRUCTION_QUERY_EN =
	"Keyword for search, when you do not know the key (e.g. checkpoint, subagent, compress, hooks, auto approve). Mixing Chinese and English is fine."
const INSTRUCTION_QUERY_ZH_CN = "不知道键名时用的关键词（如 检查点、子代理、压缩、钩子、自动批准），中英混排都行。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "setting_help",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	parameters: [
		{
			name: "key",
			required: false,
			instruction: (context: SystemPromptContext) => (isZhCN(context.locale) ? INSTRUCTION_KEY_ZH_CN : INSTRUCTION_KEY_EN),
			usage: "checkpoints",
		},
		{
			name: "query",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_QUERY_ZH_CN : INSTRUCTION_QUERY_EN,
			usage: "压缩",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const setting_help_variants = [generic]

import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.ERA_REFERENCE

const DESCRIPTION_EN =
	"Look up Emuera / EraBasic command documentation (parameters, return value, which engine builds support it, and notes). mode=lookup returns the full page for one command name; mode=search finds commands by keyword including Chinese prose in the body; mode=names lists every command the library knows. The library is bundled, so it works offline. Use this instead of guessing a signature or searching the web: EraBasic has hundreds of commands and the exact parameter order matters."

const DESCRIPTION_ZH_CN =
	"查 Emuera / EraBasic 指令手册：参数、返回值、支持的引擎版本（eramaker / Emuera / EM / EE / .NET / Skia），以及注意事项。mode=lookup 按名字取整页说明；mode=search 按关键词检索（正文中文也算）；mode=names 列出库里全部指令名。手册内置在插件里，离线可用。需要确认某个指令的参数顺序、返回值或它属于哪个引擎扩展时用这个，不要凭记忆写签名，也不要为此去搜网页。"

const INSTRUCTION_MODE_EN = "One of: lookup (default), search, names."
const INSTRUCTION_MODE_ZH_CN = "取值：lookup（默认）、search、names。"

const INSTRUCTION_NAME_EN =
	"Exact command name, case-insensitive (e.g. SETCOLOR, DT_ROW_ADD, PRINTFORMS). Required for mode=lookup."
const INSTRUCTION_NAME_ZH_CN = "精确的指令名，不区分大小写（如 SETCOLOR、DT_ROW_ADD、PRINTFORMS）。mode=lookup 时必填。"

const INSTRUCTION_QUERY_EN =
	"Keyword for mode=search. Prefer the command name or a short Chinese phrase (e.g. 颜色, 存档, DataTable)."
const INSTRUCTION_QUERY_ZH_CN = "mode=search 的关键词。优先用指令名或简短中文词（如 颜色、存档、DataTable）。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "era_reference",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	parameters: [
		{
			name: "mode",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_MODE_ZH_CN : INSTRUCTION_MODE_EN,
			usage: "lookup",
		},
		{
			name: "name",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_NAME_ZH_CN : INSTRUCTION_NAME_EN,
			usage: "SETCOLOR",
		},
		{
			name: "query",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_QUERY_ZH_CN : INSTRUCTION_QUERY_EN,
			usage: "颜色",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const era_reference_variants = [generic]

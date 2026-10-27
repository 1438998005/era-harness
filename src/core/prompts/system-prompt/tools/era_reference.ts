import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.ERA_REFERENCE

const DESCRIPTION_EN =
	"Look up Emuera / EraBasic documentation: parameters, return value, which engine builds support it, position rules for preprocessor directives, and notes. Covers the Reference API pages plus the Emuera syntax/spec pages and the tutorial pages (bundled snapshot, NOT the full upstream site). mode=lookup returns the page for one name (`#LOCALSIZE` and `LOCALSIZE` are equivalent); mode=search finds entries by keyword including Chinese prose; mode=names lists what the library actually contains. Works offline; when a name is missing locally it automatically tries the upstream docs site once. Use this instead of guessing a signature: EraBasic has hundreds of commands and the exact parameter order matters."

const DESCRIPTION_ZH_CN =
	"查 Emuera / EraBasic 文档：参数、返回值、支持的引擎版本（eramaker / Emuera / EM / EE / .NET / Skia）、预处理器的位置规则，以及注意事项。覆盖 **Reference API 页 + Emuera 语法/规格页 + tutorial 教程页**（内置快照，**不是上游全量**）。mode=lookup 按名字取说明（`#LOCALSIZE` 与 `LOCALSIZE` 等价）；mode=search 按关键词检索（正文中文也算）；mode=names 列出库里**实际收录**了什么。离线可用；本地没有的名字会自动去上游文档站检索一次。需要确认某个指令或预处理器（#LOCALSIZE / #DIM / #FUNCTION 等）的参数顺序、位置规则或属于哪个引擎扩展时用这个，⛔ 不要凭记忆写签名。"

const INSTRUCTION_MODE_EN = "One of: lookup (default), search, names."
const INSTRUCTION_MODE_ZH_CN = "取值：lookup（默认）、search、names。"

const INSTRUCTION_NAME_EN =
	"Exact command or directive name, case-insensitive, without a parameter list (e.g. SETCOLOR, DT_ROW_ADD, #LOCALSIZE, #DIM). Required for mode=lookup."
const INSTRUCTION_NAME_ZH_CN =
	"精确的指令名或预处理器名，不区分大小写，不要带参数列表（如 SETCOLOR、DT_ROW_ADD、#LOCALSIZE、#DIM）。mode=lookup 时必填。"

const INSTRUCTION_QUERY_EN =
	"Keyword for mode=search. Prefer the command name (Latin names match best) or a short Chinese phrase (e.g. 颜色, 存档, LOCALSIZE)."
const INSTRUCTION_QUERY_ZH_CN = "mode=search 的关键词。优先用指令原名（英文命中率最高）或简短中文词（如 颜色、存档、LOCALSIZE）。"

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

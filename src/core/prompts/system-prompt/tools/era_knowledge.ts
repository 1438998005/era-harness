import { KNOWLEDGE_ENTRIES } from "@eraharness/knowledge/index"
import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.ERA_KNOWLEDGE

const DESCRIPTION_EN =
	"Look up the built-in discipline/mechanism knowledge base for Emuera (EraBasic) script work: encoding discipline, upstream-merge gates, kojo naming & dispatch contracts, project structure and variable slots, the command lifecycle pipeline, OBJ/qol data conventions. mode=lookup returns one full entry (rules + pitfalls + body); mode=search finds entries by keyword; mode=list shows the catalog. Entries are bundled snapshots and work offline. Use this before reasoning about a mechanism you have not verified in this project's code: these are the traps that fail silently."

const DESCRIPTION_ZH_CN =
	"查内置的 Emuera / EraBasic 纪律与机制知识库：解释器编码纪律、上游内容合并闸门、口上命名与分发契约、工程结构与变量槽位、指令主流程与回合快照、OBJ/qol 数据层约定。mode=lookup 按 entry_id 取完整内容（铁律＋反模式＋正文）；mode=search 按关键词检索条目；mode=list 列出全部条目。知识库随插件内置，离线可用。凡「不看本工程代码就判不准的机制问题」先查这里——这些条目收的就是那些静默失效的坑。"

const INSTRUCTION_MODE_EN = "One of: lookup (default when entry_id is given), search (default when query is given), list."
const INSTRUCTION_MODE_ZH_CN = "取值：lookup（给了 entry_id 时默认）、search（给了 query 时默认）、list。"

/**
 * 条目清单从知识表**现算**（⛔ 手写枚举）：新增条目时这里的 id 列表与目录不会漂。
 */
const entryCatalog = KNOWLEDGE_ENTRIES.map((entry) => `${entry.id}（${entry.title.split("（")[0]}）`).join("、")

const INSTRUCTION_ID_EN = `Exact knowledge entry id, case-insensitive. Available: ${entryCatalog}. Required for mode=lookup.`
const INSTRUCTION_ID_ZH_CN = `精确的条目 id（entry_id），不区分大小写。可选：${entryCatalog}。mode=lookup 时必填。`

const INSTRUCTION_QUERY_EN =
	"Keyword for mode=search. Short terms work best, mixing Chinese and English is fine (e.g. BOM, RAND, M_KOJO, VariableSize, NOW_VERSION, O_DATA, DOTRAIN, SOURCE_CHECK)."
const INSTRUCTION_QUERY_ZH_CN =
	"mode=search 的关键词，短词更好，中英混排都行（如 BOM、RAND、口上、槽位、容量、NOW_VERSION、O_DATA、DOTRAIN、时序）。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "era_knowledge",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	parameters: [
		{
			name: "mode",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_MODE_ZH_CN : INSTRUCTION_MODE_EN,
			usage: "search",
		},
		{
			name: "entry_id",
			required: false,
			instruction: (context: SystemPromptContext) => (isZhCN(context.locale) ? INSTRUCTION_ID_ZH_CN : INSTRUCTION_ID_EN),
			usage: "project-structure-discipline",
		},
		{
			name: "query",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_QUERY_ZH_CN : INSTRUCTION_QUERY_EN,
			usage: "NOW_VERSION",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const era_knowledge_variants = [generic]

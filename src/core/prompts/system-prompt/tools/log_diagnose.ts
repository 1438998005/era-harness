import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.LOG_DIAGNOSE

const DESCRIPTION_EN =
	"Parse an Emuera runtime log and return the engine version, fatal errors, and a classified list of diagnostics (undefined identifiers, unbalanced blocks, unparseable lines). The log file is auto-discovered anywhere in the workspace, so the path does not need to be known up front. Use this instead of reading raw logs when the game fails to start or shows an error dialog."

const DESCRIPTION_ZH_CN =
	"解析 Emuera 运行日志，返回引擎版本、致命错误，以及分类后的诊断清单（未定义标识符、控制流不配平、无法解析的行等）。日志文件会在工作区里自动查找，不需要事先知道路径。游戏启动失败或弹出错误框时优先用这个工具，不要直接读原始日志。"

const INSTRUCTION_LOG_PATH_EN =
	"Optional path to a specific log file (relative to {{CWD}} or an absolute path inside the workspace). Omit to auto-detect the newest .log anywhere in the workspace."
const INSTRUCTION_LOG_PATH_ZH_CN =
	"可选：指定日志文件路径（相对 {{CWD}}，或工作区内的绝对路径）。省略时自动在工作区里查找最新的 .log。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "log_diagnose",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	parameters: [
		{
			name: "log_path",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_LOG_PATH_ZH_CN : INSTRUCTION_LOG_PATH_EN,
			usage: "(optional) path/to/file.log",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const log_diagnose_variants = [generic]

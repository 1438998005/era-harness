import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.ERA_SYMBOLS

const DESCRIPTION_EN =
	"Locate EraBasic symbols in the Emuera project(s) found in this workspace. kind=label finds `@label` definitions (file:line), kind=call finds CALL/JUMP/GOTO call sites, kind=file finds script files by name. Comments and strings are filtered out, so results are real symbols. The project root is detected at runtime, so it works even when the game sits in a subfolder or the script directory has been renamed. Use this instead of search_files when you need to know where a function or character script lives."

const DESCRIPTION_ZH_CN =
	"在工作区里探测到的 Emuera 工程中定位 EraBasic 符号。kind=label 查 `@标签` 定义（文件:行号），kind=call 查 CALL/JUMP/GOTO 调用点，kind=file 按文件名查脚本。结果已过滤掉注释和字符串里的假标签。工程根是运行时探测的，所以游戏放在子目录或脚本目录被改名时也能用。需要知道某个函数或某段口上在哪个文件时，优先用这个工具。"

const INSTRUCTION_QUERY_EN = "Label name, call target, or file name keyword (case-insensitive)."
const INSTRUCTION_QUERY_ZH_CN = "标签名、调用目标名或文件名关键字（不区分大小写）。"

const INSTRUCTION_KIND_EN = "One of: label (default), call, file."
const INSTRUCTION_KIND_ZH_CN = "取值：label（默认）、call、file。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "era_symbols",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	parameters: [
		{
			name: "query",
			required: true,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_QUERY_ZH_CN : INSTRUCTION_QUERY_EN,
			usage: "KOJO_K58 or TRAIN_NAME",
		},
		{
			name: "kind",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_KIND_ZH_CN : INSTRUCTION_KIND_EN,
			usage: "label",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const era_symbols_variants = [generic]

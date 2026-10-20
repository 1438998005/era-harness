import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.RUN_GAME

const DESCRIPTION_EN =
	"Launch the Emuera engine found in this workspace, wait for it to settle, and report process state plus load evidence (whether the lazyloading index was rebuilt) and any freshly written log diagnostics. Use this to verify an edit actually loads. The engine does not write game logs while sitting on the title screen, so 'no new log' is not a failure by itself - read the load evidence section. This starts a real game window and causes the engine to rewrite its own files in the game folder. Only run it when the user asked for a live test; do not use it as a substitute for reading code."

const DESCRIPTION_ZH_CN =
	"启动工作区里探测到的 Emuera 引擎，等它加载完，然后报告进程状态、加载痕迹（lazyloading 索引有没有重建）以及本次新写出的日志诊断。用来验证改动是否真能加载。引擎停在标题画面时不会写游戏日志，所以「日志没变」本身不代表失败，要看加载痕迹那一节。这会真实弹出游戏窗口，并让引擎重写游戏目录里它自己的文件。只在用户要求实测时使用，不要拿它代替读代码。"

const INSTRUCTION_ACTION_EN = "One of: run (default), status, stop."
const INSTRUCTION_ACTION_ZH_CN = "取值：run（默认）、status、stop。"

const INSTRUCTION_EXE_EN =
	"Optional engine file name or path fragment (e.g. Emuera_skiaV10_x64.exe or V10). Omit to use the newest version."
const INSTRUCTION_EXE_ZH_CN = "可选的引擎文件名或路径片段（如 Emuera_skiaV10_x64.exe 或 V10）。省略则用最新版本。"

const INSTRUCTION_DEBUG_EN = "true (default) launches with -Debug so the debug window is available."
const INSTRUCTION_DEBUG_ZH_CN = "true（默认）表示带 -Debug 启动，可打开调试窗口。"

const INSTRUCTION_WAIT_EN = "Seconds to wait before reporting, 3-120 (default 12). Large games need longer to load."
const INSTRUCTION_WAIT_ZH_CN = "启动后等待多少秒再报告，3-120（默认 12）。脚本量大的工程需要更久。"

const INSTRUCTION_KEEP_ALIVE_EN =
	"true keeps the game running after the report so the user can play; false (default) closes it. Closing does not save progress."
const INSTRUCTION_KEEP_ALIVE_ZH_CN = "true 表示报告后保留游戏窗口供用户操作；false（默认）报告完关闭。关闭不会保存进度。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "run_game",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	parameters: [
		{
			name: "action",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_ACTION_ZH_CN : INSTRUCTION_ACTION_EN,
			usage: "run",
		},
		{
			name: "exe",
			required: false,
			instruction: (context: SystemPromptContext) => (isZhCN(context.locale) ? INSTRUCTION_EXE_ZH_CN : INSTRUCTION_EXE_EN),
			usage: "Emuera_skiaV16_x64.exe",
		},
		{
			name: "debug",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_DEBUG_ZH_CN : INSTRUCTION_DEBUG_EN,
			usage: "true",
		},
		{
			name: "wait_seconds",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_WAIT_ZH_CN : INSTRUCTION_WAIT_EN,
			usage: "12",
		},
		{
			name: "keep_alive",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_KEEP_ALIVE_ZH_CN : INSTRUCTION_KEEP_ALIVE_EN,
			usage: "false",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const run_game_variants = [generic]

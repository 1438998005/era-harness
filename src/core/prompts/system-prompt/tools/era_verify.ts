import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import { isZhCN } from "../i18n/getLocaleText"
import type { ClineToolSpec } from "../spec"
import type { SystemPromptContext } from "../types"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.ERA_VERIFY

const DESCRIPTION_EN =
	"Autonomously verify an era game for errors by driving the Emuera engine's built-in --CliDebug protocol (engine 15.0.0+): the engine runs unattended, you receive its console output and warnings, then the engine closes itself. Two modes. mode=parse: force-compile the ERB tree and collect ALL warnings (Lv1/Lv2 unfiltered) from stdout plus Analysis.log - use after editing ERB/CSV to catch syntax and load-time errors. mode=boot: fully launch to the title screen, pull the console buffer via the log command (errors scrolled away by the intro art are still in the buffer), then quit cleanly - use when in-game errors or missing-log situations need checking. The engine window appears briefly and the engine rewrites its own files (Analysis.log, lazyloading index, save artifacts); user approval is always required. Note: parse mode replays existing warnings - isolated bare-identifier warnings are usually false positives, prefer whole-tree targets over single files."

const DESCRIPTION_ZH_CN =
	"通过 Emuera 引擎自带的 --CliDebug 协议（引擎 15.0.0+）自主验证游戏报错：引擎无人值守运行，收它的控制台输出与警告，然后自动关闭。两种模式。mode=parse：强制编译 ERB 树并全量收集警告（Lv1/Lv2 不过滤），结果来自 stdout 与 Analysis.log——改完 ERB/CSV 后用它抓语法与加载期错误。mode=boot：完整启动到标题画面，用 log 命令取控制台缓冲（被开头字符画刷掉的报错也在缓冲里），再干净退出——需要确认启动后行为或没有日志文件时用它。引擎窗口会短暂出现，引擎会重写自己的文件（Analysis.log、懒加载索引、存档产物）；必须用户当面确认。注意：解析模式会回放存量警告——孤立的裸标识符警告多为伪阳性，优先整树跑而不是单文件。"

const INSTRUCTION_MODE_EN =
	"parse (default) force-compiles ERB and reports warnings; boot launches to the title screen and captures console errors."
const INSTRUCTION_MODE_ZH_CN = "parse（默认）强制编译 ERB 并收集警告；boot 启动到标题画面抓控制台报错。"

const INSTRUCTION_TARGET_EN =
	"parse mode only: an .ERB file or a directory (recursively compiled). Omit to use the detected ERB directory of the project."
const INSTRUCTION_TARGET_ZH_CN = "仅 parse 模式：.ERB 文件或目录（递归编译）。省略则用探测到的工程 ERB 目录。"

const INSTRUCTION_EXE_EN =
	"Optional engine file name or path fragment (e.g. Emuera_skiaV16_x64.exe or V16). Omit to use the newest version. Must be engine 15.0.0+."
const INSTRUCTION_EXE_ZH_CN =
	"可选的引擎文件名或路径片段（如 Emuera_skiaV16_x64.exe 或 V16）。省略则用最新版本。引擎必须 15.0.0+。"

const INSTRUCTION_TIMEOUT_EN =
	"Seconds to allow before force-closing the engine: parse 5-900 (default 300; whole-tree parsing of large games takes minutes), boot 5-300 (default 90)."
const INSTRUCTION_TIMEOUT_ZH_CN = "强杀引擎前允许的秒数：parse 5-900（默认 300；大工程整树解析要几分钟），boot 5-300（默认 90）。"

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "era_verify",
	description: (context: SystemPromptContext) => (isZhCN(context.locale) ? DESCRIPTION_ZH_CN : DESCRIPTION_EN),
	parameters: [
		{
			name: "mode",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_MODE_ZH_CN : INSTRUCTION_MODE_EN,
			usage: "parse",
		},
		{
			name: "target",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_TARGET_ZH_CN : INSTRUCTION_TARGET_EN,
			usage: "ERB",
		},
		{
			name: "exe",
			required: false,
			instruction: (context: SystemPromptContext) => (isZhCN(context.locale) ? INSTRUCTION_EXE_ZH_CN : INSTRUCTION_EXE_EN),
			usage: "Emuera_skiaV16_x64.exe",
		},
		{
			name: "timeout_seconds",
			required: false,
			instruction: (context: SystemPromptContext) =>
				isZhCN(context.locale) ? INSTRUCTION_TIMEOUT_ZH_CN : INSTRUCTION_TIMEOUT_EN,
			usage: "300",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const era_verify_variants = [generic]

/**
 * era harness 身份 = **文件修改权限范围**，不是对话风格/人格设定。
 *
 * 两种互斥范围（本体侧 / 口上侧）加一个放开档：
 * - self：可改系统文件（脚本目录里非口上的部分 + 定义表），口上目录需手动确认
 * - persona：可改口上目录，其余需手动确认
 * - unrestricted：不限文件
 *
 * 口上目录的实际位置由扩展侧在运行时探测（目录名、嵌套层级因整合包而异），
 * 所以这里的文案只说「口上目录」，不写具体路径。
 *
 * 跨范围修改一律先问用户，不自动落盘。
 * 身份通过每条用户消息前缀的 <era-identity> 块下发，切换对后续回合立即生效。
 */

export type IdentityMode = "self" | "persona" | "unrestricted"

export interface IdentityModeDef {
	id: IdentityMode
	label: string
	short: string
	hint: string
	description: string
	directive: string
	autoApproveAll: boolean
}

export const IDENTITY_MODES: IdentityModeDef[] = [
	{
		id: "self",
		label: "本体侧",
		short: "本体",
		hint: "仅系统文件",
		description:
			"可改：脚本目录里除口上目录以外的系统文件（SYSTEM / COMMON / DIM / Headers 等）与定义表目录下的 CSV。改口上目录需手动确认。",
		directive:
			"当前身份：本体侧（仅约束可写文件范围，不改变对话方式与任务风格）。\n" +
			"可直接修改：脚本目录里除口上目录以外的系统文件（SYSTEM / COMMON / DIM / Headers 等）与定义表目录下的 CSV。\n" +
			"需先手动确认：口上目录下的任何文件。需要改这类文件时，先说明原因与影响范围，等用户明确同意后再动手。\n" +
			"目录位置以运行时探测结果为准：不知道确切路径时用 era_symbols 或 search_files 先查，不要凭目录名习惯拼路径。",
		autoApproveAll: false,
	},
	{
		id: "persona",
		label: "口上（剧本）侧",
		short: "口上",
		hint: "仅口上文件",
		description: "可改：口上目录下的口上、EVENT_MESSAGE、KOJO 相关文件。改系统文件与 CSV 需手动确认。",
		directive:
			"当前身份：口上（剧本）侧（仅约束可写文件范围，不改变对话方式与任务风格）。\n" +
			"可直接修改：口上目录下的口上、EVENT_MESSAGE、KOJO 相关文件。\n" +
			"需先手动确认：该目录以外的任何文件（系统脚本、CSV、配置）。需要改这类文件时，先说明原因与影响范围，等用户明确同意后再动手。\n" +
			"目录位置以运行时探测结果为准：不确定某个文件是否属于口上目录时，先确认再改。",
		autoApproveAll: false,
	},
	{
		id: "unrestricted",
		label: "权限全开",
		short: "全开",
		hint: "不限文件",
		description:
			"不限文件范围，且工具批准档位开到最大（读写与命令不再逐条确认）。每次改动仍输出 diff 摘要，删除或覆盖前先备份。",
		directive:
			"当前身份：权限全开（仅约束可写文件范围，不改变对话方式与任务风格）。\n" +
			"可修改任意文件，读写与命令不再逐条确认，一次做完再汇报。\n" +
			"仍须：每次改动输出 diff 摘要；涉及删除或覆盖前先备份，并列出影响范围。",
		autoApproveAll: true,
	},
]

export const IDENTITY_STORAGE_KEY = "era.identity.mode"
export const IDENTITY_ASK_STORAGE_KEY = "era.identity.askOnNew"

const IDENTITY_TAG_RE = /^\s*<era-identity\s+mode="([a-z]+)"\s*>[\s\S]*?<\/era-identity>\s*/

export function getIdentityMode(id: string | null | undefined): IdentityModeDef {
	return IDENTITY_MODES.find((m) => m.id === id) ?? IDENTITY_MODES[0]
}

export function isIdentityMode(value: unknown): value is IdentityMode {
	return typeof value === "string" && IDENTITY_MODES.some((m) => m.id === value)
}

/** 把身份指令拼到消息前面，供模型读取。 */
export function buildIdentityDirective(mode: IdentityMode): string {
	const def = getIdentityMode(mode)
	return `<era-identity mode="${def.id}">\n${def.directive}\n</era-identity>\n\n`
}

/** 从已存消息里剥掉身份块，返回正文与身份。 */
export function splitIdentityDirective(text: string): { mode?: IdentityMode; body: string } {
	const match = text.match(IDENTITY_TAG_RE)
	if (!match) {
		return { body: text }
	}
	const mode = isIdentityMode(match[1]) ? match[1] : undefined
	return { mode, body: text.slice(match[0].length) }
}

export function readStoredIdentityMode(): IdentityMode {
	try {
		const raw = localStorage.getItem(IDENTITY_STORAGE_KEY)
		return isIdentityMode(raw) ? raw : "self"
	} catch {
		return "self"
	}
}

export function storeIdentityMode(mode: IdentityMode): void {
	try {
		localStorage.setItem(IDENTITY_STORAGE_KEY, mode)
	} catch {
		// localStorage 不可用时静默降级，仅影响下次默认值
	}
}

export function readAskOnNew(): boolean {
	try {
		return localStorage.getItem(IDENTITY_ASK_STORAGE_KEY) !== "0"
	} catch {
		return true
	}
}

export function storeAskOnNew(value: boolean): void {
	try {
		localStorage.setItem(IDENTITY_ASK_STORAGE_KEY, value ? "1" : "0")
	} catch {
		// 同上
	}
}

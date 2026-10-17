/**
 * era harness 身份模式定义。
 *
 * 三种身份不是「人格扮演开关」，而是**输出契约 + 权限档位**的组合：
 * - self：以助手本体直述，工程口径
 * - persona：以口上（剧本）侧产出，按既有角色设定走
 * - unrestricted：本体口径 + 全部工具权限放开
 *
 * 身份通过每条用户消息前缀的 <era-identity> 块下发给模型，
 * 因此对话中途切换即刻生效，不需要重建任务。
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
		hint: "直述 · 不演绎",
		description: "以助手本体直接对话。陈述事实与判断，不代入角色、不写口上、不替用户补设定。适合改代码、查问题、理结构。",
		directive:
			"当前身份：本体侧。以助手本体直接对话——陈述事实与判断，不代入角色、不写口上、不替用户补设定。回答先给结论，再给依据；不确定就说不确定。",
		autoApproveAll: false,
	},
	{
		id: "persona",
		label: "口上（剧本）侧",
		short: "口上",
		hint: "代入 · 按设定产出",
		description:
			"以口上（剧本）侧身份产出。台词与叙述保持人称、称谓、口癖一致，不跳出角色解释。技术性说明统一放进【场外】标注。",
		directive:
			"当前身份：口上（剧本）侧。以项目既有角色设定与口上语气产出——台词、叙述保持人称、称谓、口癖一致，不跳出角色解释。技术性说明、风险提醒、需要用户决策的事项，统一放在【场外】标注内，与正文分开。",
		autoApproveAll: false,
	},
	{
		id: "unrestricted",
		label: "权限全开",
		short: "全开",
		hint: "本体口径 · 免逐条确认",
		description:
			"本体口径 + 全部工具权限放开。读写与命令直接执行，不再逐条确认；每次改动仍输出 diff 摘要，删除或覆盖前先备份。",
		directive:
			"当前身份：权限全开。以本体身份直接执行——读写与命令不再逐条确认，一次做完再汇报；每次改动仍输出 diff 摘要，涉及删除或覆盖前先备份并在汇报中列出影响范围。",
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

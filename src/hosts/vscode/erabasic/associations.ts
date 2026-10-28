/**
 * 「EraBasic 语法归属」的**纯逻辑**：给定归属态与当前用户级 files.associations，
 * 算出应该落盘的目标关联。与 vscode 解耦，node:test 可直接锁三态语义
 * （落盘/读设置的壳在 index.ts）。
 *
 * 硬纪律（D36 的教训，知识库 14 §14.1）：
 * - 只动 MANAGED_ASSOCIATION_KEYS 这两个键；
 * - 只写/只删**本扩展会写的值**（isManagedValue）；用户自己写的其他映射不碰；
 * - 归属三态互斥、单一事实来源是 `eraHarness.erabasic.languageOwner`（D42）。
 */

/** 本扩展贡献的语言 id（静态声明；era 态不需要写任何关联） */
export const ERA_ERB_LANGUAGE_ID = "era-erb"
/** sasami.erabasic 的稳定语言 id（它被卸载/禁用后读不到 package.json，兜底清理用） */
export const SASAMI_LANGUAGE_ID = "erabasic"
/**
 * 内置恒存在的语言 id：off 态把 .erb/.erh 绑到它 = VS Code 原版 Ruby 配色。
 * 2026-10-28 用户反馈修订（原为 plaintext 纯文本）：原始诉求是「用回原版颜色」，
 * 纯文本连 Ruby 配色一并杀掉，与「卸载本扩展即回到内置 Ruby」的行为也不自洽。
 */
export const RUBY_LANGUAGE_ID = "ruby"
/** 3.92.0-dev 短暂存在过的 off 表示法（绑纯文本）。不再新写，只作为迁移/清理的输入。 */
export const PLAINTEXT_LANGUAGE_ID = "plaintext"

/** 本扩展唯一有权增删的 files.associations 键 */
export const MANAGED_ASSOCIATION_KEYS = ["*.erb", "*.erh"] as const

export type LanguageOwner = "era" | "sasami" | "off"

/**
 * 哪些关联值视作「本扩展写的」。权衡：ruby / erabasic / plaintext 这些内置 id
 * 用户也可能手写，但本扩展的让位/关闭写入的正是它们，无法区分——按自己人处理，
 * 「收回」时一并清掉（与旧版对 erabasic 的处理一致）。
 */
export function isManagedValue(value: string | undefined, sasamiTarget: string | undefined): boolean {
	return (
		value === ERA_ERB_LANGUAGE_ID ||
		value === SASAMI_LANGUAGE_ID ||
		value === RUBY_LANGUAGE_ID ||
		value === PLAINTEXT_LANGUAGE_ID ||
		(sasamiTarget !== undefined && value === sasamiTarget)
	)
}

/**
 * 计算目标关联。
 * @param owner 目标归属态
 * @param associations 当前用户级 files.associations（不会被修改）
 * @param sasamiTarget sasami.erabasic 声明的语言 id；owner="sasami" 时由调用方先确认存在
 * @returns next 新关联表；changed 实际增删的键（长度 0 = 无需写盘）
 */
export function computeAssociationsForOwner(
	owner: LanguageOwner,
	associations: Record<string, string>,
	sasamiTarget: string | undefined,
): { next: Record<string, string>; changed: string[] } {
	const next = { ...associations }
	const changed: string[] = []
	for (const key of MANAGED_ASSOCIATION_KEYS) {
		const value = next[key]
		if (owner === "off") {
			// 关闭 EraBasic 着色：绑到内置 Ruby 保留原版配色；无条件落值（与 sasami 分支同构）
			if (value !== RUBY_LANGUAGE_ID) {
				next[key] = RUBY_LANGUAGE_ID
				changed.push(key)
			}
		} else if (owner === "sasami") {
			if (sasamiTarget !== undefined && value !== sasamiTarget) {
				next[key] = sasamiTarget
				changed.push(key)
			}
		} else if (isManagedValue(value, sasamiTarget)) {
			// era 态：删掉本扩展写过的所有值（历史 plaintext / 现在的 ruby / sasami 的 id），
			// 让静态语言声明重新决定归属
			delete next[key]
			changed.push(key)
		}
	}
	return { next, changed }
}

/**
 * 激活自愈：清历史脏值 + 迁移 off 态的旧表示法。
 * - `era-erb`：≤3.88.0 激活时自动写的脏值，静态声明已替它，删掉；
 * - `plaintext`：3.92.0-dev 的 off 写过。当前仍是 off → 改写成 ruby（语义迁移）；
 *   已不是 off → 是切换后残留，删掉恢复静态声明。
 */
export function healAssociations(
	associations: Record<string, string>,
	owner: LanguageOwner,
): { next: Record<string, string>; changed: string[] } {
	const next = { ...associations }
	const changed: string[] = []
	for (const key of MANAGED_ASSOCIATION_KEYS) {
		const value = next[key]
		if (value === ERA_ERB_LANGUAGE_ID) {
			delete next[key]
			changed.push(key)
		} else if (value === PLAINTEXT_LANGUAGE_ID) {
			if (owner === "off") {
				next[key] = RUBY_LANGUAGE_ID
			} else {
				delete next[key]
			}
			changed.push(key)
		}
	}
	return { next, changed }
}

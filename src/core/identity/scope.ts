/**
 * 身份 = 文件修改范围（与 webview 的 identity.ts 对应）。
 *
 * 扩展侧只关心一件事：这次写盘的目标路径是否落在当前身份允许的范围内。
 * 不在范围内 → 即使开了自动批准，也强制走人工确认。
 */

export type EraIdentityMode = "self" | "persona" | "unrestricted"

/** eraTW 工程里口上（剧本）文件的目录标记 */
const PERSONA_DIR_MARKER = "口上・メッセージ関連"

const IDENTITY_RE = /<era-identity\s+mode="(self|persona|unrestricted)"/

let currentMode: EraIdentityMode = "self"

export function parseIdentityFromText(text?: string): EraIdentityMode | undefined {
	if (!text) {
		return undefined
	}
	const match = text.match(IDENTITY_RE)
	return (match?.[1] as EraIdentityMode | undefined) ?? undefined
}

export function setCurrentIdentityMode(mode: EraIdentityMode): void {
	currentMode = mode
}

export function getCurrentIdentityMode(): EraIdentityMode {
	return currentMode
}

function normalize(p: string): string {
	return p.replace(/\\/g, "/")
}

/**
 * 判断目标路径是否在当前身份的可写范围内。
 * - unrestricted：任意路径
 * - persona：仅口上目录
 * - self：口上目录以外的路径（工作区外的路径同样需要确认）
 */
export function isWriteAllowedByScope(targetPath: string, cwd?: string): boolean {
	if (currentMode === "unrestricted") {
		return true
	}

	const abs = normalize(targetPath)
	const root = cwd ? normalize(cwd) : undefined

	// 工作区外一律要求确认（本体/口上两侧都不该默默往外写）
	if (root && !abs.toLowerCase().startsWith(root.toLowerCase())) {
		return false
	}

	const inPersonaDir = abs.includes(PERSONA_DIR_MARKER)
	return currentMode === "persona" ? inPersonaDir : !inPersonaDir
}

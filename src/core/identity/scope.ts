/**
 * 身份 = 文件修改范围（与 webview 的 identity.ts 对应）。
 *
 * 扩展侧只关心一件事：这次写盘的目标路径是否落在当前身份允许的范围内。
 * 不在范围内 → 即使开了自动批准，也强制走人工确认。
 *
 * 口上目录的位置**不写死**：交给 core/era/project-profile 在运行时探测，
 * 因为不同整合包的目录名、嵌套层级都不一样，写死一个路径等于替用户假设工作区结构。
 */

import path from "node:path"
import { getEraProjectProfile, isPersonaScopePath } from "@core/era/project-profile"

export type EraIdentityMode = "self" | "persona" | "unrestricted"

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

/** 段级包含判定：`D:/proj-evil` 不算在 `D:/proj` 里面 */
function isInsideRoot(root: string, target: string): boolean {
	const rel = path.relative(path.resolve(root), path.resolve(target))
	if (rel === "") {
		return true
	}
	return !rel.startsWith("..") && !path.isAbsolute(rel)
}

/**
 * 判断目标路径是否在当前身份的可写范围内。
 * - unrestricted：任意路径
 * - persona：仅探测到的口上目录
 * - self：口上目录以外的路径（工作区外的路径同样需要确认）
 *
 * 「口上目录」由 getEraProjectProfile 的探测结果决定，探测不到就退到通用关键字与
 * 文件名约定；两者都不命中时按「不是口上文件」处理，而不是假设某个固定路径。
 */
export function isWriteAllowedByScope(targetPath: string, cwd?: string): boolean {
	if (currentMode === "unrestricted") {
		return true
	}

	const abs = normalize(targetPath)
	const root = cwd ? normalize(cwd) : undefined

	// 工作区外一律要求确认（本体/口上两侧都不该默默往外写）
	if (root && !isInsideRoot(root, abs)) {
		return false
	}

	const profile = getEraProjectProfile(cwd)
	const inPersonaDir = isPersonaScopePath(abs, cwd, profile)
	return currentMode === "persona" ? inPersonaDir : !inPersonaDir
}

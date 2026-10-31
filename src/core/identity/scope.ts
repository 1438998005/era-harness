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

/**
 * harness 自己的目录名（工作区根或工程根下）。
 *
 * 里面放的是 harness 的私有数据：更新合并工作台 `.era-harness/merge-work/`、
 * 专属知识库 `.era-harness/knowledge/`。它已经被更新器的 `PROTECTED_PREFIXES`
 * 与「隐藏目录不扫描」双重排除，永远不会被游戏更新覆盖。
 */
export const HARNESS_DIR = ".era-harness"

/** 目标路径是否落在工作区内的 `.era-harness/` 里（路径段级判定，不做字符串前缀匹配） */
export function isHarnessOwnedPath(targetPath: string, cwd?: string): boolean {
	if (!cwd) {
		return false
	}
	const rel = normalize(path.relative(path.resolve(cwd), path.resolve(targetPath)))
	if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
		return false
	}
	return rel.split("/").includes(HARNESS_DIR)
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
 * `.era-harness/` 是例外：那是 harness 自己的目录（合并工作台、专属知识库），
 * 身份要保护的是**用户源码**，不是这里。少了这条，用户在「口上作者」身份下
 * 跑更新合并，AI 每写一个 `out/*.md` 都要人工确认，合并会直接卡死。
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

	// harness 自有目录：与身份无关，始终放行
	if (isHarnessOwnedPath(abs, cwd)) {
		return true
	}

	const profile = getEraProjectProfile(cwd)
	const inPersonaDir = isPersonaScopePath(abs, cwd, profile)
	return currentMode === "persona" ? inPersonaDir : !inPersonaDir
}

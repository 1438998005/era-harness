import type { SystemPromptContext } from "../types"

/**
 * 全局记忆段落。
 *
 * 内容由 `@shared/global-memory` 的 `formatGlobalMemoryForPrompt` 生成（自带警示头 +
 * 4KB 限额）；这里只做「有就注入、没有就跳过」，避免提示层出现两套口径。
 * 功能关闭（enabled=false）时 format 函数返回 undefined，模型看不到任何记忆。
 */
export function getGlobalMemorySection(context: SystemPromptContext): string | undefined {
	if (!context.globalMemoryEnabled) {
		return undefined
	}

	const section = context.globalMemory?.trim()
	return section ? section : undefined
}

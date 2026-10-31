import type { SystemPromptContext } from "../types"

/**
 * 专属知识库段落。
 *
 * 内容在 Task 侧读盘生成（`@core/knowledge/knowledgeBaseSection`），这里只做
 * 「有就注入、没有就跳过」。**不是铁律**：措辞里已经写明「与代码冲突以代码为准」，
 * 因为库是 AI 生成的、会过期，写成铁律等于把模型的错误固化成规则。
 *
 * 用户关掉开关时，`loadKnowledgeBaseSection` 就不会把它塞进 context，这里自然为空。
 */
export function getKnowledgeBaseSection(context: SystemPromptContext): string | undefined {
	const section = context.knowledgeBaseSection?.trim()
	return section ? section : undefined
}

/**
 * Content size limits to prevent massive files/responses from bricking conversations.
 * 400KB ≈ ~100,000 tokens, which is a reasonable limit for context.
 */

/** Maximum content size in bytes (400KB) */
export const MAX_CONTENT_SIZE_BYTES = 400 * 1024

/**
 * Format bytes into a human-readable string (e.g., "1.5 MB", "400 KB").
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Truncate content if it exceeds the maximum size limit.
 * Shows the beginning of the content with a clear truncation notice at the very end.
 *
 * @param content The content to potentially truncate
 * @param maxSize Maximum size in bytes (defaults to MAX_CONTENT_SIZE_BYTES)
 * @returns The original content if under limit, or truncated content with message at end
 */
export function truncateContent(content: string, maxSize: number = MAX_CONTENT_SIZE_BYTES): string {
	if (content.length <= maxSize) {
		return content
	}

	const truncatedContent = content.slice(0, maxSize)
	const truncatedAmount = content.length - maxSize

	return `${truncatedContent}\n\n---\n\n[FILE TRUNCATED: This content is ${formatBytes(content.length)} but only the first ${formatBytes(maxSize)} is shown (${formatBytes(truncatedAmount)} truncated). Use search_files to find specific patterns, or execute_command with grep/head/tail for targeted reading.]`
}

/**
 * 在行边界上截断（不会把一行切一半）。
 *
 * 用于 read_file：先把完整文件按 start_line/end_line 切好、加好行号，
 * 再对切片结果做长度保护。这样超大 ERB 的后半段仍然可读。
 */
export function truncateAtLineBoundary(content: string, maxSize: number = MAX_CONTENT_SIZE_BYTES): string {
	if (content.length <= maxSize) {
		return content
	}

	const lastNewline = content.lastIndexOf("\n", maxSize)
	const keep = lastNewline > 0 ? lastNewline : maxSize
	const truncatedAmount = content.length - keep

	return `${content.slice(0, keep)}\n\n---\n\n[FILE TRUNCATED: This content is ${formatBytes(content.length)} but only the first ${formatBytes(keep)} is shown (${formatBytes(truncatedAmount)} truncated). Use start_line/end_line to read a specific range.]`
}

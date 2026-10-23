/**
 * 错误码是不是只是把 HTTP status 重复了一遍。
 *
 * 我们的错误对象里 `status` 是数字 401，而 `code` 常常是服务端回的同值字符串 "401"。
 * 聊天里的错误块会把 `code` 和 `message` 直接拼在一起，于是渲染成
 * `[MIMO] 401401 Invalid API Key`（message 自己已经以 401 开头）。
 *
 * 判据只比结构化字段，不读文案。
 */
export function isDuplicateErrorCode(status: unknown, code: unknown): boolean {
	if (status === undefined || status === null || code === undefined || code === null) {
		return false
	}
	return String(status) === String(code)
}

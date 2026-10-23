/**
 * 把「拉模型列表」失败的原始错误压成一句能给人看的话。
 *
 * 背景：`refreshOpenAiModels` 原来把所有异常 `catch` 成空数组，调用方只能看到
 * 「0 个模型」，分不清是密钥被拒（401）、断网，还是账号下真的没有模型。
 * 设置页因此给出过一句假话（「接口返回了 0 个模型」），把 401 说成空列表。
 *
 * 只读结构化字段（HTTP status / axios code / 服务端 message），**不做文案匹配**。
 */
export function formatModelListError(error: unknown): string {
	const candidate = error as
		| {
				response?: { status?: number; data?: { error?: { message?: string }; message?: string } }
				code?: string
				message?: string
		  }
		| undefined

	const status = candidate?.response?.status
	const serverMessage = candidate?.response?.data?.error?.message ?? candidate?.response?.data?.message

	if (typeof status === "number") {
		// 服务端给了说明就用它（如 "Invalid API Key"），否则退回 axios 自己的描述
		const detail = serverMessage ?? candidate?.message
		return detail ? `${status} ${detail}` : `HTTP ${status}`
	}

	// 没有 HTTP 响应：连接层失败（超时 / DNS / 拒绝连接），axios 会把原因放进 code
	if (candidate?.code) {
		return candidate.message ? `${candidate.code} ${candidate.message}` : candidate.code
	}

	return candidate?.message ?? String(error)
}

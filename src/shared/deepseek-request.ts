/**
 * DeepSeek 请求侧的纯判定（零依赖，扩展与 webview 共用）。
 *
 * 之所以单独成文件（同 mimo-request.ts 的理由）：思考行为是「猜错就静默带歪输出」
 * 的地方，必须能被零依赖单测锁住；且 handler 与设置页不得各写一份判据。
 *
 * 事实来源（上游 cline PR #11392，2026-06-09 合并，修复 cline#11339）：
 * V4 系的响应侧思考行为与 R1 相同，但**请求侧不能做 R1 的历史思考回放**——
 * 旧实现一个标志同时管两件事，把 V4 的输出带歪（原生工具调用标记泄漏成正文、
 * 输出畸形）。V4 的历史格式与 R1 不同，回放会与它自己的推理通道冲突。
 * 注意与 MiMo 相反（官方硬性要求回传 reasoning_content，见 知识库/18 §18.4），
 * 两个 provider 的判据不要合并。
 */

/**
 * 响应侧：该模型是否走思考流（不发 temperature、传 reasoning_effort、流 reasoning_content）。
 * V4 系（deepseek-flash / deepseek-v4*）与旧 deepseek-reasoner 都要；
 * 用子串匹配以兼容在线同步回来的带日期后缀的 id。
 */
export function deepSeekStreamsReasoning(modelId: string): boolean {
	return modelId.includes("deepseek-flash") || modelId.includes("deepseek-v4") || modelId.includes("deepseek-reasoner")
}

/**
 * 请求侧：该模型是否需要 R1 式历史思考回放（addReasoningContent）。
 * 上游 #11392 的核心结论：只有旧 deepseek-reasoner 需要；V4 系做了反而把输出带歪。
 */
export function deepSeekUsesR1Replay(modelId: string): boolean {
	return modelId.includes("deepseek-reasoner")
}

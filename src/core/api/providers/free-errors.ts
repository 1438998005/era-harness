/**
 * 免费模型上游错误 → 候选循环行为的三态分类。
 *
 * - `context-exceeded`：上下文超限。**不切换候选**，原样上抛由 Task 层截断重试
 *   （`task/index.ts:2056` 的既有机制；换模型可能窗口更小，越换越糟）。
 * - `switchable`：限流（429）/ 区域封锁（403 RegionError）/ 免费门（403 FreeTierError，
 *   由调用方额外触发车道级冷却）/ 凭据（401）/ 传输与 5xx / 其他 400（能力不匹配）
 *   → 换池内下一个候选。
 * - `fatal`：用户中止等不该继续烧候选的情况。
 *
 * 空响应（流出零内容零工具调用）不是异常，由 handler 内部按 switchable 处理。
 */

import { checkContextWindowExceededError } from "@/core/context/context-management/context-error-handling"

export type FreeFailureKind = "switchable" | "context-exceeded" | "fatal"

export function classifyFreeFailure(error: unknown): FreeFailureKind {
	if (isUserAbort(error)) {
		return "fatal"
	}
	if (checkContextWindowExceededError(error)) {
		return "context-exceeded"
	}
	return "switchable"
}

/** 用户中止（AbortController / SDK 的 APIUserAbortError） */
export function isUserAbort(error: unknown): boolean {
	const name = (error as { name?: string } | undefined)?.name
	return name === "AbortError" || name === "APIUserAbortError"
}

/**
 * lane 级免费门拒绝（FreeTierError）。zen-gate `types.go` 注释：该门在读取请求体前
 * 判定、对所有模型同时生效、换出口无用 —— 因此要冷却整条 Zen 车道而不是逐个候选烧。
 */
export function isFreeTierGateError(error: unknown): boolean {
	const message = errorMessageOf(error)
	return message.includes("FreeTierError") || /free tier can only be used/i.test(message)
}

/** 模型级区域封锁（RegionError）：出口 IP 判定，换代理可解；按模型 failover，不冷却车道 */
export function isRegionBlockedError(error: unknown): boolean {
	const message = errorMessageOf(error)
	return message.includes("RegionError") || /not available in your country/i.test(message)
}

/** 提取错误文本（兼容 OpenAI SDK 的 APIError 与裸 Error） */
export function errorMessageOf(error: unknown): string {
	if (!error) {
		return ""
	}
	const err = error as { message?: unknown; error?: { message?: unknown }; toString?: () => string }
	if (typeof err.message === "string") {
		return err.message
	}
	if (typeof err.error?.message === "string") {
		return err.error.message
	}
	try {
		return String(error)
	} catch {
		return ""
	}
}

/** HTTP 状态码（拿不到返回 undefined） */
export function errorStatusOf(error: unknown): number | undefined {
	const status = (error as { status?: unknown } | undefined)?.status
	return typeof status === "number" ? status : undefined
}

/** 全部候选失败时的最终错误（引导用户配置 DeepSeek / 切换 Provider） */
export function composeFinalError(lastError: unknown, triedCount: number): Error {
	const detail = errorMessageOf(lastError)
	const suffix = detail ? `；最后一次错误：${detail.slice(0, 300)}` : ""
	return new Error(
		`免费模型当前均不可用（已尝试 ${triedCount} 个候选${suffix}）。` +
			`该车道为逆向免费通道，可能暂时被上游关闭或所在网络不可达；请稍后重试、更换网络环境，或在 API 设置中配置 DeepSeek API Key。`,
	)
}

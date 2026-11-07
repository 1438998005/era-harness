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

import { FREE_PINNED_RECOVERY_MARKER } from "@shared/free-pools"
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

/**
 * KB 08 #250：空停（流出零**可消费**内容）的错误归因**单源**。
 *
 * Kilo 等上游会把整段回答放进 `reasoning_content` / `reasoning` 字段、`content` 留空：
 * 流是成功的、模型也确实产出了 token，但插件拿不到正文或工具调用。旧实现一律报
 * 「返回了空响应」，用户据此误判成渠道不稳、反复换时段复测（两次共 40 轮零产出）。
 *
 * ⛔ 这里只改**文案**，不改判定：reasoning-only 仍算失败、仍按可切换失败处理；
 * 真零 chunk 仍判空。文案会作为 detail 进 `composePinnedError()`，⛔ 不动其风险因果文案（#244）。
 * ⛔ 不要把 reasoning 计入 `sawContent`：Task 层 `assistantHasContent` 同样不认 reasoning，
 * 单侧放宽只会把「只有思考、任务无法推进」误判成成功轮次（08 #250 复核修订）。
 */
export function composeFreeEmptyStopMessage(displayName: string, reasoningOnly: boolean): string {
	return reasoningOnly ? `${displayName} 只返回了思考内容，未产出正文或工具调用。` : `${displayName} 返回了空响应`
}

/** 全部候选失败时的最终错误（引导用户配置 DeepSeek / 切换 Provider） */
export function composeFinalError(lastError: unknown, triedCount: number): Error {
	const detail = errorMessageOf(lastError)
	// #250 文案以句号结尾时若不去掉尾标点，这里会拼出「…工具调用。）。」双重标点。
	// ⛔ 只清理 detail 的尾标点，不改后面的引导文案（#244 风险因果文案一字不删）。
	const suffix = detail ? `；最后一次错误：${detail.slice(0, 300).replace(/[。！？.!?；;]+$/, "")}` : ""
	return new Error(
		`免费模型当前均不可用（已尝试 ${triedCount} 个候选${suffix}）。` +
			`该车道为逆向免费通道，可能暂时被上游关闭或所在网络不可达；请稍后重试、更换网络环境，或在 API 设置中配置 DeepSeek API Key。`,
	)
}

/**
 * KB 08 #242：指定模型（pinned）失败时的**专门错误**。
 *
 * 与 `composeFinalError` 刻意分开：pinned 后候选链长度恒为 1，「已尝试 N 个候选」这类
 * 自动路由文案会误导用户以为系统已经换过模型；实际上 switchable 失败无处可切。
 * 错误文本尾部带 `FREE_PINNED_RECOVERY_MARKER`，webview 的 ErrorRow 据此渲染
 * 「切回自动路由」按钮——**只有用户点了才切，这里绝不自动回退**。
 *
 * `reason` 由调用方给出：可能是 `describePinnedGateConflict` 的门控原因，
 * 也可能是上游最后一次错误文本；`triedCount === 0` 表示四道门/车道冷却拦下、请求未发出。
 */
export function composePinnedError(pinnedModelId: string, reason: string, triedCount: number): Error {
	const detail = reason.trim()
	return new Error(
		`指定的免费模型「${pinnedModelId}」本次不可用` +
			(triedCount > 0 ? `（已尝试 ${triedCount} 次）` : "（本次请求未发出）") +
			(detail ? `：${detail.slice(0, 300)}` : "。") +
			`指定模型时候选链长度固定为 1，限流（429）、区域封锁、超时、空响应与 5xx 都没有下一个模型可切换，` +
			`自动 failover 自愈不再生效；请稍后重试，或切回自动路由。${FREE_PINNED_RECOVERY_MARKER}`,
	)
}

/**
 * 把恢复标记从展示文案里剥掉（webview 用它识别按钮，不该让用户看到裸标记）。
 * KB 08 代码审查修订：容错 —— 失败路径若给到非字符串，宁可返回空串，⛔ 也不要在错误展示阶段
 * 抛 `text.split is not a function` 把真正的原始错误盖掉。现有调用点恒为 string。
 */
export function stripPinnedRecoveryMarker(text: string | undefined | null): string {
	return typeof text === "string" ? text.split(FREE_PINNED_RECOVERY_MARKER).join("").trim() : ""
}

/**
 * KB 08 #242（review 修订）：pinned 下「原样上抛」的分支也要带恢复标记。
 *
 * 中途断流时 handler 直接 `throw error` 交给 Task 层，绕过 `composePinnedError()`，
 * 错误文本里就没有 `FREE_PINNED_RECOVERY_MARKER`，webview 的 `ErrorRow` 也不会渲染
 * 「切回自动路由并重试」按钮——而链长=1 时中途断流恰恰是高发失败形态。
 *
 * 这里**原地**修改同一个 Error 对象的 message：保留类型、stack、status 等上游字段
 * （Task 层的错误分类/截断重试都依赖它们），⛔ 绝不用 `new Error` 包装。
 * 幂等：重复调用不会叠加标记。
 */
export function withPinnedRecoveryMarker<T extends Error>(error: T): T {
	if (!error.message.includes(FREE_PINNED_RECOVERY_MARKER)) {
		error.message += FREE_PINNED_RECOVERY_MARKER
	}
	return error
}

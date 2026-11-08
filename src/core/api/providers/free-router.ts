/**
 * OpenRouter 路由模式（设置页「OpenRouter 列表」对应的单候选路径）的独立实现。
 *
 * 从 free.ts 拆出：仓库闸门要求单文件 ≤20KB，且本模式与「自动路由 / 指定模型」是并列独立路径——
 * 单候选、不经 FREE_POOL / 四道门 / listing、失败不回落。完整决策与风险依据见 KB 07 §7.9
 * （2026-11-08 修订块）与 `free-pools.ts` 头注释。
 */
import { type FreeCandidate, OPENROUTER_FREE_ROUTER_CONTEXT_WINDOW, OPENROUTER_FREE_ROUTER_ID } from "@shared/free-pools"

/**
 * 请求级输出上限（整个免费 handler 共用；handler 发送时再取 min 截断兜底）。
 * 免费池个别模型登记的 maxOutput 极大（dots-3-note 460800），上游 provider 会直接 400 拒绝
 * （2026-10-19 实测）；agent 单轮输出很少超过 32K，统一截到 32768（已验证可用）。
 */
export const FREE_REQUEST_MAX_OUTPUT = 32_768

/**
 * 虚拟路由器单候选（⛔ **不在 FREE_POOL 内**）。窗口取 Kilo listing 标称 200000；
 * maxOutput / vision 取保守值——该条目的 `max_completion_tokens` 为 null、`text+image`
 * 不是真实权重的能力，实际选中的模型可能窗口更小、也可能不支持图片。
 */
export const OPENROUTER_ROUTER_CANDIDATE: FreeCandidate = {
	id: OPENROUTER_FREE_ROUTER_ID,
	lane: "kilo", // 请求只发到 Kilo 网关；复用 createChatStream 的既有客户端选择
	wire: "chat",
	displayName: "OpenRouter Free Models Router",
	contextWindow: OPENROUTER_FREE_ROUTER_CONTEXT_WINDOW,
	maxOutput: FREE_REQUEST_MAX_OUTPUT,
	vision: false,
}

/** 隐私开关 / 带图请求按风险明确拒绝：⛔ 不静默绕过四道门，也不发出任何请求。 */
export function assertOpenRouterRouterAllowed(options: { excludeCollecting: boolean; hasImages: boolean }): void {
	if (options.excludeCollecting) {
		throw new Error(
			"「OpenRouter 免费路由」会由上游收集提示词，与隐私开关冲突。请关闭隐私开关，或在 API 设置中切回默认列表。",
		)
	}
	if (options.hasImages) {
		throw new Error(
			"「OpenRouter 免费路由」由上游随机选择模型，无法保证所选模型支持图片。请切回默认列表后重试（自动路由会挑支持图片的模型）。",
		)
	}
}

/** 全链失败：单候选无处可切，⛔ 不复用 pinned 恢复标记（避免 ErrorRow 误渲染恢复按钮）。 */
export function composeOpenRouterRouterFailure(tried: number, reason: string): Error {
	return new Error(
		`「OpenRouter 免费路由」请求失败${tried > 0 ? `（已尝试 ${tried} 个候选）` : ""}：${reason}` +
			"该模式不会自动回落到默认列表；请在 API 设置中切回默认列表后重试。",
	)
}

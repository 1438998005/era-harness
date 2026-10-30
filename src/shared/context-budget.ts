/**
 * 上下文预算的**单一算法**（扩展侧与 webview 共用，零依赖）。
 *
 * 为什么必须只有一份：
 * - 扩展侧用它算压缩阈值（`context-window-utils.ts`），webview 用它算进度条分母
 *   （`ContextWindow.tsx`）与设置页括注（`ModelInfoView.tsx`）。三处各写一遍必然漂移，
 *   用户就会看到「设置页 1M、侧栏 872K」这种自相矛盾的数字。
 * - 口径来自 D45 的实证，但**不做全供应商推广**：`glm-4.5-flash` 满额 `max_tokens` 会把
 *   实际输入预算压到窗口−输出，按满窗算会撞 400 code=1261；其余模型是纯输入窗口。
 *
 * 能力位 `contextWindowIncludesOutput`（`ModelInfo` 同名字段）：
 * - 缺省 **false**（不扣）：官方没注明互斥时，按「输入窗口与输出独立」处理，
 *   否则会凭空没收 128K～384K 的可用上下文（用户 2026-10-30 纠正）；
 * - 只有**实测证明共享**的模型才标 true——目前仅 `glm-4.5-flash`（128K 窗配 96K
 *   `max_tokens` 时 28.6k prompt 即 400，D45）。同一能力位也决定请求侧是否夹紧
 *   （`clampBigmodelOutputTokens`，08 #82 放开），显示与请求两侧口径一致。
 */

/** 拿不到窗口时的兜底（与历史行为一致）。 */
export const DEFAULT_CONTEXT_WINDOW = 128_000

/** 扣预留时至少给输入留这么多：目录把输出写错也不会把预算压成 0/负数。 */
const MIN_INPUT_BUDGET = 4_096

export interface ContextBudgetInput {
	/** 模型目录里的原始上下文窗口 */
	contextWindow?: number
	/** 模型目录里的最大输出；`-1`（OpenAI 兼容默认）/ 0 / 未填一律视为「无预留」 */
	maxTokens?: number
	/** 窗口是否含输出，缺省 false（输入输出独立）；与 `ModelInfo` 同名字段，可直接传 modelInfo */
	contextWindowIncludesOutput?: boolean
}

export interface ContextBudget {
	/** 原始窗口（设置页展示的就是这个数） */
	contextWindow: number
	/** 预留输出；不扣时为 0 */
	reservedOutput: number
	/** 有效输入预算 = 窗口 − 预留输出，即进度条分母 / 压缩阈值上限 */
	effectiveInputBudget: number
	includesOutput: boolean
}

/** 只接受有限正数，其余（-1 / 0 / NaN / Infinity / undefined）返回 undefined。 */
function positiveFloor(value: number | undefined): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return undefined
	}
	return Math.floor(value)
}

/**
 * 算出某个模型的上下文预算。
 *
 * - 窗口非法 → 兜底 128K（历史行为）
 * - 输出非法（含 `-1`）→ 预留 0，**不会**出现 `window - (-1) = window + 1` 这种分母
 * - 预留至多「窗口 − 4K」：目录写错（输出 ≥ 窗口）时仍给输入留 4K，不会压成 0 或负数
 */
export function getContextBudget(input: ContextBudgetInput): ContextBudget {
	const contextWindow = positiveFloor(input.contextWindow) ?? DEFAULT_CONTEXT_WINDOW
	const maxOutput = positiveFloor(input.maxTokens) ?? 0
	// 缺省 false：只有显式声明（且经实测）共享窗口的模型才扣预留
	const includesOutput = input.contextWindowIncludesOutput === true
	const reservedOutput = includesOutput ? Math.min(maxOutput, Math.max(0, contextWindow - MIN_INPUT_BUDGET)) : 0

	return {
		contextWindow,
		reservedOutput,
		effectiveInputBudget: contextWindow - reservedOutput,
		includesOutput,
	}
}

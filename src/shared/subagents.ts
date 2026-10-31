/**
 * 子代理可用性判定（#94，纯函数，零依赖：扩展与 webview 共用）。
 *
 * 背景：免费模型池由网关路由到 32k~1M 窗口的弱模型，用它跑 5 路并行子代理既容易跑偏，
 * 也几乎没有产出（子代理只回文本、不写文件），一次调用就可能把当天免费额度打空。
 *
 * 三条设计约束（都是为了不再复现「同一规则写三遍必然漂移」）：
 *
 * 1. **单源派生**：`resolveSubagentsEnabled` 是唯一的判定入口，调用点只读它的返回值；
 * 2. **只派生、不改存储**：用户设置里的 `subagentsEnabled` 一个字节都不动——否则免费模型下
 *    打开设置页就把它写回 false，切回付费模型时再也自动恢复不了；
 * 3. **判 provider 不判模型**：免费池的具体模型由网关决定，逐模型白名单必然过期。
 */
export function providerSupportsSubagents(provider: string | undefined): boolean {
	return provider !== "free"
}

/**
 * 实际生效的子代理开关 = 用户开关 ∧ provider 支持。
 *
 * @param enabled  用户在设置里存的原始值（`subagentsEnabled`）
 * @param provider 当前 plan/act 模式对应的 provider id
 */
export function resolveSubagentsEnabled(enabled: boolean | undefined, provider: string | undefined): boolean {
	return enabled === true && providerSupportsSubagents(provider)
}

/** 免费 provider 下强行调用子代理时的提示（宿主与 UI 共用一份文案）。 */
export const SUBAGENTS_UNAVAILABLE_FREE_PROVIDER_MESSAGE = "当前是免费模型，子代理不可用；切回其它模型后自动恢复，不需要改设置。"

import {
	type ApiProvider,
	bigmodelModels,
	bigmodelPlanModels,
	deepSeekModels,
	type ModelInfo,
	mimoModels,
	moonshotModels,
	tencentCodingPlanModels,
	tencentTokenhubModels,
} from "@shared/api"

/**
 * 辅助模型面板（AuxiliaryModelSettings）的 provider 目录：显示标签 + 内置模型表。
 *
 * 单独成纯模块的理由（KB 08 #272）：两张表内联在面板组件里时，新增 provider 只会改
 * @shared/aux-model 的支持清单，这里的标签/模型表漏补没有任何东西会红——腾讯云两家
 * （#270 归属注册已登记、面板却选不到）与 bigmodel-plan 的模型表就是这么漏的。
 * 搬出来后 `test/update/aux-provider-catalog.spec.ts` 遍历 AUXILIARY_SUPPORTED_PROVIDERS
 * 逐家断言（每家有标签、除 free 外有模型表），以后漏补必红。
 *
 * 判据单源分工：支持哪些 provider 看 @shared/aux-model 的 AUXILIARY_SUPPORTED_PROVIDERS；
 * 本模块只补「目录数据」，不做归属/回落判据（那些在 @shared/aux-model）。
 */

export const AUX_PROVIDER_LABELS: Record<string, string> = {
	deepseek: "DeepSeek",
	mimo: "Xiaomi MiMo",
	bigmodel: "智谱 BigModel",
	"bigmodel-plan": "智谱 GLM 套餐（Coding Plan）",
	moonshot: "Kimi (Moonshot)",
	"tencent-tokenhub": "腾讯云 TokenHub",
	"tencent-coding-plan": "腾讯云 Coding Plan",
	free: "免费模型",
}

export const AUX_PROVIDER_MODELS: Partial<Record<ApiProvider, Record<string, ModelInfo>>> = {
	deepseek: deepSeekModels as Record<string, ModelInfo>,
	mimo: mimoModels as Record<string, ModelInfo>,
	bigmodel: bigmodelModels as Record<string, ModelInfo>,
	"bigmodel-plan": bigmodelPlanModels as Record<string, ModelInfo>,
	moonshot: moonshotModels as Record<string, ModelInfo>,
	"tencent-tokenhub": tencentTokenhubModels as Record<string, ModelInfo>,
	"tencent-coding-plan": tencentCodingPlanModels as Record<string, ModelInfo>,
	// free 无内置清单（在线池），与面板「选了 free 不出模型下拉」的既有行为一致
}

/** provider → 显示标签；未登记的 provider 回退原始 id（宿主侧新枚举不至于显示成空白）。 */
export function auxProviderLabel(provider: string): string {
	return AUX_PROVIDER_LABELS[provider] ?? provider
}

/** provider → 内置模型表（含默认档）；free / 未登记的 provider 返回 undefined。 */
export function auxProviderModels(provider: ApiProvider): Record<string, ModelInfo> | undefined {
	return AUX_PROVIDER_MODELS[provider]
}

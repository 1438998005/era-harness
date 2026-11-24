import type { ModelInfo } from "@shared/api"

/**
 * 把在线同步回来的模型 id（`GET /models`）并进内置清单。
 *
 * 拆分说明（2026-11-24，KB 08 #270）：原在 providerUtils.ts 内；腾讯云两个 provider 的
 * normalize/getModeSpecificFields 分支加进去后该文件越过 20KB 闸门，把这张自成一体的
 * 纯函数抽到同级文件，原路径保留再导出，既有 import 不用动。
 *
 * 两条规则，都是踩过坑才写下来的：
 *
 * 1. **内置清单是底座，在线清单只加不换**（#62）。`GET /models` 只回 id，而且不保证把
 *    全部可用模型都列出来——智谱的免费六款在端点里根本不存在，BigModel 填了 Key 同步一次，
 *    免费款就从下拉框里整个消失，用户以为免费额度没了。反过来「在线清单为空就回落内置」
 *    也救不了：只要同步成功过一次，就再也回不去。
 * 2. **键必须用规范 id**。`DeepSeek-V4-Pro` 与内置清单里的 `deepseek-v4-pro` 是同一个模型，
 *    用原始 id 当键会让 `ModelSelector` 出现两行同一模型（它不做去重）。
 *
 * 抽成纯函数而不是在 DeepSeek / MiMo / BigModel 等组件里各写一遍：这正是本项目已复发多次的
 * 「同一规则写三遍必然有两遍漂移」。
 *
 * @param builtins     内置清单（同时决定下拉框的排列顺序：按档位排好的，比接口返回顺序有意义）
 * @param liveModelIds 在线同步回来的 id
 * @param canonicalize 归一函数（`resolveDeepSeekModelId` / `resolveMimoModelId` / `resolveBigmodelModelId`）；
 *                     返回 undefined 表示清单里没有这个 id，原样保留（官方可能新增模型）
 * @param infoFor      按 id 取元数据
 * @param selectedModelId 当前选中的模型，必须始终在列表里，否则下拉框会显示空值
 */
export function mergeLiveModelIds(
	builtins: Record<string, ModelInfo>,
	liveModelIds: readonly string[],
	canonicalize: (id: string) => string | undefined,
	infoFor: (id: string) => ModelInfo,
	selectedModelId?: string,
): Record<string, ModelInfo> {
	const merged: Record<string, ModelInfo> = { ...builtins }
	for (const id of liveModelIds) {
		const key = canonicalize(id) ?? id
		// 已在内置清单里的不覆盖：接口只给 id，内置清单里的价格/上下文才是准的
		if (!merged[key]) {
			merged[key] = infoFor(key)
		}
	}
	if (selectedModelId && !merged[selectedModelId]) {
		merged[selectedModelId] = infoFor(selectedModelId)
	}
	return merged
}

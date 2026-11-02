/**
 * #64（2026-10-29 用户登记）：更新时 AI 合并用哪个模型。
 *
 * 背景：合并跑的是**真实对话任务**，模型 = 用户聊天正用的那一个。聊天里挂着免费款，
 * 合并就用免费款——而合并质量直接决定「你改的代码保不保得住」。用户的原话是
 * 「更新操作太重要，应该能指定模型并被提醒用智力水平最高的」。
 *
 * 已裁定的两件事（2026-10-29 用户）：
 * 1. **每次合并前选一次**，不做「记住上次」的持久设置——更新不是高频操作，
 *    每次都问一遍的成本远低于「半年前设过一次，忘了」造成的合错。
 * 2. **可以跨家选**（DeepSeek / MiMo / BigModel 三家的清单都在候选里），
 *    因为「哪家最强」会变，写死成当前家就等于替用户决定了。
 *
 * 免费池**不列**：它内部按候选轮换，用户选不了具体哪一款，与「用最强的」相悖。
 *
 * 「智力水平」没有客观标量，所以这里只做两件有依据的事：
 * - 每家标一个**推荐**（目录里的旗舰款，人写死，改档时跟着改）；
 * - 按两个**客观特征**判「弱」：① 价格全 0（免费款）；② 目录里显式标了 `mergeWeak`
 *   （只给老一代 GLM-5.0 及以下，08 #178 用户裁定）。
 *   ⛔ 不再按 id 里的 flash / flashx / air / turbo 词根判弱——2026 年的 flash 档绝对性能
 *   足以胜任任何性质的工作，按名字一票否决是启发式冒充实测。
 *   ⛔ 也不要按价格排序冒充智力排序——贵不等于会写代码。
 */

import { type ApiProvider, bigmodelModels, deepSeekModels, type ModelInfo, mimoModels } from "@shared/api"
import type { SecretKey } from "@shared/storage/state-keys"

export interface MergeModelOption {
	/** 家（与 `ApiConfiguration.actModeApiProvider` 同值） */
	provider: ApiProvider
	modelId: string
	/** 下拉框主文案：`DeepSeek V4 Pro（DeepSeek）` */
	label: string
	/** 右侧灰字：`推荐` / `免费` / `输出 ¥13.5/百万` */
	description: string
	/** 展开后的说明 */
	detail: string
	recommended: boolean
	/** 弱模型（免费款或目录里标了 mergeWeak 的老一代）——选中要给二次确认 */
	weak: boolean
}

interface MergeCatalog {
	provider: ApiProvider
	providerLabel: string
	models: Record<string, ModelInfo>
	/** 该家旗舰款（人写死：目录改档时这里要跟着改） */
	recommended: string
}

/**
 * 候选清单的顺序 = 下拉框顺序：DeepSeek 在最前（产品默认预设），其余按目录顺序。
 * ⛔ 别用 Object.keys 之外的动态顺序——同一台机器两次打开顺序不同会让人以为选错了。
 */
const MERGE_CATALOGS: MergeCatalog[] = [
	{ provider: "deepseek", providerLabel: "DeepSeek", models: deepSeekModels, recommended: "deepseek-v4-pro" },
	{ provider: "mimo", providerLabel: "Xiaomi MiMo", models: mimoModels, recommended: "mimo-v2.6-pro" },
	{ provider: "bigmodel", providerLabel: "智谱 BigModel", models: bigmodelModels, recommended: "glm-5.3" },
]

function isFreeModel(info: ModelInfo): boolean {
	const known = [info.inputPrice, info.outputPrice, info.cacheReadsPrice, info.cacheWritesPrice].filter(
		(price) => price !== undefined,
	)
	return known.length >= 2 && known.every((price) => price === 0)
}

function describePrice(info: ModelInfo): string {
	if (isFreeModel(info)) {
		return "免费"
	}
	if (typeof info.outputPrice === "number") {
		return `输出 ¥${info.outputPrice}/百万`
	}
	return "价格未收录"
}

/** 全部候选（三家 × 各自清单）。纯函数、无 IO，单测直接调用。 */
export function mergeModelOptions(): MergeModelOption[] {
	const options: MergeModelOption[] = []
	for (const catalog of MERGE_CATALOGS) {
		for (const [modelId, info] of Object.entries(catalog.models)) {
			const recommended = modelId === catalog.recommended
			const weak = isFreeModel(info) || info.mergeWeak === true
			const price = describePrice(info)
			options.push({
				provider: catalog.provider,
				modelId,
				label: `${info.name ?? modelId}（${catalog.providerLabel}）`,
				description: recommended ? `推荐 · ${price}` : price,
				detail: recommended
					? `更新合并建议用这一款：${catalog.providerLabel} 里最强的一档。`
					: `${modelId} · 上下文 ${Math.round((info.contextWindow ?? 0) / 1000)}K · ${price}`,
				recommended,
				weak,
			})
		}
	}
	return options
}

/**
 * 默认选中项：用户当前聊天用的那一款（在候选里就直接高亮它）。
 *
 * 为什么不默认选「推荐」：默认换掉用户当前模型、而他没注意就回车了，
 * 等于偷偷花了另一家的钱。默认 = 现状，改动永远是用户主动做的。
 */
export function defaultMergeModelOption(
	options: MergeModelOption[],
	current: { provider?: string; modelId?: string },
): MergeModelOption | undefined {
	if (!current.provider) {
		return undefined
	}
	const sameProvider = options.filter((option) => option.provider === current.provider)
	if (current.modelId) {
		const exact = sameProvider.find((option) => option.modelId === current.modelId)
		if (exact) {
			return exact
		}
	}
	return sameProvider[0]
}

/** 选模型这一步的标题与提示（提醒文案就在这里，别散到别处） */
export function describeMergeModelPicker(): { title: string; placeHolder: string } {
	return {
		title: "这次合并用哪个模型？",
		placeHolder: "合并质量决定你改过的代码保不保得住。建议选标了「推荐」的那款；选完就开始合并。",
	}
}

/**
 * 选了弱模型时的二次确认。
 *
 * 只问一次、说清后果、给出「换一款」的出口——⛔ 不要在这里列一堆模型让用户重选，
 * 那是把 quickpick 再开一遍，用户会以为点错了。
 */
export function describeWeakMergeModel(option: MergeModelOption): {
	title: string
	detail: string
	keep: string
	change: string
} {
	return {
		title: `「${option.label}」用来合并可能不太稳`,
		detail: [
			"这一款是免费款或老一代模型——不是不能用，是合错了不报错。",
			"更新时要它把你改过的文件和社区的新版本合到一块儿，模型跟不上可能合错——你的口上会变乱，而且不报错。",
			"",
			"要稳妥就换一款标了「推荐」的；坚持用它也能继续，冲突文件会先备份。",
		].join("\n"),
		keep: "就用它合并",
		change: "换一款",
	}
}

/**
 * 把选中的模型落成**这次任务**的覆盖项。
 *
 * 同时写 plan / act 两套键：合并对话用哪个模式取决于用户当前所在的模式
 * （`Task` 构造时读 `mode`），只写 act 的话，用户停在计划模式时覆盖会失效。
 * 两套都写 = 无论哪个模式都按选的这款跑。
 *
 * 这是**任务级**覆盖（`StateManager.taskStateCache`），不碰全局设置：
 * 对话结束 `clearTask()` → `clearTaskSettings()` 自动还原，用户聊天的模型一点不变。
 */
export interface MergeModelOverride {
	actModeApiProvider: ApiProvider
	actModeApiModelId: string
	planModeApiProvider: ApiProvider
	planModeApiModelId: string
}

export function mergeModelOverride(option: MergeModelOption): MergeModelOverride {
	return {
		actModeApiProvider: option.provider,
		actModeApiModelId: option.modelId,
		planModeApiProvider: option.provider,
		planModeApiModelId: option.modelId,
	}
}

/** 结果弹窗/审计里那句「这次合并用的是谁」 */
export function describeMergeModelUsed(option: MergeModelOption): string {
	return `合并用的模型：${option.label}`
}

/**
 * 各家调用所需的密钥字段（`StateManager.getSecretKey` 的键）。
 *
 * 候选里必须能查到密钥才允许选：选了别家却没填那家的密钥，合并会 401，
 * 冲突文件全部原样保留——用户白等一轮，还以为是 AI 不行。
 */
const MERGE_PROVIDER_SECRET_KEY: Record<string, SecretKey> = {
	deepseek: "deepSeekApiKey",
	mimo: "mimoApiKey",
	bigmodel: "bigmodelApiKey",
}

export function mergeProviderSecretKey(provider: string): SecretKey | undefined {
	return MERGE_PROVIDER_SECRET_KEY[provider]
}

/**
 * 过滤出「有密钥可用」的候选。
 *
 * `hasSecret` 由调用方注入（host 侧读 `StateManager`），core 不碰存储。
 * 一个都没有时返回空数组——调用方据此退回「沿用当前模型」，⛔ 不要因此中止更新：
 * 全新用户默认就是免费池、一个付费密钥都没有，中止等于把更新功能关了。
 */
export function availableMergeModelOptions(
	options: MergeModelOption[],
	hasSecret: (secretKey: SecretKey) => boolean,
): MergeModelOption[] {
	return options.filter((option) => {
		const key = mergeProviderSecretKey(option.provider)
		return key ? hasSecret(key) : false
	})
}

import type { ModelInfo } from "./api"

/**
 * DeepSeek 峰谷分时计费与缓存命中计价（人民币）。
 *
 * 官方口径（https://api-docs.deepseek.com/zh-cn/quick_start/pricing，2026-10 现行）：
 * - 输入按「缓存命中 / 缓存未命中」两档分别计价，输出单列；`prompt_tokens = 命中 + 未命中`。
 * - `deepSeekModels` 里存的是**空闲时段**单价；高峰时段所有档位均为空闲的 **2 倍**。
 * - 高峰时段：北京时间周一至周五（不含中国法定节假日）09:00–12:00、14:00–18:00；
 *   其余时段（含周末、法定节假日全天）为空闲时段。
 *
 * 本模块为纯函数、无 Node/网络依赖，扩展宿主与 webview 两侧均可安全 import。
 */

/**
 * 中国法定节假日日历（离线内置）。
 *
 * `holidays`：全民法定节假日**放假日**（即使是周一~周五也按谷价/空闲处理）。
 * `workdays`：**调休补班日**（落在周六/周日但要上班，故仍按峰价处理）。
 *
 * 数据来源：《国务院办公厅关于 2026 年部分节假日安排的通知》（国办发明电〔2025〕7号）。
 * 维护提示：国务院通常在**上一年 11 月**发布下年度安排；每年 11 月后应补录新一年数据。
 * 未覆盖的年份自动回退到「周一~周五即工作周」的启发式（宁可按周几判断，也不因缺数据报错）。
 */
export const CN_HOLIDAY_CALENDAR: Record<string, { holidays: string[]; workdays: string[] }> = {
	"2026": {
		holidays: [
			// 元旦 1/1-1/3
			"2026-01-01",
			"2026-01-02",
			"2026-01-03",
			// 春节 2/15-2/23
			"2026-02-15",
			"2026-02-16",
			"2026-02-17",
			"2026-02-18",
			"2026-02-19",
			"2026-02-20",
			"2026-02-21",
			"2026-02-22",
			"2026-02-23",
			// 清明 4/4-4/6
			"2026-04-04",
			"2026-04-05",
			"2026-04-06",
			// 劳动节 5/1-5/5
			"2026-05-01",
			"2026-05-02",
			"2026-05-03",
			"2026-05-04",
			"2026-05-05",
			// 端午 6/19-6/21
			"2026-06-19",
			"2026-06-20",
			"2026-06-21",
			// 中秋 9/25-9/27
			"2026-09-25",
			"2026-09-26",
			"2026-09-27",
			// 国庆 10/1-10/7
			"2026-10-01",
			"2026-10-02",
			"2026-10-03",
			"2026-10-04",
			"2026-10-05",
			"2026-10-06",
			"2026-10-07",
		],
		workdays: [
			"2026-01-04", // 元旦调休（周日补班）
			"2026-02-14", // 春节调休（周六补班）
			"2026-02-28", // 春节调休（周六补班）
			"2026-05-09", // 劳动节调休（周六补班）
			"2026-09-20", // 国庆调休（周日补班）
			"2026-10-10", // 国庆调休（周六补班）
		],
	},
}

/**
 * 判断给定「北京时间墙钟日期」是否为工作日（含调休补班、扣除法定节假日）。
 * 表内无该年份数据时回退为「周一~周五」启发式。
 */
function isCnWorkingDay(beijing: Date): boolean {
	const y = beijing.getUTCFullYear()
	const m = String(beijing.getUTCMonth() + 1).padStart(2, "0")
	const d = String(beijing.getUTCDate()).padStart(2, "0")
	const key = `${y}-${m}-${d}`
	const cal = CN_HOLIDAY_CALENDAR[String(y)]
	if (cal) {
		if (cal.holidays.includes(key)) {
			return false // 法定节假日→休息
		}
		if (cal.workdays.includes(key)) {
			return true // 调休补班日→上班
		}
	}
	const day = beijing.getUTCDay()
	return day >= 1 && day <= 5 // 回退：周一~周五
}

/**
 * 判断给定时刻是否处于 DeepSeek 高峰计费时段。
 *
 * 不依赖运行环境本地时区：把 epoch 平移 +8h 得到「北京时间墙钟」，再读 UTC 分量。
 * 已内置法定节假日/调休补班日历：节假日全天谷价，补班周末峰价，年份缺数据回退按周几。
 *
 * @param at 判定时刻，默认当前时间。
 */
export function isDeepSeekPeakHour(at: Date = new Date()): boolean {
	const beijing = new Date(at.getTime() + 8 * 3_600_000) // UTC → 北京时间墙钟
	if (!isCnWorkingDay(beijing)) {
		return false // 休息日（周末且非补班，或法定节假日）全天谷价
	}
	const hour = beijing.getUTCHours() + beijing.getUTCMinutes() / 60
	// 高峰：09:00–12:00、14:00–18:00（左闭右开）
	return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** 高峰相对空闲的价格倍率。 */
export const DEEPSEEK_PEAK_MULTIPLIER = 2

/**
 * DeepSeek 单次请求的精确费用（人民币元）。
 *
 * 计费 = (命中×命中单价 + 未命中×未命中单价 + 输出×输出单价) / 1e6，
 * 命中/未命中/输出单价取 modelInfo 的空闲价，再按当前时段整体乘峰谷倍率。
 * 这里 modelInfo.cacheReadsPrice=输入(缓存命中)、cacheWritesPrice=输入(缓存未命中)、
 * outputPrice=输出（与 `deepSeekModels` 的字段语义一致，inputPrice 恒为 0）。
 *
 * @param cacheHitTokens  缓存命中输入 token 数（prompt_cache_hit_tokens）
 * @param cacheMissTokens 缓存未命中输入 token 数（prompt_cache_miss_tokens）
 * @param outputTokens    输出 token 数
 * @param at              计费时刻，默认当前时间（用于判定峰/谷）
 */
export function calculateDeepSeekCost(
	modelInfo: ModelInfo,
	cacheHitTokens: number,
	cacheMissTokens: number,
	outputTokens: number,
	at: Date = new Date(),
): number {
	const hitPrice = modelInfo.cacheReadsPrice ?? 0 // 输入（缓存命中）
	const missPrice = modelInfo.cacheWritesPrice ?? 0 // 输入（缓存未命中）
	const outPrice = modelInfo.outputPrice ?? 0 // 输出

	const rawYuanPerMillion =
		hitPrice * (cacheHitTokens || 0) + missPrice * (cacheMissTokens || 0) + outPrice * (outputTokens || 0)

	const multiplier = isDeepSeekPeakHour(at) ? DEEPSEEK_PEAK_MULTIPLIER : 1
	return (rawYuanPerMillion / 1_000_000) * multiplier
}

/**
 * 缓存命中率（0~1）：命中输入 / 总输入（命中+未命中）。
 * 与 UI 展示口径一致——总输入即 `prompt_tokens`。
 */
export function deepSeekCacheHitRate(cacheHitTokens: number, totalInputTokens: number): number {
	if (!totalInputTokens || totalInputTokens <= 0) {
		return 0
	}
	return Math.min(1, Math.max(0, (cacheHitTokens || 0) / totalInputTokens))
}

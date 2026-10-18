import type { ModelInfo } from "@shared/api"

/**
 * Formats a price as a currency string
 * @param currency 计价货币，默认美元；DeepSeek 等国内模型用人民币
 */
export const formatPrice = (price: number, currency: "USD" | "CNY" = "USD") => {
	return new Intl.NumberFormat(currency === "CNY" ? "zh-CN" : "en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(price)
}

/**
 * Helper function to format token prices for display
 * @param price The price per million tokens
 */
export const formatTokenPrice = (price: number, currency: "USD" | "CNY" = "USD") => {
	return `${formatPrice(price, currency)}/million tokens`
}

/**
 * 计价货币。DeepSeek 官方定价以人民币计，其余提供方按美元。
 * 直接由模型名推导，避免为了一个展示字段去改 proto 传输层。
 */
export const getPriceCurrency = (modelId?: string): "USD" | "CNY" =>
	modelId && modelId.toLowerCase().includes("deepseek") ? "CNY" : "USD"

/** 货币符号，用于紧凑显示 */
export const currencySymbol = (currency: "USD" | "CNY" = "USD") => (currency === "CNY" ? "¥" : "$")

/**
 * Helper function to determine if a model supports thinking budget
 */
export const hasThinkingBudget = (modelInfo: ModelInfo): boolean => {
	return !!modelInfo.thinkingConfig && Object.keys(modelInfo.thinkingConfig).length > 0
}

/**
 * Helper function to check if a model supports images
 */
export const supportsImages = (modelInfo: ModelInfo): boolean => {
	return !!modelInfo.supportsImages
}

/**
 * Helper function to check if a model supports browser use
 */
export const supportsBrowserUse = (modelInfo: ModelInfo): boolean => {
	return !!modelInfo.supportsImages // browser tool uses image recognition
}

/**
 * Helper function to check if a model supports prompt caching
 */
export const supportsPromptCache = (modelInfo: ModelInfo): boolean => {
	return !!modelInfo.supportsPromptCache
}

/**
 * Helper function to format token limits for display
 */
export const formatTokenLimit = (limit: number): string => {
	return limit.toLocaleString()
}

/**
 * Parses a price input string to a number, handling edge cases like
 * incomplete decimals (e.g., ".", ".5", "0.") gracefully.
 *
 * @param value - The input string to parse
 * @param defaultValue - The fallback value if input is empty or invalid
 * @returns A valid number, or the default value if parsing fails
 */
export const parsePrice = (value: string, defaultValue: number): number => {
	if (value === "" || value === ".") {
		return defaultValue
	}
	const num = Number.parseFloat(value)
	return Number.isNaN(num) ? defaultValue : num
}

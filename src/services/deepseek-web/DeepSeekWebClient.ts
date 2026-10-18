import axios from "axios"
import { Logger } from "@/shared/services/Logger"

/**
 * era harness 联网能力底座：DeepSeek 官方 Search/Fetch API 客户端。
 *
 * 文档：https://api-docs.deepseek.com/zh-cn/guides/search/
 * - POST /v1/tools/search  按 query 搜索网页（5 元/千次成功请求，Search 5 QPS）
 * - POST /v1/tools/fetch   抓取指定 URL 的 markdown 正文（5 元/千次成功请求，Fetch 5 QPS）
 * - 鉴权：Bearer <DeepSeek API Key>（与对话 API 同一个 key）
 * - 仅 HTTP 200 且有结果才计费；失败/无结果/超时不计费
 */

const DEFAULT_BASE_URL = "https://api.deepseek.com"

export interface DeepSeekWebSearchResult {
	title: string
	url: string
	snippet: string
	summary?: string
	content?: string
	site_name?: string | null
	site_icon?: string | null
	date?: string | null
	authority?: number
	rerank_score?: number
}

export interface DeepSeekWebSearchOptions {
	/** 返回条数，1~50，默认 10 */
	count?: number
	/** 是否在 content 字段返回网页正文，默认 false */
	needContent?: boolean
	/** 触发搜索的用户原始问题，有助于理解搜索意图 */
	oriQuestion?: string
}

export interface DeepSeekWebFetchResult {
	title: string
	content: string
}

/** 把 DeepSeek API 的错误码翻译成用户可行动的中文提示 */
function describeHttpError(status: number, fallbackMessage: string): string {
	switch (status) {
		case 401:
			return "DeepSeek API Key 无效或已过期，请在设置中重新配置"
		case 402:
			return "DeepSeek 账户余额不足，请充值后重试（搜索/抓取按次计费）"
		case 404:
			return "未能获取网页内容：URL 不可用、被目标站点拦截或内容类型不支持"
		case 408:
		case 429:
			return "请求被限制（QPS 超限或超时），请稍后重试"
		default:
			if (status >= 500) {
				return `DeepSeek 服务端错误（HTTP ${status}），请稍后重试`
			}
			return fallbackMessage || `请求失败（HTTP ${status}）`
	}
}

export class DeepSeekWebClient {
	constructor(
		private readonly apiKey: string,
		private readonly baseUrl: string = DEFAULT_BASE_URL,
	) {
		if (!apiKey) {
			throw new Error("DeepSeekWebClient 需要 API Key")
		}
	}

	/**
	 * 按 query 搜索网页。domainFilters.allowed / blocked 会转成 DeepSeek 搜索语法：
	 * allowed: ["a.com","b.com"] → site:a.com OR site:b.com
	 * blocked: ["x.com"]         → -site:x.com
	 */
	async search(
		query: string,
		options: DeepSeekWebSearchOptions & {
			domainFilters?: { allowed?: string[]; blocked?: string[] }
		} = {},
	): Promise<DeepSeekWebSearchResult[]> {
		const { domainFilters, ...rest } = options
		const finalQuery = this.buildQuery(query, domainFilters)
		const count = Math.min(Math.max(rest.count ?? 10, 1), 50)

		try {
			const response = await axios.post(
				`${this.baseUrl}/v1/tools/search`,
				{
					query: finalQuery,
					count,
					need_content: rest.needContent ?? false,
					ori_question: rest.oriQuestion ?? null,
				},
				{
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					timeout: 20000,
				},
			)
			return (response.data?.results ?? []) as DeepSeekWebSearchResult[]
		} catch (error) {
			throw new Error(this.wrapError("搜索", error))
		}
	}

	/** 抓取指定 URL，返回 { title, content }（content 为 markdown） */
	async fetchUrl(url: string): Promise<DeepSeekWebFetchResult> {
		try {
			const response = await axios.post(
				`${this.baseUrl}/v1/tools/fetch`,
				{ url },
				{
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					timeout: 20000,
				},
			)
			return {
				title: response.data?.title ?? "",
				content: response.data?.content ?? "",
			}
		} catch (error) {
			throw new Error(this.wrapError("抓取", error))
		}
	}

	private buildQuery(query: string, filters?: { allowed?: string[]; blocked?: string[] }): string {
		let finalQuery = query.trim()
		const allowed = (filters?.allowed ?? []).filter((d) => d?.trim()).map((d) => d.trim())
		const blocked = (filters?.blocked ?? []).filter((d) => d?.trim()).map((d) => d.trim())

		if (allowed.length > 0) {
			// 多站点用 OR 连接（DeepSeek 搜索语法）
			finalQuery += ` ${allowed.map((d) => `site:${d}`).join(" OR ")}`
		}
		for (const domain of blocked) {
			finalQuery += ` -site:${domain}`
		}
		return finalQuery
	}

	private wrapError(action: string, error: unknown): string {
		if (axios.isAxiosError(error)) {
			const status = error.response?.status
			if (status) {
				return `${action}失败：${describeHttpError(status, error.message)}`
			}
			return `${action}失败：网络错误（${error.message}）`
		}
		const message = error instanceof Error ? error.message : String(error)
		Logger.error(`[DeepSeekWebClient] ${action}异常:`, error)
		return `${action}失败：${message}`
	}
}

/**
 * eratw 一键更新 —— 最小 HTTP 客户端。
 *
 * **为什么不用 `fetch`（undici）**
 *
 * GitLab 的 `/-/archive/` 归档端点会把带 `Sec-Fetch-Mode: cors` 的请求判为
 * `406 Not Acceptable`。而 `sec-*` 是 Fetch 规范里的 forbidden header name，
 * undici 会强制注入、调用方**传 headers 也覆盖不掉**。实测对照：
 *
 * | 请求方                              | 结果 |
 * | ----------------------------------- | ---- |
 * | `node:https` 裸请求                 | 200  |
 * | `node:https` + `sec-fetch-mode:cors`| 406  |
 * | `fetch()`（无论怎么传 headers）     | 406  |
 *
 * 所以归档下载只能走 `node:https`。为了不出现「同一个功能两套 HTTP 栈」，
 * 更新源的所有网络请求都统一走这里——JSON 接口也一并走，省得以后换个
 * GitLab 实例又被同一个坑绊住。
 *
 * 另一点：默认发 `accept-encoding: identity`。`fetch` 会自动解压，而
 * `node:https` 不会；统一不让服务器压缩，就不必在这里实现 gzip/br 解码。
 * 归档文件本身是 `.tar.gz`，靠 `content-type` 而非 `content-encoding` 传输，
 * 不受影响。
 */

import { createWriteStream } from "node:fs"
import type { IncomingHttpHeaders, IncomingMessage } from "node:http"
import http from "node:http"
import https from "node:https"
import { pipeline } from "node:stream/promises"

export interface HttpGetOptions {
	headers?: Record<string, string>
	signal?: AbortSignal
	/** 最多跟随几次重定向（GitLab 归档可能 302 到对象存储） */
	maxRedirects?: number
	/** 连接与空闲超时 */
	timeoutMs?: number
}

export interface HttpResponse {
	status: number
	headers: IncomingHttpHeaders
	stream: IncomingMessage
	/** 跟随重定向之后的最终地址 */
	url: string
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_REDIRECTS = 5

function requestOnce(
	url: string,
	opts: HttpGetOptions,
): Promise<{ status: number; headers: IncomingHttpHeaders; stream: IncomingMessage }> {
	let target: URL
	try {
		target = new URL(url)
	} catch {
		return Promise.reject(new Error(`无效的地址: ${url}`))
	}
	const lib = target.protocol === "http:" ? http : target.protocol === "https:" ? https : null
	if (!lib) {
		return Promise.reject(new Error(`不支持的协议: ${target.protocol}`))
	}

	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

	return new Promise((resolve, reject) => {
		const req = lib.request(
			target,
			{
				method: "GET",
				headers: {
					"accept-encoding": "identity",
					...opts.headers,
				},
			},
			(res) => {
				resolve({ status: res.statusCode ?? 0, headers: res.headers, stream: res })
			},
		)

		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error(`请求超时（${timeoutMs}ms）: ${url}`))
		})
		req.on("error", reject)

		const signal = opts.signal
		if (signal) {
			if (signal.aborted) {
				req.destroy(new Error("已取消"))
			} else {
				const onAbort = () => req.destroy(new Error("已取消"))
				signal.addEventListener("abort", onAbort, { once: true })
				req.on("close", () => signal.removeEventListener("abort", onAbort))
			}
		}

		req.end()
	})
}

/** 发 GET，跟随重定向，返回未消费的响应流（调用方负责读完或销毁） */
export async function httpGet(url: string, opts: HttpGetOptions = {}): Promise<HttpResponse> {
	const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS
	let current = url

	for (let hop = 0; hop <= maxRedirects; hop++) {
		const res = await requestOnce(current, opts)
		const location = res.headers.location
		const redirect = res.status >= 300 && res.status < 400 && location
		if (!redirect) {
			return { ...res, url: current }
		}
		// 重定向响应体没用，排空后丢弃，避免占着 socket
		res.stream.resume()
		current = new URL(location as string, current).toString()
	}

	throw new Error(`重定向次数过多（>${maxRedirects}）: ${url}`)
}

export interface HttpBufferResponse {
	status: number
	headers: IncomingHttpHeaders
	body: Buffer
	url: string
}

/** 发 GET 并把响应体整个读进内存（给小的 JSON / 单文件用） */
export async function httpGetBuffer(url: string, opts: HttpGetOptions = {}): Promise<HttpBufferResponse> {
	const res = await httpGet(url, opts)
	const chunks: Buffer[] = []
	for await (const chunk of res.stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
	}
	return { status: res.status, headers: res.headers, body: Buffer.concat(chunks), url: res.url }
}

/** 发 GET 并把响应体流式写到文件（先写 `.part`，成功后 rename） */
export async function httpDownload(
	url: string,
	destPath: string,
	opts: HttpGetOptions & { onProgress?: (received: number, total: number) => void } = {},
): Promise<number> {
	const res = await httpGet(url, opts)
	if (res.status < 200 || res.status >= 300) {
		const detail = await readErrorSnippet(res.stream)
		throw new HttpStatusError(`HTTP ${res.status}`, res.status, detail)
	}

	const total = Number(res.headers["content-length"] ?? 0)
	let received = 0
	const part = `${destPath}.part`

	await pipeline(
		res.stream,
		async function* (source) {
			for await (const chunk of source) {
				const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
				received += buf.length
				opts.onProgress?.(received, total)
				yield buf
			}
		},
		createWriteStream(part),
	)

	const { rename } = await import("node:fs/promises")
	await rename(part, destPath)
	return received
}

/** 带状态码的 HTTP 错误，调用方可以据 `status` 决定要不要降级 */
export class HttpStatusError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly detail = "",
	) {
		super(detail ? `${message}（${detail}）` : message)
		this.name = "HttpStatusError"
	}
}

/** 读响应体开头一小段，用于错误信息（服务端通常会把原因写在里面） */
async function readErrorSnippet(stream: IncomingMessage, limit = 200): Promise<string> {
	const chunks: Buffer[] = []
	let size = 0
	try {
		for await (const chunk of stream) {
			const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
			chunks.push(buf)
			size += buf.length
			if (size >= limit) {
				break
			}
		}
	} catch {
		// 读错误体失败不影响主流程
	} finally {
		stream.destroy()
	}
	return Buffer.concat(chunks).toString("utf8").replace(/\s+/g, " ").trim().slice(0, limit)
}

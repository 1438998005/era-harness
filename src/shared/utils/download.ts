/**
 * 流式下载 vsix 到 `.part`（3.91.1）。
 *
 * 为什么单独一个文件：这段是"点了下载没反应"那次事故的正中央，必须能被单测覆盖。
 * 因此这里**不 import vscode**，只吃 Node 内置能力 + 注入的 fetch，取消走 `AbortSignal`。
 *
 * 三条硬约束（别改回去）：
 * 1. **先写 `.part`，校验全过才由调用方改名**——半个包绝不交给安装器；
 * 2. **第一块就验 ZIP 头**——GitHub 出错时回的是 HTML 错误页，不该白下 8MB；
 * 3. **三档超时**（首字节 / 停滞 / 总计）——34 KB/s 不该让用户等 40 分钟，卡住要能自己死。
 */

import { createHash } from "node:crypto"
import type { FileHandle } from "node:fs/promises"
import fs from "node:fs/promises"
import { formatBytes, formatSpeed, isValidDownloadedVsix } from "./version"

export type DownloadErrorKind = "cancelled" | "timeout" | "network" | "http" | "integrity" | "size" | "io"

/** 分类过的下载错误：`kind` 决定文案与"能不能改走直连"，message 是给用户看的人话 */
export class DownloadError extends Error {
	readonly kind: DownloadErrorKind

	constructor(kind: DownloadErrorKind, message: string) {
		super(message)
		this.kind = kind
		this.name = "DownloadError"
	}
}

export interface DownloadTimeouts {
	/** 连上之后多久没有任何数据算超时 */
	firstByteMs: number
	/** 收到过数据之后，多久没有新数据算卡死 */
	stallMs: number
	/** 总计上限 */
	totalMs: number
}

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>

export interface StreamDownloadOptions {
	fetchImpl: FetchLike
	url: string
	/** 目标 `.part` 路径（调用方负责决定最终文件名） */
	partPath: string
	/** Release 元数据里声明的体积，用于算百分比与最终校验；<=0 表示未知 */
	expectedSize: number
	/** 硬上限，防止被喂超大文件 */
	maxBytes: number
	userAgent: string
	/** 外部取消（用户点了「取消」） */
	signal?: AbortSignal
	timeouts: DownloadTimeouts
	/** 进度回调；内部已节流（整数百分比变化或 ≥200ms） */
	onProgress?: (received: number, total: number, bytesPerSecond: number) => void
	/** 便于测试注入时钟 */
	now?: () => number
}

/** 进度节流窗口：整数百分比变化或 ≥200ms 才回调 */
export const PROGRESS_MIN_INTERVAL_MS = 200
/** 速率采样窗口（EMA 平滑） */
export const SPEED_SAMPLE_MS = 500

export function isZipHeader(head: Uint8Array): boolean {
	return head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
}

/** 约剩多久：只给到"分"这一级，秒级跳动反而让人焦虑 */
export function formatEta(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) {
		return "不到 1 秒"
	}
	if (seconds < 60) {
		return `${Math.max(1, Math.ceil(seconds))} 秒`
	}
	if (seconds < 3600) {
		return `${Math.ceil(seconds / 60)} 分`
	}
	return `${(seconds / 3600).toFixed(1)} 小时`
}

/** `下载中 42% · 3.2/7.6 MB · 812 KB/s · 约剩 1 分` */
export function describeDownload(received: number, total: number, bytesPerSecond: number): string {
	const percent = total > 0 ? Math.min(100, Math.floor((received / total) * 100)) : 0
	const parts = [`下载中 ${percent}%`, `${formatBytes(received)}/${formatBytes(total)}`]
	if (bytesPerSecond > 0) {
		parts.push(formatSpeed(bytesPerSecond))
		const remain = (total - received) / bytesPerSecond
		if (remain > 0) {
			parts.push(`约剩 ${formatEta(remain)}`)
		}
	}
	return parts.join(" · ")
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/**
 * 下载到 `.part` 并返回体积与 sha256。
 *
 * 失败时**不删** `.part`（调用方统一在 catch 里删，因为它可能还想改走直连重下）。
 * 返回的 sha256 是裸十六进制，比对交给 `matchesSha256`。
 */
export async function streamDownloadToPart(options: StreamDownloadOptions): Promise<{ bytes: number; sha256: string }> {
	const { expectedSize, maxBytes, timeouts } = options
	const now = options.now ?? Date.now

	const controller = new AbortController()
	let abortKind: DownloadErrorKind = "cancelled"
	let abortMessage = "已取消"
	/**
	 * 取消/超时必须能**打断 `await`**，不能只靠 abort 信号。
	 *
	 * `controller.abort()` 只能保证 fetch 层收到信号；`reader.read()` 是否跟着 reject
	 * 取决于底层实现（undici 会，但这不是我们可以依赖的契约）。所以这里额外准备一个
	 * 拒绝用的 promise，和每一次 `await` 赛跑——否则"卡住"就会真的永远卡住。
	 */
	let rejectAborted: ((error: DownloadError) => void) | undefined
	const aborted = new Promise<never>((_, reject) => {
		rejectAborted = reject
	})
	// 赛跑先结束时，aborted 的拒绝仍然需要被"接住"，否则会变成 unhandled rejection
	aborted.catch(() => {})

	const abortWith = (kind: DownloadErrorKind, message: string) => {
		if (controller.signal.aborted) {
			return
		}
		abortKind = kind
		abortMessage = message
		controller.abort()
		rejectAborted?.(new DownloadError(kind, message))
	}

	if (options.signal?.aborted) {
		throw new DownloadError("cancelled", "已取消")
	}
	const onExternalAbort = () => abortWith("cancelled", "已取消")
	options.signal?.addEventListener("abort", onExternalAbort, { once: true })

	const firstByteTimer = setTimeout(
		() => abortWith("timeout", `连接后 ${Math.round(timeouts.firstByteMs / 1000)} 秒没有任何数据`),
		timeouts.firstByteMs,
	)
	const totalTimer = setTimeout(
		() => abortWith("timeout", `下载超过 ${Math.round(timeouts.totalMs / 60_000)} 分钟仍未完成`),
		timeouts.totalMs,
	)
	let stallTimer: ReturnType<typeof setTimeout> | undefined
	const armStall = () => {
		if (stallTimer) {
			clearTimeout(stallTimer)
		}
		stallTimer = setTimeout(
			() => abortWith("timeout", `下载卡住 ${Math.round(timeouts.stallMs / 1000)} 秒没有新数据`),
			timeouts.stallMs,
		)
	}

	let handle: FileHandle | undefined
	try {
		const response = await Promise.race([
			options.fetchImpl(options.url, {
				headers: { "User-Agent": options.userAgent },
				signal: controller.signal,
			}),
			aborted,
		])
		if (!response.ok) {
			throw new DownloadError("http", `下载失败：HTTP ${response.status} ${response.statusText}`)
		}
		if (!response.body) {
			throw new DownloadError("network", "下载失败：响应没有内容")
		}

		const reader = response.body.getReader()
		clearTimeout(firstByteTimer)
		armStall()

		try {
			handle = await fs.open(options.partPath, "w")
		} catch (error) {
			throw new DownloadError("io", `无法写入临时文件：${messageOf(error)}`)
		}

		const hash = createHash("sha256")
		let received = 0
		let head: Buffer = Buffer.alloc(0)
		let headerChecked = false
		let bytesPerSecond = 0
		let sampleAt = now()
		let sampleBytes = 0
		let lastReportPercent = -1
		let lastReportAt = 0

		while (true) {
			const { done, value } = await Promise.race([reader.read(), aborted])
			if (done) {
				break
			}
			if (!value || value.length === 0) {
				continue
			}

			if (!headerChecked) {
				head = Buffer.concat([head, Buffer.from(value)])
				if (head.length >= 4) {
					headerChecked = true
					if (!isZipHeader(head)) {
						throw new DownloadError("integrity", "下载内容不是合法的 vsix（ZIP 头校验失败）")
					}
					head = Buffer.alloc(0)
				}
			}

			received += value.length
			if (received > maxBytes) {
				throw new DownloadError("size", `下载体积超过上限（${formatBytes(maxBytes)}），已中止`)
			}

			hash.update(value)
			await handle.write(value)
			armStall()

			const timestamp = now()
			if (timestamp - sampleAt >= SPEED_SAMPLE_MS) {
				const instant = ((received - sampleBytes) * 1000) / (timestamp - sampleAt)
				bytesPerSecond = bytesPerSecond === 0 ? instant : bytesPerSecond * 0.6 + instant * 0.4
				sampleAt = timestamp
				sampleBytes = received
			}

			const percent = expectedSize > 0 ? Math.floor((received / expectedSize) * 100) : 0
			if (percent > lastReportPercent || timestamp - lastReportAt >= PROGRESS_MIN_INTERVAL_MS) {
				lastReportPercent = percent
				lastReportAt = timestamp
				options.onProgress?.(received, expectedSize, bytesPerSecond)
			}
		}

		if (received === 0) {
			throw new DownloadError("integrity", "下载到 0 字节，什么也没拿到")
		}
		if (!headerChecked) {
			throw new DownloadError("integrity", "下载内容太短，不是合法的 vsix")
		}
		if (!isValidDownloadedVsix(received, expectedSize)) {
			throw new DownloadError(
				"size",
				`下载体积与 Release 声明不一致（收到 ${formatBytes(received)}，声明 ${formatBytes(expectedSize)}）`,
			)
		}

		return { bytes: received, sha256: hash.digest("hex") }
	} catch (error) {
		if (controller.signal.aborted) {
			throw new DownloadError(abortKind, abortMessage)
		}
		throw error instanceof DownloadError ? error : new DownloadError("network", messageOf(error))
	} finally {
		clearTimeout(firstByteTimer)
		clearTimeout(totalTimer)
		if (stallTimer) {
			clearTimeout(stallTimer)
		}
		options.signal?.removeEventListener("abort", onExternalAbort)
		await handle?.close().catch(() => {})
	}
}

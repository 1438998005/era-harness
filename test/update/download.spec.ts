/**
 * 流式下载的回归网（3.91.1）。
 *
 * 这段代码是"点了下载没反应"那次事故的正中央：旧实现无进度、无超时、整包进内存。
 * 所以这里的用例全部钉在**行为**上——超时真的会死、取消真的会停、错字节真的会被拒。
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
	DownloadError,
	describeDownload,
	type FetchLike,
	formatEta,
	isZipHeader,
	PROGRESS_MIN_INTERVAL_MS,
	streamDownloadToPart,
} from "../../src/shared/utils/download"

const ZIP_PREFIX = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const TIMEOUTS = { firstByteMs: 5_000, stallMs: 5_000, totalMs: 60_000 }

function sha256Of(data: Uint8Array): string {
	return createHash("sha256").update(data).digest("hex")
}

/** 拼一个以 ZIP 头开头的假 vsix */
function fakeVsix(payloadBytes: number): Buffer {
	return Buffer.concat([ZIP_PREFIX, Buffer.alloc(Math.max(0, payloadBytes - ZIP_PREFIX.length), 0x41)])
}

/** 把一串块做成真正的 ReadableStream，`getReader()` 因此是原生行为 */
function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(chunk)
			}
			controller.close()
		},
	})
}

/** 一个永远不给数据也不关闭的流：用来测「卡住」 */
function hangingStream(first?: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			if (first) {
				controller.enqueue(first)
			}
		},
	})
}

function responseOf(body: ReadableStream<Uint8Array> | null, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? "OK" : "Error",
		body,
	} as unknown as Response
}

function fetchReturning(response: Response): FetchLike {
	return async () => response
}

async function tempDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), "era-download-"))
}

async function run(options: {
	response?: Response
	fetchImpl?: FetchLike
	bytes: Buffer
	chunks?: Uint8Array[]
	expectedSize?: number
	maxBytes?: number
	signal?: AbortSignal
	timeouts?: typeof TIMEOUTS
	onProgress?: (received: number, total: number, bps: number) => void
	now?: () => number
}) {
	const dir = await tempDir()
	const partPath = path.join(dir, "x.vsix.part")
	const body = options.chunks ? streamOf(options.chunks) : streamOf([options.bytes])
	try {
		const result = await streamDownloadToPart({
			fetchImpl: options.fetchImpl ?? fetchReturning(options.response ?? responseOf(body)),
			url: "https://example.invalid/x.vsix",
			partPath,
			expectedSize: options.expectedSize ?? options.bytes.length,
			maxBytes: options.maxBytes ?? 200 * 1024 * 1024,
			userAgent: "test/1.0",
			signal: options.signal,
			timeouts: options.timeouts ?? TIMEOUTS,
			onProgress: options.onProgress,
			now: options.now,
		})
		return { result, partPath, dir }
	} finally {
		await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
	}
}

// ————————————————————————————————————————————————
// 正常路径
// ————————————————————————————————————————————————

test("正常下载：字节数与 sha256 都对，且真的落到 .part", async () => {
	const bytes = fakeVsix(8192)
	const chunks = [bytes.subarray(0, 2048), bytes.subarray(2048, 4096), bytes.subarray(4096)]
	const dir = await tempDir()
	const partPath = path.join(dir, "x.vsix.part")
	try {
		const result = await streamDownloadToPart({
			fetchImpl: fetchReturning(responseOf(streamOf(chunks))),
			url: "https://example.invalid/x.vsix",
			partPath,
			expectedSize: bytes.length,
			maxBytes: 200 * 1024 * 1024,
			userAgent: "test/1.0",
			timeouts: TIMEOUTS,
		})
		assert.equal(result.bytes, bytes.length)
		assert.equal(result.sha256, sha256Of(bytes), "sha256 必须按真实落盘字节算")
		const written = await fs.readFile(partPath)
		assert.equal(written.length, bytes.length)
		assert.deepEqual(written, bytes, "写下去的内容必须与响应逐字节一致")
	} finally {
		await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
	}
})

test("正常下载：进度单调递增且最后停在 100%", async () => {
	const bytes = fakeVsix(10_000)
	const reports: Array<{ received: number; total: number }> = []
	let clock = 0
	await run({
		bytes,
		onProgress: (received, total) => {
			reports.push({ received, total })
		},
		// 每次读都推进 300ms，保证节流窗口允许上报
		now: () => (clock += 300),
	})

	assert.ok(reports.length > 0, "至少要上报一次进度")
	for (let index = 1; index < reports.length; index++) {
		assert.ok(reports[index].received >= reports[index - 1].received, "已下字节不许回退")
	}
	assert.equal(reports.at(-1)?.received, bytes.length)
	assert.equal(reports.at(-1)?.total, bytes.length)
})

test("进度节流：同一整数百分比内的多个块不会各报一次", async () => {
	// 1000 块 × 1 字节、时钟固定 → 只有整数百分比变化才回调，约 101 次而不是 1000 次
	const bytes = fakeVsix(1000)
	const chunks = Array.from({ length: 1000 }, (_, index) => bytes.subarray(index, index + 1))
	let calls = 0
	await run({
		bytes,
		chunks,
		onProgress: () => {
			calls += 1
		},
		now: () => 0,
	})
	assert.ok(calls >= 2, "该报的还是要报")
	assert.ok(calls <= 101, `1000 块最多报 101 次（实际 ${calls} 次，窗口 ${PROGRESS_MIN_INTERVAL_MS}ms）`)
})

// ————————————————————————————————————————————————
// 拒绝坏内容
// ————————————————————————————————————————————————

test("HTML 错误页：ZIP 头不过 → integrity，且不白下整包", async () => {
	const html = Buffer.from("<html><body>429 Too Many Requests</body></html>")
	await assert.rejects(
		() => run({ bytes: html }),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "integrity")
			assert.match(error.message, /ZIP 头/)
			return true
		},
	)
})

test("HTTP 4xx/5xx：直接 http，不去读 body", async () => {
	await assert.rejects(
		() => run({ bytes: fakeVsix(64), response: responseOf(null, 404) }),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "http")
			assert.match(error.message, /HTTP 404/)
			return true
		},
	)
})

test("体积与声明不一致 → size", async () => {
	await assert.rejects(
		() => run({ bytes: fakeVsix(4096), expectedSize: 8192 }),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "size")
			return true
		},
	)
})

test("0 字节 → integrity", async () => {
	await assert.rejects(
		() => run({ bytes: Buffer.alloc(0) }),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "integrity")
			assert.match(error.message, /0 字节/)
			return true
		},
	)
})

test("不足 4 字节 → integrity（不是 ZIP）", async () => {
	await assert.rejects(
		() => run({ bytes: Buffer.from([0x50, 0x4b, 0x03]), expectedSize: 3 }),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "integrity")
			return true
		},
	)
})

test("超过硬上限 → size，不会把磁盘写满", async () => {
	await assert.rejects(
		() => run({ bytes: fakeVsix(4096), expectedSize: 4096, maxBytes: 1024 }),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "size")
			assert.match(error.message, /上限/)
			return true
		},
	)
})

// ————————————————————————————————————————————————
// 取消与超时：必须真的能打断 await
// ————————————————————————————————————————————————

test("用户取消：卡住的流也能立刻停 → cancelled", async () => {
	const controller = new AbortController()
	const pending = run({
		bytes: fakeVsix(1024),
		fetchImpl: async () => responseOf(hangingStream(ZIP_PREFIX)),
		signal: controller.signal,
	})
	setTimeout(() => controller.abort(), 20)
	await assert.rejects(pending, (error: unknown) => {
		assert.ok(error instanceof DownloadError)
		assert.equal(error.kind, "cancelled")
		return true
	})
})

test("首字节超时：fetch 一直不返回也会自己死 → timeout", async () => {
	const startedAt = Date.now()
	await assert.rejects(
		() =>
			run({
				bytes: fakeVsix(1024),
				fetchImpl: () => new Promise<Response>(() => {}),
				timeouts: { firstByteMs: 20, stallMs: 20, totalMs: 60_000 },
			}),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "timeout")
			return true
		},
	)
	assert.ok(Date.now() - startedAt < 2000, "超时必须真的打断 await，而不是等到底层自己超时")
})

test("停滞超时：收到过数据之后不再有新数据 → timeout", async () => {
	await assert.rejects(
		() =>
			run({
				bytes: fakeVsix(1024),
				fetchImpl: async () => responseOf(hangingStream(fakeVsix(1024))),
				timeouts: { firstByteMs: 5_000, stallMs: 20, totalMs: 60_000 },
			}),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "timeout")
			assert.match(error.message, /卡住/)
			return true
		},
	)
})

test("总计超时：慢速持续有数据也要在总时限上停住 → timeout", async () => {
	// 每块 1 字节、间隔 10ms 的无限流：停滞检测永远不会触发，只有总时限能停住它
	let sent = 0
	const endless = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(ZIP_PREFIX)
			sent += 1
			const timer = setInterval(() => {
				controller.enqueue(Buffer.from([0x41]))
				sent += 1
			}, 10)
			// 总时限到了之后清理，避免测试进程挂住
			setTimeout(() => clearInterval(timer), 500)
		},
	})
	await assert.rejects(
		() =>
			run({
				bytes: fakeVsix(1024),
				expectedSize: 0,
				fetchImpl: async () => responseOf(endless),
				timeouts: { firstByteMs: 5_000, stallMs: 5_000, totalMs: 60 },
			}),
		(error: unknown) => {
			assert.ok(error instanceof DownloadError)
			assert.equal(error.kind, "timeout")
			assert.match(error.message, /分钟/)
			return true
		},
	)
	assert.ok(sent > 0)
})

// ————————————————————————————————————————————————
// 文案与纯函数
// ————————————————————————————————————————————————

test("isZipHeader：只认 50 4b 03 04", () => {
	assert.equal(isZipHeader(Buffer.from([0x50, 0x4b, 0x03, 0x04])), true)
	assert.equal(isZipHeader(Buffer.from([0x50, 0x4b, 0x05, 0x06])), false, "空压缩包（EOCD）也不算 vsix")
	assert.equal(isZipHeader(Buffer.from([0x3c, 0x68, 0x74, 0x6d])), false, "<html>")
	assert.equal(isZipHeader(Buffer.from([0x50, 0x4b, 0x03])), false, "不足 4 字节")
})

test("formatEta：秒 / 分 / 小时三档", () => {
	assert.equal(formatEta(0), "不到 1 秒")
	assert.equal(formatEta(Number.NaN), "不到 1 秒")
	assert.equal(formatEta(0.4), "1 秒")
	assert.equal(formatEta(45), "45 秒")
	assert.equal(formatEta(61), "2 分")
	assert.equal(formatEta(3599), "60 分")
	assert.equal(formatEta(7200), "2.0 小时")
})

test("describeDownload：百分比 / 体积 / 速率 / 约剩", () => {
	const text = describeDownload(3.2 * 1024 * 1024, 7.6 * 1024 * 1024, 812 * 1024)
	assert.match(text, /^下载中 42%/)
	assert.match(text, /3\.2 MB\/7\.6 MB/)
	assert.match(text, /812 KB\/s/)
	assert.match(text, /约剩 \d+ 秒/)
})

test("describeDownload：速度为 0 时不编造速率与剩余时间", () => {
	const text = describeDownload(1024, 2048, 0)
	assert.equal(text, "下载中 50% · 1 KB/2 KB")
})

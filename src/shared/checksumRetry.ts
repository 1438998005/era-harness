/**
 * 08 #204 / #211：插件自更新时「校验文件下载 HTTP 401」的有限退避。
 *
 * 取证：2026-11-04 诊断包里同一份 vsix 的校验文件连续 4 次 401，第 5 次才成功；
 * 此前 `readChecksumFile()` 没有任何自动重试，只能靠用户在失败弹窗里反复点「重试」。
 *
 * 判据和整段重试循环都放在纯模块里：宿主 updateChecker 带 vscode 依赖，node:test 跑不了；
 * 这里通过 `fetchOnce` / `wait` / `makeError` 注入副作用，自动化测试能真跑请求序列与
 * AbortController 取消时序，而不是对着源码字符串做断言。
 */

/** 总尝试次数（含首次）。共享 15s 的校验超时预算，所以上限刻意压到 3 次。 */
export const CHECKSUM_MAX_ATTEMPTS = 3

const RETRY_BASE_DELAY_MS = 400

/** 只对瞬时状态重试；404/403 这类确定性失败立刻报错，别让用户干等。 */
export function isRetryableChecksumStatus(status: number): boolean {
	return status === 401 || status === 408 || status === 429 || (status >= 500 && status < 600)
}

/** 第 0 次失败后等待 400ms，第 1 次 800ms（指数退避，上限由尝试次数封顶）。 */
export function checksumRetryDelayMs(failedAttempt: number): number {
	return RETRY_BASE_DELAY_MS * 2 ** Math.max(0, failedAttempt)
}

export interface ChecksumFetchResponse {
	readonly ok: boolean
	readonly status: number
}

export interface ChecksumRetryOptions<TResponse extends ChecksumFetchResponse> {
	/** 宿主共享 15s 总预算/用户取消的 AbortSignal。 */
	signal: AbortSignal
	/** 发一次请求；把 signal 透传给底层 fetch。 */
	fetchOnce: (signal: AbortSignal) => Promise<TResponse>
	/** 重试前的进度文案回调，参数是 1-based 的「即将进行第几次」。 */
	onRetry?: (nextAttempt: number, maxAttempts: number) => void
	/** 可注入的等待（测试里传立即 resolve 的假时钟）；默认真实定时器 + abort 唤醒。 */
	wait?: (ms: number, signal: AbortSignal) => Promise<void>
	/** 宿主把普通错误翻译成带 kind 的 UpdateError，便于上层决定要不要改走直连。 */
	makeError: (message: string) => Error
}

/**
 * #211：signal 可能在监听器注册之前就已经 abort，此时 "abort" 事件不会再触发，
 * 只靠 setTimeout 会白等一整轮。等待前后都要显式检查，取消后绝不发请求。
 */
export function waitForChecksumRetry(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise<void>((resolve) => {
		if (signal.aborted) {
			resolve()
			return
		}
		let done = false
		const finish = () => {
			if (done) {
				return
			}
			done = true
			clearTimeout(id)
			signal.removeEventListener("abort", finish)
			resolve()
		}
		const id = setTimeout(finish, ms)
		signal.addEventListener("abort", finish, { once: true })
	})
}

/**
 * 取校验文件：最多 CHECKSUM_MAX_ATTEMPTS 次，只重试瞬时状态，成功即返回 response。
 *
 * 与旧实现相比，等待期间被取消时会在进入下一次 fetch **之前**拦下（旧代码只在循环顶部
 * 检查，而 wait 发生在循环顶部之后，所以取消后仍会带 aborted signal 发一次请求）。
 */
export async function fetchChecksumWithRetry<TResponse extends ChecksumFetchResponse>(
	options: ChecksumRetryOptions<TResponse>,
): Promise<TResponse> {
	const { signal, fetchOnce, onRetry, wait = waitForChecksumRetry, makeError } = options
	const cancelled = () => makeError("校验文件下载失败（请求已取消或超时）")

	for (let attempt = 0; attempt < CHECKSUM_MAX_ATTEMPTS; attempt++) {
		if (signal.aborted) {
			throw cancelled()
		}
		if (attempt > 0) {
			onRetry?.(attempt + 1, CHECKSUM_MAX_ATTEMPTS)
			await wait(checksumRetryDelayMs(attempt - 1), signal)
			if (signal.aborted) {
				throw cancelled()
			}
		}

		const response = await fetchOnce(signal)
		if (response.ok) {
			return response
		}
		if (!isRetryableChecksumStatus(response.status) || attempt === CHECKSUM_MAX_ATTEMPTS - 1) {
			throw makeError(`校验文件下载失败（HTTP ${response.status}）`)
		}
	}
	throw makeError("校验文件下载失败（重试已用尽）")
}

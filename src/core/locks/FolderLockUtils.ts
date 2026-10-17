import { Logger } from "@/shared/services/Logger"
import type { FolderLockOptions, FolderLockResult, FolderLockWithRetryResult } from "./types"

/**
 * Retry configuration for folder lock acquisition
 */
export interface FolderLockRetryConfig {
	initialDelayMs: number
	incrementPerAttemptMs: number
	maxTotalTimeoutMs: number
}

/**
 * Default retry configuration for folder locks:
 * - 500ms initial wait - this is typically enough for most cases
 * - +1s backoff per attempt
 * - 30s max total timeout
 */
export const DEFAULT_RETRY_CONFIG: FolderLockRetryConfig = {
	initialDelayMs: 500,
	incrementPerAttemptMs: 1000,
	maxTotalTimeoutMs: 30000,
}

/**
 * era harness 减法说明：
 * 上游的文件夹锁依赖 standalone 形态的 SqliteLockManager（多 cline-core 实例并发防护）。
 * VSCode 扩展为单实例形态，因此这里保留空实现：锁获取恒为 skipped，
 * 行为与上游 "lock manager 不可用" 分支完全一致（CheckpointLockUtils /
 * TaskLockUtils 已按 skipped 语义处理）。
 */

/**
 * Attempt to acquire a folder lock with retry logic.
 * This is a generic utility that works with any folder path.
 *
 * 单实例扩展模式：无跨进程锁，直接返回 skipped。
 *
 * @param lockTarget - The folder path to lock
 * @param config - Optional retry configuration if defaults are not suitable
 * @returns Result with skipped: true (no lock subsystem in extension mode)
 */
export async function tryAcquireFolderLockWithRetry(
	_options: FolderLockOptions,
	_config?: FolderLockRetryConfig,
): Promise<FolderLockWithRetryResult> {
	Logger.debug("Folder lock not available in extension mode - skipping lock acquisition")
	return { acquired: false, skipped: true }
}

/**
 * Release a folder lock safely with error handling.
 *
 * 单实例扩展模式：无需释放。
 *
 * @param lockTarget - The folder path to release
 */
export async function releaseFolderLock(_taskId: string, _lockTarget: string): Promise<void> {
	Logger.debug("Folder lock not available in extension mode - skipping lock release")
}

/**
 * Acquire a folder lock with no retry
 * @param options - Folder lock options including heldBy
 * @returns Result indicating if lock was acquired and any conflicting lock
 */
export async function acquireFolderLock(_options: FolderLockOptions): Promise<FolderLockResult> {
	Logger.debug("Folder lock not available in extension mode - cannot acquire folder lock")
	return { acquired: false }
}

/**
 * Retry a folder lock acquisition with exponential backoff.
 * @param operation - Function that attempts to acquire the lock
 * @param config - Optional retry configuration, uses defaults if not provided
 * @returns Promise that resolves with acquisition status and details
 */
export async function retryFolderLockAcquisition(
	operation: () => Promise<FolderLockWithRetryResult>,
	config: FolderLockRetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<FolderLockWithRetryResult> {
	const startTime = Date.now()
	let attemptCount = 0
	let lastResult: FolderLockWithRetryResult | undefined

	while (true) {
		const elapsedTime = Date.now() - startTime

		// Retries = check timeout before starting next attempt
		if (elapsedTime >= config.maxTotalTimeoutMs) {
			Logger.warn(`Folder lock acquisition timed out after ${config.maxTotalTimeoutMs}ms`)
			return lastResult || { acquired: false }
		}

		// Attempt lock acquisition
		try {
			const result = await operation()
			lastResult = result

			// Return immediately if skipped or acquired
			if (result.skipped || result.acquired) {
				if (result.acquired && attemptCount > 0) {
					Logger.debug(`Folder lock acquired after ${attemptCount + 1} attempts (${elapsedTime}ms)`)
				}
				return result
			}
		} catch (error) {
			Logger.error(`Error during folder lock acquisition attempt ${attemptCount + 1}:`, error)
		}

		// Prep for next attempt
		attemptCount++
		const baseDelay = config.initialDelayMs + attemptCount * config.incrementPerAttemptMs
		const remainingTime = config.maxTotalTimeoutMs - (Date.now() - startTime)
		const delay = Math.min(baseDelay, Math.max(0, remainingTime))

		if (delay <= 0) {
			Logger.warn(`Folder lock acquisition timed out after ${config.maxTotalTimeoutMs}ms`)
			return lastResult || { acquired: false }
		}

		Logger.log(`Folder lock held by another instance, retrying in ${delay}ms (attempt ${attemptCount})`)
		await new Promise((resolve) => setTimeout(resolve, delay))
	}
}

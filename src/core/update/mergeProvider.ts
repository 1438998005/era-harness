/**
 * eratw 一键更新 —— 把 `MergeAsk` 接到真实的模型调用上。
 *
 * `merge.ts` 刻意不依赖任何 provider（模型调用通过 `ask` 注入），所以那套
 * 窗口化 + 校验逻辑可以在单元测试里跑。这个文件是唯一的接线点：
 * 它把 `ask` 实现成「一次不带工具的一次性 completion」。
 *
 * 注意：这里只 `import type` ApiHandler，编译后不会把 provider 依赖带进
 * `core/update/` 的纯 Node 模块（该约束写在 `types.ts` 顶部约定里）。
 */

import type { ApiHandler } from "@core/api"
import type { MergeAsk, MergeAskInput } from "./merge"

export interface MergeAskOptions {
	/** 取消信号；合并过程中用户点了取消就走这里 */
	signal?: AbortSignal
	/** 每收到一段文本回调一次，用于 UI 上显示"正在合并…" */
	onToken?: (text: string) => void
	/** 单次合并的软上限（字符），超过就中止，避免模型跑飞烧 token */
	maxChars?: number
	/**
	 * 单窗口硬超时（毫秒）。模型挂住不返回时不能把整次更新卡死：
	 * 超时后调 `api.abort?.()` 并抛错，`runMerge` 会当成「这次尝试失败」→ 保留本地。
	 */
	timeoutMs?: number
}

export const DEFAULT_MERGE_MAX_CHARS = 200_000
export const DEFAULT_MERGE_TIMEOUT_MS = 180_000

/**
 * 把异步流与「超时」赛跑：超时那一侧 reject，迭代器在 finally 里被关闭。
 *
 * 不能只靠 `api.abort()`：只有 free provider 实现了 abort，其余 provider 的
 * 请求会继续在后台跑，但至少消费侧不会再卡住整次更新。
 */
async function* withDeadline<T>(source: AsyncIterable<T>, deadline: Promise<never>): AsyncGenerator<T> {
	const iterator = source[Symbol.asyncIterator]()
	try {
		for (;;) {
			const next = await Promise.race([iterator.next(), deadline])
			if (next.done) {
				return
			}
			yield next.value
		}
	} finally {
		// 超时/取消时主动收尾；**不能 await** —— 卡住的迭代器 return() 可能永不 settle，
		// 那会把看门狗自己变成新的卡死点。正常结束时这里是无害的 no-op。
		try {
			void iterator.return?.(undefined)?.catch(() => undefined)
		} catch {
			// 收尾失败不影响已抛出的超时/取消错误
		}
	}
}

/**
 * 把 ApiHandler 变成 `MergeAsk`。
 *
 * 失败一律抛错 —— `runMerge` 会把它当成"这次尝试失败"，带着原因重试，
 * 重试还不行就退回"保留本地"，不会写坏文件。
 */
export function createMergeAsk(api: ApiHandler, options: MergeAskOptions = {}): MergeAsk {
	const maxChars = options.maxChars ?? DEFAULT_MERGE_MAX_CHARS
	const timeoutMs = options.timeoutMs ?? DEFAULT_MERGE_TIMEOUT_MS

	return async (input: MergeAskInput): Promise<string> => {
		if (options.signal?.aborted) {
			throw new Error("已取消")
		}

		let text = ""
		let timer: ReturnType<typeof setTimeout> | undefined
		const deadline = new Promise<never>((_, reject) => {
			timer = setTimeout(() => {
				try {
					api.abort?.()
				} catch {
					// 取消失败不影响超时判定
				}
				reject(new Error(`合并超时（${Math.round(timeoutMs / 1000)} 秒没有结果），已放弃这次合并`))
			}, timeoutMs)
		})
		// 只发一轮 user 消息，不挂工具：这是纯粹的文本变换任务，
		// 让模型有机会调工具反而会让它输出工具调用而不是代码。
		const stream = api.createMessage(input.system, [{ role: "user", content: input.user }])

		try {
			for await (const chunk of withDeadline(stream, deadline)) {
				if (options.signal?.aborted) {
					throw new Error("已取消")
				}
				if (chunk.type !== "text") {
					continue
				}
				text += chunk.text
				options.onToken?.(chunk.text)
				if (text.length > maxChars) {
					throw new Error(`合并结果异常地长（超过 ${maxChars} 字符），已中止`)
				}
			}
		} finally {
			if (timer !== undefined) {
				clearTimeout(timer)
			}
		}

		if (text.trim() === "") {
			throw new Error("模型返回了空结果")
		}
		return text
	}
}

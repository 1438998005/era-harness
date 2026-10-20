/**
 * 真实 provider 接线的测试。
 *
 * 用假 ApiHandler 验证三件最容易出事的地方：
 * 1. 只把 text chunk 拼起来（不能把 thinking / usage 混进代码里）；
 * 2. 空结果要抛错（否则 `runMerge` 会把空串当成"合并成功"写盘）；
 * 3. 超长要中止（模型跑飞时不能把整个上下文烧完）。
 */

import assert from "node:assert/strict"
import test from "node:test"
import type { ApiHandler } from "../../src/core/api"
import { createMergeAsk } from "../../src/core/update/mergeProvider"

function fakeApi(chunks: Array<{ type: string; text?: string }>): ApiHandler {
	return {
		createMessage: () =>
			(async function* () {
				for (const chunk of chunks) {
					yield chunk
				}
			})(),
		getModel: () => ({ id: "fake-model", info: {} as never }),
	} as unknown as ApiHandler
}

const input = { path: "ERB/t.ERB", attempt: 1, system: "sys", user: "usr" }

test("provider：只拼接 text 片段，忽略其它类型", async () => {
	const ask = createMergeAsk(
		fakeApi([
			{ type: "text", text: "IF A\n" },
			{ type: "reasoning", text: "思考中，这段不能进结果" },
			{ type: "usage" },
			{ type: "text", text: "ENDIF\n" },
		]),
	)
	assert.equal(await ask(input), "IF A\nENDIF\n")
})

test("provider：空结果要抛错，不能当成合并成功", async () => {
	const ask = createMergeAsk(fakeApi([{ type: "text", text: "   \n" }]))
	await assert.rejects(() => ask(input), /空结果/)
})

test("provider：超长输出中止", async () => {
	const ask = createMergeAsk(fakeApi([{ type: "text", text: "x".repeat(200) }]), { maxChars: 100 })
	await assert.rejects(() => ask(input), /异常地长/)
})

test("provider：取消信号生效", async () => {
	const controller = new AbortController()
	controller.abort()
	const ask = createMergeAsk(fakeApi([{ type: "text", text: "IF A" }]), { signal: controller.signal })
	await assert.rejects(() => ask(input), /已取消/)
})

test("provider：逐段回调给 UI 用", async () => {
	const seen: string[] = []
	const ask = createMergeAsk(
		fakeApi([
			{ type: "text", text: "AB" },
			{ type: "text", text: "CD" },
		]),
		{
			onToken: (text) => seen.push(text),
		},
	)
	await ask(input)
	assert.deepEqual(seen, ["AB", "CD"])
})

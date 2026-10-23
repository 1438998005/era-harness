/**
 * 两处「把结构化字段拼成人话」的纯函数。
 *
 * 都来自 3.91.2 的真实反馈：
 * 1. 设置页把 401 说成「接口返回了 0 个模型」——因为 refreshOpenAiModels 把所有异常吞成空数组；
 * 2. 聊天错误块渲染成 `[MIMO] 401401 Invalid API Key`——code 和 message 之间没分隔，
 *    而 message 自己已经以状态码开头。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { isDuplicateErrorCode } from "../../src/services/error/error-code"
import { formatModelListError } from "../../src/shared/utils/model-list-error"

test("拉模型列表失败：优先用服务端的结构化说明，不做文案匹配", () => {
	// axios 401：response.data.error.message 是小米/DeepSeek 这类 OpenAI 兼容端点的形状
	assert.equal(
		formatModelListError({
			response: { status: 401, data: { error: { message: "Invalid API Key" } } },
			message: "Request failed with status code 401",
		}),
		"401 Invalid API Key",
	)

	// 服务端只给顶层 message
	assert.equal(formatModelListError({ response: { status: 403, data: { message: "forbidden" } } }), "403 forbidden")

	// 有状态码但没有任何说明：不能拼出 "401 undefined"
	assert.equal(formatModelListError({ response: { status: 500 } }), "HTTP 500")

	// 连接层失败：没有 response，用 axios 的 code
	assert.equal(
		formatModelListError({ code: "ECONNABORTED", message: "timeout of 30000ms exceeded" }),
		"ECONNABORTED timeout of 30000ms exceeded",
	)

	// 兜底：普通 Error
	assert.equal(formatModelListError(new Error("boom")), "boom")
})

test("错误码只是 status 的重复时不该再拼一遍", () => {
	// 服务端回 code: "401"，status 也是 401 → 重复
	assert.equal(isDuplicateErrorCode(401, "401"), true)
	// DeepSeek 的 code 是 invalid_request_error，和 402 不是一回事 → 要显示
	assert.equal(isDuplicateErrorCode(402, "invalid_request_error"), false)
	// 任一侧缺失 → 不判定为重复（保持原行为，别把真正的 code 吞掉）
	assert.equal(isDuplicateErrorCode(undefined, "401"), false)
	assert.equal(isDuplicateErrorCode(401, undefined), false)
	assert.equal(isDuplicateErrorCode(undefined, undefined), false)
})

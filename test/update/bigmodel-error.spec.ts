/**
 * #60：BigModel 错误响应 → 人话（纯函数，仿 error-text.spec 的 MiMo 先例）。
 *
 * 背景：3.92.0 用户实测 glm-4.5-flash 被 400 code=1261 拒绝，错误块渲染
 * `{"message":"400 Prompt exceeds max length","status":400,"code":"1261",…}` 原文。
 * 形状事实：BigModel OpenAI 兼容端错误体为 `{error:{code,message}}` + HTTP status。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { extractBigmodelError } from "../../src/shared/bigmodel-request"

test("1261（窗口含输出撞上限）：说清成因并指出路", () => {
	// openai SDK APIError 形状（真实 400 响应）
	const info = extractBigmodelError({
		status: 400,
		message: "400 Prompt exceeds max length",
		error: { code: "1261", message: "Prompt exceeds max length" },
	})
	assert.ok(info)
	assert.equal(info.status, 400)
	assert.equal(info.code, "1261")
	assert.ok(info.humanMessage.includes("输入+输出合计超出模型窗口"), "要说清「窗口含输出」成因")
	assert.ok(info.humanMessage.includes("压缩对话") || info.humanMessage.includes("长窗口"), "要给出路")
})

test("401 / 429 / 其它 HTTP 状态：各有人话，不再裸拼", () => {
	const unauthorized = extractBigmodelError({
		status: 401,
		message: "401 Invalid API key",
		error: { code: "1002", message: "Invalid API key" },
	})
	assert.equal(unauthorized?.humanMessage.includes("检查 BigModel 密钥"), true)

	const rateLimited = extractBigmodelError({ status: 429, message: "429 too many requests", error: { message: "slow down" } })
	assert.equal(rateLimited?.humanMessage.includes("请求过于频繁"), true)
	assert.equal(rateLimited?.humanMessage.includes("slow down"), true, "服务端说明要保留")

	const other = extractBigmodelError({ status: 500, message: "500 Internal Server Error" })
	assert.equal(other?.humanMessage, "HTTP 500：500 Internal Server Error")
})

test("axios / ClineError._error 形状也能取到字段", () => {
	// axios 形：response.data.error
	const axiosShape = extractBigmodelError({
		response: { status: 400, data: { error: { code: "1261", message: "Prompt exceeds max length" } } },
	})
	assert.equal(axiosShape?.code, "1261")

	// ClineError._error 形：status/code 打平、服务端说明在 details
	const detailsShape = extractBigmodelError({
		status: 400,
		code: "1261",
		message: "400 Prompt exceeds max length",
		details: { code: "1261", message: "Prompt exceeds max length" },
	})
	assert.equal(detailsShape?.code, "1261")
	assert.equal(detailsShape?.status, 400)
})

test("非 BigModel 形状 / 空输入：返回 undefined 不误伤", () => {
	assert.equal(extractBigmodelError(undefined), undefined)
	assert.equal(extractBigmodelError("boom"), undefined)
	assert.equal(extractBigmodelError({}), undefined)
	assert.equal(extractBigmodelError(new Error("普通错误")), undefined, "普通 Error 无结构化字段，不接管")
})

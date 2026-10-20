// era harness：每轮模型名显示（§12.20 渲染锚点方案）数据层纯函数单测。
// 运行：npm run test:ui（vitest，jsdom）；或 node webview-ui/node_modules/vitest/vitest.mjs run --root webview-ui
import type { ClineMessage } from "@shared/ExtensionMessage"
import { describe, expect, it } from "vitest"
import { findRoundModelId, parseModelIdFromApiReq } from "./messageUtils"

/** 构造最小 ClineMessage（只填本测试用到的字段） */
function msg(partial: Partial<ClineMessage> & { ts: number }): ClineMessage {
	return { type: "say", ...partial } as ClineMessage
}

function apiReq(ts: number, modelId?: string): ClineMessage {
	return msg({
		ts,
		say: "api_req_started",
		text: modelId === undefined ? "{}" : JSON.stringify({ modelId, cost: 0 }),
	})
}

describe("parseModelIdFromApiReq", () => {
	it("解析合法 JSON 的 modelId", () => {
		expect(parseModelIdFromApiReq(JSON.stringify({ modelId: "deepseek-v4.1-flash-free" }))).toBe("deepseek-v4.1-flash-free")
	})

	it("无字段 / 空串 / 非字符串 / 非法 JSON → undefined（绝不抛错，白屏防护）", () => {
		expect(parseModelIdFromApiReq(JSON.stringify({ cost: 1 }))).toBeUndefined()
		expect(parseModelIdFromApiReq("")).toBeUndefined()
		expect(parseModelIdFromApiReq(undefined)).toBeUndefined()
		expect(parseModelIdFromApiReq(JSON.stringify({ modelId: 42 }))).toBeUndefined()
		expect(parseModelIdFromApiReq("{not json")).toBeUndefined()
	})
})

describe("findRoundModelId", () => {
	// 两个回合：回合 1 有思考行（锚点在思考行），回合 2 无思考行（锚点在工具分组头）
	const messages = [
		msg({ ts: 1, say: "text", text: "hi" }),
		apiReq(2, "muse-spark-1.3-contributor-free"),
		msg({ ts: 3, say: "reasoning", text: "think1" }),
		msg({ ts: 4, say: "reasoning", text: "think1 more" }),
		msg({ ts: 5, say: "tool", text: "{}" }),
		apiReq(6, "dots-studio/dots-3-note-preview:free"),
		msg({ ts: 7, say: "tool", text: "{}" }),
	]

	it("思考行锚点：从 reasoning ts 向前取本回合 api_req 的 modelId", () => {
		expect(findRoundModelId(4, messages)).toBe("muse-spark-1.3-contributor-free")
	})

	it("工具分组头：giveUpAtReasoning=true 时遇 reasoning 即放弃（有思考行的回合不重复显示）", () => {
		expect(findRoundModelId(5, messages, true)).toBeUndefined()
	})

	it("工具分组头：无思考行的回合正常显示本回合模型名", () => {
		expect(findRoundModelId(7, messages, true)).toBe("dots-studio/dots-3-note-preview:free")
	})

	it("历史任务（api_req 无 modelId 字段）→ undefined 静默不显示", () => {
		const legacy = [apiReq(2), msg({ ts: 3, say: "reasoning", text: "x" })]
		expect(findRoundModelId(3, legacy)).toBeUndefined()
	})

	it("msgTs 不在消息列表中 → undefined", () => {
		expect(findRoundModelId(999, messages)).toBeUndefined()
	})

	it("多回合时只取最近的一个 api_req", () => {
		expect(findRoundModelId(7, messages)).toBe("dots-studio/dots-3-note-preview:free")
	})
})

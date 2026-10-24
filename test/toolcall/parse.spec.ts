// era harness：工具调用解析回归测试。用 node:test 驱动真实解析器（经 run.mjs 用 esbuild 打包）。
// 运行：npm run test:toolcall
import assert from "node:assert/strict"
import { test } from "node:test"
import { parseAssistantMessageV2 } from "@core/assistant-message"
import fixtures from "./fixtures.json"

type AnyBlock = { type: string; name?: string; params?: Record<string, string>; content?: string; partial?: boolean }
type ExpectTool = { name: string; params?: Record<string, string> }
type Case = {
	name: string
	raw: string
	expectTools?: ExpectTool[]
	expectNoTools?: boolean
	expectTextContains?: string | string[]
	expectTextNotContains?: string | string[]
}

const cases: Case[] = (fixtures as { cases: Case[] }).cases

for (const c of cases) {
	test(c.name, () => {
		const blocks = parseAssistantMessageV2(c.raw) as AnyBlock[]
		const tools = blocks.filter((b) => b.type === "tool_use" && !b.partial)

		if (c.expectNoTools) {
			assert.equal(tools.length, 0, `期望无工具，实际解析出: ${JSON.stringify(tools.map((t) => t.name))}`)
		}

		const joinedText = blocks
			.filter((b) => b.type === "text")
			.map((b) => b.content || "")
			.join("")

		if (c.expectTextContains) {
			const needles = Array.isArray(c.expectTextContains) ? c.expectTextContains : [c.expectTextContains]
			for (const needle of needles) {
				assert.ok(joinedText.includes(needle), `正文应包含 "${needle}"，实际: ${JSON.stringify(joinedText)}`)
			}
		}

		if (c.expectTextNotContains) {
			const needles = Array.isArray(c.expectTextNotContains) ? c.expectTextNotContains : [c.expectTextNotContains]
			for (const needle of needles) {
				assert.ok(
					!joinedText.includes(needle),
					`正文不应包含 "${needle}"（应被剥离），实际: ${JSON.stringify(joinedText)}`,
				)
			}
		}

		if (c.expectTools) {
			assert.equal(tools.length, c.expectTools.length, `工具数量不符：实际 ${JSON.stringify(tools.map((t) => t.name))}`)
			c.expectTools.forEach((exp, i) => {
				const got = tools[i]
				assert.equal(got.name, exp.name, `第 ${i} 个工具名不符`)
				if (exp.params) {
					for (const [k, v] of Object.entries(exp.params)) {
						assert.equal(got.params?.[k], v, `工具 ${exp.name} 的参数 ${k} 不符`)
					}
				}
			})
		}
	})
}

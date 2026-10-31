/**
 * 全局记忆的「生效性」守门（3.94.0）。
 *
 * 这里只测三件用户能感知的事：
 * 1. 关闭后：段落不注入、工具不暴露（两者都不能只靠前端隐藏）；
 * 2. 开启后：段落带警示头，工具描述里写明「什么时候该写」——没有这句，模型不会主动记，
 *    用户看到的就是「记忆开了也什么都不记」；
 * 3. 子代理看不到这个工具（写入只允许主任务做）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { getGlobalMemorySection } from "../../src/core/prompts/system-prompt/components/global_memory"
import { global_memory_variants } from "../../src/core/prompts/system-prompt/tools/global_memory"
import type { SystemPromptContext } from "../../src/core/prompts/system-prompt/types"
import { applyGlobalMemoryUpsert, createEmptyGlobalMemory, formatGlobalMemoryForPrompt } from "../../src/shared/global-memory"

const tool = global_memory_variants[0] as unknown as {
	description: (context: SystemPromptContext) => string
	contextRequirements?: (context: SystemPromptContext) => boolean
}

function context(overrides: Partial<SystemPromptContext>): SystemPromptContext {
	return { locale: "zh-CN", ...overrides } as SystemPromptContext
}

function documentWithEntry() {
	return applyGlobalMemoryUpsert(createEmptyGlobalMemory(1), {
		text: "回答语言：简体中文",
		source: "user",
	}).document
}

test("关闭时：段落不注入", () => {
	const document = { ...documentWithEntry(), enabled: false }
	assert.equal(formatGlobalMemoryForPrompt(document), undefined)
	assert.equal(getGlobalMemorySection(context({ globalMemoryEnabled: false, globalMemory: "## 全局记忆\n- x" })), undefined)
})

test("关闭时：工具不暴露给模型", () => {
	assert.equal(tool.contextRequirements?.(context({ globalMemoryEnabled: false })), false)
	assert.equal(tool.contextRequirements?.(context({ globalMemoryEnabled: true })), true)
})

test("子代理运行时不暴露（写入只允许主任务）", () => {
	assert.equal(
		tool.contextRequirements?.(context({ globalMemoryEnabled: true, isSubagentRun: true } as Partial<SystemPromptContext>)),
		false,
	)
})

test("开启且有内容时：段落带「不是实测事实 / 以代码为准」警示头", () => {
	const section = getGlobalMemorySection(
		context({ globalMemoryEnabled: true, globalMemory: formatGlobalMemoryForPrompt(documentWithEntry()) }),
	)

	assert.ok(section)
	assert.match(section ?? "", /不是本工程的实测事实/)
	assert.match(section ?? "", /以代码\/日志\/配置为准/)
	assert.match(section ?? "", /回答语言：简体中文/)
})

test("工具描述必须写明「主动记、不要等用户开口」（中英各一份）", () => {
	const zh = tool.description(context({ locale: "zh-CN" }))
	const en = tool.description(context({ locale: "en-US" }))

	assert.match(zh, /主动记，不要等用户开口/)
	assert.match(en, /Proactively record, do not wait to be asked/)
})

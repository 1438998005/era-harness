/**
 * 08 #85：GLM 家族判定漏掉老款 GLM-4 系。
 *
 * 影响面不是文案而是**提示词变体与工具集**：`variants/glm/config.ts` 的 matcher
 * 就是 `isGLMModelFamily(model.id)`，漏判会让 4v-flash / 4-flash-250414 这类
 * 老款吃到通用提示词（含它不支持的段落）与全量工具集，表现为「工具调用总失败」。
 *
 * 注意：本用例只守判定本身。扩家族后这四款的真实表现**必须人工各跑一轮**
 * （list_files + read_file + replace_in_file），验收记录见知识库 08 销项。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { isGLMModelFamily } from "../../src/utils/model-utils"

test("老款 GLM-4 系必须判进家族（#85 漏判组）", () => {
	for (const id of [
		"glm-4v-flash",
		"glm-4-flash-250414",
		"glm-4.1v-thinking-flash",
		"glm-4-long",
		"glm-4.6v-flash",
		"GLM 4.6V",
		"GLM 4",
		"z-ai/glm-4.5",
	]) {
		assert.equal(isGLMModelFamily(id), true, `${id} 应判为 GLM 家族`)
	}
})

test("原分支不回退：glm-5 / 4.7 / 4.6 / 4.5 / z-ai / zai-org", () => {
	for (const id of ["glm-5.1", "glm-4.7", "glm-4.6", "glm-4.5-flash", "zai-org/glm-5"]) {
		assert.equal(isGLMModelFamily(id), true, `${id} 应判为 GLM 家族`)
	}
})

test("反例不误伤：gpt-4o / glm-3 / not-glm", () => {
	for (const id of ["gpt-4o", "glm-3", "not-glm", "claude-sonnet-4-5"]) {
		assert.equal(isGLMModelFamily(id), false, `${id} 不应判为 GLM 家族`)
	}
})

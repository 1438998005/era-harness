/**
 * 08 #176：自动压缩对话历史默认开启，并把 GLM-5 系 / MiMo 系纳入生效范围。
 *
 * 这条测试守两件事，性质不同：
 *
 * 1. **默认值**（`useAutoCondense` 默认 true）。这是用户裁定，纯产品口径，没有
 *    技术推导可依赖 —— 只能靠断言钉住，否则哪天有人「顺手改回 false」不会有
 *    任何报错。同时守 `ExtensionStateContext` 里那份手写的默认状态：它和
 *    `state-keys.ts` 是两处单源，不一致会让 webview 首帧渲染成关闭。
 *
 * 2. **生效范围**（`supportsAutoCondense`）。注意**不要**为了扩范围去改
 *    `isNextGenModelFamily` —— 那个函数同时决定提示词变体与原生工具调用，
 *    把 MiMo/GLM 塞进去会连带换掉它们整套提示词。所以这里额外加了一条反向
 *    断言：MiMo / GLM-5 必须**不**在 next-gen 里，两件事必须保持分离。
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { isNextGenModelFamily, supportsAutoCondense } from "../../src/utils/model-utils"

// run.mjs 会把 cwd 设为仓库根（打包成 CJS 后 import.meta.url 不可用）
const repoRoot = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8")

test("#176 自动压缩生效范围：next-gen ∪ MiMo ∪ GLM-5 系", () => {
	for (const id of [
		// next-gen 既有分支（不改动，防扩范围时误伤）
		"claude-sonnet-4-5-20250929",
		"gemini-2.5-pro",
		"gpt-5",
		"kimi-k2-0905-preview",
		// DeepSeek 原生系（现行名 deepseek-flash）
		"deepseek-flash",
		"deepseek-v4",
		// 本次新增：MiMo 系
		"mimo-v2.6-flash",
		"MiMo-V2.6",
		// 本次新增：GLM-5 系
		"glm-5",
		"glm-5.3",
		"glm-5.3-flashx",
		"GLM-5.3", // 大小写不敏感
	]) {
		assert.equal(supportsAutoCondense(id), true, `${id} 应启用自动压缩`)
	}
})

test("#176 老一代 GLM / 未知模型不启用自动压缩", () => {
	for (const id of ["glm-4v-flash", "glm-4.7-flash", "glm-4-long", "glm-4-flash-250414", "some-unknown-model", ""]) {
		assert.equal(supportsAutoCondense(id), false, `${id} 不应启用自动压缩`)
	}
})

test("#176 MiMo / GLM-5 不得混进 isNextGenModelFamily（它同时管提示词与原生工具调用）", () => {
	// 这两款走的是各自的提示词变体与工具集，被 next-gen 吃掉会连带换掉整套提示词。
	for (const id of ["mimo-v2.6-flash", "glm-5.3", "glm-5"]) {
		assert.equal(isNextGenModelFamily(id), false, `${id} 不属于 next-gen 家族`)
		assert.equal(supportsAutoCondense(id), true, `${id} 仍应启用自动压缩`)
	}
})

test("#176 useAutoCondense 默认值为 true（state-keys 单源）", () => {
	const src = read("src/shared/storage/state-keys.ts")
	// 允许注释、允许 as boolean，只要求默认值是 true
	const match = src.match(/useAutoCondense:\s*\{[^}]*default:\s*(true|false)/s)
	assert.ok(match, "state-keys.ts 里应能找到 useAutoCondense 的 default 声明")
	assert.equal(match[1], "true", "useAutoCondense 默认值必须是 true（08 #176 用户裁定）")
})

test("#176 webview 初始状态与单源一致（不得残留 false）", () => {
	const src = read("webview-ui/src/context/ExtensionStateContext.tsx")
	const match = src.match(/useAutoCondense:\s*(true|false)/)
	assert.ok(match, "ExtensionStateContext.tsx 里应能找到 useAutoCondense 初始值")
	assert.equal(match[1], "true", "webview 首帧默认状态必须与 state-keys.ts 一致")
})

test("#176 任务侧与子代理侧都改走 supportsAutoCondense，不再直连 isNextGenModelFamily", () => {
	// 旧实现两处都直接调 isNextGenModelFamily，扩范围后会漏掉子代理这条路径。
	for (const rel of ["src/core/task/index.ts", "src/core/task/tools/subagent/SubagentRunner.ts"]) {
		const src = read(rel)
		assert.ok(src.includes("supportsAutoCondense"), `${rel} 应引用 supportsAutoCondense`)
		assert.ok(
			!/useAutoCondense\s*&&\s*isNextGenModelFamily\(/.test(src),
			`${rel} 不应再用 isNextGenModelFamily 直接判定自动压缩`,
		)
	}
})

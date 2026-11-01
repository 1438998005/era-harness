/**
 * 源码探针：读源码时**剥掉注释**。
 *
 * 为什么需要：本目录有一批 spec 靠「在源码里找某个标识符的位置」来断言顺序
 * （审批必须早于副作用、快照必须早于开对话、忙判据必须走纯函数……）。这类断言
 * 如果扫到注释里顺带提到的同名函数，就会误判成「顺序错了」——已经踩过三次：
 *
 *   - #113：`mergeTask.ts` 头部注释里残留 `taskState.isStreaming`，让
 *     「不能再裸判 isStreaming」的断言变红，只能去改注释迁就测试；
 *   - #114：注释里写 `controller.initTask()`，被当成真实调用，`indexOf`
 *     排到了 `snapshotTree` 前面，判定「快照在开对话之后」；
 *   - #111：注释里写 `askApprovalAndPushFeedback` 与 `yoloModeToggled`，
 *     同理把审批/硬闸的锚点顶到了真实调用之前。
 *
 * 结论：**顺序断言只该看代码，不该看注释。** 让测试去迁就注释的写法是反的——
 * 注释本来就该自由地提到函数名。
 *
 * 只剥两种，够用且不会误伤：
 *   1. 整段块注释 `/** ... *\/`（用等量换行占位，行号不变，便于对照报错）；
 *   2. 整行 `//` 注释。
 *
 * 行尾注释（`foo() // 说明`）**不剥**：它前面就是代码，`indexOf` 的相对位置
 * 不受影响。而为了剥行尾注释去写一个完整的 JS 词法器，会把本文件变成又一个
 * 需要被测试的对象——收益不抵成本。同理，字符串里出现 `/*` 的极端情况不处理。
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

/** 剥掉块注释与整行 `//` 注释，保留代码与行数 */
export function stripComments(source: string): string {
	const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ""))
	return withoutBlocks
		.split("\n")
		.map((line) => (/^\s*\/\//.test(line) ? "" : line))
		.join("\n")
}

/** 读仓库内文件并剥掉注释（断言代码结构时用这个） */
export function readCode(relative: string): string {
	return stripComments(readRaw(relative))
}

/** 读仓库内文件原文（断言文案、i18n key 这类字符串时用这个） */
export function readRaw(relative: string): string {
	const full = path.join(process.cwd(), relative)
	assert.ok(fs.existsSync(full), `源码文件不存在：${full}`)
	return fs.readFileSync(full, "utf8")
}

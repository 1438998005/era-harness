/**
 * 校验**已安装**的扩展产物里的中文文案（不是 dev 的 dist/）。
 *
 * 为什么单独要这个：check-text.mjs 只查 `../../dist/extension.js`（开发构建），
 * 但用户跑的是 `~/.vscode/extensions/eraharness.era-harness-<ver>/dist/extension.js`。
 * 「开发构建对、装的还是旧的」这种事靠前者发现不了。
 *
 * 两个必须记住的坑（各栽过一次）：
 *   1. esbuild 把字符串字面量里的非 ASCII 转义成 `\uXXXX`，grep 中文永远匹配不到
 *      → 必须先 `decodeEscapes` 再比。
 *   2. PowerShell 5.1 给 node 传非 ASCII **参数**会被 ANSI 编码弄坏
 *      → 待查文案必须写死在脚本里，不能走 argv。
 *   3. `process.argv[1]` 是**脚本自身路径**，不是第一个参数。
 *      → 想接外部参数必须用 argv[2] 起；本脚本干脆不接参数。
 */

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const INSTALLED = path.join(os.homedir(), ".vscode", "extensions", "eraharness.era-harness-3.86.6", "dist", "extension.js")

const decodeEscapes = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(Number.parseInt(h, 16)))

/** [文案, 是否应该存在] */
const EXPECTATIONS = [
	["merge-work", true],
	["正在扫描本地的游戏文件", true],
	["正在扫描你电脑上的游戏文件", false],
	["让 AI 帮我合并", true],
	["合并要在一个新对话里进行", true],
	["AI 正在合并你改过的文件", true],
]

async function main() {
	let raw
	try {
		raw = await fs.readFile(INSTALLED, "utf8")
	} catch (error) {
		console.error(`读不到已安装产物：${INSTALLED}\n${error.message}`)
		process.exit(2)
	}
	const decoded = decodeEscapes(raw)
	console.log(`目标：${INSTALLED}`)
	console.log(`大小：${raw.length} 字符\n`)

	let failed = 0
	for (const [text, shouldExist] of EXPECTATIONS) {
		const inRaw = raw.includes(text)
		const inDecoded = decoded.includes(text)
		const present = inRaw || inDecoded
		const ok = present === shouldExist
		if (!ok) failed++
		const via = inRaw ? "原文" : inDecoded ? "\\u 转义后" : "未出现"
		console.log(`${ok ? "PASS" : "FAIL"}  ${shouldExist ? "应存在" : "不应存在"}: ${text}（${via}）`)
	}
	if (failed > 0) {
		console.error(`\n${failed} 项不符`)
		process.exit(1)
	}
	console.log("\n全部符合")
}

main()

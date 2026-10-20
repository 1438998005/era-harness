/**
 * 校验构建产物里的中文文案。
 *
 * 为什么要有这个：esbuild 会把 JS 字符串字面量里的非 ASCII 字符转义成 `\uXXXX`，
 * 所以 `grep 正在扫描本地的游戏文件 dist/extension.js` **永远匹配不到**，
 * 容易把"改对了"误判成"没进去"（本仓库已经因为 grep 中文栽过一次判断）。
 *
 * 用法：node test/update/check-text.mjs [期望有,期望有...] [-- absent,absent...]
 *   node test/update/check-text.mjs 正在扫描本地的游戏文件 -- 正在扫描你电脑上的游戏文件
 */
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const target = path.resolve(import.meta.dirname, "../../dist/extension.js")

const decodeEscapes = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(Number.parseInt(h, 16)))

async function main() {
	const argv = process.argv.slice(2)
	const sep = argv.indexOf("--")
	const expectPresent = sep === -1 ? argv : argv.slice(0, sep)
	const expectAbsent = sep === -1 ? [] : argv.slice(sep + 1)

	const raw = await fs.readFile(target, "utf8")
	// 只解字符串转义，不改变原始字节，避免把正文里的字面 "\u0041" 也解掉造成误判
	const decoded = decodeEscapes(raw)

	let failed = 0
	for (const text of expectPresent) {
		const inRaw = raw.includes(text)
		const inDecoded = decoded.includes(text)
		const ok = inRaw || inDecoded
		console.log(`${ok ? "PASS" : "FAIL"}  应存在: ${text}${ok ? `（${inRaw ? "原文" : "\\u 转义后"}）` : ""}`)
		if (!ok) failed++
	}
	for (const text of expectAbsent) {
		const inRaw = raw.includes(text)
		const inDecoded = decoded.includes(text)
		const ok = !inRaw && !inDecoded
		console.log(`${ok ? "PASS" : "FAIL"}  不应存在: ${text}${ok ? "" : "（仍在产物里）"}`)
		if (!ok) failed++
	}

	if (failed > 0) {
		console.error(`\n${failed} 项不符`)
		process.exit(1)
	}
	console.log("\n全部符合")
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})

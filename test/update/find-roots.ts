/**
 * 目录发现探针：在工作区里找 eraTW，打印候选、置信度、版本号、嵌套关系。
 * 用来回答用户最可能问的那句："为什么没找到我的游戏？"
 *
 * 用法：
 *   node test/update/run.mjs discover <工作区目录>
 */

import path from "node:path"
import process from "node:process"
import { defaultSelection, describeCandidate, discoverGameRoots } from "../../src/core/update/discover"

async function main(): Promise<void> {
	const root = process.argv[2]
	if (!root) {
		console.error("用法: node test/update/run.mjs discover <工作区目录>")
		process.exit(1)
	}

	const started = Date.now()
	const candidates = await discoverGameRoots(root)
	const elapsed = Date.now() - started

	console.log(`工作区: ${path.resolve(root)}`)
	console.log(`耗时  : ${elapsed}ms`)
	console.log("")

	if (candidates.length === 0) {
		console.log("没有找到 eraTW 目录。")
		console.log("判据：ERB/ +3、CSV/ +3、emuera.config +2、Emuera*.exe +2、sav/ +1，合计 ≥4 才算候选。")
		return
	}

	const selected = new Set(defaultSelection(candidates).map((c) => c.path))
	for (const candidate of candidates) {
		const mark = selected.has(candidate.path) ? "✓" : " "
		console.log(`[${mark}] ${describeCandidate(candidate)}`)
		console.log(`     路径: ${candidate.path}`)
		console.log(`     特征: ${candidate.markers.join(" + ")}  → ${candidate.score} 分 / ${candidate.confidence}`)
		if (candidate.nestedUnder) {
			console.log(`     嵌套于: ${candidate.nestedUnder}（默认不选）`)
		}
		if (candidate.duplicateOf) {
			console.log(`     副本  : 与 ${candidate.duplicateOf} 内容相同`)
		}
	}

	console.log("")
	console.log(
		candidates.length > 1
			? `发现 ${candidates.length} 个候选 → 必须让用户多选（默认一个都不勾）`
			: "只有一个候选 → 直接用，不打扰用户",
	)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

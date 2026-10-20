/**
 * 合并引擎的**真机探测**工具（不联网、不写盘）。
 *
 * 拿真实游戏目录里的 ERB 当素材，模拟两种最常见的情况：
 *   1. 玩家改一处、上游改另一处（应当**完全不调模型**，且结果精确等于手工预期）
 *   2. 玩家和上游改了同一行（应当产生 1 个冲突窗口，且窗口只覆盖那一行）
 *
 * 用法：node test/update/run.mjs mergeprobe <游戏目录> [文件数上限]
 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { decodeText, planMergeWindows, runMerge } from "../../src/core/update/merge"

interface Stats {
	files: number
	skipped: number
	mechanicalOk: number
	mechanicalBad: number
	conflictFiles: number
	windowLines: number[]
	maxWindow: number
	maxWindowPath: string
	blockWindowLines: number[]
	maxBlockWindow: number
	maxBlockWindowPath: string
	failures: string[]
}

function collect(dir: string, out: string[], limit: number): void {
	if (out.length >= limit) {
		return
	}
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (out.length >= limit) {
			return
		}
		const p = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			collect(p, out, limit)
			continue
		}
		if (/\.erb$/i.test(entry.name)) {
			out.push(p)
		}
	}
}

async function main(): Promise<void> {
	const root = process.argv[2]
	const limit = Number(process.argv[3] ?? 300)
	if (!root) {
		console.error("用法: node test/update/run.mjs mergeprobe <游戏目录> [文件数上限]")
		process.exit(1)
	}

	const files: string[] = []
	collect(path.join(root, "ERB"), files, limit)

	const stats: Stats = {
		files: 0,
		skipped: 0,
		mechanicalOk: 0,
		mechanicalBad: 0,
		conflictFiles: 0,
		windowLines: [],
		maxWindow: 0,
		maxWindowPath: "",
		blockWindowLines: [],
		maxBlockWindow: 0,
		maxBlockWindowPath: "",
		failures: [],
	}

	for (const file of files) {
		const buf = fs.readFileSync(file)
		const decoded = decodeText(buf)
		if (!decoded) {
			stats.skipped++
			continue
		}
		const baseLines = decoded.text.split("\n")
		if (baseLines.length < 40) {
			stats.skipped++
			continue
		}
		stats.files++

		// 场景 1：两处不相交的改动
		const localLines = [...baseLines]
		const theirsLines = [...baseLines]
		const a = Math.floor(baseLines.length * 0.2)
		const b = Math.floor(baseLines.length * 0.7)
		localLines[a] = `${localLines[a]} ;LOCAL_EDIT`
		theirsLines[b] = `${theirsLines[b]} ;THEIRS_EDIT`

		let asked = 0
		const mechanical = await runMerge({
			path: path.basename(file),
			base: decoded.text,
			local: localLines.join("\n"),
			theirs: theirsLines.join("\n"),
			ask: async () => {
				asked++
				throw new Error("不该调用模型")
			},
		})
		const expected = localLines.join("\n").split("\n")
		expected[b] = theirsLines[b]
		const expectedText = expected.join("\n")
		if (asked === 0 && mechanical.ok && mechanical.text === expectedText) {
			stats.mechanicalOk++
		} else {
			stats.mechanicalBad++
			if (stats.failures.length < 5) {
				stats.failures.push(`机械合并异常：${file}（ask=${asked}, ok=${mechanical.ok}）`)
			}
		}

		// 场景 2：两边改同一行 → 冲突窗口应当只覆盖那一行
		const windows = planMergeWindows(
			baseLines,
			localLines,
			theirsLines.map((l, i) => (i === a ? `${l} ;T` : l)),
		)
		const conflict = windows.filter((w) => w.kind === "conflict")
		if (conflict.length > 0) {
			stats.conflictFiles++
			for (const w of conflict) {
				const size = Math.max(w.base.length, w.local.length, w.theirs.length)
				stats.windowLines.push(size)
				if (size > stats.maxWindow) {
					stats.maxWindow = size
					stats.maxWindowPath = file
				}
			}
		}

		// 场景 3：本地整块改了 20 行、上游只改其中 3 行 → 窗口应当约 20 行，
		// 绝不能退化成"整个文件"（否则模型截断风险回来了）
		const blockLocal = [...baseLines]
		const blockTheirs = [...baseLines]
		const start = Math.floor(baseLines.length * 0.3)
		const blockSize = Math.min(20, Math.max(1, baseLines.length - start - 5))
		for (let i = 0; i < blockSize; i++) {
			blockLocal[start + i] = `${blockLocal[start + i]} ;LOCAL_BLOCK`
		}
		for (let i = 0; i < Math.min(3, blockSize); i++) {
			blockTheirs[start + i] = `${blockTheirs[start + i]} ;THEIRS_BLOCK`
		}
		for (const w of planMergeWindows(baseLines, blockLocal, blockTheirs)) {
			if (w.kind !== "conflict") {
				continue
			}
			const size = Math.max(w.base.length, w.local.length, w.theirs.length)
			stats.blockWindowLines.push(size)
			if (size > stats.maxBlockWindow) {
				stats.maxBlockWindow = size
				stats.maxBlockWindowPath = file
			}
		}
	}

	const avg = stats.windowLines.length > 0 ? stats.windowLines.reduce((x, y) => x + y, 0) / stats.windowLines.length : 0
	const avgBlock =
		stats.blockWindowLines.length > 0 ? stats.blockWindowLines.reduce((x, y) => x + y, 0) / stats.blockWindowLines.length : 0
	console.log(`扫描文件            ${stats.files}（跳过 ${stats.skipped} 个小文件/非 UTF-8）`)
	console.log(`机械合并正确        ${stats.mechanicalOk}`)
	console.log(`机械合并异常        ${stats.mechanicalBad}`)
	console.log(`出现冲突窗口的文件  ${stats.conflictFiles}`)
	console.log(`冲突窗口行数 平均   ${avg.toFixed(1)}  最大 ${stats.maxWindow}`)
	if (stats.maxWindowPath) {
		console.log(`最大窗口来自        ${stats.maxWindowPath}`)
	}
	console.log(`整块冲突窗口 平均   ${avgBlock.toFixed(1)}  最大 ${stats.maxBlockWindow}（期望 ≤ 30）`)
	if (stats.maxBlockWindowPath) {
		console.log(`最大整块窗口来自    ${stats.maxBlockWindowPath}`)
	}
	for (const failure of stats.failures) {
		console.log(`  ! ${failure}`)
	}
	process.exit(stats.mechanicalBad === 0 ? 0 : 1)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})

/**
 * 真实目录 dry-run：只读，不联网、不写盘。
 *
 * 输出：
 * 1. 扫描规模与耗时
 * 2. 识别出的"批量解压"时刻（这是首次同步判定的依据）
 * 3. 批量之外的文件 —— 按设计它们会被判为"人手改过"，默认保留
 * 4. 按角色目录归并，方便肉眼核对"这些确实是我改的"
 */

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { DEFAULT_EXCLUDED_DIRS, scanLocal } from "../../src/core/update/manifest"
import { personaKeyOf } from "../../src/core/update/plan"
import type { RelPath } from "../../src/core/update/types"

function fmtTime(ms: number): string {
	const d = new Date(ms)
	const pad = (n: number): string => String(n).padStart(2, "0")
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtSize(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
	}
	if (bytes >= 1024 * 1024) {
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`
	}
	return `${(bytes / 1024).toFixed(1)} KB`
}

async function main(): Promise<void> {
	const root = process.argv[2]
	if (!root) {
		console.error("用法: node test/update/run.mjs dryrun <游戏目录>")
		process.exit(1)
	}

	const stat = await fs.stat(root).catch(() => null)
	if (!stat?.isDirectory()) {
		console.error(`目录不存在: ${root}`)
		process.exit(1)
	}

	console.log(`扫描目录: ${path.resolve(root)}`)
	console.log(`排除目录: ${DEFAULT_EXCLUDED_DIRS.join(" ")}`)
	const started = Date.now()
	let lastTick = 0
	const scan = await scanLocal(root, {
		onProgress: (done, total) => {
			const now = Date.now()
			if (now - lastTick > 1000 || done === total) {
				lastTick = now
				process.stdout.write(`\r  已处理 ${done}/${total} 个文件`)
			}
		},
	})
	process.stdout.write("\r")
	const elapsed = ((Date.now() - started) / 1000).toFixed(1)

	let bytes = 0
	for (const fp of scan.files.values()) {
		bytes += fp.size
	}

	console.log("")
	console.log(`文件数: ${scan.files.size}    体积: ${fmtSize(bytes)}    耗时: ${elapsed}s`)
	console.log("")

	const { batches, bulkPaths, reliable, threshold, total } = scan.batches
	console.log(
		`批量识别: 阈值 ${threshold} 个/分钟，命中 ${batches.length} 个批次，覆盖率 ${((bulkPaths.size / Math.max(1, total)) * 100).toFixed(1)}%`,
	)
	console.log(`判定可信: ${reliable ? "是（首次同步可自动判定）" : "否（首次同步必须让用户二选一）"}`)
	for (const b of batches) {
		console.log(`  · ${fmtTime(b.minuteMs)}  ${String(b.count).padStart(6)} 个  (${(b.ratio * 100).toFixed(1)}%)`)
	}

	const outside: RelPath[] = []
	for (const rel of scan.files.keys()) {
		if (!bulkPaths.has(rel)) {
			outside.push(rel)
		}
	}
	outside.sort()

	console.log("")
	console.log(`批量之外（判为"人手改过"，默认保留）: ${outside.length} 个`)

	const byPersona = new Map<string, RelPath[]>()
	const byOther: RelPath[] = []
	for (const rel of outside) {
		const key = personaKeyOf(rel)
		if (key) {
			const list = byPersona.get(key)
			if (list) {
				list.push(rel)
			} else {
				byPersona.set(key, [rel])
			}
		} else {
			byOther.push(rel)
		}
	}

	for (const [key, list] of [...byPersona].sort((a, b) => b[1].length - a[1].length)) {
		console.log(`  [角色] ${key}  ${list.length} 个`)
		for (const rel of list.slice(0, 5)) {
			console.log(`         ${rel}`)
		}
		if (list.length > 5) {
			console.log(`         …… 其余 ${list.length - 5} 个`)
		}
	}
	if (byOther.length > 0) {
		console.log(`  [本体侧/其他] ${byOther.length} 个`)
		for (const rel of byOther.slice(0, 20)) {
			console.log(`         ${rel}`)
		}
		if (byOther.length > 20) {
			console.log(`         …… 其余 ${byOther.length - 20} 个`)
		}
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

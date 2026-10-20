/**
 * 快照探针：把任意来源（GitLab 归档 / 本地 .tar.gz / 已解压目录）解析成清单，
 * 打印规模与抽样指纹。用来验证"从归档算出来的 hash"与"上游认的 blob id"是否一致。
 *
 * 用法：
 *   node test/update/run.mjs snapshot <归档.tar.gz | 目录> [要显示的路径]
 */

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { snapshotFromArchiveFile, snapshotFromDir } from "../../src/core/update/source"

async function main(): Promise<void> {
	const target = process.argv[2]
	if (!target) {
		console.error("用法: node test/update/run.mjs snapshot <归档.tar.gz | 目录> [要显示的路径]")
		process.exit(1)
	}
	const wanted = process.argv[3]

	const stat = await fs.stat(target)
	const started = Date.now()
	let lastTick = 0
	const progress = (files: number, bytes: number): void => {
		const now = Date.now()
		if (now - lastTick > 800) {
			lastTick = now
			process.stdout.write(`\r  已解析 ${files} 个文件 / ${(bytes / 1024 / 1024).toFixed(1)} MB`)
		}
	}

	const snapshot = stat.isDirectory()
		? await snapshotFromDir(target)
		: await snapshotFromArchiveFile(target, path.basename(target), progress)
	process.stdout.write("\r")

	let bytes = 0
	for (const file of snapshot.files.values()) {
		bytes += file.size
	}
	const elapsed = ((Date.now() - started) / 1000).toFixed(2)

	console.log(`来源: ${snapshot.label}`)
	console.log(`文件数: ${snapshot.files.size}    体积: ${(bytes / 1024 / 1024).toFixed(1)} MB    耗时: ${elapsed}s`)

	const sample = [...snapshot.files.keys()].sort().slice(0, 5)
	console.log("路径样例:")
	for (const p of sample) {
		console.log(`  ${p}`)
	}

	if (wanted) {
		const hit = snapshot.files.get(wanted)
		console.log("")
		if (hit) {
			console.log(`指定路径: ${wanted}`)
			console.log(`  sha1 = ${hit.sha1}`)
			console.log(`  size = ${hit.size}`)
		} else {
			console.log(`指定路径不存在于快照: ${wanted}`)
			process.exit(1)
		}
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

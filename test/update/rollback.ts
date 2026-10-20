/**
 * 把游戏回滚到某次更新之前（给"反复测插件"用）。
 *
 *   node test/update/run.mjs rollback <游戏目录> [备份目录]
 *
 * 不传备份目录时，取游戏目录下 `_备份/` 里按名字排序最后的一个。
 *
 * 回滚做两件事：
 * 1. `rollbackFromBackup`：按 manifest 把写过的还原、新增的删掉（逐字节）
 * 2. 把 `.era-harness/update-state.json` 恢复成备份里的 `state-before.json`
 *    （为 `null` 就删掉文件）—— 否则插件会拿"更新后"的基线去比"回滚后"的磁盘，
 *    把 759 个文件全判成"你改过"，测出来的东西是假的。
 */

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { rollbackFromBackup } from "../../src/core/update/apply"
import { readNowVersion } from "../../src/core/update/discover"
import { statePath } from "../../src/core/update/manifest"

async function findLatestBackup(root: string): Promise<string> {
	const backupRoot = path.join(root, "_备份")
	const names = (await fs.readdir(backupRoot, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory() && entry.name.startsWith("update_backup_"))
		.map((entry) => entry.name)
		.sort()
	const last = names[names.length - 1]
	if (!last) {
		throw new Error(`${backupRoot} 里没有 update_backup_* 备份`)
	}
	return path.join(backupRoot, last)
}

async function main(): Promise<void> {
	const root = process.argv[2]
	if (!root) {
		console.error("用法: node test/update/run.mjs rollback <游戏目录> [备份目录]")
		process.exit(1)
	}
	const backupDir = process.argv[3] ?? (await findLatestBackup(root))

	console.log(`游戏目录: ${root}`)
	console.log(`备份目录: ${backupDir}`)
	console.log(`回滚前版本: ${(await readNowVersion(root)) ?? "未知"}`)

	const report = await rollbackFromBackup(backupDir)
	console.log(`还原 ${report.restored} 个 / 移除 ${report.removed} 个 / 错误 ${report.errors.length} 个`)
	if (report.errors.length > 0) {
		for (const error of report.errors.slice(0, 10)) {
			console.error(`  ${error.path}: ${error.message}`)
		}
		process.exit(1)
	}

	// 状态文件回到更新前（state-before.json 为 null 时删掉）
	const stateBeforePath = path.join(backupDir, "state-before.json")
	const target = statePath(root)
	let restoredState = "保留原样"
	try {
		const raw = await fs.readFile(stateBeforePath, "utf8")
		const parsed = raw.trim() === "null" ? null : JSON.parse(raw)
		if (parsed === null) {
			await fs.rm(target, { force: true })
			restoredState = "已删除（回到首次同步前）"
		} else {
			await fs.writeFile(target, JSON.stringify(parsed, null, 2), "utf8")
			restoredState = "已还原为备份里的状态"
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error
		}
	}

	console.log(`更新记录: ${restoredState}`)
	console.log(`回滚后版本: ${(await readNowVersion(root)) ?? "未知"}`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})

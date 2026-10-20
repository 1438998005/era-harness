/**
 * 真实更新（会联网、会写盘）。
 *
 *   node test/update/run.mjs live <游戏目录>            # 只算计划，打印人话摘要，不写盘
 *   node test/update/run.mjs live <游戏目录> --apply     # 真的更新（会先备份）
 *
 * 这是给"最后一步人工验收"用的：单元测试证明逻辑对，这个证明**在你机器上真的能跑通**。
 * 与插件里点按钮走的是同一条 `runUpdate`，唯一区别是这里的"确认"来自命令行参数。
 */

import process from "node:process"
import { describePlan, describeResult } from "../../src/core/update/describe"
import { readNowVersion } from "../../src/core/update/discover"
import type { UpdateEvent } from "../../src/core/update/service"
import { runUpdate } from "../../src/core/update/service"

const STAGE: Record<string, string> = {
	check: "检查社区版本",
	download: "下载社区版本",
	snapshot: "读取文件清单",
	scan: "扫描本地文件",
	plan: "比对差异",
	merge: "合并",
	apply: "备份并写入",
	verify: "校验写入结果",
}

let lastStage = ""
function onEvent(event: UpdateEvent): void {
	const label = STAGE[event.stage] ?? event.stage
	if (label !== lastStage) {
		lastStage = label
		console.log(`  · ${label}`)
	}
	if (event.progress && event.stage !== "plan") {
		const { done, total } = event.progress
		if (total > 0 && done % Math.max(1, Math.floor(total / 10)) < 1) {
			console.log(`      ${done}/${total}`)
		}
	}
}

async function main(): Promise<void> {
	const root = process.argv[2]
	const apply = process.argv.includes("--apply")
	if (!root) {
		console.error("用法: node test/update/run.mjs live <游戏目录> [--apply]")
		process.exit(1)
	}

	const before = await readNowVersion(root)
	console.log(`游戏目录: ${root}`)
	console.log(`当前版本: ${before ?? "未知"}`)
	console.log(`模式    : ${apply ? "真的更新（会备份）" : "只看计划（不写盘）"}`)
	console.log("")

	const planned = await runUpdate({
		root,
		source: { kind: "gitlab" },
		dryRun: !apply,
		confirm: () => true,
		onEvent,
	})

	const narrative = describePlan(planned.plan, {
		fromVersion: before,
		toVersion: planned.head?.nowVersion ?? null,
	})
	console.log("")
	console.log("──────── 计划（人话，就是弹窗里会看到的） ────────")
	console.log(narrative.text)
	console.log("")
	console.log("──────── 机器可读 ────────")
	console.log(
		JSON.stringify(
			{
				mode: planned.plan.mode,
				warnings: planned.plan.warnings,
				summary: planned.plan.summary,
				groups: planned.plan.groups.length,
				status: planned.status,
			},
			null,
			2,
		),
	)

	if (!apply) {
		console.log("\n没加 --apply，什么都没写。")
	}

	if (process.argv.includes("--detail")) {
		const byReason = new Map<string, string[]>()
		for (const entry of planned.plan.entries) {
			const key = `${entry.action}/${entry.reason}`
			const list = byReason.get(key) ?? []
			list.push(entry.path)
			byReason.set(key, list)
		}
		console.log("\n──────── 明细（按原因分组） ────────")
		const limit = process.env.ERA_LIVE_FULL ? Number.MAX_SAFE_INTEGER : 15
		for (const [key, list] of [...byReason].sort((a, b) => a[0].localeCompare(b[0]))) {
			console.log(`\n[${key}] ${list.length} 个`)
			for (const p of list.slice(0, limit)) {
				console.log(`    ${p}`)
			}
			if (list.length > limit) {
				console.log(`    …另外 ${list.length - limit} 个`)
			}
		}
	}

	if (!apply) {
		return
	}

	const done = describeResult(planned.status, {
		root,
		nowVersion: planned.verify?.nowVersion ?? planned.head?.nowVersion ?? null,
		backupDir: planned.report?.backupDir ?? null,
		error: planned.error,
	})
	console.log("")
	console.log("──────── 结果 ────────")
	console.log(done.text)
	console.log("")
	console.log(
		JSON.stringify(
			{
				status: planned.status,
				report: planned.report
					? {
							ok: planned.report.ok,
							written: planned.report.written,
							deleted: planned.report.deleted,
							rolledBack: planned.report.rolledBack,
							errors: planned.report.errors,
						}
					: null,
				verify: planned.verify ? { ok: planned.verify.ok, checked: planned.verify.checked } : null,
				after: await readNowVersion(root),
			},
			null,
			2,
		),
	)
	process.exit(planned.status === "applied" ? 0 : 1)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})

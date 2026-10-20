/**
 * 一次性校验：按拟定的 state 改动跑一遍真实 `buildPlan`，确认只会产生一个 both-changed 冲突。
 *
 * 为什么不直接改完 state 让用户去点：改错 state 会让用户点下去之后看到一堆莫名其妙的冲突，
 * 或者更糟——看到「已是最新」什么都没发生。先用纯函数在本机预演一遍，是零风险的。
 *
 * 输入三份全部来自真实来源，不含手写夹具：
 *   base   = 当前 state.files（= 20261017 上游快照），仅把目标文件换成 20261013 的 sha1
 *   theirs = 当前 state.files（上游 HEAD 仍是 fa0e525，与 state 记录同源）
 *   local  = scanLocal(游戏目录)
 */

import fs from "node:fs"
import path from "node:path"
import { scanLocal } from "../../src/core/update/manifest"
import { buildPlan } from "../../src/core/update/plan"
import type { RelPath } from "../../src/core/update/types"

const GAME_ROOT = process.argv[2]
if (!GAME_ROOT) {
	console.error("用法: node test/update/out/verifyplan.cjs <游戏目录>")
	process.exit(1)
}

/** 要造成 both-changed 的目标文件 */
const TARGET: RelPath = "tools/gift_sense_tags.csv"
/** 该文件在 20261013 (commit a2f336d4) 的 git blob sha1 */
const BASE_313_SHA1 = "5049c84bbc696a1de922cea5f9b0665ac02b1ffa"
/**
 * 该文件在上游 HEAD (fa0e525a / 20261017) 的 git blob sha1。
 *
 * 为什么必须写死：真实流程里 `theirs` 来自新拉取的上游快照（service.ts:270 `prepared.snapshot`），
 * 而装配脚本把 state.files[目标] 改成了 20261013 的基线值 —— 再用 state 派生 theirs 就自欺欺人了。
 */
const THEIRS_HEAD_SHA1 = "469f3f7e34a1ade41f13ca5914b98585a1d6744d"
const THEIRS_HEAD_SIZE = 4779

async function main() {
	const statePath = path.join(GAME_ROOT, ".era-harness", "update-state.json")
	const state = JSON.parse(fs.readFileSync(statePath, "utf8"))

	// theirs = 上游快照：state.files 原样，但目标文件换成真实的上游 HEAD 值
	const theirs = new Map<RelPath, { sha1: string; size: number }>()
	for (const [rel, rec] of Object.entries(state.files)) {
		theirs.set(rel as RelPath, { sha1: rec.sha1, size: rec.size })
	}
	theirs.set(TARGET, { sha1: THEIRS_HEAD_SHA1, size: THEIRS_HEAD_SIZE })

	// base = state.files 原样；未回退时模拟覆盖成 20261013 基线
	const base = new Map(theirs)
	base.delete(TARGET)
	const stateRec = state.files[TARGET]
	if (!stateRec) {
		console.error(`state 里找不到目标文件：${TARGET}`)
		process.exit(1)
	}
	if (stateRec.sha1 === BASE_313_SHA1) {
		base.set(TARGET, { sha1: BASE_313_SHA1, size: stateRec.size })
		console.log(`（state 已回退，按现状验证）`)
	} else {
		base.set(TARGET, { sha1: BASE_313_SHA1, size: stateRec.size })
		console.log(`（state 未回退，模拟回退后的基线）`)
	}

	// 与真实流程保持完全一致：默认排除目录 + onProgress（service.ts:262 的调用方式）
	const local = await scanLocal(GAME_ROOT, { onProgress: (done, total) => process.stdout.write(`\r扫描 ${done}/${total}`) })
	process.stdout.write("\n")

	console.log(`本地扫描：${local.files.size} 个文件`)
	console.log(`目标文件：${TARGET}`)
	console.log(`  磁盘 sha1 = ${local.files.get(TARGET)?.sha1 ?? "(本地没有)"}`)
	console.log(`  拟设基线 = ${BASE_313_SHA1}`)
	console.log(`  theirs   = ${theirs.get(TARGET)?.sha1 ?? "(上游没有)"}`)

	const plan = buildPlan({ base, local, theirs: { label: "state-files-as-upstream", files: theirs } })
	console.log(`\n=== buildPlan 结果 ===`)
	console.log(`mode      = ${plan.mode}`)
	console.log(`summary   = ${JSON.stringify(plan.summary)}`)
	console.log(`groups    = ${plan.groups.length}`)
	for (const g of plan.groups) {
		console.log(`  kind=${g.kind}  key=${g.key}  文件数=${g.paths.length}  路径=${g.paths.join(", ")}`)
	}
	console.log(`\n冲突条目：`)
	for (const e of plan.entries.filter((x) => x.action === "conflict")) {
		console.log(
			`  ${e.path}\n     reason=${e.reason}  local=${e.localSha1 ?? "-"}  base=${e.baseSha1 ?? "-"}  theirs=${e.theirsSha1 ?? "-"}`,
		)
	}
	console.log(`\n会写入的条目数 = ${plan.entries.filter((e) => e.action === "write").length}`)
	console.log(`会删除的条目数 = ${plan.entries.filter((e) => e.action === "delete").length}`)
	if (plan.warnings.length > 0) console.log(`warnings = ${plan.warnings.join(", ")}`)

	const ok =
		plan.mode === "incremental" &&
		plan.summary.conflict === 1 &&
		plan.entries.some((e) => e.path === TARGET && e.action === "conflict" && e.reason === "both-changed")
	console.log(`\n${ok ? "✓ 符合预期：恰好一个 both-changed 冲突，指向目标文件" : "✗ 不符合预期，先别改 state"}`)
	process.exit(ok ? 0 : 1)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

/**
 * 装配一个真实的 both-changed 场景，供真机验证「AI 合并对话工作台」。
 *
 * 做三件事：
 *   1. 备份 .era-harness/update-state.json → update-state.json.bak-verify
 *   2. 把目标文件从 22:52 更新前的备份恢复回游戏目录（= 玩家真实的本地改动）
 *   3. 回退 state：applied 指到 20261013 的 commit，目标文件的基线 sha1 换成 20261013 的值
 *
 * 回退后 buildPlan 会且仅会把目标文件判为 both-changed，其余文件全部 unchanged
 * （因为 state.files 记的就是 20261017 上游快照，与上游 HEAD 同源）。
 *
 * 回滚方法见脚本末尾打印。
 */
import fs from "node:fs"
import path from "node:path"

const GAME_ROOT = process.argv[2]
if (!GAME_ROOT) {
	console.error("用法: node setup-both-changed.mjs <游戏目录>")
	process.exit(1)
}

const REL = "tools/gift_sense_tags.csv"
const BASE_COMMIT = "a2f336d44f2aeb9d6aba8fa953ab875a569986c7" // NOW_VERSION = 20261013
const BASE_NOW_VERSION = "20261013"
const BASE_313_SHA1 = "5049c84bbc696a1de922cea5f9b0665ac02b1ffa"
const BASE_313_SIZE = 4782

const BACKUP_FILES = path.join(GAME_ROOT, "_备份", "update_backup_20261018_2252_develop20261017", "files")
const STATE_PATH = path.join(GAME_ROOT, ".era-harness", "update-state.json")
const STATE_BAK = `${STATE_PATH}.bak-verify`
const TARGET = path.join(GAME_ROOT, REL)

function main() {
	// ── 0. 前置检查 ──
	if (!fs.existsSync(STATE_PATH)) throw new Error(`找不到 state：${STATE_PATH}`)
	const src = path.join(BACKUP_FILES, REL)
	if (!fs.existsSync(src)) throw new Error(`备份里没有 ${REL}`)
	if (!fs.existsSync(TARGET)) throw new Error(`游戏目录里没有 ${REL}`)

	const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
	const rec = state.files[REL]
	if (!rec) throw new Error(`state 里没有 ${REL}`)
	if (rec.sha1 === BASE_313_SHA1) throw new Error("state 已是 20261013 基线，setup 似乎已执行过")
	if (state.applied?.nowVersion === "20261017") {
		// 正常，等待回退
	} else {
		throw new Error(`applied.nowVersion 不是 20261017（实际 ${state.applied?.nowVersion}），前言不成立，中止`)
	}

	// ── 1. 备份 state ──
	fs.copyFileSync(STATE_PATH, STATE_BAK)
	console.log(`[1/3] state 已备份 → ${STATE_BAK}`)

	// ── 2. 恢复玩家的本地版本 ──
	const localBuf = fs.readFileSync(src)
	const diskBuf = fs.readFileSync(TARGET)
	if (localBuf.equals(diskBuf)) throw new Error("备份版本与磁盘版本相同，没有可恢复的改动")
	fs.writeFileSync(TARGET, localBuf)
	console.log(`[2/3] 已把 ${REL} 恢复为你的版本（${localBuf.length}B）`)
	console.log(`      恢复前是上游 20261017 版（${diskBuf.length}B）`)

	// ── 3. 回退 state ──
	const before = { ...state.applied, fileSha: rec.sha1, fileSize: rec.size }
	state.applied = {
		...state.applied,
		commit: BASE_COMMIT,
		nowVersion: BASE_NOW_VERSION,
	}
	state.files[REL] = { ...rec, sha1: BASE_313_SHA1, size: BASE_313_SIZE }
	fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 1)}\n`)
	console.log(`[3/3] state 已回退`)
	console.log(`      applied.commit     ${before.commit} → ${BASE_COMMIT}`)
	console.log(`      applied.nowVersion ${before.nowVersion} → ${BASE_NOW_VERSION}`)
	console.log(`      files["${REL}"].sha1 ${before.fileSha} → ${BASE_313_SHA1}`)

	console.log(`\n装配完成。接下来：`)
	console.log(`  1. 在 VS Code 里打开工作区，确认没有正在进行的对话（有对话在跑会走静默合并）`)
	console.log(`  2. 点「更新 eraTW」`)
	console.log(`  3. 计划里会且只会有这一个 both-changed 冲突，弹询问时选「让 AI 帮我合并」`)
	console.log(`\n回滚方法：`)
	console.log(
		`  node -e "require('fs').copyFileSync('${STATE_BAK.replace(/\\/g, "\\\\")}','${STATE_PATH.replace(/\\/g, "\\\\")}')"`,
	)
	console.log(`  再把 ${REL} 从 _备份/update_backup_20261018_2252_develop20261017/files/ 之外的上游版恢复`)
	console.log(`  （最简单：再跑一次更新即可回到上游 20261017）`)
}

main()

/**
 * 文案测试。
 *
 * 这些断言看着琐碎，但零门槛原则就靠它们守：
 * 界面上出现 commit / 冲突 / 覆盖 / 基线 任何一个词，这个功能对目标用户就失败了。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { describeFreeModelRisk, describeGroup, describePlan, describeResult } from "../../src/core/update/describe"
import type { PlanEntry, UpdatePlan } from "../../src/core/update/types"

function entry(path: string, action: PlanEntry["action"], reason: PlanEntry["reason"]): PlanEntry {
	return { path, action, reason }
}

function plan(entries: PlanEntry[], mode: UpdatePlan["mode"] = "incremental"): UpdatePlan {
	const summary = { write: 0, delete: 0, keep: 0, conflict: 0, unchanged: 0, keepByReason: {} }
	for (const item of entries) {
		if (item.action === "write") {
			summary.write++
		} else if (item.action === "delete") {
			summary.delete++
		} else if (item.action === "keep") {
			summary.keep++
		} else {
			summary.conflict++
		}
	}
	return { mode, entries, groups: [], summary, warnings: [] }
}

const FORBIDDEN = ["commit", "merge", "冲突", "覆盖", "基线", "分支", "仓库", "diff", "HEAD", "上游"]

function assertNoJargon(text: string): void {
	for (const word of FORBIDDEN) {
		assert.ok(!text.includes(word), `文案里不该出现「${word}」：${text}`)
	}
}

test("文案：普通更新说清替换/新增/删除", () => {
	const narrative = describePlan(
		plan([
			entry("ERB/a.ERB", "write", "clean-update"),
			entry("ERB/b.ERB", "write", "upstream-add"),
			entry("ERB/old.ERB", "delete", "upstream-delete"),
		]),
		{ fromVersion: "20261013", toVersion: "20261017" },
	)
	assert.equal(narrative.title, "社区有新版本（20261013 → 20261017）")
	assert.match(narrative.text, /替换 1 个游戏文件/)
	assert.match(narrative.text, /新增 1 个/)
	assert.match(narrative.text, /删掉 1 个/)
	assert.match(narrative.text, /自动备份/)
	assertNoJargon(narrative.text)
})

test("文案：首次更新要主动说明它在靠文件时间猜", () => {
	const narrative = describePlan(plan([entry("ERB/a.ERB", "write", "first-sync-bulk")], "first-sync"))
	assert.match(narrative.text, /第一次更新/)
	assert.match(narrative.text, /靠文件时间/)
	assertNoJargon(narrative.text)
})

test("文案：批量识别不可信时要坦白", () => {
	const base = plan([entry("ERB/a.ERB", "write", "first-sync-bulk")], "first-sync")
	base.warnings = ["first-sync-unreliable"]
	assert.match(describePlan(base).text, /分不太准/)
})

test("文案：冲突不说「冲突」", () => {
	const narrative = describePlan(
		plan([entry("ERB/a.ERB", "conflict", "both-changed"), entry("ERB/b.ERB", "conflict", "both-changed")]),
	)
	assert.equal(narrative.hasConflicts, true)
	assert.match(narrative.text, /你改过、社区也改了/)
	assert.match(narrative.text, /逐个问你/)
	assertNoJargon(narrative.text)
})

test("文案：保留本地改动要说清楚不会被覆盖", () => {
	const narrative = describePlan(plan([entry("ERB/a.ERB", "keep", "local-change"), entry("ERB/b.ERB", "keep", "local-only")]))
	assert.match(narrative.text, /原样留着，不会被改掉/)
	assert.match(narrative.text, /你自己加的 1 个文件/)
	assertNoJargon(narrative.text)
})

test("文案：口上组整包问一次，本体逐文件问", () => {
	const persona = describeGroup({
		kind: "persona",
		key: "053 Tewi [てゐ]",
		label: "053 Tewi [てゐ]",
		paths: ["ERB/個人口上/053/x.ERB", "ERB/個人口上/053/y.ERB"],
	})
	assert.match(persona, /053 Tewi \[てゐ\] 的口上你改过，社区也改了（2 个文件）/)

	const file = describeGroup({ kind: "file", key: "ERB/本体.ERB", label: "ERB/本体.ERB", paths: ["ERB/本体.ERB"] })
	assert.match(file, /这个文件你改过，社区也改了/)
})

test("文案：免费模型风险提醒说清轮换风险与手动备份建议，且无术语", () => {
	const risk = describeFreeModelRisk()
	assert.ok(risk.title.includes("免费模型"), `标题应点明免费模型：${risk.title}`)
	assert.match(risk.detail, /抽到智力不高的模型/)
	assert.match(risk.detail, /复制一份/)
	assertNoJargon(`${risk.title}\n${risk.detail}`)
})

test("文案：成功时给备份路径与撤销提示", () => {
	const narrative = describeResult("applied", {
		root: "D:/game",
		nowVersion: "20261017",
		merged: 2,
		backupDir: "D:/game/_备份/update_backup_x",
	})
	assert.equal(narrative.title, "更新完成，现在是 20261017")
	assert.match(narrative.text, /合在一起的/)
	assert.match(narrative.text, /备份放在/)
	assert.equal(narrative.backupDir, "D:/game/_备份/update_backup_x")
	assertNoJargon(narrative.text)
})

test("文案：失败必须明说「什么都没变」", () => {
	const narrative = describeResult("failed", { root: "D:/game", error: "磁盘空间不够" })
	assert.match(narrative.title, /什么都没变/)
	assert.match(narrative.text, /磁盘空间不够/)
})

test("文案：回滚没跑干净时不能谎报「什么都没变」，要指路备份目录", () => {
	const narrative = describeResult("failed", {
		root: "D:/game",
		error: "文件被占用",
		rolledBack: false,
		backupDir: "D:/game/_备份/update_backup_x",
	})
	assert.match(narrative.title, /没能完全恢复/)
	assert.ok(!narrative.text.includes("什么都没变"), `不能谎报原状：${narrative.text}`)
	assert.match(narrative.text, /手动处理/)
	assert.match(narrative.text, /update_backup_x/)
	assert.equal(narrative.backupDir, "D:/game/_备份/update_backup_x")
	assertNoJargon(narrative.text)
})

test("文案：写后校验有文件没写对时，点名文件并建议处理", () => {
	const narrative = describeResult("applied", {
		root: "D:/game",
		nowVersion: "20261017",
		backupDir: "D:/game/_备份/update_backup_x",
		verifyMismatches: ["ERB/a.ERB", "ERB/b.ERB", "ERB/c.ERB", "ERB/d.ERB", "ERB/e.ERB", "ERB/f.ERB", "ERB/g.ERB"],
	})
	assert.match(narrative.title, /7 个文件没写对/)
	assert.ok(!narrative.text.includes("什么都没丢"), `校验没过不能当一切正常：${narrative.text}`)
	assert.match(narrative.text, /ERB\/a\.ERB/)
	assert.match(narrative.text, /还有 2 个/)
	assert.match(narrative.text, /update_backup_x/)
	assertNoJargon(narrative.text)
})

test("文案：校验全部通过时照常报更新完成", () => {
	const narrative = describeResult("applied", {
		root: "D:/game",
		nowVersion: "20261017",
		verifyMismatches: [],
	})
	assert.match(narrative.title, /更新完成/)
	assert.match(narrative.text, /什么都没丢/)
})

test("文案：只有冲突且全部保留时不说「更新完成」", () => {
	const narrative = describeResult("nothing-to-do", { root: "D:/game", keptLocal: 3 })
	assert.equal(narrative.title, "没有需要更新的文件")
	assert.match(narrative.text, /3 个文件都留着/)
	assert.ok(!narrative.text.includes("更新完成"))
})

test("文案：闸门警告列文件行号与修法，且无术语", () => {
	const base = plan([entry("ERB/a.ERB", "write", "clean-update")])
	base.gateFindings = [
		{
			gate: "G2",
			code: "rand-hollow",
			path: "ERB/a.ERB",
			line: 42,
			detail: "RAND:9 只有 5 种走法且无 CASEELSE（4/9 概率落空）",
		},
	]
	base.gatesSkipped = 3
	const narrative = describePlan(base)
	assert.ok(narrative.gateNotes && narrative.gateNotes.length >= 3)
	assert.ok(narrative.text.includes("ERB/a.ERB 第 42 行"))
	assert.ok(narrative.text.includes("以上清单不全"))
	assertNoJargon(narrative.text)
})

test("文案：没有闸门 finding 时不出 gateNotes", () => {
	const narrative = describePlan(plan([entry("ERB/a.ERB", "write", "clean-update")]))
	assert.equal(narrative.gateNotes, undefined)
})

test("文案：已是最新时给出当前版本", () => {
	assert.match(describeResult("up-to-date", { root: "D:/game", nowVersion: "20261017" }).text, /20261017/)
})

test("文案：已经是最新时不能说「社区有新版本」", () => {
	const narrative = describePlan(plan([entry("ERB/mine.ERB", "keep", "local-only")]), {
		fromVersion: "20261017",
		toVersion: "20261017",
	})
	assert.match(narrative.title, /已经是最新的了/)
	assert.ok(!narrative.text.includes("有新版本"), `不能让人以为还有更新要装：${narrative.text}`)
	assert.ok(!narrative.text.includes("自动备份"), "没活要干时不必提备份")
	assert.match(narrative.text, /1 个文件/)
	assertNoJargon(narrative.text)
})

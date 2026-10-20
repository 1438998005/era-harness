/**
 * 存档迁移时机判据（第九问）＋ 它的文案。
 *
 * 纪律与 gates.spec.ts 同源：**保守不误报**——版本号读不到就不报，
 * 没动剧本/数据也不报；报出来的每一条都要能指出"哪个症状会因此出现"。
 */
import assert from "node:assert/strict"
import test from "node:test"
import { describePlan } from "../../src/core/update/describe"
import type { PlanEntry, UpdatePlan } from "../../src/core/update/types"
import { versionBumpNotice } from "../../src/core/update/version"

const FORBIDDEN = ["commit", "merge", "冲突", "覆盖", "基线", "分支", "仓库", "diff", "HEAD", "上游"]

function entry(path: string, action: PlanEntry["action"]): PlanEntry {
	return { path, action, reason: "clean-update" }
}

function planOf(entries: PlanEntry[], notice?: UpdatePlan["versionNotice"]): UpdatePlan {
	return {
		mode: "incremental",
		entries,
		groups: [],
		summary: {
			write: entries.filter((e) => e.action === "write").length,
			delete: entries.filter((e) => e.action === "delete").length,
			keep: 0,
			conflict: 0,
			unchanged: 0,
			keepByReason: {},
		},
		warnings: [],
		...(notice ? { versionNotice: notice } : {}),
	}
}

// ————————————————————————————————————————————————
// 判据
// ————————————————————————————————————————————————

test("vu-02 判据：版本号没变、又要动剧本 ⇒ 报", () => {
	const notice = versionBumpNotice([entry("ERB/口上・メッセージ関連/M_KOJO_K1.ERB", "write")], {
		local: "20261017",
		upstream: "20261017",
	})
	assert.ok(notice)
	assert.equal(notice.version, "20261017")
	assert.equal(notice.saveAffectingFiles, 1)
	assert.equal(notice.saveAffectingDeletes, 0)
})

test("版本号变了 ⇒ 不报（迁移会自动跑，这是正常情况）", () => {
	const notice = versionBumpNotice([entry("ERB/a.ERB", "write")], { local: "20261017", upstream: "20261020" })
	assert.equal(notice, null)
})

test("没动剧本/数据 ⇒ 不报（只换立绘、改说明文件不需要迁移）", () => {
	const notice = versionBumpNotice([entry("resources/a.png", "write"), entry("readme.md", "write")], {
		local: "20261017",
		upstream: "20261017",
	})
	assert.equal(notice, null)
})

test("两边任一读不到 ⇒ 如实不报（⛔ 把读不到当没 bump）", () => {
	const entries = [entry("ERB/a.ERB", "write")]
	assert.equal(versionBumpNotice(entries, { local: null, upstream: "20261017" }), null)
	assert.equal(versionBumpNotice(entries, { local: "20261017", upstream: null }), null)
	assert.equal(versionBumpNotice(entries, undefined), null)
})

test("CSV 命名表同样算存档口径；大小写与子目录都要认", () => {
	const notice = versionBumpNotice([entry("csv/CFLAG.csv", "write"), entry("ERB/fromEN/NEW_UPDATE/UPDATE_MAIN.ERB", "write")], {
		local: "1",
		upstream: "1",
	})
	assert.equal(notice?.saveAffectingFiles, 2)
})

test("只数真会落盘的（write/delete）；待定的不算，⛔ 拿没发生的事吓人", () => {
	const notice = versionBumpNotice([{ path: "ERB/a.ERB", action: "keep", reason: "local-change" }], {
		local: "1",
		upstream: "1",
	})
	assert.equal(notice, null)
})

test("删除单独计数（删剧本有方向性：⛔ 删默认那份）", () => {
	const notice = versionBumpNotice([entry("ERB/a.ERB", "write"), entry("ERB/b.ERB", "delete")], {
		local: "1",
		upstream: "1",
	})
	assert.equal(notice?.saveAffectingFiles, 2)
	assert.equal(notice?.saveAffectingDeletes, 1)
})

// ————————————————————————————————————————————————
// 文案
// ————————————————————————————————————————————————

test("文案：说清「不会自动迁移」与怎么办，且不出现行话", () => {
	const narrative = describePlan(
		planOf([entry("ERB/a.ERB", "write")], { version: "20261017", saveAffectingFiles: 3, saveAffectingDeletes: 0 }),
		{ fromVersion: "20261017", toVersion: "20261017" },
	)
	assert.ok(
		narrative.lines.some((line) => line.includes("不会自动迁移")),
		narrative.text,
	)
	assert.ok(narrative.text.includes("NOW_VERSION"), "要给出处置办法")
	assert.ok(narrative.text.includes("3 个剧本/数据文件"))
	for (const word of FORBIDDEN) {
		assert.ok(!narrative.text.includes(word), `文案里不该出现「${word}」`)
	}
})

test("文案：有删除时多点一句方向性；没有删除时不多嘴", () => {
	const withDelete = describePlan(
		planOf([entry("ERB/a.ERB", "delete")], { version: "1", saveAffectingFiles: 1, saveAffectingDeletes: 1 }),
		{},
	)
	assert.ok(withDelete.text.includes("删掉默认那份"))
	const withoutDelete = describePlan(
		planOf([entry("ERB/a.ERB", "write")], { version: "1", saveAffectingFiles: 1, saveAffectingDeletes: 0 }),
		{},
	)
	assert.ok(!withoutDelete.text.includes("删默认那份"))
})

test("文案：没有提醒时一个字都不加（⛔ 每次都念叨）", () => {
	const narrative = describePlan(planOf([entry("ERB/a.ERB", "write")]), { fromVersion: "1", toVersion: "2" })
	assert.ok(!narrative.text.includes("迁移"), narrative.text)
})

test("闸门警告要进 lines——确认弹窗只渲染 lines，只挂 text 等于看不见", () => {
	const base = planOf([entry("ERB/a.ERB", "write")])
	const withFinding: UpdatePlan = {
		...base,
		gateFindings: [
			{
				gate: "G6",
				code: "hph-residue",
				path: "ERB/a.ERB",
				line: 3,
				detail: "字符串仍含 HPH（粉色 /// 陷阱，去化必回归）",
			},
		],
	}
	const narrative = describePlan(withFinding, {})
	assert.ok(
		narrative.lines.some((line) => line.includes("HPH")),
		`lines 里应能看到闸门警告：${narrative.lines.join(" | ")}`,
	)
	assert.ok(narrative.text.includes("HPH"))
})

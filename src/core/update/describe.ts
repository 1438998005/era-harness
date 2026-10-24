/**
 * eratw 一键更新 —— 把计划翻译成人话。
 *
 * 所有面向用户的文案集中在这里，理由有三：
 * 1. 零词汇原则要求界面里不出现 commit / merge / 冲突 / 基线。
 *    文案散落在各处必然走味，集中起来才守得住。
 * 2. 纯函数，可以单元测试 —— 文案错了和逻辑错了同等严重。
 * 3. 同一段文案要给 VS Code 弹窗、聊天区、工具返回三处复用。
 *
 * 术语替换表：冲突 → 「你改过，社区也改了」；
 * 覆盖 → 「替换」；上游 → 「社区」；基线 → 「上次更新的记录」。
 */

import type { ConflictGroup, PlanEntry, UpdatePlan } from "./types"

export interface PlanNarrative {
	/** 一行标题 */
	title: string
	/** 明细行，UI 逐行显示 */
	lines: string[]
	/** 拼好的整段文本（弹窗正文） */
	text: string
	/** 有没有需要用户拍板的东西 */
	hasConflicts: boolean
	/** 闸门警告（诊断细节保留 ERB 术语，与引擎错误消息一致；没有时为 undefined） */
	gateNotes?: string[]
}

export interface DescribePlanOptions {
	/** 本地当前版本号（`NOW_VERSION`），读不到传 null */
	fromVersion?: string | null
	/** 社区最新版本号，读不到传 null */
	toVersion?: string | null
}

function countByReason(entries: PlanEntry[]): Map<string, number> {
	const map = new Map<string, number>()
	for (const entry of entries) {
		map.set(entry.reason, (map.get(entry.reason) ?? 0) + 1)
	}
	return map
}

/**
 * 计划 → 人话。
 *
 * 刻意不报"不变"的文件数：玩家不关心 12729 个没动的文件，报了只会让人以为要处理它们。
 */
export function describePlan(plan: UpdatePlan, opts: DescribePlanOptions = {}): PlanNarrative {
	const lines: string[] = []
	const reasons = countByReason(plan.entries)

	const replaced =
		(reasons.get("clean-update") ?? 0) + (reasons.get("first-sync-bulk") ?? 0) + (reasons.get("local-deleted") ?? 0)
	const added = reasons.get("upstream-add") ?? 0
	const deleted = plan.summary.delete
	const conflicted = plan.summary.conflict
	const keptByMe = (reasons.get("local-change") ?? 0) + (reasons.get("first-sync-human") ?? 0)
	const mineOnly = reasons.get("local-only") ?? 0

	const from = opts.fromVersion
	const to = opts.toVersion
	const hasWork = plan.summary.write + plan.summary.delete + plan.summary.conflict > 0

	// 没有活要干时不能说"社区有新版本"——用户会以为点了按钮没生效（§13.13 记过这个坑）
	if (!hasWork) {
		const title = to ? `已经是最新的了（${to}）` : "已经是最新的了"
		const idle: string[] = ["社区那边没有新东西，不用更新。"]
		if (keptByMe > 0) {
			idle.push(`你自己改过的 ${keptByMe} 个文件会原样留着，不会被改掉。`)
		}
		if (mineOnly > 0) {
			idle.push(`你自己加的 ${mineOnly} 个文件（社区版里没有）不会被动。`)
		}
		return { title, lines: idle, text: [title, ...idle].join("\n"), hasConflicts: false }
	}

	const title = from && to && from !== to ? `社区有新版本（${from} → ${to}）` : to ? `社区有新版本（${to}）` : "社区有新版本"

	if (plan.mode === "first-sync") {
		lines.push("这是第一次更新，我会靠文件时间分辨哪些是你自己改的。")
		if (plan.warnings.includes("first-sync-unreliable")) {
			lines.push("不过你的文件时间看起来被整体动过，我分不太准，更新前会先备份。")
		}
	}

	const parts: string[] = []
	if (replaced > 0) {
		parts.push(`替换 ${replaced} 个游戏文件`)
	}
	if (added > 0) {
		parts.push(`新增 ${added} 个`)
	}
	if (deleted > 0) {
		parts.push(`删掉 ${deleted} 个社区已经不要的旧文件`)
	}
	if (parts.length > 0) {
		lines.push(`这次会${parts.join("、")}。`)
	}

	if (conflicted > 0) {
		lines.push(`其中 ${conflicted} 个文件你改过、社区也改了，我会逐个问你怎么处理。`)
	}
	if (keptByMe > 0) {
		lines.push(`你自己改过的 ${keptByMe} 个文件会原样留着，不会被改掉。`)
	}
	if (mineOnly > 0) {
		lines.push(`你自己加的 ${mineOnly} 个文件（社区版里没有）不会被动。`)
	}

	const migrationNotes = describeVersionNotes(plan)
	for (const note of migrationNotes) {
		lines.push(note)
	}

	lines.push("更新前会自动备份，随时可以撤销。")

	const narrative: PlanNarrative = { title, lines, text: [title, ...lines].join("\n"), hasConflicts: conflicted > 0 }
	const gateNotes = describeGateNotes(plan)
	if (gateNotes.length > 0) {
		narrative.gateNotes = gateNotes
		// 确认弹窗只渲染 lines（updateGame.ts 用 lines.join），只挂 text 等于用户看不见
		lines.push(...gateNotes)
		narrative.text = `${narrative.text}\n\n${gateNotes.join("\n")}`
	}
	return narrative
}

/**
 * 存档迁移时机 → 人话（判据在 `version.ts`）。
 * 判不了时返回空数组，⛔ 编一条吓人的话；有删除才多点方向性那句。
 */
function describeVersionNotes(plan: UpdatePlan): string[] {
	const notice = plan.versionNotice
	if (!notice) {
		return []
	}
	const notes = [
		`注意：社区这版和你现在都是 ${notice.version}，但这次要动 ${notice.saveAffectingFiles} 个剧本/数据文件。`,
		"版本号没变，游戏读旧存档时不会自动迁移——可能有些角色从此不出台词，而且不报错。",
	]
	if (notice.saveAffectingDeletes > 0) {
		notes.push(`其中有 ${notice.saveAffectingDeletes} 个是要删掉的剧本/数据——删掉默认那份没有自愈，老存档会一直不出台词。`)
	}
	notes.push("更新后把 DIM.ERH 里的 NOW_VERSION 抬一级，或让旧存档手动跑一次 UPDATE，迁移才会跑。")
	return notes
}

/** 闸门警告 → 人话（最多列 10 条，防弹窗被淹没） */
function describeGateNotes(plan: UpdatePlan): string[] {
	const findings = plan.gateFindings ?? []
	if (findings.length === 0) {
		return []
	}
	const notes: string[] = ["这次更新的文件里发现几处老毛病（不拦更新，但建议处理）："]
	for (const finding of findings.slice(0, 10)) {
		const where = finding.line ? `${finding.path} 第 ${finding.line} 行` : finding.path
		notes.push(`· ${where}：${finding.detail}`)
	}
	if (findings.length > 10) {
		notes.push(`· ……还有 ${findings.length - 10} 条类似的，更新完可以在日志里看全。`)
	}
	if (plan.gatesSkipped && plan.gatesSkipped > 0) {
		notes.push(`（有 ${plan.gatesSkipped} 个改动脚本太大没扫，以上清单不全。）`)
	}
	return notes
}

/** 一个冲突组 → 一句问话 */
export function describeGroup(group: ConflictGroup): string {
	if (group.kind === "persona") {
		const count = group.paths.length === 1 ? "" : `（${group.paths.length} 个文件）`
		return `${group.label} 的口上你改过，社区也改了${count}。要怎么处理？`
	}
	return `${group.label} 这个文件你改过，社区也改了。要怎么处理？`
}

export interface ResultNarrative {
	title: string
	lines: string[]
	text: string
	/** 有备份目录时给撤销按钮用 */
	backupDir: string | null
}

export interface DescribeResultOptions {
	root: string
	nowVersion?: string | null
	/** 合并过几个文件 */
	merged?: number
	/** 保留了几个本地改过的文件 */
	keptLocal?: number
	/**
	 * 自动回滚是否完全成功（failed 时用；缺省视为已完全恢复，与旧行为一致）。
	 * false = 磁盘可能停在半更新状态，文案必须让用户手动处理，不能说"什么都没变"。
	 */
	rolledBack?: boolean
	/** 写后校验发现内容不符的文件路径（applied 时用；非空 = 有文件没写对） */
	verifyMismatches?: string[]
}

/**
 * 免费模型风险提醒（2026-10-19 用户需求）。
 *
 * 免费池是多个候选模型轮换的路由，可能抽到智力不高的模型；更新里的 AI 合稿
 * 依赖模型质量，抽到弱模型可能把用户改过的文件改错。所以免费模型下执行更新前，
 * 先用这段文案提醒风险并建议手动备份，再走正常的确认流程。
 */
export function describeFreeModelRisk(): { title: string; detail: string } {
	return {
		title: "当前是免费模型，更新有风险",
		detail: [
			"免费模型是在几个候选模型里轮换的，这次可能抽到智力不高的模型。",
			"更新时要 AI 把你改过的文件和社区的新版本合到一块儿，模型不好可能合错，你的口上容易变乱。",
			"",
			"建议：更新前先把游戏文件夹整个复制一份留着；更新后进游戏确认没问题，再删掉那份复制。",
			"更新自己也会自动备份，但手动复制多一层保险——万一合错了又跑了几轮，也能整个退回去。",
		].join("\n"),
	}
}

/** 执行结果 → 人话（成功、失败、无需更新三种） */
export function describeResult(
	status: "applied" | "failed" | "up-to-date" | "planned" | "nothing-to-do" | "cancelled",
	opts: DescribeResultOptions & { backupDir?: string | null; error?: string },
): ResultNarrative {
	const backupDir = opts.backupDir ?? null

	if (status === "planned") {
		// 只算了计划没执行。正常情况下调用方会改用 describePlan 展示，
		// 走到这里说明调用方想直接说一句"等你确认"。
		const title = "已经算好了，等你确认"
		return { title, lines: ["磁盘上的文件一个都没动。"], text: `${title}\n磁盘上的文件一个都没动。`, backupDir: null }
	}

	if (status === "applied") {
		// 写后校验发现内容不符：不能照常报"更新完成"——用户有权知道哪些文件可疑（U4）
		const mismatched = opts.verifyMismatches ?? []
		if (mismatched.length > 0) {
			const title = `更新完成，但有 ${mismatched.length} 个文件没写对`
			const lines = [
				"下面这些文件写完后的内容和应该写入的不一致（可能被杀毒软件或其他程序动了）：",
				...mismatched.slice(0, 5).map((p) => `· ${p}`),
			]
			if (mismatched.length > 5) {
				lines.push(`· ……还有 ${mismatched.length - 5} 个`)
			}
			if (backupDir) {
				lines.push(`备份还在：${backupDir}，不放心可以手动对照。`)
			}
			lines.push("建议重跑一次更新；重跑前最好先手动备份游戏文件夹。")
			return { title, lines, text: [title, ...lines].join("\n"), backupDir }
		}
		const lines = ["什么都没丢，你改过的地方都留着。"]
		if (opts.merged && opts.merged > 0) {
			lines.push(`其中 ${opts.merged} 个文件是把你和社区的改动合在一起的，建议进游戏看一眼。`)
		}
		if (backupDir) {
			lines.push(`备份放在：${backupDir}`)
		}
		const title = opts.nowVersion ? `更新完成，现在是 ${opts.nowVersion}` : "更新完成"
		return { title, lines, text: [title, ...lines].join("\n"), backupDir }
	}

	if (status === "up-to-date") {
		const title = opts.nowVersion ? `已经是最新的了（${opts.nowVersion}）` : "已经是最新的了"
		return { title, lines: ["不需要更新。"], text: `${title}\n不需要更新。`, backupDir: null }
	}

	if (status === "nothing-to-do") {
		const title = "没有需要更新的文件"
		const kept =
			opts.keptLocal && opts.keptLocal > 0 ? `你改过的 ${opts.keptLocal} 个文件都留着。` : "磁盘上的文件一个都没动。"
		return { title, lines: [kept], text: `${title}\n${kept}`, backupDir: null }
	}

	if (status === "cancelled") {
		const title = "已取消，什么都没改"
		return { title, lines: ["磁盘上的文件一个都没动。"], text: `${title}\n磁盘上的文件一个都没动。`, backupDir: null }
	}

	// 回滚没跑干净时不能谎报"什么都没变"——磁盘可能停在半更新状态，必须让用户手动处理
	if (opts.rolledBack === false) {
		const title = "更新没成功，而且没能完全恢复原样"
		const lines = [
			"有些文件可能停在更新到一半的状态，需要手动处理。",
			backupDir ? `更新前的备份还在：${backupDir}` : "更新前的备份在游戏目录下的「_备份」文件夹里。",
		]
		if (opts.error) {
			lines.unshift(`原因：${opts.error}`)
		}
		return { title, lines, text: [title, ...lines].join("\n"), backupDir }
	}

	const title = "更新没成功，已经恢复到更新前的样子，什么都没变"
	const detail = opts.error ? `原因：${opts.error}` : ""
	return {
		title,
		lines: detail ? [detail] : [],
		text: [title, detail].filter(Boolean).join("\n"),
		backupDir: null,
	}
}

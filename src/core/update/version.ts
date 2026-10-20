/**
 * 「更新 eraTW」的**存档迁移时机**判据（G1–G8 之外的第九问）。
 *
 * G1–G8 管「合进来的内容对不对」，这里管「合进去之后老存档会不会失声」——
 * 引擎只在**版本号不匹配**的首次读档时自动跑一次迁移：
 * 存档里的 `modding_version` ↔ 当前 `NOW_VERSION`（魔改版）、`SAVESTR:本体バージョン` ↔ 游戏本体版本，任一不等才触发。
 * ⇒ 社区这版改了剧本/数据却没抬 `NOW_VERSION` 时，内容全对、旧存档照样静默失声（不出台词、零报错）。
 *
 * 判据正本：核心库 `src/knowledge/data/version-up-and-save-migration.ts`（`vu-01` / `vu-02`），
 * 上游正本 shared-trae `knowledge/eratw/kojo-script-index-system.md`。
 *
 * 纯函数、无 IO；与内容闸门同一保守口径：**读不到版本号就不报**（拿不准不报＝不误报的立身之本）。
 */

import type { PlanEntry, VersionNotice } from "./types"

/**
 * 影响存档的路径前缀：剧本逻辑（ERB）与命名/槽位数据表（CSV）。
 * 其余（resources 立绘、readme、tools…）改了不动存档结构，不需要迁移。
 */
const SAVE_AFFECTING_RE = /^(ERB|CSV)\//i

/** 两边版本号；读不到传 null ⇒ 本判据如实不报 */
export interface NowVersions {
	local: string | null
	upstream: string | null
}

/** 数一下改动集里「会动到存档口径」的文件（只算真会落盘的 write / delete，不含未定的 conflict） */
export function selectSaveAffecting(entries: readonly PlanEntry[]): PlanEntry[] {
	return entries.filter(
		(entry) => (entry.action === "write" || entry.action === "delete") && SAVE_AFFECTING_RE.test(entry.path),
	)
}

/**
 * 版本号未 bump 判据。
 *
 * 报出的条件（三条同时成立，否则返回 null）：
 * 1. 两边 `NOW_VERSION` 都读得到；
 * 2. 两者**相等** ⇒ 迁移不会自动跑；
 * 3. 改动集里至少有一个 ERB/CSV 文件要落盘或删除。
 *
 * ⛔ 只在两边不等时报警——那是正常情况；⛔ 拿 `null`（本地目录源、坏档）当「没 bump」。
 */
export function versionBumpNotice(entries: readonly PlanEntry[], versions?: NowVersions): VersionNotice | null {
	if (!versions || versions.local === null || versions.upstream === null) {
		return null
	}
	if (versions.local !== versions.upstream) {
		return null
	}
	const touched = selectSaveAffecting(entries)
	if (touched.length === 0) {
		return null
	}
	return {
		version: versions.local,
		saveAffectingFiles: touched.length,
		saveAffectingDeletes: touched.filter((entry) => entry.action === "delete").length,
	}
}

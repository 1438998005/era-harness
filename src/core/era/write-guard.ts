/**
 * 备份落点守卫：**备份文件不能写进脚本树**。
 *
 * 为什么需要：插件自己不做备份，而目标工程的 `AGENTS.md` / `.clinerules` 只写了
 * 「覆盖前先备份」，没给路径。模型于是就近备份——实测把 `X.ERB.bak` 写进了口上目录。
 * 更危险的是写成 `.ERB` 副本：引擎会把 `ERB/` 下的任何 `.ERB` 当源码加载，
 * 造成函数重复定义、懒加载索引污染，而模型以为自己只是「留了个备份」。
 *
 * 规则（按顺序，先命中先返回）：
 * 1. 工程根的备份区（`_备份/`、`备份/`、`backup/`…）→ 放行（更新器也用这里）。
 * 2. 脚本树里出现备份目录段 → 拒绝。
 * 3. 文件名是「脚本的备份形态」（`X.ERB.bak`）→ 拒绝（任何位置，工程外不管）。
 * 4. 脚本树或口上目录里的 `.bak/.orig/.../副本` → 拒绝。
 * 5. 其余（例如口上目录要求的 `*.txt` 改动记录）→ 放行。
 *
 * 纯函数 + 一次工程探测，不碰文件系统写操作，便于单测。
 */

import path from "node:path"
import { type EraProjectProfile, getEraProjectProfile, isPersonaScopePath } from "./project-profile"

export type EraWriteGuardRule = "backup-root" | "backup-in-script-tree" | "script-backup-copy" | "backup-name-in-source"

export interface EraWriteGuardResult {
	allowed: boolean
	/** 命中的规则（放行时用于说明「这是允许的备份区」） */
	rule?: EraWriteGuardRule
	/** 拒绝原因：给模型看，必须能照着改 */
	reason?: string
}

export interface EraWriteTargetInput {
	/** 目标文件绝对路径 */
	absolutePath: string
	/** 当前工作目录（没有传 profile 时现场探测） */
	cwd?: string
	profile?: EraProjectProfile
}

/** 备份目录形态；与 `project-profile.ts` 的探测规则保持一致 */
const BACKUP_DIR_RE = /^_*(备份|备份档|backup|backups|bak|old)$/i
/** 备份文件形态 */
const BACKUP_NAME_RE = /\.(bak|orig|old|backup|copy|tmp)$|副本/i
/** 脚本的备份副本（最强信号：无论在哪都拦） */
const SCRIPT_BACKUP_RE = /\.(erb|erh)\.(bak|orig|old|backup|copy|tmp)$/i

/** 便宜的前置过滤：不像备份就直接放行，避免每次写盘都去扫工程目录 */
function looksLikeBackupPath(targetPath: string): boolean {
	const base = path.basename(targetPath)
	if (BACKUP_NAME_RE.test(base)) {
		return true
	}
	return targetPath.split(/[\\/]/).some((segment) => BACKUP_DIR_RE.test(segment))
}

function segmentsUnderRoot(targetPath: string, root: string): string[] {
	const rel = path.relative(path.resolve(root), path.resolve(targetPath))
	if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
		return []
	}
	return rel.split(/[\\/]/).filter(Boolean)
}

const REASON_IN_SCRIPT_TREE =
	"⛔ 备份不能写进脚本目录：引擎会把脚本树里的 .ERB/.ERH 当源码加载，造成函数重复定义与懒加载索引污染。\n" +
	"请把备份写到工程根的「_备份/<日期>_<用途>/」，或直接用 replace_in_file 定点改（改动会留在文件历史里）。"

const REASON_NAME =
	"⛔ 不要在源码目录里生成 .bak/.orig/.old/副本：引擎可能把它当源码加载，也会污染懒加载索引。\n" +
	"请把备份写到工程根的「_备份/<日期>_<用途>/」。"

/**
 * 判定一次写盘的目标是否允许。
 *
 * 只对「像备份」的路径做完整判定；普通脚本/文本写入直接放行，不增加写盘开销。
 */
export function checkEraWriteTarget(input: EraWriteTargetInput): EraWriteGuardResult {
	const absolutePath = path.resolve(input.absolutePath)
	if (!looksLikeBackupPath(absolutePath)) {
		return { allowed: true }
	}

	const profile = input.profile ?? getEraProjectProfile(input.cwd)
	if (!profile.isEra) {
		return { allowed: true }
	}
	const root = profile.roots[0]
	if (!root) {
		return { allowed: true }
	}

	const segments = segmentsUnderRoot(absolutePath, root)
	if (segments.length === 0) {
		// 工程外：不归这条规则管
		return { allowed: true }
	}

	const fileName = segments[segments.length - 1] ?? ""
	const dirs = segments.slice(0, -1)
	const knownScriptDirs = new Set(profile.scriptDirNames.map((name) => name.toLowerCase()))
	const inScriptTree = dirs.some((segment) => knownScriptDirs.has(segment.toLowerCase())) || /^ERB$/i.test(dirs[0] ?? "")
	const inBackupDir = dirs.some((segment) => BACKUP_DIR_RE.test(segment))

	// 1) 工程根的备份区：放行（更新器写 _备份/update_backup_* 也走这里）
	if (dirs.length > 0 && BACKUP_DIR_RE.test(dirs[0] ?? "")) {
		return { allowed: true, rule: "backup-root" }
	}

	// 2) 脚本树里的备份目录：拒绝
	if (inScriptTree && inBackupDir) {
		return { allowed: false, rule: "backup-in-script-tree", reason: REASON_IN_SCRIPT_TREE }
	}

	// 3) 脚本的备份副本：无论写在哪都拒绝（这类文件最容易被引擎当源码）
	if (SCRIPT_BACKUP_RE.test(fileName)) {
		return { allowed: false, rule: "script-backup-copy", reason: REASON_NAME }
	}

	// 4) 脚本树 / 口上目录里的备份形态文件名：拒绝
	const persona = isPersonaScopePath(absolutePath, input.cwd, profile)
	if ((inScriptTree || persona) && BACKUP_NAME_RE.test(fileName)) {
		return { allowed: false, rule: "backup-name-in-source", reason: REASON_NAME }
	}

	// 5) 其余（例如口上目录要求的 *.txt 改动记录）：放行
	return { allowed: true }
}

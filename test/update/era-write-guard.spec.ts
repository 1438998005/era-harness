/**
 * 写盘两道确定性防线的回归测试。
 *
 * 背景（2026-10-25 真实任务取证）：
 * 1. 模型把 `#LOCALSIZE 500` 当成「重复定义」去重删掉 —— 目标工程实测 21,878 处
 *    （`#LOCALSIZE` 10,970 + `#LOCALSSIZE` 10,908，分布在 1,416 个脚本文件里），
 *    删掉后容量回退 `VariableSize.csv`，函数用到 `LOCAL:M` 时越界。
 * 2. 模型把备份写进了口上目录（`X.ERB.bak`）—— 引擎会把 `ERB/` 下任何 `.ERB` 当源码加载。
 *
 * 这两条都是「确定性判据」，不靠提示词，直接在写盘入口拦。
 * 本测试锁两件事：**该拦的拦住**，以及**不该拦的别误拒**（硬拦最大的风险就是误拒）。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { findLostLocalSizeDirectives, formatLostDirectivesError } from "@eraharness/erb/directives"
import { resetEraProjectProfileCache } from "../../src/core/era/project-profile"
import { checkEraWriteTarget } from "../../src/core/era/write-guard"

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-write-guard-"))
	try {
		await run(root)
	} finally {
		resetEraProjectProfileCache()
		await fs.rm(root, { recursive: true, force: true })
	}
}

async function touch(abs: string, content = "; x\n"): Promise<void> {
	await fs.mkdir(path.dirname(abs), { recursive: true })
	await fs.writeFile(abs, content, "utf8")
}

/** 最小 EraBasic 工程：ERB/ 里有脚本、CSV/ 有配置、根上有引擎 */
async function makeEraGame(root: string): Promise<void> {
	for (let i = 0; i < 12; i++) {
		await touch(path.join(root, "ERB", `S${i}.ERB`))
	}
	await fs.mkdir(path.join(root, "CSV"), { recursive: true })
	await fs.writeFile(path.join(root, "emuera.config"), "USELAZYLOADING:YES\n", "utf8")
	await fs.writeFile(path.join(root, "Emuera.exe"), "MZ", "utf8")
}

// ── 备份落点守卫 ─────────────────────────────────────────────

test("口上目录里的 X.ERB.bak：拒绝（引擎会把它当源码加载）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({
			absolutePath: path.join(root, "ERB", "口上", "口上_メイ.ERB.bak"),
			cwd: root,
		})
		assert.equal(result.allowed, false)
		assert.equal(result.rule, "script-backup-copy")
		assert.match(result.reason ?? "", /_备份\//)
	})
})

test("ERB/备份/X.ERB：拒绝（脚本树里不能有备份目录）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({
			absolutePath: path.join(root, "ERB", "备份", "S0.ERB"),
			cwd: root,
		})
		assert.equal(result.allowed, false)
		assert.equal(result.rule, "backup-in-script-tree")
	})
})

test("ERB/backup/X.ERB：同样拒绝（英文目录名不放过）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({
			absolutePath: path.join(root, "ERB", "backup", "S0.ERB"),
			cwd: root,
		})
		assert.equal(result.allowed, false)
		assert.equal(result.rule, "backup-in-script-tree")
	})
})

test("工程根 _备份/<日期>_<用途>/X.ERB：放行（更新器也写这里）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({
			absolutePath: path.join(root, "_备份", "2026-10-28_修口上", "S0.ERB"),
			cwd: root,
		})
		assert.equal(result.allowed, true)
		assert.equal(result.rule, "backup-root")
	})
})

test("工程根 备份/X.ERB（无下划线）：放行", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({ absolutePath: path.join(root, "备份", "S0.ERB"), cwd: root })
		assert.equal(result.allowed, true)
		assert.equal(result.rule, "backup-root")
	})
})

test("口上目录里的 说明.txt：放行（口上要求的改动记录不能被误拦）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({ absolutePath: path.join(root, "ERB", "口上", "说明.txt"), cwd: root })
		assert.equal(result.allowed, true)
	})
})

test("正常改口上脚本：放行（零开销路径，不触发工程探测也能过）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({
			absolutePath: path.join(root, "ERB", "口上", "口上_メイ.ERB"),
			cwd: root,
		})
		assert.equal(result.allowed, true)
	})
})

test("工程外的 .bak：放行（不归这条规则管）", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(path.join(root, "game"))
		const result = checkEraWriteTarget({
			absolutePath: path.join(root, "notes", "草稿.txt.bak"),
			cwd: root,
		})
		assert.equal(result.allowed, true)
	})
})

test("非 Era 工程：放行（不能干扰普通仓库的备份习惯）", async () => {
	await withTempDir(async (root) => {
		await touch(path.join(root, "src", "index.ts"), "export {}\n")
		const result = checkEraWriteTarget({ absolutePath: path.join(root, "src", "index.ts.bak"), cwd: root })
		assert.equal(result.allowed, true)
	})
})

test("扩展名大小写不敏感：X.ERB.BAK 也拒", async () => {
	await withTempDir(async (root) => {
		await makeEraGame(root)
		const result = checkEraWriteTarget({
			absolutePath: path.join(root, "ERB", "口上", "口上_メイ.ERB.BAK"),
			cwd: root,
		})
		assert.equal(result.allowed, false)
		assert.equal(result.rule, "script-backup-copy")
	})
})

// ── 容量指令丢失检查（写盘硬拦依赖的契约）────────────────────

const SIZE_FIXTURE = [
	"@FOO",
	"#LOCALSIZE 500",
	"#LOCALSSIZE 100",
	"#DIM LOCAL:10",
	"LOCAL:0 = 1",
	"RETURN",
	"",
	"@BAR",
	"#LOCALSIZE 500",
	"LOCAL:0 = 2",
	"RETURN",
	"",
].join("\n")

test("把跨函数重复的 #LOCALSIZE 去重删掉：判定为丢失", async () => {
	const deduped = [
		"@FOO",
		"#LOCALSIZE 500",
		"#LOCALSSIZE 100",
		"#DIM LOCAL:10",
		"LOCAL:0 = 1",
		"RETURN",
		"",
		"@BAR",
		"LOCAL:0 = 2",
		"RETURN",
		"",
	].join("\n")
	const lost = findLostLocalSizeDirectives(SIZE_FIXTURE, deduped)
	assert.equal(lost.length, 1)
	assert.equal(lost[0]?.label, "BAR")
	assert.equal(lost[0]?.directive, "#LOCALSIZE")

	const message = formatLostDirectivesError("ERB/口上/X.ERB", lost)
	assert.match(message, /@BAR #LOCALSIZE 500/)
	assert.match(message, /不是变量定义/)
	assert.match(message, /VariableSize\.csv/)
})

test("同函数内把 #LOCALSIZE 挪到 #DIM 后面：不算丢失（这是正确修法，不能误拒）", async () => {
	const reordered = [
		"@FOO",
		"#LOCALSSIZE 100",
		"#DIM LOCAL:10",
		"#LOCALSIZE 500",
		"LOCAL:0 = 1",
		"RETURN",
		"",
		"@BAR",
		"#LOCALSIZE 500",
		"LOCAL:0 = 2",
		"RETURN",
		"",
	].join("\n")
	assert.equal(findLostLocalSizeDirectives(SIZE_FIXTURE, reordered).length, 0)
})

test("改数值不算丢失（缩容量应该改值，不是删行）", async () => {
	const resized = SIZE_FIXTURE.replaceAll("#LOCALSIZE 500", "#LOCALSIZE 200")
	assert.equal(findLostLocalSizeDirectives(SIZE_FIXTURE, resized).length, 0)
})

test("整段函数被删：不算容量丢失（交给 missing-label 报，避免双报）", async () => {
	const withoutBar = ["@FOO", "#LOCALSIZE 500", "#LOCALSSIZE 100", "#DIM LOCAL:10", "LOCAL:0 = 1", "RETURN", ""].join("\n")
	assert.equal(findLostLocalSizeDirectives(SIZE_FIXTURE, withoutBar).length, 0)
})

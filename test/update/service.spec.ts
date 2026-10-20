/**
 * 端到端集成测试：用"本地文件夹当上游"，跑完整 7 步（不联网、不下载）。
 *
 * 这条路径同时覆盖了首次同步（无基线）→ mtime 批量判定 → 计划 → 备份 → 写入
 * → 自检 → 落状态 → 二次运行幂等 的全过程。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { readState } from "../../src/core/update/manifest"
import { runUpdate } from "../../src/core/update/service"

const BULK = new Date("2026-07-27T13:56:00Z")
const FILE_COUNT = 60

/** 真实 ERB 形状：函数体由 @标签 起头，`#FUNCTION` 只是返回类型声明，没有 `#END` */
function erbBody(index: number, extra = ""): string {
	return `@F${index}\n#FUNCTION\n${extra}RETURNF 0\n`
}

async function writeFile(root: string, rel: string, content: string): Promise<void> {
	const abs = path.join(root, ...rel.split("/"))
	await fs.mkdir(path.dirname(abs), { recursive: true })
	await fs.writeFile(abs, content, "utf8")
}

/** 造一个"刚从 zip 解压出来"的游戏：60 个文件卡在同一分钟 */
async function makeInstalledGame(root: string): Promise<void> {
	for (let i = 0; i < FILE_COUNT; i++) {
		const rel = `ERB/f${i}.ERB`
		await writeFile(root, rel, erbBody(i))
		const abs = path.join(root, ...rel.split("/"))
		await fs.utimes(abs, BULK, BULK)
	}
	await writeFile(root, "sav/global.sav", "SAVE-DATA")
	await writeFile(root, "emuera.config", "USELAZYLOADING:YES\n")
}

async function withTempBase(run: (base: string) => Promise<void>): Promise<void> {
	const base = await fs.mkdtemp(path.join(os.tmpdir(), "era-service-"))
	try {
		await run(base)
	} finally {
		await fs.rm(base, { recursive: true, force: true })
	}
}

test("端到端：首次同步 → 写入 → 自检 → 落状态 → 二次运行幂等", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeInstalledGame(root)

		// 上游：f0 改了、新增 NEW.ERB、删掉 f59
		for (let i = 0; i < FILE_COUNT - 1; i++) {
			const extra = i === 0 ? "# 社区改过了\n" : ""
			await writeFile(upstream, `ERB/f${i}.ERB`, erbBody(i, extra))
		}
		await writeFile(upstream, "ERB/NEW.ERB", erbBody(999))

		const first = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
		})

		assert.equal(first.status, "applied", first.error)
		assert.equal(first.plan.mode, "first-sync")
		assert.equal(first.plan.summary.write, 2, "改 1 + 新增 1")
		assert.equal(first.plan.summary.delete, 1, "上游已删的 f59")
		assert.equal(first.verify?.ok, true, "自检必须通过")
		assert.equal(first.verify?.checked, 2)

		assert.match(await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8"), /社区改过了/)
		assert.equal(await fs.readFile(path.join(root, "ERB", "NEW.ERB"), "utf8"), erbBody(999))
		await assert.rejects(fs.stat(path.join(root, "ERB", "f59.ERB")))
		assert.equal(await fs.readFile(path.join(root, "sav", "global.sav"), "utf8"), "SAVE-DATA", "存档绝不能动")

		// 备份里必须是改动前的内容
		assert.ok(first.report?.backupDir)
		assert.equal(await fs.readFile(path.join(first.report.backupDir, "files", "ERB", "f0.ERB"), "utf8"), erbBody(0))
		assert.equal(await fs.readFile(path.join(first.report.backupDir, "files", "ERB", "f59.ERB"), "utf8"), erbBody(59))

		// 状态落盘：下次就有基线了
		const state = await readState(root)
		assert.ok(state)
		assert.equal(Object.keys(state.files).length, FILE_COUNT, "上游清单全量入基线")
		assert.ok(state.lastBackup)

		// 二次运行：应当判定"已是最新"，一个文件都不动
		const second = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
		})
		assert.equal(second.status, "up-to-date")
		assert.equal(second.plan.mode, "incremental", "有基线后应走稳态三方比对")
		assert.equal(second.plan.summary.write + second.plan.summary.delete, 0)
	})
})

test("用户取消：一个字节都不写", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeInstalledGame(root)
		await writeFile(upstream, "ERB/f0.ERB", erbBody(0, "# 改了\n"))

		const before = await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8")
		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => false,
		})

		assert.equal(result.status, "cancelled")
		assert.equal(await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8"), before)
		await assert.rejects(fs.stat(path.join(root, "_备份")))
	})
})

test("没有确认回调时按安全闸门拒绝执行", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeInstalledGame(root)
		await writeFile(upstream, "ERB/f0.ERB", erbBody(0, "# 改了\n"))

		const result = await runUpdate({ root, source: { kind: "dir", path: upstream } })
		assert.equal(result.status, "cancelled")
		assert.match(result.error ?? "", /缺少用户确认/)
	})
})

test("dryRun：算出计划但不执行", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeInstalledGame(root)
		await writeFile(upstream, "ERB/f0.ERB", erbBody(0, "# 改了\n"))

		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			dryRun: true,
			confirm: () => true,
		})
		assert.equal(result.status, "planned", "dryRun 有活要干时必须是 planned，不能是 up-to-date")
		assert.equal(result.plan.summary.write, 1)
		await assert.rejects(fs.stat(path.join(root, "_备份")))
		assert.equal(await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8"), erbBody(0))
	})
})

test("AI 合并：合并结果写盘、自检通过、标记为玩家定制", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeInstalledGame(root)

		// 本地改过 f0，且 mtime 不在解压批次里 → 首次同步判定为"人手改过" → 冲突
		await writeFile(root, "ERB/f0.ERB", erbBody(0, "# 本地加的口上\n"))
		const localAbs = path.join(root, "ERB", "f0.ERB")
		const human = new Date("2026-10-01T10:00:00Z")
		await fs.utimes(localAbs, human, human)
		// 上游也改了 f0（内容不同），另外干净地改了 f1
		for (let i = 0; i < FILE_COUNT; i++) {
			const extra = i === 0 || i === 1 ? "# 社区改的\n" : ""
			await writeFile(upstream, `ERB/f${i}.ERB`, erbBody(i, extra))
		}

		const merged = "@F0\n#FUNCTION\n# 本地加的口上\n# 社区改的\nRETURNF 0"
		let asked = 0
		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
			merge: {
				shouldMerge: () => true,
				ask: async () => {
					asked++
					return merged
				},
			},
		})

		assert.equal(result.status, "applied", result.error)
		assert.equal(result.resolve?.files.length, 1, "只有 f0 需要处理")
		assert.equal(result.resolve?.files[0].decision, "merged")
		assert.equal(result.plan.summary.write, 2, "合并后的 f0 + 干净更新的 f1")
		assert.equal(result.plan.summary.delete, 0, "不该删掉任何本地文件")
		assert.equal(asked, 1, "只对冲突文件问一次模型")
		assert.equal(await fs.readFile(localAbs, "utf8"), merged, "合并结果必须落盘")
		assert.match(await fs.readFile(path.join(root, "ERB", "f1.ERB"), "utf8"), /社区改的/)
		assert.equal(result.verify?.ok, true, "合并文件的自检要按合并结果比对")

		const state = await readState(root)
		assert.ok(state?.localOverrides.includes("ERB/f0.ERB"), "合并过的文件要标记为玩家定制")
		// 基线仍然记上游的 hash —— 下次上游再改它才会再次触发合并
		assert.notEqual(state?.files["ERB/f0.ERB"].sha1, undefined)
	})
})

test("AI 合并：用户不同意时冲突文件原样保留，磁盘不动", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeInstalledGame(root)

		await writeFile(root, "ERB/f0.ERB", erbBody(0, "# 本地加的口上\n"))
		const localAbs = path.join(root, "ERB", "f0.ERB")
		const human = new Date("2026-10-01T10:00:00Z")
		await fs.utimes(localAbs, human, human)
		for (let i = 0; i < FILE_COUNT; i++) {
			await writeFile(upstream, `ERB/f${i}.ERB`, erbBody(i, i === 0 ? "# 社区改的\n" : ""))
		}

		let asked = 0
		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
			merge: {
				shouldMerge: () => false,
				ask: async () => {
					asked++
					return ""
				},
			},
		})

		assert.equal(asked, 0, "不同意就不该调用模型")
		assert.equal(result.status, "nothing-to-do", `只有冲突且都保留时，没有要写的文件：${JSON.stringify(result.plan.summary)}`)
		assert.equal(await fs.readFile(localAbs, "utf8"), erbBody(0, "# 本地加的口上\n"))
		await assert.rejects(fs.stat(path.join(root, "_备份")), "什么都没写就不该留备份目录")
	})
})

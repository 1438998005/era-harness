/**
 * 端到端：比对不可信时的一次性策略（service.ts#onBaselineUntrusted）。
 *
 * 用「本地文件夹当上游」跑完整流程，不联网。样本量必须 ≥1000 才会触发
 * 可信度判定，所以这里造 1000 个脚本文件（每个只有一行，落盘很快）。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { gitBlobSha1, readState } from "../../src/core/update/manifest"
import { runUpdate } from "../../src/core/update/service"

/** 样本量要 ≥1000 才触发可信度判定；多造 100 个给「上游改过」的那批留余量 */
const COUNT = 1100
const LF = "@F\n#FUNCTION\nRETURNF 0\n"
const LF_CHANGED = "@F\n#FUNCTION\nRETURNF 1\n"
/** 「本地这份内容和记录、上游都不是一回事」——用来造真正不可信的基线 */
const LF_DIVERGED = "@F\n#FUNCTION\nRETURNF 9\n"

async function writeFile(root: string, rel: string, content: string): Promise<void> {
	const abs = path.join(root, ...rel.split("/"))
	await fs.mkdir(path.dirname(abs), { recursive: true })
	await fs.writeFile(abs, content, "utf8")
}

/**
 * 造一个「本地 = 上游内容的 CRLF 变体」的游戏目录 + 一份 v1 基线（只记 LF 的 raw sha1）。
 *
 * 这正是 2026-10-29 事故的形态：内容一样、字节不一样、基线没有规范形指纹。
 * `diverged` 为 true 时本地换成**另一份内容**（不是换行差异），用来造真正不可信的基线
 * ——两条路必须分开测，否则「修好了误报」和「该报的还是要报」会互相掩盖。
 */
async function makeGame(root: string, opts: { diverged?: boolean } = {}): Promise<void> {
	const files: Record<string, { sha1: string; size: number; mtimeMs: number }> = {}
	const crlf = LF.replace(/\n/g, "\r\n")
	const localContent = opts.diverged ? LF_DIVERGED : crlf
	for (let i = 0; i < COUNT; i++) {
		const rel = `ERB/f${i}.ERB`
		await writeFile(root, rel, localContent)
		files[rel] = { sha1: gitBlobSha1(Buffer.from(LF, "utf8")), size: LF.length, mtimeMs: 0 }
	}
	const state = {
		schemaVersion: 1,
		source: { projectUrl: "", branch: "develop" },
		applied: { commit: "deadbeef", nowVersion: "20261015", appliedAt: "" },
		files,
		localOverrides: [],
	}
	await writeFile(root, ".era-harness/update-state.json", JSON.stringify(state))
}

/** 上游：前 10 个文件改了内容，其余原样（LF） */
async function makeUpstream(root: string): Promise<void> {
	for (let i = 0; i < COUNT; i++) {
		await writeFile(root, `ERB/f${i}.ERB`, i < 10 ? LF_CHANGED : LF)
	}
}

async function withTempBase(run: (base: string) => Promise<void>): Promise<void> {
	const base = await fs.mkdtemp(path.join(os.tmpdir(), "era-trust-"))
	try {
		await run(base)
	} finally {
		await fs.rm(base, { recursive: true, force: true })
	}
}

test("老记录 + 只差换行：判定为可信，10261 类误报消失（2026-10-29 事故出口）", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeGame(root)
		await makeUpstream(upstream)

		let asked = false
		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
			onBaselineUntrusted: () => {
				asked = true
				return "cancel"
			},
		})

		// 关键：这份基线是**可信**的——本地只是 CRLF 变体，不是玩家改过
		assert.equal(result.plan.baseline?.level, "ok")
		assert.equal(asked, false, "可信时不该弹「比对可能不准」")
		// 1090 个「上游没动」的文件必须判成无事可做，而不是「你自己改过的」
		assert.equal(result.plan.summary.unchanged, COUNT - 10)
		assert.equal(result.plan.summary.keepByReason["local-change"] ?? 0, 0)
		assert.equal(result.plan.summary.conflict, 0)
		// 上游改过的 10 个正常替换（老记录的纯字节 blob 能对上规范形，所以是干净替换）
		assert.equal(result.plan.summary.write, 10)
		assert.equal(result.status, "applied", result.error)
		assert.match(await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8"), /RETURNF 1/)
	})
})

test("不可信：选「只更新能确定的」→ 冲突全保留、磁盘一个字节都不动", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeGame(root, { diverged: true })
		await makeUpstream(upstream)

		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
			onBaselineUntrusted: () => "keep-all",
		})

		assert.equal(result.plan.baseline?.level, "suspect")
		assert.equal(result.plan.summary.conflict, 0)
		assert.equal(result.status, "nothing-to-do")
		// 上游改过的 10 个文件必须原样留着（一个字节都不该被改写）
		assert.equal(await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8"), LF_DIVERGED)
	})
})

test("不可信：选「全部换成社区版」→ 冲突批量替换并落 v2 状态", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeGame(root, { diverged: true })
		await makeUpstream(upstream)

		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
			onBaselineUntrusted: () => "take-theirs",
		})

		assert.equal(result.status, "applied", result.error)
		assert.equal(result.plan.summary.conflict, 0)
		assert.equal(result.plan.summary.write, 10)
		assert.equal(result.verify?.ok, true)
		assert.match(await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8"), /RETURNF 1/)
		const state = await readState(root)
		assert.equal(state?.schemaVersion, 2)
		assert.equal(state?.canonVersion, 1)
		assert.equal(typeof state?.files["ERB/f0.ERB"]?.canonBlobSha1, "string")
	})
})

test("不可信：取消 → status=cancelled、零写盘", async () => {
	await withTempBase(async (base) => {
		const root = path.join(base, "game")
		const upstream = path.join(base, "upstream")
		await makeGame(root, { diverged: true })
		await makeUpstream(upstream)

		const result = await runUpdate({
			root,
			source: { kind: "dir", path: upstream },
			confirm: () => true,
			onBaselineUntrusted: () => "cancel",
		})

		assert.equal(result.status, "cancelled")
		assert.equal(await fs.readFile(path.join(root, "ERB", "f0.ERB"), "utf8"), LF_DIVERGED)
	})
})

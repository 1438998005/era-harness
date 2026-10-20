/**
 * AI 合并工作台（`resolveConflictsViaWorkbench` + `mergeWorkbench.ts`）的回归测试。
 *
 * 这个模块的目的：把「静默调一次模型」换成「一个用户可见的对话」。
 * 所以测试重点不是合并算法（那已在 `merge.spec.ts` / `mergeResolve.spec.ts` 覆盖），
 * 而是**换了执行方式之后安全性质有没有变**：
 *
 * 1. **零悬空**：AI 不交 / 交坏 / 对话没跑成 → 该文件一律保留本地，绝不写半成品；
 * 2. **仍然窗口化**：只有一侧改过的文件根本不进工作台，零模型调用；
 * 3. **对话本身的问题要留痕**：跑失败、动了工作台之外的文件，全部进 `notes`；
 * 4. **落盘位置固定**在 `.era-harness/merge-work/<stamp>/`，更新流程扫不到也写不到。
 *
 * 这里的「AI」是假的：`runTask` 真的去读 items/ 里的工单、真的往 out/ 写结果，
 * 走的全是真实文件 IO——只有「谁来做合并」是假的。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { resolveConflictsViaWorkbench } from "../../src/core/update/mergeResolve"
import type { WorkbenchLayout, WorkbenchRunOutcome } from "../../src/core/update/mergeWorkbench"
import { workbenchLayout } from "../../src/core/update/mergeWorkbench"
import type { PlanEntry, RelPath, UpdatePlan } from "../../src/core/update/types"

interface Fake {
	path: RelPath
	local: string
	theirs: string
	base?: string | null
}

function makePlan(fakes: Fake[]): UpdatePlan {
	const entries: PlanEntry[] = fakes.map((f) => ({
		path: f.path,
		action: "conflict" as const,
		reason: "both-changed" as const,
		localSha1: `local-${f.path}`,
		theirsSha1: `theirs-${f.path}`,
		baseSha1: f.base === null ? undefined : `base-${f.path}`,
	}))
	return {
		mode: "incremental",
		entries,
		groups: [{ kind: "file", key: "g", label: "g", paths: fakes.map((f) => f.path) }],
		summary: {
			write: 0,
			delete: 0,
			keep: 0,
			conflict: fakes.length,
			unchanged: 0,
			keepByReason: {},
		},
		warnings: [],
	}
}

function readers(fakes: Fake[]) {
	const local = new Map<RelPath, Buffer>()
	const theirs = new Map<RelPath, Buffer>()
	const base = new Map<RelPath, Buffer>()
	for (const f of fakes) {
		local.set(f.path, Buffer.from(f.local, "utf8"))
		theirs.set(f.path, Buffer.from(f.theirs, "utf8"))
		if (typeof f.base === "string") {
			base.set(f.path, Buffer.from(f.base, "utf8"))
		}
	}
	return {
		readLocal: (rel: RelPath) => Promise.resolve(local.get(rel) ?? null),
		readTheirs: (rel: RelPath) => Promise.resolve(theirs.get(rel) ?? null),
		readBase: (rel: RelPath) => Promise.resolve(base.get(rel) ?? null),
		baseAvailable: true,
	}
}

/** 取围栏里的内容 */
function between(raw: string, label: string): string {
	const open = `<<<${label}>>>`
	const first = raw.indexOf(open)
	if (first === -1) {
		return ""
	}
	const start = first + open.length
	const end = raw.indexOf(open, start)
	return end === -1 ? "" : raw.slice(start, end).replace(/^\n/, "").replace(/\n$/, "")
}

/** 假 AI：把工单里 LOCAL 与 THEIRS 的非空行并排写出（保留双方改动） */
function mergeLines(local: string, theirs: string): string {
	const out: string[] = []
	const seen = new Set<string>()
	for (const line of [...local.split("\n"), ...theirs.split("\n")]) {
		if (line.trim() === "" || seen.has(line)) {
			continue
		}
		seen.add(line)
		out.push(line)
	}
	return out.join("\n")
}

/** 假 AI：读全部工单并交出合并结果 */
function answerAll(rewrite?: (id: string, text: string) => string) {
	return async (prompt: string, layout: WorkbenchLayout): Promise<WorkbenchRunOutcome> => {
		void prompt
		const files = await fs.readdir(layout.itemsDir).catch(() => [] as string[])
		for (const name of files.filter((n) => n.endsWith(".md"))) {
			const id = name.slice(0, -3)
			const raw = await fs.readFile(path.join(layout.itemsDir, name), "utf8")
			let text = mergeLines(between(raw, "LOCAL"), between(raw, "THEIRS"))
			if (rewrite) {
				text = rewrite(id, text)
			}
			await fs.writeFile(path.join(layout.outDir, `${id}.md`), text, "utf8")
		}
		return { status: "completed", unexpected: [] }
	}
}

/** 两边都改了同一处的最小例子：第二行 */
function conflicting(path: RelPath): Fake {
	return {
		path,
		base: ["@FOO", "第一行", "第二行", "第三行", "RETURNF"].join("\n"),
		local: ["@FOO", "第一行", "第二行-玩家", "第三行", "RETURNF"].join("\n"),
		theirs: ["@FOO", "第一行", "第二行-社区", "第三行", "RETURNF"].join("\n"),
	}
}

/** 只有上游改了：机械合并，不该进工作台 */
function theirsOnly(path: RelPath): Fake {
	return {
		path,
		base: ["@BAR", "甲", "乙"].join("\n"),
		local: ["@BAR", "甲", "乙"].join("\n"),
		theirs: ["@BAR", "甲", "乙-社区"].join("\n"),
	}
}

async function withTempRoot(fn: (root: string) => Promise<void>): Promise<void> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "era-workbench-"))
	try {
		await fn(root)
	} finally {
		await fs.rm(root, { recursive: true, force: true })
	}
}

const AGREE_ALL = async () => true

test("工作台落在 .era-harness/merge-work/<stamp>/，且 items/out/TASK.md 齐备", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB")]
		await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "20261018_2330",
			shouldMerge: AGREE_ALL,
			runTask: answerAll(),
		})

		const layout = workbenchLayout(root, "20261018_2330")
		assert.equal(layout.root, path.join(root, ".era-harness", "merge-work", "20261018_2330"))
		const names = await fs.readdir(layout.itemsDir)
		assert.deepEqual(names, ["0001.md"])
		const item = await fs.readFile(path.join(layout.itemsDir, "0001.md"), "utf8")
		assert.match(item, /<<<BASE>>>/)
		assert.match(item, /<<<LOCAL>>>/)
		assert.match(item, /<<<THEIRS>>>/)
		assert.match(item, /ERB\/A\.ERB/)
		await fs.stat(path.join(layout.root, "TASK.md"))
		await fs.stat(layout.outDir)
	})
})

test("AI 全交 → 合并成功，overrides 里有字节、writes 里有指纹", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB")]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s1",
			shouldMerge: AGREE_ALL,
			runTask: answerAll(),
		})

		assert.equal(result.files.length, 1)
		assert.equal(result.files[0].decision, "merged")
		assert.ok(result.overrides.has("ERB/A.ERB"))
		assert.ok(result.writes.has("ERB/A.ERB"))
		const text = result.overrides.get("ERB/A.ERB")?.toString("utf8") ?? ""
		// 双方改的都要在（窗口化合并的意义就在这里）
		assert.match(text, /第二行-玩家/)
		assert.match(text, /第二行-社区/)
		// 没被改动的部分原样保留
		assert.match(text, /@FOO/)
		assert.match(text, /RETURNF/)
	})
})

test("AI 一个都不交 → 全部保留本地，overrides 为空（零悬空）", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB"), conflicting("ERB/B.ERB")]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s2",
			shouldMerge: AGREE_ALL,
			runTask: async () => ({ status: "completed", unexpected: [] }),
		})

		assert.equal(result.overrides.size, 0)
		assert.deepEqual(
			result.files.map((f) => f.decision),
			["keep-local", "keep-local"],
		)
		// 账要算给用户看：几个窗口、几个没过
		assert.ok(result.notes?.some((n) => n.includes("共 2 个冲突窗口")))
		assert.ok(result.notes?.some((n) => n.includes("2 个没通过")))
	})
})

test("只交一部分 → 交了的合并、没交的保留本地", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB"), conflicting("ERB/B.ERB")]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s3",
			shouldMerge: AGREE_ALL,
			// 只答第一个工单
			runTask: async (_prompt, layout) => {
				const raw = await fs.readFile(path.join(layout.itemsDir, "0001.md"), "utf8")
				await fs.writeFile(
					path.join(layout.outDir, "0001.md"),
					mergeLines(between(raw, "LOCAL"), between(raw, "THEIRS")),
					"utf8",
				)
				return { status: "completed", unexpected: [] }
			},
		})

		assert.equal(result.overrides.size, 1)
		assert.equal(result.files[0].decision, "merged")
		assert.equal(result.files[1].decision, "keep-local")
	})
})

test("只有一侧改过的文件不进工作台，机械合并且零模型调用", async () => {
	await withTempRoot(async (root) => {
		const fakes = [theirsOnly("ERB/C.ERB")]
		let called = 0
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s4",
			shouldMerge: AGREE_ALL,
			runTask: async () => {
				called++
				return { status: "completed", unexpected: [] }
			},
		})

		assert.equal(called, 0, "没有冲突窗口就不该开对话")
		assert.equal(result.files[0].decision, "merged")
		const text = result.overrides.get("ERB/C.ERB")?.toString("utf8") ?? ""
		assert.match(text, /乙-社区/)
		// 没开工，工作台目录压根不该出现
		await assert.rejects(() => fs.stat(path.join(root, ".era-harness", "merge-work", "s4")))
	})
})

test("两边改成一样的（trivialMerge）不进工作台", async () => {
	await withTempRoot(async (root) => {
		const fakes: Fake[] = [
			{
				path: "ERB/D.ERB",
				base: "@X\n1\n",
				local: "@X\n1\n一样\n",
				theirs: "@X\n1\n一样\n",
			},
		]
		let called = 0
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s5",
			shouldMerge: AGREE_ALL,
			runTask: async () => {
				called++
				return { status: "completed", unexpected: [] }
			},
		})
		assert.equal(called, 0)
		assert.equal(result.files[0].decision, "merged")
	})
})

test("对话跑失败 → 进 notes，冲突全部保留本地", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB")]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s6",
			shouldMerge: AGREE_ALL,
			runTask: async () => ({ status: "failed", detail: "你取消了这次合并对话" }),
		})
		assert.equal(result.overrides.size, 0)
		assert.equal(result.files[0].decision, "keep-local")
		assert.ok(result.notes?.some((n) => n.includes("你取消了这次合并对话")))
	})
})

test("有对话在跑（busy）→ 进 notes，不写任何东西", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB")]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s7",
			shouldMerge: AGREE_ALL,
			runTask: async () => ({ status: "busy", detail: "现在有一个对话正在跑" }),
		})
		assert.equal(result.overrides.size, 0)
		assert.ok(result.notes?.some((n) => n.includes("现在有一个对话正在跑")))
	})
})

test("AI 动了工作台之外的文件 → 记进 notes，但不影响合并结果", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB")]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s8",
			shouldMerge: AGREE_ALL,
			runTask: async (prompt, layout) => {
				const out = await answerAll()(prompt, layout)
				return { ...out, status: "completed", unexpected: [{ path: "ERB/A.ERB", kind: "modified" }] }
			},
		})
		assert.equal(result.files[0].decision, "merged")
		assert.ok(result.notes?.some((n) => n.includes("工作台之外的文件")))
	})
})

test("第一轮交坏、第二轮返工成功 → 最终合并成功并留下 FIX.md", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB")]
		let round = 0
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s9",
			shouldMerge: AGREE_ALL,
			maxAttempts: 2,
			runTask: async (prompt, layout) => {
				round++
				if (round === 1) {
					// 故意交个空的 → 校验不过
					await fs.writeFile(path.join(layout.outDir, "0001.md"), "   \n", "utf8")
					return { status: "completed", unexpected: [] }
				}
				assert.match(prompt, /返工/)
				await fs.stat(layout.fixFile)
				return answerAll()(prompt, layout)
			},
		})

		assert.equal(round, 2)
		assert.equal(result.files[0].decision, "merged")
		assert.ok(result.notes?.some((n) => n.includes("没通过校验")))
		await fs.stat(path.join(root, ".era-harness", "merge-work", "s9", "FIX.md"))
	})
})

test("窗口数超过上限 → 全部保留本地并在 notes 说明", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB"), conflicting("ERB/B.ERB")]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s10",
			shouldMerge: AGREE_ALL,
			maxItems: 1,
			runTask: async () => {
				throw new Error("窗口超限时根本不该开对话")
			},
		})
		assert.equal(result.overrides.size, 0)
		assert.ok(result.notes?.some((n) => n.includes("一次对话处理不了")))
	})
})

test("用户没同意合并 → 不开对话、全部保留本地", async () => {
	await withTempRoot(async (root) => {
		const fakes = [conflicting("ERB/A.ERB")]
		let called = 0
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s11",
			shouldMerge: async () => false,
			runTask: async () => {
				called++
				return { status: "completed", unexpected: [] }
			},
		})
		assert.equal(called, 0)
		assert.equal(result.overrides.size, 0)
		assert.equal(result.files[0].decision, "keep-local")
	})
})

test("BOM 与行尾按本地版本原样保留", async () => {
	await withTempRoot(async (root) => {
		const fakes: Fake[] = [
			{
				path: "ERB/E.ERB",
				base: "@X\r\n1\r\n2\r\n",
				local: "@X\r\n1\r\n2-玩家\r\n",
				theirs: "@X\r\n1\r\n2-社区\r\n",
			},
		]
		// 手工给 local 加 BOM
		const r = readers(fakes)
		r.readLocal = (rel) =>
			Promise.resolve(
				rel === "ERB/E.ERB"
					? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(fakes[0].local, "utf8")])
					: null,
			)
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...r,
			root,
			stamp: "s12",
			shouldMerge: AGREE_ALL,
			runTask: answerAll(),
		})

		assert.equal(result.files[0].decision, "merged")
		const bytes = result.overrides.get("ERB/E.ERB")
		assert.ok(bytes)
		assert.equal(bytes?.[0], 0xef)
		assert.equal(bytes?.[1], 0xbb)
		assert.equal(bytes?.[2], 0xbf)
		// CRLF 保留
		assert.ok(bytes?.includes(Buffer.from("\r\n")))
	})
})

test("同一个文件有多个冲突窗口：少一个就整份保留本地", async () => {
	await withTempRoot(async (root) => {
		// 两处**都**是两边同时改 → 两个冲突窗口，落成 0001 / 0002 两个工单
		const fakes: Fake[] = [
			{
				path: "ERB/F.ERB",
				base: ["@F", "一1", "一2", "中1", "二1", "二2", "三1"].join("\n"),
				local: ["@F", "一1", "一2-玩家", "中1", "二1", "二2-玩家", "三1"].join("\n"),
				theirs: ["@F", "一1", "一2-社区", "中1", "二1", "二2-社区", "三1"].join("\n"),
			},
		]
		const result = await resolveConflictsViaWorkbench({
			plan: makePlan(fakes),
			...readers(fakes),
			root,
			stamp: "s13",
			shouldMerge: AGREE_ALL,
			// 只交第一个工单 → 这份文件有两个冲突窗口，缺一个就整体放弃
			runTask: async (_prompt, layout) => {
				const files = (await fs.readdir(layout.itemsDir)).sort()
				assert.equal(files.length, 2, "应该有两个冲突窗口工单")
				const raw = await fs.readFile(path.join(layout.itemsDir, files[0]), "utf8")
				await fs.writeFile(
					path.join(layout.outDir, files[0].replace(/\.md$/, "")),
					mergeLines(between(raw, "LOCAL"), between(raw, "THEIRS")),
					"utf8",
				)
				return { status: "completed", unexpected: [] }
			},
		})

		assert.equal(result.overrides.size, 0, "有一个窗口没成就不能写半成品")
		assert.equal(result.files[0].decision, "keep-local")
		assert.match(result.files[0].issues[0]?.detail ?? "", /没能自动合并/)
	})
})

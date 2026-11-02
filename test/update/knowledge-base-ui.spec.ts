/**
 * 08 #107 / #108 / #173 / #175：知识库相关的四处修复。
 *
 * 这四个问题性质完全不同，放同一个文件是因为它们都围绕「知识库」这一块，
 * 改动时一起回归比较省事；每节顶部单独说明它在守什么。
 *
 * #107 的失败方向是本文件里唯一有「安全后果」的：未知 mode 以前一律升级成
 * `full`（全量建库 = 大量模型调用 = 真金白银），失败安全方向反了。
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { createKnowledgeBaseListCache } from "../../src/core/knowledge/knowledgeBaseHint"
import {
	isKnowledgeBaseUpdateTurnEnd,
	type KnowledgeBaseListItem,
	normalizeKnowledgeBaseBuildMode,
	pickKnowledgeBaseUpdateTargets,
} from "../../src/shared/knowledgeBase"

// run.mjs 会把 cwd 设为仓库根（打包成 CJS 后 import.meta.url 不可用）
const repoRoot = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), "utf8")

// ---------------------------------------------------------------------------
// #107 未知建库方式必须降级到 blank
// ---------------------------------------------------------------------------

test("#107 已知 mode 原样保留，不标记降级", () => {
	assert.deepEqual(normalizeKnowledgeBaseBuildMode("full"), { mode: "full", fellBack: false })
	assert.deepEqual(normalizeKnowledgeBaseBuildMode("blank"), { mode: "blank", fellBack: false })
})

test("#107 未知 mode 一律降级为 blank 并标记 fellBack", () => {
	// 旧实现是 `action.mode === "blank" ? "blank" : "full"`，任何脏值都会开全量建库。
	for (const raw of [undefined, null, "", "FULL", "Full", "blank ", "increment", 0, 1, true, {}, []]) {
		const result = normalizeKnowledgeBaseBuildMode(raw)
		assert.equal(result.mode, "blank", `未知 mode ${JSON.stringify(raw)} 应降级为 blank`)
		assert.equal(result.fellBack, true, `未知 mode ${JSON.stringify(raw)} 应标记 fellBack`)
	}
})

test("#107 控制器不再出现「非 blank 即 full」的写法，且降级要留日志", () => {
	const src = read("src/core/controller/ui/knowledgeBaseAction.ts")
	assert.ok(
		!/action\.mode\s*===\s*"blank"\s*\?\s*"blank"\s*:\s*"full"/.test(src),
		"knowledgeBaseAction.ts 不应保留 `非 blank 即 full` 的判定",
	)
	assert.ok(src.includes("normalizeKnowledgeBaseBuildMode("), "应走 normalizeKnowledgeBaseBuildMode")
	assert.ok(/fellBack[\s\S]{0,200}Logger\.warn/.test(src), "降级路径应留下 warn 日志，便于排查脏请求")
})

// ---------------------------------------------------------------------------
// #108 每次 attempt_completion 都全量扫库 → 加 TTL 缓存
// ---------------------------------------------------------------------------

/** `KnowledgeBaseEntries` 没导出，从工厂返回值反推，避免测试里重复定义一份结构 */
type Entries = Awaited<ReturnType<ReturnType<typeof createKnowledgeBaseListCache>>>

function fakeEntries(slug: string): Entries {
	return [{ slug, name: slug, dir: `/tmp/${slug}`, enabled: true, broken: false }] as unknown as Entries
}

test("#108 TTL 内同一工作区只扫一次盘", async () => {
	let calls = 0
	let clock = 1000
	const cached = createKnowledgeBaseListCache({
		list: async (root) => {
			calls++
			return fakeEntries(root)
		},
		ttlMs: 60_000,
		now: () => clock,
	})

	const first = await cached("/ws")
	assert.equal(calls, 1)

	clock += 59_999
	const second = await cached("/ws")
	assert.equal(calls, 1, "TTL 内不应重复扫盘")
	assert.equal(second, first, "应返回同一份结果（同一个对象引用）")
})

test("#108 过期后重新扫盘；不同工作区各自独立", async () => {
	let calls = 0
	let clock = 0
	const cached = createKnowledgeBaseListCache({
		list: async (root) => {
			calls++
			return fakeEntries(root)
		},
		ttlMs: 1000,
		now: () => clock,
	})

	await cached("/ws-a")
	assert.equal(calls, 1)
	await cached("/ws-b")
	assert.equal(calls, 2, "不同工作区不能共用缓存")

	clock += 1000
	await cached("/ws-a")
	assert.equal(calls, 3, "到期后应重新扫盘")
})

test("#108 扫盘抛错不写缓存，下次仍会重试", async () => {
	let calls = 0
	const cached = createKnowledgeBaseListCache({
		list: async (root) => {
			calls++
			if (calls === 1) {
				throw new Error("disk on fire")
			}
			return fakeEntries(root)
		},
		ttlMs: 60_000,
		now: () => 0,
	})

	await assert.rejects(() => cached("/ws"), /disk on fire/)
	await cached("/ws")
	assert.equal(calls, 2, "失败的那次不应被缓存成结果")
})

test("#108 提示路径确实走缓存版本（否则工厂白写）", () => {
	const src = read("src/core/knowledge/knowledgeBaseHint.ts")
	assert.ok(src.includes("listKnowledgeBasesCached(workspaceRoot)"), "提示逻辑应调用缓存版本")
})

// ---------------------------------------------------------------------------
// #175 对话内「更新知识库」按钮
// ---------------------------------------------------------------------------

function item(overrides: Partial<KnowledgeBaseListItem> = {}): KnowledgeBaseListItem {
	return {
		slug: "s",
		name: "S",
		dir: "/tmp/s",
		enabled: true,
		broken: false,
		fileCount: 3,
		hasIndex: true,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stale: false,
		buildStatus: "ready",
		...overrides,
	} as KnowledgeBaseListItem
}

test("#175 只有「启用 + 未损坏 + 有索引 + ready」的库才是更新目标", () => {
	const usable = item({ slug: "ok" })
	const targets = pickKnowledgeBaseUpdateTargets([
		usable,
		item({ slug: "disabled", enabled: false }),
		item({ slug: "broken", broken: true }),
		item({ slug: "no-index", hasIndex: false }),
		item({ slug: "draft", buildStatus: "draft" }),
		item({ slug: "building", buildStatus: "building" }),
		item({ slug: "failed", buildStatus: "failed" }),
	])
	assert.deepEqual(
		targets.map((t) => t.slug),
		["ok"],
		"不可用的库不该出现在按钮里（要么没内容可续，要么正在跑）",
	)
})

test("#175 全部不可用时返回空数组（按钮据此不渲染）", () => {
	assert.equal(pickKnowledgeBaseUpdateTargets([]).length, 0)
	assert.equal(pickKnowledgeBaseUpdateTargets([item({ buildStatus: "building" })]).length, 0)
})

test("#175 只有「AI 回复完、轮到你」的收尾态才给按钮", () => {
	// 该给
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ say: "completion_result" }), true)
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ ask: "completion_result" }), true)
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ ask: "followup" }), true)
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ ask: "plan_mode_respond" }), true)

	// 不该给：任务还在跑，点了会被 isConversationBusy 拒掉
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ ask: "tool" }), false)
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ ask: "command" }), false)
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ say: "text" }), false)
	assert.equal(isKnowledgeBaseUpdateTurnEnd({}), false)
})

test("#175 流式未完成的消息不给按钮（否则会跟着每个 chunk 闪）", () => {
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ say: "completion_result", partial: true }), false)
	assert.equal(isKnowledgeBaseUpdateTurnEnd({ ask: "followup", partial: true }), false)
})

test("#175 按钮已接进消息渲染，且走 increment/recent 而不是全量重建", () => {
	const renderer = read("webview-ui/src/components/chat/chat-view/components/messages/MessageRenderer.tsx")
	assert.ok(renderer.includes("KnowledgeBaseUpdateRow"), "MessageRenderer 应渲染更新按钮")

	const row = read("webview-ui/src/components/chat/KnowledgeBaseUpdateRow.tsx")
	assert.ok(row.includes('action: "increment"'), "点击应走 increment")
	assert.ok(row.includes('kind: "recent"'), "范围应是 recent（只补本任务碰过的语义）")
	assert.ok(row.includes("isKnowledgeBaseUpdateTurnEnd"), "按钮显隐应复用同一份收尾态判定")
})

// ---------------------------------------------------------------------------
// #173 设置页行内代码的深色主题黑块
// ---------------------------------------------------------------------------

test("#173 InlineCode 自带前景色与背景色，不依赖全局兜底", () => {
	const src = read("webview-ui/src/components/common/InlineCode.tsx")
	for (const cls of ["text-preformat", "bg-code-block-background", "border-text-separator", "text-xs"]) {
		assert.ok(src.includes(cls), `InlineCode 应显式声明 ${cls}`)
	}
})

test("#173 设置页不再出现裸 <code className=...>，统一走 InlineCode", () => {
	const src = read("webview-ui/src/components/settings/sections/KnowledgeBaseSection.tsx")
	assert.ok(src.includes("<InlineCode>"), "知识库说明应使用 InlineCode")
	assert.ok(!/<code\s+className=/.test(src), "不应残留手写样式的 <code>（#173 的成因）")
	assert.ok(!/\*\*[^*\n]+\*\*/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "不应残留裸 markdown 星号加粗")
})

test("#173 大模型套餐说明同样改用 InlineCode", () => {
	const src = read("webview-ui/src/components/settings/providers/BigmodelPlanProvider.tsx")
	assert.ok(!/<code\s+className=/.test(src), "BigmodelPlanProvider 不应残留手写 <code>")
	assert.ok(src.includes("<InlineCode>"), "应改用 InlineCode")
})

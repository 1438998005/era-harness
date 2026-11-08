/**
 * 2026-11-08：设置页「OpenRouter 列表」的数据契约、grpc 接线与 host 状态机行为。
 *
 * 薄封装带 Controller / vscode 依赖，按本目录既有做法用源码接线断言（只作补充）；
 * 缓存 / TTL / 冷却 / 回落 / 并发去重抽成纯状态机后，直接 import 真模块做行为测试。
 * ⛔ 只查标识符会假绿：删光缓存逻辑仍全绿，这是上一轮审查的 P3-8。
 */

import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import {
	loadOpenRouterFreeModels,
	resetOpenRouterListingCache,
} from "../../src/core/controller/models/openrouter-free-models-cache"
import { OPENROUTER_FREE_MODELS_SNAPSHOT, parseOpenRouterFreeModels } from "../../src/shared/openrouter-free-models"
import { readCode, readRaw } from "./source-probe"

const FREE_PAYLOAD = {
	data: [
		{ id: "a/model:free", name: "A", context_length: 8192, pricing: { prompt: "0", completion: "0" } },
		{ id: "b/model:free", name: "B", context_length: 4096, pricing: { prompt: 0, completion: 0 } },
	],
}

/** 注入时钟 + stub 网络：行为测试不依赖真实时间，也不打外部端点。 */
function setup(fetchImpl: () => Promise<unknown>) {
	const state = { now: 1_000_000, calls: 0 }
	const deps = {
		fetchModels: async () => {
			state.calls++
			return fetchImpl()
		},
		now: () => state.now,
	}
	return { state, deps }
}

beforeEach(() => {
	resetOpenRouterListingCache()
})

test("清单快照：12 项实测、全为 :free 变体、不含虚拟路由器", () => {
	const ids = OPENROUTER_FREE_MODELS_SNAPSHOT.map((model) => model.id)
	assert.equal(ids.length, 12)
	assert.equal(new Set(ids).size, ids.length)
	assert.ok(ids.every((id) => id.endsWith(":free")))
	assert.ok(!ids.includes("openrouter/free"))
	assert.ok(!ids.includes("kilo-auto/free"))
})

test("清单解析：只收 :free、排除付费与坏数据、缺失字段给保守值", () => {
	const rows = parseOpenRouterFreeModels({
		data: [
			{ id: "ok/model:free", name: "OK", context_length: 8192, architecture: { input_modalities: ["text", "image"] } },
			{ id: "paid/model", pricing: { prompt: "0.001", completion: "0.002" } },
			{ id: "also-paid:free", pricing: { prompt: "0.001", completion: "0" } },
			{ id: "openrouter/free", pricing: { prompt: "0", completion: "0" } },
			null,
		],
	})
	assert.deepEqual(
		rows.map((row) => row.id),
		["ok/model:free"],
	)
	assert.equal(rows[0]?.contextWindow, 8192)
	assert.equal(rows[0]?.vision, true)
	assert.deepEqual(parseOpenRouterFreeModels({ data: "oops" }), [])
	// `:free` 后缀是主判据；pricing 缺失按无法判定保守放行，不是「坏数据被误收」。
	assert.equal(parseOpenRouterFreeModels({ data: [{ id: "x/model:free" }] })[0]?.contextWindow, 0)
	assert.equal(
		parseOpenRouterFreeModels({ data: [{ id: "n/model:free", pricing: { prompt: 0, completion: 0 } }] }).length,
		1,
		"数字 0 定价也必须按免费收下",
	)
})

test("源码接线：proto rpc / host 薄封装 / 四类生成物", () => {
	const proto = readRaw("proto/cline/models.proto")
	assert.match(proto, /rpc refreshOpenRouterFreeModels\(Empty\) returns \(OpenRouterFreeModelsResponse\);/)
	assert.match(proto, /bool from_snapshot = 2;/)
	assert.match(proto, /bool stale = 3;/, "回落旧缓存与内置快照必须可区分")

	const handler = readCode("src/core/controller/models/refreshOpenRouterFreeModels.ts")
	assert.match(handler, /export async function refreshOpenRouterFreeModels\(/)
	assert.match(handler, /@\/shared\/net/, "外部请求必须走代理感知的 fetch")
	assert.match(handler, /AbortSignal\.timeout/, "必须带超时，避免设置页被挂起")
	assert.match(handler, /fromSnapshot/, "回落必须显式标注，UI 才能提示")
	assert.match(handler, /stale/, "必须把来源映射成 stale")

	const services = readRaw("src/generated/hosts/vscode/protobus-services.ts")
	assert.match(
		services,
		/import \{ refreshOpenRouterFreeModels \} from "@core\/controller\/models\/refreshOpenRouterFreeModels"/,
	)
	assert.match(services, /refreshOpenRouterFreeModels: refreshOpenRouterFreeModels/)
	const types = readRaw("src/generated/hosts/vscode/protobus-service-types.ts")
	assert.match(types, /refreshOpenRouterFreeModels:\(controller: Controller, request: proto\.cline\.Empty\)/)
	const client = readRaw("webview-ui/src/services/grpc-client.ts")
	assert.match(client, /static async refreshOpenRouterFreeModels\(/, "生成物应含新 RPC，禁止手改")
})

// 2026-11-08 代码审查回归 P3-8：host 缓存/回落必须能脱离 Controller / vscode 做行为测试，
// 不能只靠「源码里找标识符」（删光缓存逻辑仍全绿的假绿区）。
test("审查回归 P3-8：host 缓存状态机可独立测试、薄封装不再内联缓存", () => {
	const cache = readRaw("src/core/controller/models/openrouter-free-models-cache.ts")
	assert.match(cache, /export (async )?function loadOpenRouterFreeModels/)
	assert.match(cache, /export function resetOpenRouterListingCache/)
	const wrapper = readCode("src/core/controller/models/refreshOpenRouterFreeModels.ts")
	assert.match(wrapper, /loadOpenRouterFreeModels/, "host handler 必须 delegate 到纯状态机")
	assert.doesNotMatch(wrapper, /SUCCESS_TTL_MS\s*=/, "TTL / 冷却必须收口到纯状态机")
})

// ---------------------------------------------------------------------------
// 纯状态机行为测试（P3-8 主体）：TTL / 冷却 / 三态来源 / 并发去重 / reset
// ---------------------------------------------------------------------------

test("host 状态机：成功拉取为 live，成功 TTL 内复用缓存不重打端点", async () => {
	const { state, deps } = setup(async () => FREE_PAYLOAD)
	const first = await loadOpenRouterFreeModels(deps)
	assert.equal(first.source, "live")
	assert.deepEqual(
		first.models.map((model) => model.id),
		["a/model:free", "b/model:free"],
	)
	assert.equal(state.calls, 1)

	state.now += 9 * 60 * 1000
	assert.equal((await loadOpenRouterFreeModels(deps)).source, "live")
	assert.equal(state.calls, 1, "TTL 内不得重拉")

	state.now += 2 * 60 * 1000
	assert.equal((await loadOpenRouterFreeModels(deps)).source, "live")
	assert.equal(state.calls, 2, "TTL 过期后必须重拉")
})

test("host 状态机：TTL 过期且刷新失败 → 回落旧缓存，不谎报内置快照", async () => {
	let fail = false
	const { state, deps } = setup(async () => {
		if (fail) {
			throw new Error("network down")
		}
		return FREE_PAYLOAD
	})
	await loadOpenRouterFreeModels(deps)
	state.now += 11 * 60 * 1000
	fail = true
	const stale = await loadOpenRouterFreeModels(deps)
	assert.equal(stale.source, "cache", "有旧缓存时回落来源必须是 cache")
	assert.deepEqual(
		stale.models.map((model) => model.id),
		["a/model:free", "b/model:free"],
		"必须保留上次成功拉取的官方清单",
	)
	assert.notEqual(stale.models[0]?.id, OPENROUTER_FREE_MODELS_SNAPSHOT[0]?.id, "⛔ 不得把旧缓存说成内置快照")
})

test("host 状态机：从未成功过且失败 → 回落内置快照", async () => {
	const { deps } = setup(async () => {
		throw new Error("down")
	})
	const state = await loadOpenRouterFreeModels(deps)
	assert.equal(state.source, "snapshot")
	assert.deepEqual(state.models, [...OPENROUTER_FREE_MODELS_SNAPSHOT])
})

test("host 状态机：失败冷却 60s 内不重打端点，冷却结束后可成功", async () => {
	let fail = true
	const { state, deps } = setup(async () => {
		if (fail) {
			throw new Error("down")
		}
		return FREE_PAYLOAD
	})
	assert.equal((await loadOpenRouterFreeModels(deps)).source, "snapshot")
	assert.equal(state.calls, 1)

	state.now += 30_000
	assert.equal((await loadOpenRouterFreeModels(deps)).source, "snapshot")
	assert.equal(state.calls, 1, "冷却期内不得重打端点")

	state.now += 31_000
	fail = false
	assert.equal((await loadOpenRouterFreeModels(deps)).source, "live", "冷却结束后必须能重新成功")
	assert.equal(state.calls, 2)
})

test("host 状态机：空清单按失败处理并进入冷却", async () => {
	const { state, deps } = setup(async () => ({ data: [] }))
	assert.equal((await loadOpenRouterFreeModels(deps)).source, "snapshot")
	state.now += 10_000
	await loadOpenRouterFreeModels(deps)
	assert.equal(state.calls, 1, "解析为空也必须进入失败冷却")
})

test("host 状态机：并发请求复用同一个 in-flight Promise", async () => {
	let resolveFirst: ((value: unknown) => void) | undefined
	let calls = 0
	const deps = {
		fetchModels: () => {
			calls++
			return new Promise<unknown>((resolve) => {
				resolveFirst = resolve
			})
		},
		now: () => 1_000_000,
	}
	const first = loadOpenRouterFreeModels(deps)
	const second = loadOpenRouterFreeModels(deps)
	assert.equal(calls, 1, "并发只打一次端点")
	assert.equal(first, second, "必须复用 in-flight Promise")
	resolveFirst?.(FREE_PAYLOAD)
	const [a, b] = await Promise.all([first, second])
	assert.equal(a.source, "live")
	assert.equal(b.source, "live")
	assert.equal((await loadOpenRouterFreeModels(deps)).source, "live")
	assert.equal(calls, 1, "完成后命中缓存，仍不重打端点")
})

test("host 状态机：reset 清空缓存与冷却", async () => {
	const { state, deps } = setup(async () => FREE_PAYLOAD)
	await loadOpenRouterFreeModels(deps)
	assert.equal(state.calls, 1)
	resetOpenRouterListingCache()
	await loadOpenRouterFreeModels(deps)
	assert.equal(state.calls, 2, "reset 后必须重新拉取")
})

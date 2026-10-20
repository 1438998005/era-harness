/**
 * 免费模型双车道客户端：OpenCode Zen（免 Key + CLI 指纹头）与 Kilo 免费池（零凭据）。
 *
 * 事实来源（2026-10-19 spike 实测 + zen-gate 源码 + zen-useragent 社区消融）：
 * - Zen 推理端点 `https://opencode.ai/inference/v1`；免费门（FreeTierError）三要素
 *   （zen-useragent v1.6.0 消融结论，本机三发复测证实缺一不可）：
 *   ① UA 以 `opencode/` 开头；② `x-opencode-session` 是**账号已知会话**（真实 opencode
 *      客户端创建过的 ID，自造/随机一律 403，约 2026-10 中旬起生效）；③ body.tools 含一个
 *      **名为 `read`** 的函数工具（空壳即可）。
 *   本机无 opencode 客户端 → 造不出合格会话 → Zen 车道整体 403（非 tools/UA 问题）。
 *   恢复正道：本机安装并登录过一次 opencode 官方客户端后，从其
 *   `~/.local/share/opencode/opencode.db`（session_v2 表）读真实会话 + 请求体补 read 空壳。
 *   详见 知识库/07-外部资源.md §7.7「免费门三要素」。
 * - Kilo `https://api.kilo.ai/api/gateway`：**完全不能带 Authorization**（带任何值都 401
 *   INVALID_TOKEN），OpenAI SDK 传空 apiKey 即不发该头（已实测）。
 * - listing：Kilo `GET /models` 只信 `isFree === true`；Zen 清单在 `/zen/v1/models`。
 */

import { type FreeLane, type KiloFreeRow, parseKiloFreeRows } from "@shared/free-pools"
import OpenAI from "openai"
import { fetch } from "@/shared/net"
import { mintSessionId, SESSION_REMINT_AFTER_MS } from "./free-session"

const ZEN_BASE_URL = "https://opencode.ai/inference/v1"
const KILO_BASE_URL = "https://api.kilo.ai/api/gateway"
const OVH_BASE_URL = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1"

/** zen-gate 使用的 CLI 指纹 UA（上游免费门识别用） */
export const ZEN_CLIENT_UA = "opencode/latest/2.0.26/cli"

const LISTING_TTL_MS = 10 * 60 * 1000

export interface ZenClientHandle {
	client: OpenAI
	/** 当前会话 ID（四头同值；6 天后重铸） */
	session: string
	mintedAt: number
}

/** Zen 车道客户端：Bearer public + CLI 指纹头（缺一即 403 FreeTierError） */
export function createZenClient(session: string = mintSessionId()): ZenClientHandle {
	const now = Date.now()
	return {
		client: new OpenAI({
			baseURL: ZEN_BASE_URL,
			apiKey: "public",
			defaultHeaders: {
				"User-Agent": ZEN_CLIENT_UA,
				"x-opencode-client": "cli",
				"x-opencode-project": "global",
				// 四个 session 头同值双发（v2 门指纹；x-opencode-request / Referer 绝不能带）
				"x-opencode-session": session,
				"x-opencode-session-id": session,
				"x-session-affinity": session,
				"x-session-id": session,
			},
			fetch,
		}),
		session,
		mintedAt: now,
	}
}

/** session 超过 6 天（上游容忍上限）时重铸客户端 */
export function ensureFreshZenClient(handle: ZenClientHandle, now: number = Date.now()): ZenClientHandle {
	if (now - handle.mintedAt < SESSION_REMINT_AFTER_MS) {
		return handle
	}
	return createZenClient()
}

/** Kilo 车道客户端：零凭据（空 apiKey → SDK 不发 Authorization；带任何值都会 401） */
export function createKiloClient(): OpenAI {
	return new OpenAI({
		baseURL: KILO_BASE_URL,
		apiKey: "",
		defaultHeaders: {
			"User-Agent": "era-harness/1.0",
		},
		fetch,
	})
}

/**
 * OVH 车道客户端（AI Endpoints，OpenAI 完全兼容，chat/tools/stream 实测均正常）：
 * - 无 key：匿名 2 次/分钟（空 apiKey → SDK 不发 Authorization，实测 200）；
 * - 有 key：`Authorization: Bearer <key>`，400 次/分钟（用户设置页选填）。
 */
export function createOvhClient(apiKey?: string): OpenAI {
	return new OpenAI({
		baseURL: OVH_BASE_URL,
		apiKey: apiKey || "",
		defaultHeaders: {
			"User-Agent": "era-harness/1.0",
		},
		fetch,
	})
}

// ---------------------------------------------------------------------------
// listing 拉取（TTL 缓存，模块级共享）
// ---------------------------------------------------------------------------

let kiloListingCache: { at: number; rows: KiloFreeRow[] } | undefined

/** 拉取 Kilo 免费清单；失败返回 undefined（调用方回退静态实证表） */
export async function fetchKiloFreeModels(now: number = Date.now()): Promise<KiloFreeRow[] | undefined> {
	if (kiloListingCache && now - kiloListingCache.at < LISTING_TTL_MS) {
		return kiloListingCache.rows
	}
	try {
		const response = await fetch("https://api.kilo.ai/api/gateway/models", {
			method: "GET",
			headers: { accept: "application/json" },
		})
		if (!response.ok) {
			return kiloListingCache?.rows
		}
		const rows = parseKiloFreeRows(await response.json())
		if (rows.length === 0) {
			return kiloListingCache?.rows
		}
		kiloListingCache = { at: now, rows }
		return rows
	} catch {
		return kiloListingCache?.rows // 网络失败时沿用上次可用清单，再不行回退静态表
	}
}

/** 测试辅助：清空 listing 缓存 */
export function resetFreeLaneCaches(): void {
	kiloListingCache = undefined
	laneCooldowns.clear()
}

// ---------------------------------------------------------------------------
// 车道级冷却（FreeTierError 是 lane 级拒绝：每请求重试全部 Zen 候选纯属浪费）
// ---------------------------------------------------------------------------

const LANE_COOLDOWN_MS = 5 * 60 * 1000
const laneCooldowns = new Map<FreeLane, number>()

/** 记录车道级冷却（仅用于 lane 级拒绝，如 FreeTierError；region/限流按模型 failover 不冷却） */
export function noteLaneCooldown(lane: FreeLane, now: number = Date.now()): void {
	laneCooldowns.set(lane, now + LANE_COOLDOWN_MS)
}

export function isLaneCoolingDown(lane: FreeLane, now: number = Date.now()): boolean {
	const until = laneCooldowns.get(lane)
	return until !== undefined && now < until
}

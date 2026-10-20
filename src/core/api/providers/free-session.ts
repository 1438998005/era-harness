/**
 * Zen 车道 session ID 铸造（纯函数，无 IO 依赖，便于单测）。
 *
 * 移植自 zen-gate `internal/lane/upstream.go` MintSessionId：
 * - 格式 `ses_` + 12 位 hex + 14 位 base62，上游用正则校验形状；
 * - 12 位 hex 是「反转时间戳」：`value = ^(nowMS<<12 | seq)` 后取中间 6 字节
 *   （`raw[i] = (value >> (40-8i)) & 0xFF`）。**最高字节被丢弃**——时间戳占 52 位、
 *   取反后高位恒 1，携带零信息；勿"修正"成大端全 8 字节；
 * - 上游会解码 hex 前缀校验时间戳新鲜度（容忍约一周），纯随机 session 会被退回
 *   403 FreeTierError。
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/** 上游对 session 时间戳前缀的容忍上限约一周；6 天重铸保平安 */
export const SESSION_REMINT_AFTER_MS = 6 * 24 * 60 * 60 * 1000

/** 铸造网关形状的 session ID */
export function mintSessionId(nowMs: number = Date.now()): string {
	const value = (~((BigInt(nowMs) << 12n) | 1n) as bigint) & 0xffff_ffff_ffff_ffffn
	let hex = ""
	for (let i = 0; i < 6; i++) {
		hex += Number((value >> BigInt(40 - 8 * i)) & 0xffn)
			.toString(16)
			.padStart(2, "0")
	}
	let suffix = ""
	for (let i = 0; i < 14; i++) {
		suffix += BASE62[Math.floor(Math.random() * BASE62.length)]
	}
	return `ses_${hex}${suffix}`
}

/**
 * 解码 session 的 12 位 hex 前缀，还原毫秒时间戳的**低 36 位**（供测试与诊断）。
 * 注意：铸造算法丢弃了 64 位 value 的最高字节，raw 6 字节只保留低 48 位
 * （= 时间戳低 36 位 + 12 位 seq），高 16 位时间戳不可恢复，故只能按低 36 位对账。
 */
export function decodeSessionTimestamp(session: string): number | undefined {
	const hex = session.slice(4, 16)
	if (!/^[0-9a-f]{12}$/.test(hex)) {
		return undefined
	}
	let valueLow48 = 0n
	for (let i = 0; i < 6; i++) {
		valueLow48 = (valueLow48 << 8n) | BigInt(parseInt(hex.slice(i * 2, i * 2 + 2), 16))
	}
	const originalLow48 = ~valueLow48 & 0xffff_ffff_ffffn
	// 原始值 = (nowMs << 12 | seq)：bit0..11 为 seq，bit12..47 为 nowMs 低 36 位
	return Number(originalLow48 >> 12n)
}

/**
 * eratw 一键更新 —— 规范形哈希（换行 / BOM 无关的内容指纹）。
 *
 * 为什么需要：上游 git blob 基本是 LF、多数带 UTF-8 BOM，而发布包/整合包常被
 * Windows 工具整体转成 CRLF 或去掉 BOM。纯字节 sha1 会把「同一份内容、不同换行」
 * 全判成「玩家改过」——2026-10-29 真实事故：全新整合包被判改了 10261 个文件、
 * 2785 个假冲突（KB 13 §13.3.4）。
 *
 * 规范形只抹掉两件与语义无关的事：
 *   1. 文件头的一次 UTF-8 BOM（`EF BB BF`，仅偏移 0）
 *   2. 行尾：CRLF / 孤立 CR → LF（`\r\r\n` → `\n\n`；**不合并连续 CR**，
 *      那是上游真实存在的空行/杂散 CR，合并会掩盖真实改动）
 *
 * ⚠️ `canonBlobSha1` 是**规范形内容的 git blob id**（`sha1("blob " + 长度 + "\0" + 内容)`），
 * 不是随便一个摘要——这一点是刻意的：
 *
 * - 3.92.1 及更早的 `update-state.json` 里只存了纯字节 blob id。用「域分隔摘要」
 *   就永远比不出结果，老用户第一次更新仍会把上千个「只差换行」的文件判成改过
 *   （2026-10-29 的真实事故就是这样：整合包里的记录是别人机器上 LF 时算的，
 *   用户解压出来是 CRLF）。而 blob id 可以直接和旧记录里的 `sha1` 比——
 *   「这份内容和那份记录是不是同一份（只差换行/BOM）」就答得出来。
 * - 反过来也一样：新记录里的 `canonBlobSha1` 与上游的 raw `sha1` 可直接比。
 *
 * 代价：git blob 头要长度前缀，而规范形长度流式不可知 → 只能把规范形字节攒在内存里
 * 最后算。所以设了 `CANON_BLOB_MAX_BYTES` 上限，超限的文本文件退回纯字节比对
 * （eraTW 的脚本/数据文件远小于这个数）。
 *
 * 纯 Node、无 vscode；与 `manifest.ts` 的流式扫描共用同一实现。
 */

import { createHash, type Hash } from "node:crypto"

/** 文本扩展名白名单（小写、不带点）。不在名单里的一律按二进制处理。 */
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
	"erb",
	"erh",
	"erd",
	"csv",
	"als",
	"txt",
	"md",
	"json",
	"js",
	"ts",
	"bat",
	"cmd",
	"ini",
	"xml",
	"html",
	"htm",
	"yml",
	"yaml",
	"toml",
	"py",
	"sh",
	"eram",
	"dim",
	"log",
	"config",
	"css",
])

/** git 的二进制判据：前 8000 字节里出现 NUL 就当二进制 */
export const NUL_SCAN_BYTES = 8000

const EMPTY = Buffer.alloc(0)
const BOM = [0xef, 0xbb, 0xbf] as const

/**
 * 规范形内容的内存上限：超过它就不攒字节、退回纯字节比对。
 * 8MB 远超 eraTW 里任何脚本/数据文件，同时保证单文件峰值内存可控。
 */
export const CANON_BLOB_MAX_BYTES = 8 * 1024 * 1024

/** 按扩展名判断是否值得做规范形归一（内容里还有 NUL 的第二道闸） */
export function looksTextPath(pathOrName: string): boolean {
	const name = pathOrName.replace(/\\/g, "/").split("/").pop() ?? pathOrName
	const dot = name.lastIndexOf(".")
	if (dot <= 0 || dot === name.length - 1) {
		return false
	}
	return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}

/** 内容里是否含 NUL（只扫前 8000 字节，与 git 同判据） */
export function looksBinaryContent(buf: Buffer): boolean {
	return buf.subarray(0, NUL_SCAN_BYTES).includes(0)
}

/**
 * 流式规范形哈希：一次读盘同时产出 raw sha1（git blob id）与规范形 blob id。
 *
 * 调用方必须先把 `size` 传进来 —— git blob 头需要长度前缀，而流式读之前
 * 长度已经由 `stat` / tar 头给出。
 */
export class CanonicalHasher {
	private readonly rawHash: Hash
	private readonly text: boolean
	private pendingCr = false
	private binary = false
	private bomChecked = false
	private prefix: Buffer = EMPTY
	private scanned = 0
	private done = false
	/** 规范形字节（最后拼 blob 头用）；超上限后置 null = 放弃规范形 */
	private canonParts: Buffer[] | null = []
	private canonBytes = 0

	constructor(opts: { text: boolean; size: number }) {
		this.text = opts.text
		this.rawHash = createHash("sha1").update(Buffer.from(`blob ${opts.size}\0`, "utf8"))
	}

	update(chunk: Buffer): void {
		if (this.done || chunk.length === 0) {
			return
		}
		this.rawHash.update(chunk)
		if (this.binary) {
			return
		}
		if (!this.text) {
			// 扩展名不在白名单：不值得归一，规范形 == 原文
			this.binary = true
			this.canonParts = null
			return
		}
		if (this.scanned < NUL_SCAN_BYTES) {
			const limit = Math.min(chunk.length, NUL_SCAN_BYTES - this.scanned)
			if (chunk.subarray(0, limit).includes(0)) {
				this.binary = true
				this.canonParts = null
				return
			}
		}
		this.scanned += chunk.length

		let data = chunk
		if (!this.bomChecked) {
			this.prefix = this.prefix.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.prefix, chunk])
			if (this.prefix.length < BOM.length) {
				return
			}
			this.bomChecked = true
			const skip = this.prefix[0] === BOM[0] && this.prefix[1] === BOM[1] && this.prefix[2] === BOM[2] ? BOM.length : 0
			data = this.prefix.subarray(skip)
			this.prefix = EMPTY
		}
		this.feed(data)
	}

	digest(): { raw: string; canonBlob?: string; binary: boolean } {
		if (this.done) {
			throw new Error("CanonicalHasher.digest() 只能调用一次")
		}
		this.done = true
		if (!this.binary && !this.bomChecked) {
			// 文件不足 3 字节：前缀里不可能有完整 BOM，原样过状态机
			const rest = this.prefix
			this.prefix = EMPTY
			this.bomChecked = true
			this.feed(rest)
		}
		if (!this.binary && this.pendingCr) {
			this.pendingCr = false
			this.emit(Buffer.from([0x0a]))
		}
		const raw = this.rawHash.digest("hex")
		if (this.binary) {
			// 二进制不做归一：规范形就是原文本身
			return { raw, canonBlob: raw, binary: true }
		}
		if (!this.canonParts) {
			return { raw, binary: false }
		}
		const content = this.canonParts.length === 1 ? this.canonParts[0] : Buffer.concat(this.canonParts, this.canonBytes)
		const header = Buffer.from(`blob ${this.canonBytes}\0`, "utf8")
		const canonBlob = createHash("sha1").update(header).update(content).digest("hex")
		return { raw, canonBlob, binary: false }
	}

	/** 行尾状态机：CRLF/CR → LF；CR 跨块时留到下一块再决定 */
	private feed(data: Buffer): void {
		if (data.length === 0) {
			return
		}
		// 快路径：没有待决 CR、本块也没有 CR —— 绝大多数块走这里
		if (!this.pendingCr && !data.includes(0x0d)) {
			this.emit(data)
			return
		}
		// +1：块首若带着上一块遗留的 CR，第一字节要先补一个 LF，输出可能比输入长 1
		const out = Buffer.allocUnsafe(data.length + 1)
		let o = 0
		for (let i = 0; i < data.length; i++) {
			const byte = data.readUInt8(i)
			if (this.pendingCr) {
				this.pendingCr = false
				out[o++] = 0x0a
				if (byte === 0x0a) {
					continue
				}
			}
			if (byte === 0x0d) {
				this.pendingCr = true
				continue
			}
			out[o++] = byte
		}
		this.emit(out.subarray(0, o))
	}

	/**
	 * 收下规范形字节。必须**复制**：调用方的 chunk 缓冲会被复用。
	 * 超上限就整体放弃（置 null），而不是攒一半——半个文件算出来的摘要比没有更危险。
	 */
	private emit(buf: Buffer): void {
		if (buf.length === 0 || !this.canonParts) {
			return
		}
		if (this.canonBytes + buf.length > CANON_BLOB_MAX_BYTES) {
			this.canonParts = null
			this.canonBytes = 0
			return
		}
		this.canonParts.push(Buffer.from(buf))
		this.canonBytes += buf.length
	}
}

/**
 * 整块规范化（测试 / 小文件用）。规则与 `CanonicalHasher` 完全一致：
 * 二进制内容原样返回，不剥 BOM、不动行尾。
 */
export function canonicalizeBytes(buf: Buffer, opts: { text?: boolean } = {}): Buffer {
	const text = opts.text ?? !looksBinaryContent(buf)
	if (!text) {
		return buf
	}
	let start = 0
	if (buf.length >= 3 && buf[0] === BOM[0] && buf[1] === BOM[1] && buf[2] === BOM[2]) {
		start = 3
	}
	const out = Buffer.allocUnsafe(Math.max(0, buf.length - start))
	let o = 0
	for (let i = start; i < buf.length; i++) {
		const byte = buf.readUInt8(i)
		if (byte === 0x0d) {
			out[o++] = 0x0a
			if (i + 1 < buf.length && buf.readUInt8(i + 1) === 0x0a) {
				i++
			}
			continue
		}
		out[o++] = byte
	}
	return out.subarray(0, o)
}

/**
 * 规范形内容的 git blob id（整块；测试 / 小文件用）。
 * 规则与 `CanonicalHasher` 完全一致：二进制内容原样返回，不剥 BOM、不动行尾。
 */
export function canonicalBlobSha1(buf: Buffer, opts: { text?: boolean } = {}): string {
	const canon = canonicalizeBytes(buf, opts)
	return createHash("sha1")
		.update(Buffer.from(`blob ${canon.length}\0`, "utf8"))
		.update(canon)
		.digest("hex")
}

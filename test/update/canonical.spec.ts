/**
 * 规范形哈希（canonical.ts）回归测试。
 *
 * 这一层是 2026-10-29「全新整合包被判改了 10261 个文件」的根因修复：
 * 换行/BOM 差异必须被判成「同一内容」。所以每条规则都要有反例锁死，
 * 尤其是「不能把真实改动也归一掉」。
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
	CANON_BLOB_MAX_BYTES,
	CanonicalHasher,
	canonicalBlobSha1,
	canonicalizeBytes,
	looksBinaryContent,
	looksTextPath,
} from "../../src/core/update/canonical"

function hash(buf: Buffer, opts: { text?: boolean; chunk?: number } = {}) {
	const hasher = new CanonicalHasher({ text: opts.text ?? true, size: buf.length })
	const size = opts.chunk ?? buf.length
	for (let i = 0; i < buf.length; i += size) {
		hasher.update(buf.subarray(i, Math.min(i + size, buf.length)))
	}
	return hasher.digest()
}

const BOM = Buffer.from([0xef, 0xbb, 0xbf])

test("canonical：纯 LF 内容不变", () => {
	const text = Buffer.from("@A\n#FUNCTION\nRETURNF 0\n")
	assert.deepEqual(canonicalizeBytes(text), text)
})

test("canonical：CRLF / 孤立 CR / LF 三种写法等价", () => {
	const lf = Buffer.from("a\nb\nc\n")
	const crlf = Buffer.from("a\r\nb\r\nc\r\n")
	const cr = Buffer.from("a\rb\rc\r")
	assert.equal(canonicalBlobSha1(lf), canonicalBlobSha1(crlf))
	assert.equal(canonicalBlobSha1(lf), canonicalBlobSha1(cr))
})

test("canonical：文件头 BOM 被剥掉，中部 BOM 是真实内容", () => {
	const body = Buffer.from("a\nb\n")
	const withBom = Buffer.concat([BOM, body])
	assert.equal(canonicalBlobSha1(withBom), canonicalBlobSha1(body))
	const middleBom = Buffer.from("a\nb\n\uFEFFc\n", "utf8")
	assert.notEqual(canonicalBlobSha1(middleBom), canonicalBlobSha1(Buffer.from("a\nb\nc\n")))
})

test("canonical：`\\r\\r\\n` → `\\n\\n`（不合并连续 CR）且幂等", () => {
	const weird = Buffer.from("a\r\r\nb")
	const once = canonicalizeBytes(weird)
	assert.equal(once.toString(), "a\n\nb")
	assert.deepEqual(canonicalizeBytes(once), once)
})

test("canonical：含 NUL 的内容判二进制，canon == raw", () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
	assert.equal(looksBinaryContent(png), true)
	const result = hash(png)
	assert.equal(result.binary, true)
	assert.equal(result.canonBlob, result.raw)
})

test("canonical：扩展名不在白名单时不做归一", () => {
	assert.equal(looksTextPath("ERB/COMMON.ERB"), true)
	assert.equal(looksTextPath("CSV/CSTR.als"), true)
	assert.equal(looksTextPath("resources/a.PNG"), false)
	assert.equal(looksTextPath("ERB/noext"), false)
	const a = hash(Buffer.from("a\r\nb"), { text: looksTextPath("a.png") })
	const b = hash(Buffer.from("a\nb"), { text: looksTextPath("a.png") })
	assert.notEqual(a.canonBlob, b.canonBlob)
})

test("canonical：0 字节文件保持 git 空 blob 指纹", () => {
	const empty = hash(Buffer.alloc(0))
	assert.equal(empty.raw, "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391")
	assert.equal(empty.binary, false)
})

test("canonical：分片喂入（含 1 字节）与整块结果一致", () => {
	const body = Buffer.concat([BOM, Buffer.from("line1\r\nline2\rline3\n")])
	const whole = hash(body)
	for (const chunk of [1, 2, 3, 7, 64]) {
		const part = hash(body, { chunk })
		assert.equal(part.raw, whole.raw, `raw chunk=${chunk}`)
		assert.equal(part.canonBlob, whole.canonBlob, `canon chunk=${chunk}`)
	}
})

test("canonical：CR 落在块尾 / CRLF 被块边界劈开也一致", () => {
	const body = Buffer.from("aaa\r\nbbb\r\n")
	const whole = hash(body)
	// 故意把 \r\n 劈开：每块 4 字节 → "aaa\r" + "\nbbb" + "\r\n"
	const split = hash(body, { chunk: 4 })
	assert.equal(split.canonBlob, whole.canonBlob)
	// 文件正好以 CR 结尾
	const tail = Buffer.from("abc\r")
	assert.equal(hash(tail).canonBlob, hash(Buffer.from("abc\n")).canonBlob)
})

test("canonical：BOM 被劈成 1+1+1 仍能识别", () => {
	const body = Buffer.concat([BOM, Buffer.from("x\r\n")])
	assert.equal(hash(body, { chunk: 1 }).canonBlob, hash(Buffer.from("x\n")).canonBlob)
})

test("canonical：不足 3 字节的文件不会被误当 BOM", () => {
	assert.equal(hash(Buffer.from("a")).canonBlob, canonicalBlobSha1(Buffer.from("a")))
	assert.equal(hash(Buffer.from("ab")).canonBlob, canonicalBlobSha1(Buffer.from("ab")))
})

test("canonical：真实 ERB 的 CRLF 变体与原件等价（回归 10261 事故）", () => {
	const lf = Buffer.from("@A\n#FUNCTION\nPRINTL 気\nRETURNF 0\n", "utf8")
	const crlf = Buffer.from(lf.toString("utf8").replace(/\n/g, "\r\n"), "utf8")
	const a = hash(lf)
	const b = hash(crlf)
	assert.notEqual(a.raw, b.raw, "raw 必须不同（否则测不到点子上）")
	assert.equal(a.canonBlob, b.canonBlob, "规范形必须相同")
})

// —— 老记录兼容（2026-10-29 事故的真正出口）——
// 3.92.1 及更早的 update-state.json 里只有纯字节 blob id，没有规范形指纹。
// 如果规范形摘要用的是「域分隔摘要」，老记录永远比不出结果，用户第一次更新
// 照样会把上千个「只差换行」的文件判成改过。所以规范形摘要必须做成 git blob id。

test("老记录兼容：规范形摘要就是 blob id，能直接对上 LF 原件的 sha1", () => {
	const lf = Buffer.from("@A\n#FUNCTION\nRETURNF 0\n")
	const crlf = Buffer.from("@A\r\n#FUNCTION\r\nRETURNF 0\r\n")
	// 老记录里存的是「当时那份 LF 文件的 blob id」
	const legacyBlob = hash(lf).raw
	assert.equal(hash(crlf).canonBlob, legacyBlob, "CRLF 文件的规范形 blob 必须等于 LF 原件的 blob id")
	assert.notEqual(hash(crlf).raw, legacyBlob, "raw 必须不同（否则测不到点子上）")
})

test("老记录兼容：带 BOM 的本地文件也能对上不带 BOM 的老记录", () => {
	const plain = Buffer.from("a\nb\n")
	const withBom = Buffer.concat([BOM, plain])
	assert.equal(hash(withBom).canonBlob, hash(plain).raw)
})

test("老记录兼容：规范形 blob 与 canonicalBlobSha1 同口径（流式/整块一致）", () => {
	const body = Buffer.concat([BOM, Buffer.from("x\r\ny\rz\n")])
	assert.equal(hash(body).canonBlob, canonicalBlobSha1(body))
})

test("老记录兼容：真实改动仍然产生不同的规范形（⛔ 不能把改动一起抹掉）", () => {
	const before = Buffer.from("PRINTL 1\r\n")
	const after = Buffer.from("PRINTL 2\n")
	assert.notEqual(hash(after).canonBlob, hash(before).raw)
})

test("超上限的文本文件放弃规范形（canonBlob 为 undefined，退回纯字节比对）", () => {
	// 造一个刚好超上限的输入：不真的分配 8MB 字符串，直接喂分片计数
	const hasher = new CanonicalHasher({ text: true, size: CANON_BLOB_MAX_BYTES + 1 })
	const chunk = Buffer.alloc(1024 * 1024, 0x61)
	for (let i = 0; i <= CANON_BLOB_MAX_BYTES / chunk.length; i++) {
		hasher.update(chunk)
	}
	const result = hasher.digest()
	assert.equal(result.binary, false)
	assert.equal(result.canonBlob, undefined, "超上限必须放弃规范形，而不是算半个")
	assert.equal(typeof result.raw, "string")
})

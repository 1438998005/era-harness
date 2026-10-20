/**
 * 流式 tar.gz 解析的回归测试。
 *
 * 重点不是"能不能解析正常归档"，而是**真实归档里那些坑**：
 * 超长日文路径（pax 扩展头）、GNU 长名、归档顶层前缀、路径穿越、分片边界。
 */

import assert from "node:assert/strict"
import { Readable } from "node:stream"
import test from "node:test"
import { createGunzip, gzipSync } from "node:zlib"
import { extractTar, normalizeEntryPath } from "../../src/core/update/tarball"
import { buildTar, chunked } from "./tar-fixture"

async function collect(tar: Buffer, opts: Parameters<typeof extractTar>[1] = {}) {
	const files = new Map<string, string>()
	const stats = await extractTar(chunked(tar), {
		...opts,
		onFile: (entry, chunk) => {
			files.set(entry.path, (files.get(entry.path) ?? "") + chunk.toString("utf8"))
		},
	})
	return { stats, files }
}

test("解析基本归档：自动剥掉 GitLab 的顶层目录前缀", async () => {
	const tar = buildTar([
		{ path: "eratw-sub-modding-develop", type: "dir" },
		{ path: "eratw-sub-modding-develop/ERB/DIM.ERH", content: "NOW_VERSION = 20261017" },
		{ path: "eratw-sub-modding-develop/CSV/Abl.csv", content: "a,b" },
	])
	const { stats, files } = await collect(tar)

	assert.equal(stats.prefix, "eratw-sub-modding-develop")
	assert.deepEqual([...files.keys()].sort(), ["CSV/Abl.csv", "ERB/DIM.ERH"])
	assert.equal(files.get("ERB/DIM.ERH"), "NOW_VERSION = 20261017")
	assert.equal(stats.files, 2)
})

test("超长日文路径走 pax 扩展头（git archive 的真实行为）", async () => {
	const longPath =
		"eratw-sub-modding-develop/ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/因幡帝海外版/M_KOJO_K53_extra_interactions.ERB"
	assert.ok(Buffer.byteLength(longPath) > 100, "该路径必须超过 ustar 的 100 字节上限")

	const tar = buildTar([
		{ path: "eratw-sub-modding-develop", type: "dir" },
		{ path: longPath, content: "#FUNCTION TEST\n#END" },
	])
	const { files } = await collect(tar)

	const expected = "ERB/口上・メッセージ関連/個人口上/053 Tewi [てゐ]/因幡帝海外版/M_KOJO_K53_extra_interactions.ERB"
	assert.deepEqual([...files.keys()], [expected])
	assert.equal(files.get(expected), "#FUNCTION TEST\n#END")
})

test("GNU 长名（'L' 类型）也能认", async () => {
	const tar = buildTar([
		{ path: "eratw-sub-modding-develop", type: "dir" },
		{
			path: "eratw-sub-modding-develop/a/b/c/d/e/very-long-file-name-that-exceeds-ustar-limits.ERB",
			content: "x",
			gnuLongName: true,
		},
	])
	const { files } = await collect(tar)
	assert.deepEqual([...files.keys()], ["a/b/c/d/e/very-long-file-name-that-exceeds-ustar-limits.ERB"])
})

test("路径穿越条目被拒绝，且不影响后续条目解析", async () => {
	const tar = buildTar([
		{ path: "eratw-sub-modding-develop", type: "dir" },
		{ path: "../../evil.txt", content: "pwn" },
		{ path: "eratw-sub-modding-develop/ok.txt", content: "fine" },
	])
	const { stats, files } = await collect(tar)

	assert.ok(stats.rejected.includes("../../evil.txt"))
	assert.deepEqual([...files.keys()], ["ok.txt"])
	assert.equal(files.get("ok.txt"), "fine")
})

test("filter 为 false 时丢弃内容但仍消费流（后续条目照常解析）", async () => {
	const tar = buildTar([
		{ path: "eratw-sub-modding-develop", type: "dir" },
		{ path: "eratw-sub-modding-develop/skip.bin", content: "A".repeat(5000) },
		{ path: "eratw-sub-modding-develop/keep.txt", content: "kept" },
	])
	const { stats, files } = await collect(tar, { filter: (entry) => entry.path.endsWith(".txt") })

	assert.deepEqual([...files.keys()], ["keep.txt"])
	assert.equal(stats.skipped, 1)
})

test("分片边界：1 字节一片也能正确解析", async () => {
	const tar = buildTar([
		{ path: "eratw-sub-modding-develop", type: "dir" },
		{ path: "eratw-sub-modding-develop/x.txt", content: "0123456789" },
	])
	const files = new Map<string, string>()
	await extractTar(chunked(tar, 1), {
		onFile: (entry, chunk) => {
			files.set(entry.path, (files.get(entry.path) ?? "") + chunk.toString("utf8"))
		},
	})
	assert.equal(files.get("x.txt"), "0123456789")
})

test("真实 gzip 流：gunzip 后交给解析器", async () => {
	const tar = buildTar([
		{ path: "eratw-sub-modding-develop", type: "dir" },
		{ path: "eratw-sub-modding-develop/ERB/SYSTEM.ERB", content: "#FUNCTION SYSTEM_TITLE\n#END" },
	])
	const gz = gzipSync(tar)
	const gunzip = createGunzip()
	Readable.from([gz]).pipe(gunzip)

	const files = new Map<string, string>()
	await extractTar(gunzip, {
		onFile: (entry, chunk) => {
			files.set(entry.path, (files.get(entry.path) ?? "") + chunk.toString("utf8"))
		},
	})
	assert.equal(files.get("ERB/SYSTEM.ERB"), "#FUNCTION SYSTEM_TITLE\n#END")
})

test("目录条目带尾部斜杠时也能探测前缀（GitLab 归档的真实形态）", async () => {
	const tar = buildTar([
		{ path: "eratw-sub-modding-develop-CSV/", type: "dir" },
		{ path: "eratw-sub-modding-develop-CSV/CSV/Abl.csv", content: "a,b" },
	])
	const { stats, files } = await collect(tar)

	assert.equal(stats.prefix, "eratw-sub-modding-develop-CSV")
	assert.deepEqual([...files.keys()], ["CSV/Abl.csv"])
	assert.deepEqual(stats.rejected, [])
})

test("normalizeEntryPath：绝对路径与空路径一律拒绝", () => {
	assert.equal(normalizeEntryPath("/etc/passwd"), null)
	assert.equal(normalizeEntryPath("C:/windows/x"), null)
	assert.equal(normalizeEntryPath("./"), null)
	assert.equal(normalizeEntryPath("a//b"), null)
	assert.equal(normalizeEntryPath("./ERB/a.ERB"), "ERB/a.ERB")
	assert.equal(normalizeEntryPath("ERB/口上/a.ERB"), "ERB/口上/a.ERB")
})

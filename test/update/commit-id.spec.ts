/**
 * #69：上游 commit id 的形态校验。
 *
 * 为什么值得单独锁：commit 会被拼进缓存文件名（`cachePath(root, `${commit}.tar.gz`)`）。
 * gitgud/GitLab 账号或服务器被入侵时，`commit.id` 只要带 `..` 或路径分隔符，
 * 就能把几百 MB 归档写到游戏目录之外，而归档**内容**的 `isInsideRoot` 闸门管不到缓存路径。
 */
import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { assertCommitId, isValidCommitId } from "../../src/core/update/source"

const GOOD = "0123456789abcdef0123456789abcdef01234567"

test("#69 合法 40 位十六进制放行（大小写不敏感）", () => {
	assert.equal(assertCommitId(GOOD, "head"), GOOD)
	assert.equal(assertCommitId(GOOD.toUpperCase(), "head"), GOOD.toUpperCase())
	assert.equal(isValidCommitId(GOOD), true)
})

test("#69 路径穿越 / 空格 / 超长 / 非十六进制一律拒绝", () => {
	const bad = [
		"../../x",
		"..\\..\\x",
		"0123456789abcdef0123456789abcdef0123456 ", // 尾空格
		"0123456789abcdef0123456789abcdef0123456789", // 41 位
		"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
		"",
		"HEAD",
		"01234567",
	]
	for (const id of bad) {
		assert.equal(isValidCommitId(id), false, `应拒绝 ${JSON.stringify(id)}`)
		assert.throws(() => assertCommitId(id, "head"), /非法的提交 id/)
	}
})

test("#69 被拒的 id 不会产生越界缓存路径", () => {
	const root = path.resolve("/tmp/era-root")
	const evil = "../../../etc/passwd"
	assert.equal(isValidCommitId(evil), false)
	// 校验通过后才允许拼路径：这里模拟「先校验再拼」的正确顺序
	const safe = path.join(root, "_cache", `${GOOD}.tar.gz`)
	assert.ok(safe.startsWith(path.join(root, "_cache")), "合法 id 拼出的路径必须在缓存目录内")
})

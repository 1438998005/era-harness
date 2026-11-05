import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

/**
 * 元测试（2026-11-04，08 #227 的防同类回归）。
 *
 * `test/update/run.mjs` 的 SPECS 是**硬编码文件清单**，不是通配符：新增 spec 忘了登记，
 * `npm run test:update` 会静默漏跑且依旧「全绿」（KB 04 §4.22 坑一，已复发三次）。
 * 这里让测试自己守门：磁盘上的每个 *.spec.ts 都必须在 SPECS 里，反之亦然。
 * 本文件自己也登记在 SPECS 中（自举），新增 spec 未登记时它会先红。
 */

function updateDir(): string {
	const fromCwd = path.resolve(process.cwd(), "test", "update")
	if (fs.existsSync(path.join(fromCwd, "run.mjs"))) {
		return fromCwd
	}
	// 打包成 test/update/out/*.cjs 后 cwd 仍是仓库根，这里只是兜底
	return path.join(__dirname, "..")
}

function readRegisteredSpecs(): string[] {
	const source = fs.readFileSync(path.join(updateDir(), "run.mjs"), "utf8")
	const block = source.match(/const SPECS = \[([\s\S]*?)\n\]/)
	assert.ok(block, "没找到 run.mjs 的 SPECS 清单（改名或改成通配符时请同步更新本测试）")
	return [...block[1].matchAll(/"([^"]+\.spec\.ts)"/g)].map((match) => match[1])
}

describe("test:update 的 spec 清单完整性（防静默漏跑）", () => {
	it("磁盘上每个 *.spec.ts 都登记在 SPECS", () => {
		const files = fs
			.readdirSync(updateDir())
			.filter((name) => name.endsWith(".spec.ts"))
			.sort()
		const registered = new Set(readRegisteredSpecs())
		const missing = files.filter((name) => !registered.has(name))
		assert.deepEqual(missing, [], `这些 spec 没登记进 run.mjs 的 SPECS，npm run test:update 会漏跑：${missing.join(", ")}`)
	})

	it("SPECS 里每个条目都对应真实存在的文件", () => {
		const missing = readRegisteredSpecs().filter((name) => !fs.existsSync(path.join(updateDir(), name)))
		assert.deepEqual(missing, [], `SPECS 里登记了不存在的文件：${missing.join(", ")}`)
	})

	it("SPECS 没有重复登记", () => {
		const registered = readRegisteredSpecs()
		assert.equal(new Set(registered).size, registered.length, "重复登记会让同一 spec 被跑两遍")
	})
})

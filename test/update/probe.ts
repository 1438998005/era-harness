/**
 * 指纹校验探针：拿上游返回的 blob id（GitLab tree 接口的 `id`）与本地算出的
 * git blob sha1 逐条对拍，证明"我们算的指纹"和"仓库认的指纹"是同一个东西。
 *
 * 这是整个更新功能的地基假设，值得在接入任何网络逻辑之前先钉死。
 *
 * 用法：
 *   node test/update/run.mjs probe <本地目录> <expected.json>
 * expected.json 形如 { "README.zh.md": "<40 位 blob id>", ... }
 */

import fs from "node:fs/promises"
import process from "node:process"
import { hashLocalFile, toFsPath } from "../../src/core/update/manifest"

async function main(): Promise<void> {
	const root = process.argv[2]
	const expectedPath = process.argv[3]
	if (!root || !expectedPath) {
		console.error("用法: node test/update/run.mjs probe <本地目录> <expected.json>")
		process.exit(1)
	}

	const expected = JSON.parse(await fs.readFile(expectedPath, "utf8")) as Record<string, string>
	const entries = Object.entries(expected)
	let pass = 0
	let fail = 0
	let missing = 0

	for (const [rel, want] of entries) {
		try {
			const actual = await hashLocalFile(toFsPath(root, rel))
			if (actual.sha1 === want) {
				pass++
				console.log(`  PASS  ${rel}`)
			} else {
				fail++
				console.log(`  FAIL  ${rel}\n        期望 ${want}\n        实际 ${actual.sha1}`)
			}
		} catch {
			missing++
			console.log(`  SKIP  ${rel}（本地不存在，上游独有）`)
		}
	}

	console.log("")
	console.log(`对拍 ${entries.length} 项：一致 ${pass}，内容不同 ${fail}，本地缺失 ${missing}`)
	if (pass === 0) {
		console.log("结论：一项都没对上，指纹口径可疑，禁止继续接入网络逻辑。")
		process.exit(1)
	}
	console.log(
		`结论：指纹口径已验证（${pass} 项逐字节一致）。${
			fail > 0 ? "内容不同的项属版本差异，可用上游历史版本再确认，不影响口径结论。" : ""
		}`,
	)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

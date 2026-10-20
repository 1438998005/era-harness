/**
 * 更新源探针：查分支头 commit、提交时间、上游 NOW_VERSION。
 * 用来验证"检查更新"这一步（2 个请求、<2s）在真实仓库上是否成立。
 *
 * 用法：
 *   node test/update/run.mjs head [仓库地址] [分支]
 */

import process from "node:process"
import { createGitLabSource, DEFAULT_BRANCH, DEFAULT_PROJECT_URL, parseProjectUrl } from "../../src/core/update/source"

async function main(): Promise<void> {
	const url = process.argv[2] ?? DEFAULT_PROJECT_URL
	const branch = process.argv[3] ?? DEFAULT_BRANCH
	const project = parseProjectUrl(url, branch)
	const source = createGitLabSource(project)

	console.log(`仓库: ${project.host}/${project.path}`)
	console.log(`分支: ${project.branch}`)
	console.log(`归档地址: ${source.archiveUrl()}`)

	const started = Date.now()
	const head = await source.head()
	const elapsed = Date.now() - started

	console.log("")
	console.log(`commit      : ${head.commit}`)
	console.log(`提交时间    : ${head.committedAt}`)
	console.log(`NOW_VERSION : ${head.nowVersion ?? "（未读到）"}`)
	console.log(`耗时        : ${elapsed}ms`)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

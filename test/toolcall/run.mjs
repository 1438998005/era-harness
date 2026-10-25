// era harness —— 工具调用解析层的自动化测试/调试运行器（零新增依赖，复用 esbuild）。
//
// 为什么需要它：过去只能靠用户手测 + 截图来验证工具调用 bug，反馈回路极慢。
// 解析层（parseAssistantMessageV2 / normalizeLeakedToolMarkup / decodeCommandEntities）
// 是纯函数、不依赖 vscode，可用 esbuild 打包后直接用 node 跑，从而让 AI 自己 debug。
//
// 用法：
//   node test/toolcall/run.mjs                # 跑回归测试（fixtures.json）
//   node test/toolcall/run.mjs replay <path>  # 把某个真实任务的 api_conversation_history.json 过一遍解析器并打印

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..", "..")
const outDir = path.join(__dirname, "out")

// 与 esbuild.mjs 一致的别名解析（测试专用最小版）。
const aliasResolverPlugin = {
	name: "alias-resolver",
	setup(build) {
		const aliases = {
			"@": path.join(repoRoot, "src"),
			"@core": path.join(repoRoot, "src", "core"),
			"@integrations": path.join(repoRoot, "src", "integrations"),
			"@services": path.join(repoRoot, "src", "services"),
			"@shared": path.join(repoRoot, "src", "shared"),
			"@utils": path.join(repoRoot, "src", "utils"),
			"@packages": path.join(repoRoot, "src", "packages"),
		}
		for (const [alias, aliasPath] of Object.entries(aliases)) {
			const aliasRegex = new RegExp(`^${alias}($|/.*)`)
			build.onResolve({ filter: aliasRegex }, (args) => {
				const importPath = args.path.replace(alias, aliasPath)
				if (fs.existsSync(importPath) && !fs.statSync(importPath).isDirectory()) {
					return { path: importPath }
				}
				if (fs.existsSync(importPath)) {
					for (const ext of [".ts", ".tsx", ".js"]) {
						const idx = path.join(importPath, `index${ext}`)
						if (fs.existsSync(idx)) return { path: idx }
					}
				}
				for (const ext of [".ts", ".tsx", ".js"]) {
					const p = `${importPath}${ext}`
					if (fs.existsSync(p)) return { path: p }
				}
				return { path: importPath }
			})
		}
	},
}

async function bundle(entry, outfile) {
	await esbuild.build({
		entryPoints: [path.join(__dirname, entry)],
		outfile,
		bundle: true,
		platform: "node",
		format: "cjs",
		target: "node20",
		logLevel: "silent",
		tsconfig: path.join(repoRoot, "tsconfig.json"),
		external: ["vscode"],
		plugins: [aliasResolverPlugin],
	})
}

function runNode(args) {
	const res = spawnSync(process.execPath, args, { stdio: "inherit", cwd: repoRoot })
	process.exit(res.status ?? 1)
}

async function main() {
	fs.mkdirSync(outDir, { recursive: true })
	const mode = process.argv[2]

	if (mode === "replay") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/toolcall/run.mjs replay <api_conversation_history.json 或 task 目录>")
			process.exit(1)
		}
		await bundle("replay.ts", path.join(outDir, "replay.cjs"))
		runNode([path.join(outDir, "replay.cjs"), target])
		return
	}

	await bundle("parse.spec.ts", path.join(outDir, "parse.spec.cjs"))
	await bundle("stream.spec.ts", path.join(outDir, "stream.spec.cjs"))
	runNode(["--test", path.join(outDir, "parse.spec.cjs"), path.join(outDir, "stream.spec.cjs")])
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

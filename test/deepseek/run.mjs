// era harness —— DeepSeek 请求侧纯判定单元测试 runner（零新增依赖，复用 esbuild + node:test）。
// 与 test/free/run.mjs 同一模式：esbuild 打包 spec.ts（带别名解析 + vscode external）后 node --test。
// 运行：npm run test:deepseek
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

async function main() {
	fs.mkdirSync(outDir, { recursive: true })
	await bundle("spec.ts", path.join(outDir, "spec.cjs"))
	const res = spawnSync(process.execPath, ["--test", path.join(outDir, "spec.cjs")], {
		stdio: "inherit",
		cwd: repoRoot,
	})
	process.exit(res.status ?? 1)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

/**
 * eratw 一键更新 —— 测试/调试运行器（零新增依赖，复用 esbuild）。
 *
 * 用法：
 *   node test/update/run.mjs                  # 跑判定表回归测试
 *   node test/update/run.mjs dryrun <游戏目录>  # 只扫本地，打印批量识别结果（不联网、不写盘）
 *
 * dryrun 的用途：在没有基线、没有下载的情况下，先验证"mtime 批量识别"这套
 * 首次同步判定在真实游戏目录上是否成立 —— 这是整个更新功能的第一道硬证据。
 */

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..", "..")
const outDir = path.join(__dirname, "out")

/** 默认模式下要跑的全部测试文件 */
const SPECS = [
	"update.spec.ts",
	"tarball.spec.ts",
	"emptyfile.spec.ts",
	"discover.spec.ts",
	"profile.spec.ts",
	"apply.spec.ts",
	"plan-drift.spec.ts",
	"service.spec.ts",
	"gates.spec.ts",
	"gates-g158.spec.ts",
	"version.spec.ts",
	"labels.spec.ts",
	"merge.spec.ts",
	"mergeResolve.spec.ts",
	"mergeProvider.spec.ts",
	"mergeWorkbench.spec.ts",
	"describe.spec.ts",
	"reference.spec.ts",
	"game-runner.spec.ts",
	"shell-notice.spec.ts",
	"reasoning-support.spec.ts",
	"global-memory.spec.ts",
	"version-check.spec.ts",
	"download.spec.ts",
	"loop-detection.spec.ts",
	"audit-redaction.spec.ts",
	"mimo-model.spec.ts",
	"model-id.spec.ts",
	"error-text.spec.ts",
	"open-folder.spec.ts",
	"era-domain-prompt.spec.ts",
]

const aliasResolverPlugin = {
	name: "alias-resolver",
	setup(build) {
		const aliases = {
			"@": path.join(repoRoot, "src"),
			"@core": path.join(repoRoot, "src", "core"),
			"@eraharness": path.join(repoRoot, "packages", "era-harness-core", "src"),
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
				// 依次试：原样 → 加扩展名 → 目录下的 index（`@core/api` 就是目录）
				const candidates = [importPath]
				for (const ext of [".ts", ".tsx", ".js"]) {
					candidates.push(`${importPath}${ext}`)
				}
				for (const ext of [".ts", ".tsx", ".js"]) {
					candidates.push(path.join(importPath, `index${ext}`))
				}
				for (const candidate of candidates) {
					if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
						return { path: candidate }
					}
				}
				return { path: importPath }
			})
		}
	},
}

/** 把 `vscode` 模块解析到替身，让插件代码能在命令行里跑 */
const vscodeStubPlugin = {
	name: "vscode-stub",
	setup(build) {
		build.onResolve({ filter: /^vscode$/ }, () => ({ path: path.join(__dirname, "vscode-stub.cjs") }))
	},
}

async function bundle(entry, outfile, opts = {}) {
	await esbuild.build({
		entryPoints: [path.join(__dirname, entry)],
		outfile,
		bundle: true,
		platform: "node",
		format: "cjs",
		target: "node20",
		logLevel: "silent",
		tsconfig: path.join(repoRoot, "tsconfig.json"),
		external: opts.stubVscode ? [] : ["vscode"],
		plugins: opts.stubVscode ? [vscodeStubPlugin, aliasResolverPlugin] : [aliasResolverPlugin],
	})
}

function runNode(args) {
	const res = spawnSync(process.execPath, args, { stdio: "inherit", cwd: repoRoot })
	process.exit(res.status ?? 1)
}

async function main() {
	fs.mkdirSync(outDir, { recursive: true })
	const mode = process.argv[2]

	if (mode === "dryrun") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs dryrun <游戏目录>")
			process.exit(1)
		}
		await bundle("dryrun.ts", path.join(outDir, "dryrun.cjs"))
		runNode([path.join(outDir, "dryrun.cjs"), target])
		return
	}

	if (mode === "verifyplan") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs verifyplan <游戏目录>")
			process.exit(1)
		}
		await bundle("verify-plan.ts", path.join(outDir, "verifyplan.cjs"))
		runNode([path.join(outDir, "verifyplan.cjs"), target])
		return
	}

	if (mode === "probe") {
		const target = process.argv[3]
		const expected = process.argv[4]
		if (!target || !expected) {
			console.error("用法: node test/update/run.mjs probe <本地目录> <expected.json>")
			process.exit(1)
		}
		await bundle("probe.ts", path.join(outDir, "probe.cjs"))
		runNode([path.join(outDir, "probe.cjs"), target, expected])
		return
	}

	if (mode === "snapshot") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs snapshot <归档.tar.gz | 目录> [要显示的路径]")
			process.exit(1)
		}
		await bundle("snapshot.ts", path.join(outDir, "snapshot.cjs"))
		runNode([path.join(outDir, "snapshot.cjs"), target, ...process.argv.slice(4)])
		return
	}

	if (mode === "discover") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs discover <工作区目录>")
			process.exit(1)
		}
		await bundle("find-roots.ts", path.join(outDir, "find-roots.cjs"))
		runNode([path.join(outDir, "find-roots.cjs"), target])
		return
	}

	if (mode === "head") {
		await bundle("head.ts", path.join(outDir, "head.cjs"))
		runNode([path.join(outDir, "head.cjs"), ...process.argv.slice(3)])
		return
	}

	if (mode === "mergeprobe") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs mergeprobe <游戏目录> [文件数上限]")
			process.exit(1)
		}
		await bundle("merge-probe.ts", path.join(outDir, "merge-probe.cjs"))
		runNode([path.join(outDir, "merge-probe.cjs"), ...process.argv.slice(3)])
		return
	}

	if (mode === "plugin") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs plugin <游戏目录> [--apply]")
			process.exit(1)
		}
		await bundle("plugin-flow.ts", path.join(outDir, "plugin-flow.cjs"), { stubVscode: true })
		runNode([path.join(outDir, "plugin-flow.cjs"), ...process.argv.slice(3)])
		return
	}

	if (mode === "rollback") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs rollback <游戏目录> [备份目录]")
			process.exit(1)
		}
		await bundle("rollback.ts", path.join(outDir, "rollback.cjs"))
		runNode([path.join(outDir, "rollback.cjs"), ...process.argv.slice(3)])
		return
	}

	if (mode === "live") {
		const target = process.argv[3]
		if (!target) {
			console.error("用法: node test/update/run.mjs live <游戏目录> [--apply]")
			process.exit(1)
		}
		await bundle("live.ts", path.join(outDir, "live.cjs"))
		runNode([path.join(outDir, "live.cjs"), ...process.argv.slice(3)])
		return
	}

	await Promise.all(SPECS.map((spec) => bundle(spec, path.join(outDir, spec.replace(/\.ts$/, ".cjs")))))
	runNode(["--test", ...SPECS.map((spec) => path.join(outDir, spec.replace(/\.ts$/, ".cjs")))])
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

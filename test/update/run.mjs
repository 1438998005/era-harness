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
	"canonical.spec.ts",
	"plan-canon.spec.ts",
	"baseline-trust.spec.ts",
	"service-trust.spec.ts",
	"conflictPolicy.spec.ts",
	"history-base.spec.ts",
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
	"merge-model.spec.ts",
	"describe.spec.ts",
	"reference.spec.ts",
	"game-runner.spec.ts",
	"clidebug.spec.ts",
	"project-profile-prune.spec.ts",
	"shell-notice.spec.ts",
	"reasoning-support.spec.ts",
	"global-memory.spec.ts",
	"memory-gating.spec.ts",
	"display-clean-reasoning.spec.ts",
	"glm-family.spec.ts",
	"version-check.spec.ts",
	"download.spec.ts",
	"loop-detection.spec.ts",
	"read-turn-dedupe.spec.ts",
	"task-progress-threshold.spec.ts",
	"request-fingerprint.spec.ts",
	"audit-redaction.spec.ts",
	"mimo-model.spec.ts",
	"bigmodel-model.spec.ts",
	"bigmodel-plan.spec.ts",
	"bigmodel-error.spec.ts",
	"context-budget.spec.ts",
	"commit-id.spec.ts",
	"model-id.spec.ts",
	"error-text.spec.ts",
	"open-folder.spec.ts",
	"era-domain-prompt.spec.ts",
	"era-write-guard.spec.ts",
	"era-identity-harness-dir.spec.ts",
	"gamekb-prompt.spec.ts",
	"gamekb-manifest.spec.ts",
	"gamekb-index.spec.ts",
	"gamekb-build-lifecycle.spec.ts",
	"task-busy.spec.ts",
	"erabasic-owner.spec.ts",
	"subagent-budget.spec.ts",
	"subagent-wiring.spec.ts",
	"subagents-availability.spec.ts",
	"subagent-command-guard.spec.ts",
	"run-game-approval.spec.ts",
	"merge-task-restore.spec.ts",
	"webview-input-guard.spec.ts",
	"apply-patch-guard.spec.ts",
	"hardening-guards.spec.ts",
	"hardening2-guards.spec.ts",
	// 08 批（#107 / #108 / #173–#181）
	"auto-condense.spec.ts",
	"knowledge-base-ui.spec.ts",
	"update-session.spec.ts",
	"update-progress.spec.ts",
	"ask-race.spec.ts",
	"diagnostics-and-retry.spec.ts",
	"enhance-prompt.spec.ts",
	"explorer-add-to-chat.spec.ts",
	// 2026-11-04 四项合并批次（Kimi / 独立辅助模型 / 解析器 / 品牌）：
	// ⚠️ 本列表是硬编码的，新增 test/update/*.spec.ts 必须在这里登记，
	// 否则 `npm run test:update` 会静默漏跑（上一批两个 spec 就是这样没进全套的）。
	"aux-model.spec.ts",
	"moonshot-provider.spec.ts",
	// 2026-11-04 晚未提交内容复审的跨层回归
	"review-bugfix.spec.ts",
	// 防同类：spec 清单自守门 + proto 转换路径对称（新增字段只补一侧会红）
	"spec-registry.spec.ts",
	"settings-conversion-symmetry.spec.ts",
	// 2026-11-05 review 修复：辅助配置「清空 = 显式删除」的真实存储往返（#230）
	"aux-clear.spec.ts",
	// #231：provider 组件的 i18n key 必须能从真实 locale 解析（防 namespace 双层前缀 + 假绿测试）
	"settings-i18n-keys.spec.ts",
	// #233：ModelInfo proto 类型映射三方一致（proto 文本 ↔ 映射表 ↔ 手写转换清单）
	"model-info-proto-mapping.spec.ts",
	// 2026-11-06 第七批 BUG 修复（KB 08 #243–#247）
	// #245 单源 mistake 计数 + #246 合法工具参数与正文独立段的统计口径分离
	"task-loop-repair.spec.ts",
	// #247 连续同因流式失败：跨实例计数 / 升级提示 / 审计与诊断包可见 / 守住 #242
	"stream-error-streak.spec.ts",
	// 2026-11-08：OpenRouter 免费模型清单（列表切换）的数据契约与 grpc 接线
	"openrouter-free-models.spec.ts",
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

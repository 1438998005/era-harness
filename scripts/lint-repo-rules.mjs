#!/usr/bin/env node
/**
 * 把原先只写在提示词里、模型却反复犯的仓库规则做成检查。
 *
 * 1. 本机绝对路径（Windows 用户目录，占位名除外；另读 gitignore 的本机片段文件）
 * 2. 在允许文件之外调用 getConfiguration().update（会改用户的编辑器设置）
 * 3. package.json、package-lock.json 两处版本、CHANGELOG.md 最上方版本标题三者一致
 *
 * 用法：
 *   node scripts/lint-repo-rules.mjs              全库（npm run lint）
 *   node scripts/lint-repo-rules.mjs --staged       仅暂存区（pre-commit）
 *   node scripts/lint-repo-rules.mjs --self-test    只跑样例
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SELF_REL = "scripts/lint-repo-rules.mjs"
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md", ".json", ".css", ".scss", ".ps1", ".sh"])
const SETTINGS_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const SETTINGS_ALLOW = new Set(["src/hosts/vscode/erabasic/index.ts"])
const LOCKFILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"])
const VERSION_FILES = ["package.json", "package-lock.json", "CHANGELOG.md"]

/**
 * Windows 用户目录（占位：username / user / {user} / x / 用户名）不命中。
 * 不扫 POSIX `/Users/...` 上游示例。本机特有的目录片段放 gitignore 的
 * scripts/lint-private-paths.json（字符串数组），不进公开仓库。
 */
export const MACHINE_PATH = new RegExp(
	[
		"[A-Za-z]:[\\\\/]Users[\\\\/](?!",
		"username(?:[\\\\/]|$)|user(?:[\\\\/]|$)|\\{user\\}(?:[\\\\/]|$)|x(?:[\\\\/]|$)|",
		"用户名(?:[\\\\/]|$|[，。、`；：）])",
		")[^\\\\/'\"`\\s，。、`；：）]+",
	].join(""),
)
const PRIVATE_PATHS_FILE = "scripts/lint-private-paths.json"

export const SETTINGS_WRITE = /getConfiguration\s*\([\s\S]{0,240}?\)\s*\.update\s*\(/

export function stripComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function normalize(rel) {
	return rel.replaceAll("\\", "/")
}

function extensionOf(rel) {
	const base = rel.slice(rel.lastIndexOf("/") + 1)
	const dot = base.lastIndexOf(".")
	return dot >= 0 ? base.slice(dot) : ""
}

function lineOf(source, index) {
	return source.slice(0, index).split("\n").length
}

function git(args, options = {}) {
	return spawnSync("git", args, {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		...options,
	})
}

function trackedFiles() {
	const result = git(["ls-files", "-z"])
	if (result.status !== 0) {
		throw new Error((result.stderr || "git ls-files 失败").trim())
	}
	return (result.stdout ?? "")
		.split("\0")
		.filter((rel) => rel.length > 0)
		.map(normalize)
}

function stagedPaths() {
	const result = git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"])
	if (result.status !== 0) {
		throw new Error((result.stderr || "git diff --cached 失败").trim())
	}
	return (result.stdout ?? "")
		.split("\0")
		.filter((rel) => rel.length > 0)
		.map(normalize)
}

function readAtCommit(rel, rev) {
	const result = git(["show", `${rev}:${rel}`])
	if (result.status !== 0) {
		return null
	}
	return result.stdout ?? ""
}

function readStagedBlob(rel) {
	const result = git(["show", `:${rel}`])
	if (result.status !== 0) {
		return null
	}
	return result.stdout ?? ""
}

/** 本次提交里该路径的有效内容：暂存优先，否则 HEAD */
function effectiveText(rel, stagedSet) {
	if (stagedSet.has(rel)) {
		return readStagedBlob(rel)
	}
	return readAtCommit(rel, "HEAD")
}

export function checkVersionsFromSources(pkgText, lockText, changelogText) {
	const problems = []
	if (pkgText == null || lockText == null || changelogText == null) {
		problems.push("版本核对缺少 package.json / package-lock.json / CHANGELOG.md 之一（未跟踪或读盘失败）")
		return problems
	}
	const pkg = JSON.parse(pkgText)
	const lock = JSON.parse(lockText)
	const version = pkg.version
	if (lock.version !== version) {
		problems.push(`package-lock.json 顶部 version 是 ${lock.version}，package.json 是 ${version}`)
	}
	const nested = lock.packages?.[""]?.version
	if (nested !== version) {
		problems.push(`package-lock.json 的 packages[""].version 是 ${nested}，package.json 是 ${version}`)
	}
	const heading = /^## (\d+\.\d+\.\d+)\b/m.exec(changelogText)
	if (!heading) {
		problems.push("CHANGELOG.md 没有 ## x.y.z 标题")
	} else if (heading[1] !== version) {
		problems.push(`CHANGELOG.md 最上方的版本是 ${heading[1]}，package.json 是 ${version}`)
	}
	return problems
}

export function checkVersions(root = ROOT) {
	return checkVersionsFromSources(
		fs.readFileSync(path.join(root, "package.json"), "utf8"),
		fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
		fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"),
	)
}

function loadPrivateFragments() {
	const file = path.join(ROOT, PRIVATE_PATHS_FILE)
	if (!fs.existsSync(file)) {
		return []
	}
	const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
	if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || item.length === 0)) {
		throw new Error(`${PRIVATE_PATHS_FILE} 必须是非空字符串数组`)
	}
	return parsed
}

function firstPrivateIndex(source, fragments) {
	let index = -1
	for (const fragment of fragments) {
		const at = source.indexOf(fragment)
		if (at >= 0 && (index < 0 || at < index)) {
			index = at
		}
	}
	return index
}

function shouldScanContent(rel) {
	if (rel === SELF_REL) {
		return false
	}
	const base = rel.slice(rel.lastIndexOf("/") + 1).toLowerCase()
	if (LOCKFILES.has(base)) {
		return false
	}
	if (rel.includes("/generated/") || rel.includes("/src/shared/proto/") || rel.includes("/reference/data/")) {
		return false
	}
	return TEXT_EXT.has(extensionOf(rel))
}

function scanSource(rel, source, privateFragments) {
	const problems = []
	const pathMatch = MACHINE_PATH.exec(source)
	const privateAt = pathMatch ? -1 : firstPrivateIndex(source, privateFragments)
	if (pathMatch || privateAt >= 0) {
		problems.push(
			`${rel}:${lineOf(source, pathMatch ? pathMatch.index : privateAt)} 写了本机绝对路径。仓内用相对路径，或写成 $EMUERA_WS/<相对路径>。`,
		)
	}
	if (!SETTINGS_EXT.has(extensionOf(rel)) || SETTINGS_ALLOW.has(rel)) {
		return problems
	}
	const code = stripComments(source)
	const writeMatch = SETTINGS_WRITE.exec(code)
	if (writeMatch) {
		problems.push(
			`${rel}:${lineOf(code, writeMatch.index)} 调用了 getConfiguration().update。用户编辑器设置只允许写在 src/hosts/vscode/erabasic/index.ts（用户点命令之后）。扩展自己的状态写 state-manager 或 .era-harness/。`,
		)
	}
	return problems
}

function scanTracked() {
	const problems = []
	const privateFragments = loadPrivateFragments()
	for (const rel of trackedFiles()) {
		if (!shouldScanContent(rel)) {
			continue
		}
		const source = fs.readFileSync(path.join(ROOT, rel), "utf8")
		problems.push(...scanSource(rel, source, privateFragments))
	}
	problems.push(...checkVersions())
	return problems
}

function scanStaged() {
	const stagedSet = new Set(stagedPaths())
	const privateFragments = loadPrivateFragments()
	const problems = []
	for (const rel of stagedSet) {
		if (!shouldScanContent(rel)) {
			continue
		}
		const source = readStagedBlob(rel)
		if (source == null) {
			continue
		}
		problems.push(...scanSource(rel, source, privateFragments))
	}
	const touchesVersion = VERSION_FILES.some((file) => stagedSet.has(file))
	if (touchesVersion) {
		problems.push(
			...checkVersionsFromSources(
				effectiveText("package.json", stagedSet),
				effectiveText("package-lock.json", stagedSet),
				effectiveText("CHANGELOG.md", stagedSet),
			),
		)
	}
	return problems
}

function selfTest() {
	const assert = (cond, message) => {
		if (!cond) {
			throw new Error(message)
		}
	}
	assert(MACHINE_PATH.test("C:\\Users\\Alice\\AppData"), "真实 Windows 用户目录要命中")
	assert(firstPrivateIndex("keep-SamplePrivate-token", ["SamplePrivate"]) >= 0, "本地片段按字面量命中")
	assert(!MACHINE_PATH.test("C:\\Users\\username\\.cline"), "文档里的 username 形状不命中")
	assert(!MACHINE_PATH.test("C:\\Users\\用户名\\AppData"), "中文占位 用户名 不命中")
	assert(!MACHINE_PATH.test("C:\\Users\\用户名，含中文"), "文档里的 用户名 占位（后跟标点）不命中")
	assert(!MACHINE_PATH.test("C:/Users/x/secret.md"), "测试用的占位 x 不命中")
	assert(!MACHINE_PATH.test("/Users/saoud/Repositories/test"), "POSIX /Users 示例不命中")
	assert(!MACHINE_PATH.test("sha512-not-a-windows-profile"), "没有用户目录的字符串不命中")
	const sample = `const x = 1\n// getConfiguration("files")${".update"}("associations", {}, 1)\nvoid x\n`
	assert(!SETTINGS_WRITE.test(stripComments(sample)), "注释里的设置写入不命中")
	const gcfg = 'vscode.workspace.getConfiguration("files")'
	const upd = `${".update"}("associations", {}, 1)`
	assert(SETTINGS_WRITE.test(gcfg + upd), "真正的设置写入要命中")
	const selfSource = fs.readFileSync(path.join(ROOT, SELF_REL), "utf8")
	assert(!MACHINE_PATH.test(selfSource), "本脚本源码不得命中路径规则（样例须拆开写）")
	assert(!SETTINGS_WRITE.test(stripComments(selfSource)), "本脚本源码不得命中设置写入规则（样例须拆开写）")
}

const args = new Set(process.argv.slice(2))
const selfOnly = args.has("--self-test")
const stagedMode = args.has("--staged")

try {
	selfTest()
	if (selfOnly) {
		console.log("lint-repo-rules: 样例通过")
		process.exit(0)
	}
	const problems = stagedMode ? scanStaged() : scanTracked()
	if (problems.length === 0) {
		process.exit(0)
	}
	console.error(problems.join("\n"))
	process.exit(1)
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error))
	process.exit(1)
}

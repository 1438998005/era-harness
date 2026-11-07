#!/usr/bin/env node
/**
 * 拦住新出现的、超过 20KB 的源码文件。
 *
 * 模型读不完这种体积，改的时候容易漏改或整篇重写。报错要求按功能拆开。
 * lockfile、生成物、以及模型不会去读的数据文件直接跳过。
 *
 * HEAD 里已经超过 20KB 的旧文件仍允许提交：这个仓库从 Cline fork 来，
 * 一次拆完会把正常提交冻住。新文件、或从 20KB 以下长过线的文件会被拒绝。
 *
 * 用法：
 *   node scripts/check-code-file-size.mjs --staged     提交钩子：看暂存区
 *   node scripts/check-code-file-size.mjs --worktree   看工作区里已跟踪的文件
 *   node scripts/check-code-file-size.mjs --self-test  只跑判定用例
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const LIMIT_BYTES = 20 * 1024

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".cts", ".mts", ".css", ".scss"])
const LOCKFILES = new Set([
	"package-lock.json",
	"npm-shrinkwrap.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"bun.lock",
	"bun.lockb",
	"cargo.lock",
	"composer.lock",
	"gemfile.lock",
	"poetry.lock",
	"go.sum",
])
const SKIP_SEGMENTS = [
	"/node_modules/",
	"/dist/",
	"/dist-standalone/",
	"/generated/",
	"/src/shared/proto/",
	"/webview-ui/build/",
	"/reference/data/",
	"/out/",
]

export function normalizeRel(rel) {
	return rel.replaceAll("\\", "/")
}

export function isCheckedCodeFile(rel) {
	const normalized = normalizeRel(rel)
	const base = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase()
	if (LOCKFILES.has(base)) {
		return false
	}
	if (/\.generated\.(tsx?|jsx?)$/.test(base)) {
		return false
	}
	if (base.endsWith(".min.js") || base.endsWith(".min.css") || base.endsWith(".map") || base.endsWith(".snap")) {
		return false
	}
	if (normalized === "webview-ui/src/services/grpc-client.ts") {
		return false
	}
	const padded = `/${normalized}`
	if (SKIP_SEGMENTS.some((segment) => padded.includes(segment))) {
		return false
	}
	const dot = base.lastIndexOf(".")
	return dot >= 0 && CODE_EXT.has(base.slice(dot))
}

/** @returns {"ok" | "grandfather" | "too-big"} */
export function judgeFileSize(headBytes, nextBytes, limit = LIMIT_BYTES) {
	if (nextBytes <= limit) {
		return "ok"
	}
	if (headBytes != null && headBytes > limit) {
		return "grandfather"
	}
	return "too-big"
}

export function formatTooBig(relPath, bytes) {
	const kb = (bytes / 1024).toFixed(1)
	return [
		`${relPath} 有 ${kb} KB，超过 20KB。`,
		"模型读不完这种体积的源码，改起来容易漏改或整篇重写。",
		"请按功能拆成多个文件，每个文件只做一件事，再提交。",
	].join("\n")
}

function git(args, input) {
	return spawnSync("git", args, {
		cwd: ROOT,
		encoding: "utf8",
		input,
		maxBuffer: 64 * 1024 * 1024,
	})
}

function batchSizes(specs) {
	const sizes = new Map()
	if (specs.length === 0) {
		return sizes
	}
	const result = git(["cat-file", "--batch-check"], `${specs.join("\n")}\n`)
	if (result.error) {
		throw new Error(`git cat-file 起不来：${result.error.message}`)
	}
	const lines = (result.stdout ?? "").split(/\n/)
	specs.forEach((spec, index) => {
		const line = lines[index] ?? ""
		const match = / (\d+)$/.exec(line)
		sizes.set(spec, line.endsWith("missing") || !match ? null : Number(match[1]))
	})
	return sizes
}

function parseNameStatus(raw) {
	const parts = raw.split("\0").filter((part) => part.length > 0)
	const files = []
	for (let index = 0; index < parts.length; ) {
		const status = parts[index++]
		const code = status[0]
		if (code === "R" || code === "C") {
			const headPath = parts[index++]
			const nextPath = parts[index++]
			files.push({ path: nextPath, headPath })
		} else {
			const nextPath = parts[index++]
			files.push({ path: nextPath, headPath: code === "A" ? null : nextPath })
		}
	}
	return files
}

function stagedTargets() {
	const result = git(["diff", "--cached", "-z", "--name-status", "--diff-filter=ACMR"])
	if (result.status !== 0) {
		throw new Error((result.stderr || "git diff --cached 失败").trim())
	}
	return parseNameStatus(result.stdout ?? "").filter((file) => isCheckedCodeFile(file.path))
}

function worktreeTargets() {
	const result = git(["ls-files", "-z"])
	if (result.status !== 0) {
		throw new Error((result.stderr || "git ls-files 失败").trim())
	}
	return (result.stdout ?? "")
		.split("\0")
		.filter((rel) => rel.length > 0 && isCheckedCodeFile(rel))
		.map((rel) => ({ path: rel, headPath: rel }))
}

function nextBytes(target, mode) {
	if (mode === "staged") {
		return null
	}
	const absolute = path.join(ROOT, target.path)
	if (!fs.existsSync(absolute)) {
		return null
	}
	return fs.statSync(absolute).size
}

function collectProblems(mode) {
	const targets = mode === "staged" ? stagedTargets() : worktreeTargets()
	const headSpecs = []
	const indexSpecs = []
	for (const target of targets) {
		if (target.headPath) {
			headSpecs.push(`HEAD:${target.headPath}`)
		}
		if (mode === "staged") {
			indexSpecs.push(`:${target.path}`)
		}
	}
	const headSizes = batchSizes(headSpecs)
	const indexSizes = batchSizes(indexSpecs)
	const problems = []
	for (const target of targets) {
		const stagedOrDisk = mode === "staged" ? indexSizes.get(`:${target.path}`) : nextBytes(target, mode)
		if (stagedOrDisk == null) {
			continue
		}
		const head = target.headPath ? headSizes.get(`HEAD:${target.headPath}`) : null
		if (judgeFileSize(head ?? null, stagedOrDisk) === "too-big") {
			problems.push(formatTooBig(normalizeRel(target.path), stagedOrDisk))
		}
	}
	return problems
}

function selfTest() {
	const assert = (cond, message) => {
		if (!cond) {
			throw new Error(message)
		}
	}
	assert(judgeFileSize(null, LIMIT_BYTES) === "ok", "刚好 20KB 应该放行")
	assert(judgeFileSize(null, LIMIT_BYTES + 1) === "too-big", "新文件超过 20KB 应该拒绝")
	assert(judgeFileSize(1000, LIMIT_BYTES + 1) === "too-big", "从限额以下长过线应该拒绝")
	assert(judgeFileSize(LIMIT_BYTES + 10, LIMIT_BYTES + 500) === "grandfather", "HEAD 里已经超限的旧文件应该放行")
	assert(isCheckedCodeFile("src/foo.ts") === true, "ts 源码要检查")
	assert(isCheckedCodeFile("package-lock.json") === false, "lockfile 跳过")
	assert(isCheckedCodeFile("src/generated/a.ts") === false, "生成目录跳过")
	assert(isCheckedCodeFile("src/shared/proto/cline/state.ts") === false, "proto 生成物跳过")
	assert(isCheckedCodeFile("src/settings/data/features.generated.ts") === false, "*.generated.ts 跳过")
	assert(isCheckedCodeFile("webview-ui/src/services/grpc-client.ts") === false, "protobus 生成客户端跳过")
	assert(isCheckedCodeFile("packages/era-harness-core/src/reference/data/meta.json") === false, "指令数据跳过")
	assert(formatTooBig("src/a.ts", 30 * 1024).includes("按功能拆"), "报错要提示按功能拆分")
}

const args = new Set(process.argv.slice(2))
if (args.has("--self-test")) {
	selfTest()
	console.log("check-code-file-size: 判定用例通过")
	process.exit(0)
}

const mode = args.has("--worktree") ? "worktree" : args.has("--staged") ? "staged" : null
if (!mode) {
	console.error("用法：node scripts/check-code-file-size.mjs --staged | --worktree | --self-test")
	process.exit(2)
}

try {
	selfTest()
	const problems = collectProblems(mode)
	if (problems.length === 0) {
		process.exit(0)
	}
	console.error(problems.join("\n\n"))
	process.exit(1)
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error))
	process.exit(1)
}

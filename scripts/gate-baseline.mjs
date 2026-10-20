#!/usr/bin/env node
/**
 * 验收基线现算器。
 *
 * 为什么要有它：AGENTS.md / project_rules.md 里的「103 例」「229/229」是手抄的，
 * 每加一批用例就过期一次（2026-10-21 就抓到 209 与 229 差了 20 例没人发现）。
 * ⇒ 文档只写「跑这条命令」，数字由这里现算。
 *
 * 用法（仓根）：
 *   node scripts/gate-baseline.mjs            跑三条快闸门（核心库测试 / 核心库 typecheck / 更新闸门）
 *   node scripts/gate-baseline.mjs --compile  再带上根 npm run compile（protos＋biome＋esbuild，慢）
 *   node scripts/gate-baseline.mjs --json     机器可读输出（挂 CI 或写台账用）
 *
 * 退出码：全绿 0；任一闸门红或未跑成 1（⛔ 把「没跑」当「过了」）。
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CORE = path.join(ROOT, "packages", "era-harness-core")
/** Windows 上 npm/npx 是 .cmd，Node ≥18.20 不带 shell 直接 spawn 会 EINVAL */
const USE_SHELL = process.platform === "win32"
const NPM = "npm"

const flags = process.argv.slice(2)
const withCompile = flags.includes("--compile")
const asJson = flags.includes("--json")

function run(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		shell: USE_SHELL,
	})
	return {
		code: result.status ?? 1,
		out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
		spawnError: result.error ? String(result.error.message ?? result.error) : null,
	}
}

/** node:test 的 TAP 汇总行（`# tests 103` 这种）；拿不到就返回 null，由调用方标「未跑成」 */
function tapNumbers(out) {
	const grab = (key) => {
		const match = new RegExp(`^# ${key} (\\d+\\s*)$`, "m").exec(out)
		return match ? Number.parseInt(match[1].trim(), 10) : null
	}
	return { tests: grab("tests"), pass: grab("pass"), fail: grab("fail"), skipped: grab("skipped") }
}

function firstFailureLines(out, limit = 6) {
	return out
		.split(/\r?\n/)
		.filter((line) => /^not ok|error TS|npm error|\bFAILED\b/.test(line.trim()))
		.slice(0, limit)
}

const gates = []

function push(name, detail, status, problems) {
	gates.push({ name, detail, status, ...(problems && problems.length > 0 ? { problems } : {}) })
}

// 0) 用例登记核对（两处清单都是**显式文件列表**，不是 glob —— 漏登记＝新用例根本不会被跑，
//    而且测试仍然全绿，比红了更坏。实证踩过两次：核心库 package.json、test/update/run.mjs）
{
	const problems = []
	const coreDir = path.join(CORE, "test")
	const coreScript = JSON.parse(fs.readFileSync(path.join(CORE, "package.json"), "utf8")).scripts.test ?? ""
	const listed = new Set((coreScript.match(/test\/[\w.-]+\.test\.ts/g) ?? []).map((token) => token.slice("test/".length)))
	const onDisk = fs.readdirSync(coreDir).filter((name) => name.endsWith(".test.ts"))
	for (const name of onDisk) {
		if (!listed.has(name)) {
			problems.push(`核心库 test/${name} 未登记进 package.json 的 test 脚本`)
		}
	}
	const runMjs = fs.readFileSync(path.join(ROOT, "test/update/run.mjs"), "utf8")
	const specs = new Set((runMjs.match(/"[\w.-]+\.spec\.ts"/g) ?? []).map((token) => token.replaceAll('"', "")))
	for (const name of fs.readdirSync(path.join(ROOT, "test/update")).filter((file) => file.endsWith(".spec.ts"))) {
		if (!specs.has(name)) {
			problems.push(`test/update/${name} 未登记进 run.mjs 的 SPECS`)
		}
	}
	push(
		"用例登记核对",
		problems.length === 0 ? `${onDisk.length} + ${specs.size} 全部在册` : `${problems.length} 个用例文件在册外`,
		problems.length === 0 ? "green" : "red",
		problems,
	)
}

// 1) 内嵌知识候选池体检（候选⇄条目⇄NOTICE⇄常驻档位，四处一致性）
{
	const result = run(process.execPath, ["scripts/check-knowledge-pool.mjs"], ROOT)
	const lines = result.out.split(/\r?\n/).filter((line) => /^(❌|⬜)/.test(line))
	const ok = result.code === 0
	push(
		"知识候选池核对",
		ok ? "四处一致" : `${lines.filter((line) => line.startsWith("❌")).length} 项不一致`,
		ok ? "green" : "red",
		ok ? null : lines,
	)
}

// 2) 核心库测试（用例数会随批次变，这就是它不该手抄的原因）
{
	const result = run(NPM, ["test"], CORE)
	const n = tapNumbers(result.out)
	const ok = result.code === 0 && n.fail === 0 && n.tests !== null
	const detail =
		n.tests === null
			? "没跑成（拿不到 TAP 汇总）"
			: `${n.tests} 例＝${n.pass ?? "?"} 过／${n.skipped ?? 0} 跳过／${n.fail ?? "?"} 败`
	push("核心库 npm test", detail, ok ? "green" : "red", ok ? null : firstFailureLines(result.out))
}

// 2) 核心库 typecheck（零运行时依赖的纯 Node 库，编译期就是它的契约面）
{
	const result = run(NPM, ["run", "typecheck"], CORE)
	const errors = (result.out.match(/error TS\d+/g) ?? []).length
	const ok = result.code === 0 && errors === 0
	push(
		"核心库 npm run typecheck",
		ok ? "0 错" : `${errors} 处 error TS`,
		ok ? "green" : "red",
		ok ? null : firstFailureLines(result.out),
	)
}

// 3) 更新闸门回归（test/update/run.mjs 的 SPECS 是显式清单，新 spec 不登记就不会被跑）
{
	const result = run(process.execPath, ["test/update/run.mjs"], ROOT)
	const n = tapNumbers(result.out)
	const ok = result.code === 0 && n.fail === 0 && n.tests !== null
	const detail = n.tests === null ? "没跑成（拿不到 TAP 汇总）" : `${n.pass ?? 0}/${n.tests} 过`
	push("node test/update/run.mjs", detail, ok ? "green" : "red", ok ? null : firstFailureLines(result.out))
}

// 4) 全量 compile（默认不跑：protos＋biome＋esbuild 要几分钟）
if (withCompile) {
	const result = run(NPM, ["run", "compile"], ROOT)
	const ok = result.code === 0
	push(
		"npm run compile",
		ok ? "EXIT=0" : `EXIT=${result.code}`,
		ok ? "green" : "red",
		ok ? null : firstFailureLines(result.out),
	)
} else {
	push("npm run compile", "未跑（加 --compile 才跑）", "skipped")
}

/** 本机日期（toISOString 是 UTC，凌晨会算成前一天——台账日期必须跟本机一致） */
function localDate() {
	return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const allGreen = gates.every((gate) => gate.status !== "red")

if (asJson) {
	console.log(JSON.stringify({ generatedAt: new Date().toISOString(), allGreen, gates }, null, 2))
} else {
	console.log(`验收基线（现算 ${localDate()}）`)
	for (const gate of gates) {
		const mark = gate.status === "green" ? "✅" : gate.status === "skipped" ? "⬜" : "❌"
		console.log(`${mark} ${gate.name.padEnd(26, " ")} ${gate.detail}`)
		for (const problem of gate.problems ?? []) {
			console.log(`   · ${problem}`)
		}
	}
	console.log(allGreen ? "全绿＝可以提交；文档里的数字请以此为唯一口径，⛔ 手抄。" : "有红闸门，先修再提交。")
}

process.exit(allGreen ? 0 : 1)

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

/**
 * node:test 的汇总行。Node ≤22 在管道里输出 TAP（`# tests 103`），
 * Node 24 的默认 reporter 输出 `ℹ tests 103` —— 两种都要认，
 * 否则 gate 在 Node 24 上永远报「没跑成（拿不到 TAP 汇总）」，而测试其实是绿的。
 */
function tapNumbers(out) {
	const grab = (key) => {
		const match = new RegExp(`^(?:#|ℹ)\\s*${key}\\s+(\\d+)\\s*$`, "m").exec(out)
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

// 1b) 设置目录完整性：proto 里每个「使用者可设置」字段，必须 ∈ 生成目录 ∪ 未收录白名单。
//     为什么要这道门：新增一个设置项却没人写说明时，模型会对着一半的设置说「不知道」；
//     要么补 overrides / 生成源，要么在黑名单里写一句「为什么不收录」——两者都不做就红灯。
{
	const problems = []
	const settingsDataDir = path.join(CORE, "src", "settings", "data")
	const featureSrc = fs.readFileSync(path.join(settingsDataDir, "features.generated.ts"), "utf8")
	const vscodeSrc = fs.readFileSync(path.join(settingsDataDir, "vscode-config.generated.ts"), "utf8")
	const autoSrc = fs.readFileSync(path.join(settingsDataDir, "auto-approval.generated.ts"), "utf8")
	const overridesSrc = fs.readFileSync(path.join(settingsDataDir, "overrides.ts"), "utf8")

	// 目录能覆盖的键：`key:` 本身、`state-key:<stateKey>`、`nested:<父键>.<子键>`
	const catalogKeys = new Set()
	const storageTargets = new Set()
	for (const source of [featureSrc, vscodeSrc, autoSrc]) {
		for (const match of source.matchAll(/^\s*key: '([A-Za-z0-9_.-]+)'/gm)) {
			catalogKeys.add(match[1])
		}
		for (const match of source.matchAll(/storage: '(?:state-key|nested):([A-Za-z0-9_.]+)'/g)) {
			storageTargets.add(match[1].split(".")[0])
		}
	}
	const catalogCount = catalogKeys.size

	/** 从 `export const NAME: Record<...> = {...}` 里抽一层键（同文件里都是 2 空格缩进的平铺表） */
	const flatKeys = (name) => {
		const block = new RegExp(`export const ${name}[\\s\\S]*?\\n\\};`).exec(overridesSrc)?.[0] ?? ""
		return new Set([...block.matchAll(/^\s{1,4}([A-Za-z_]\w*):/gm)].map((match) => match[1]))
	}
	const uncovered = flatKeys("UNCOVERED_SETTINGS")
	const aliases = new Map()
	for (const match of (/export const SETTING_KEY_ALIASES[\s\S]*?\n\};/.exec(overridesSrc)?.[0] ?? "").matchAll(
		/^\s{1,4}([A-Za-z_]\w*):\s*'([^']+)'/gm,
	)) {
		aliases.set(match[1], match[2])
	}

	const proto = fs.readFileSync(path.join(ROOT, "proto", "cline", "state.proto"), "utf8")
	const messageBlock = /message UpdateSettingsRequest \{([\s\S]*?)\n\}/.exec(proto)?.[1] ?? ""
	const fields = [...messageBlock.matchAll(/^\s*(?:repeated\s+)?[A-Za-z0-9_<>., ]+\s+([a-z][A-Za-z0-9_]*)\s*=\s*\d+;/gm)].map(
		(match) => match[1],
	)
	/** proto 用 snake_case，state-keys 用 camelCase */
	const camel = (name) => name.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())

	let missing = 0
	if (fields.length === 0) {
		problems.push("没能从 proto/cline/state.proto 解析出 UpdateSettingsRequest 字段（布局变了？）")
	} else {
		for (const field of fields) {
			// 先查别名表（proto 名与设置键不同名的历史残留），再查目录两种命名
			const viaAlias = aliases.get(field)
			const inCatalog = catalogKeys.has(viaAlias ?? "") || storageTargets.has(camel(field))
			if (!inCatalog && !uncovered.has(field)) {
				missing++
				problems.push(`设置项 ${field} 既不在目录也不在 UNCOVERED_SETTINGS（补说明或写一句为什么不收录）`)
			}
		}
	}

	const attributed = fields.length - missing
	const percent = fields.length === 0 ? 0 : Math.round((attributed / fields.length) * 100)
	push(
		"设置目录完整性",
		`${attributed}/${fields.length} 字段有归属（${percent}%）＝目录 ${catalogCount} 项 ＋ 白名单 ${uncovered.size} 项`,
		problems.length === 0 ? "green" : "red",
		problems,
	)
}

// 1c) 生成物新鲜度：改了 FeatureSettingsSection / locales / state-keys / package.json 却没重跑生成器，
//     模型就会按旧文案回答（比报错更坏：答得像真的）。
{
	const result = run(NPM, ["run", "build:settings", "--", "--check"], CORE)
	const ok = result.code === 0
	push(
		"设置目录生成物新鲜度",
		ok ? "与源码一致" : "过期（重跑 npm run build:settings）",
		ok ? "green" : "red",
		ok
			? null
			: result.out
					.split(/\r?\n/)
					.filter((line) => line.trim().length > 0)
					.slice(-6),
	)
}

// 1d) 工具登记完整性：12 个 prompt 变体少登记一个，该变体下模型永远看不到这个工具，
//     而测试照样全绿（AGENTS.md §1 规则 4 的坑）。
{
	const problems = []
	const variantsDir = path.join(ROOT, "src", "core", "prompts", "system-prompt", "variants")
	const variants = fs.readdirSync(variantsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
	for (const variant of variants) {
		const configPath = path.join(variantsDir, variant.name, "config.ts")
		if (!fs.readFileSync(configPath, "utf8").includes("ClineDefaultTool.SETTING_HELP")) {
			problems.push(`variants/${variant.name}/config.ts 没登记 setting_help`)
		}
	}
	const toolsSrc = fs.readFileSync(path.join(ROOT, "src", "shared", "tools.ts"), "utf8")
	if (!/READ_ONLY_TOOLS[\s\S]*?ClineDefaultTool\.SETTING_HELP/.test(toolsSrc)) {
		problems.push("src/shared/tools.ts 的 READ_ONLY_TOOLS 没加 SETTING_HELP")
	}
	push(
		"工具登记完整性",
		problems.length === 0 ? `${variants.length} 个变体 ＋ READ_ONLY_TOOLS 全部在册` : `${problems.length} 处漏登记`,
		problems.length === 0 ? "green" : "red",
		problems,
	)
}

// 1e) 语言归属声明：`.erb/.erh` 必须由 contributes.languages.extensions 静态声明。
//     为什么：早期版本靠**运行时给用户 settings.json 写 files.associations** 来接管，
//     扩展被禁用/卸载后那个关联还在、语言 id 却没了 ⇒ .erb 直接变纯文本，比不装还糟
//     （2026-10-21 用户反馈，已改回标准做法）。本道门锁住两件事：
//       · 后缀声明存在（否则又要回去写用户配置）；
//       · 自愈逻辑在（升级用户的旧脏值得能被清掉）。
{
	const problems = []
	const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))
	const languages = pkg.contributes?.languages ?? []
	const eraErb = languages.find((entry) => entry.id === "era-erb")
	if (!eraErb) {
		problems.push("package.json 没有 contributes.languages[id=era-erb]")
	} else {
		const declared = new Set(eraErb.extensions ?? [])
		for (const ext of [".erb", ".erh"]) {
			if (!declared.has(ext)) {
				problems.push(`languages[era-erb].extensions 缺少 ${ext}（否则只能靠改用户 files.associations 接管）`)
			}
		}
	}

	const hostSrc = fs.readFileSync(path.join(ROOT, "src/hosts/vscode/erabasic/index.ts"), "utf8")
	if (hostSrc.includes("syncAssociations")) {
		problems.push("src/hosts/vscode/erabasic/index.ts 又出现了 syncAssociations（自动写用户设置，正是那个 bug）")
	}
	if (!hostSrc.includes("healLegacyAssociations")) {
		problems.push("src/hosts/vscode/erabasic/index.ts 缺少 healLegacyAssociations（旧脏值无法自愈）")
	}

	push(
		"语言归属声明",
		problems.length === 0 ? ".erb/.erh 由 languages.extensions 声明，零自动写入" : `${problems.length} 处回归`,
		problems.length === 0 ? "green" : "red",
		problems,
	)
}

// 1f) 自动批准映射：调了 shouldAutoApproveToolWithPath 的原生工具，必须在 autoApprove.ts 里映射。
//     不映射 → switch 落到 return false → 用户把「自动批准」的选项勾满也仍然每次弹人工确认。
//     （2026-10-21 实测：era_knowledge 就是这个问题，用户以为权限全开就什么都不用点。）
{
	const problems = []
	const handlersDir = path.join(ROOT, "src/core/task/tools/handlers")
	const autoSrc = fs.readFileSync(path.join(ROOT, "src/core/task/tools/autoApprove.ts"), "utf8")
	// 有意保持人工确认的工具：会弹游戏窗口、让引擎重写自己的文件
	const INTENTIONALLY_MANUAL = new Set(["RUN_GAME"])
	const checked = []
	for (const file of fs.readdirSync(handlersDir)) {
		if (!file.endsWith(".ts")) continue
		const text = fs.readFileSync(path.join(handlersDir, file), "utf8")
		if (!text.includes("shouldAutoApproveToolWithPath")) continue
		// 显式传了别的工具名（如 summarize_task 借 FILE_READ）就不归本文件管
		if (text.includes("shouldAutoApproveToolWithPath(ClineDefaultTool.")) continue
		const nameMatch = /readonly name = ClineDefaultTool\.(\w+)/.exec(text)
		if (!nameMatch) continue
		const tool = nameMatch[1]
		if (INTENTIONALLY_MANUAL.has(tool)) continue
		checked.push(tool)
		if (!autoSrc.includes(`ClineDefaultTool.${tool}`)) {
			problems.push(`${file} 的 ${tool} 在 autoApprove.ts 没有映射（勾满自动批准也会弹确认）`)
		}
	}
	push(
		"自动批准映射",
		problems.length === 0 ? `${checked.length} 个工具都有映射` : `${problems.length} 个未映射`,
		problems.length === 0 ? "green" : "red",
		problems,
	)
}

// 1g) 命令注册一致性：package.json 声明 ⇄ menus 引用 ⇄ registerCommand 注册，三处必须对得上。
//     实测踩过：reviewComment.reply / addToChat 在 package.json 里声明成 era-harness.*，
//     代码却还注册着 fork 前的 cline-chinese.*（改名没改全）——评论区按钮点了只报
//     "command not found"，而 tsc / lint / 测试全绿（没有一处检查字符串 id）。
{
	const problems = []
	const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))
	const declared = new Set((pkg.contributes?.commands ?? []).map((command) => command.command))
	const registrySrc = fs.readFileSync(path.join(ROOT, "src/registry.ts"), "utf8")
	const constToId = new Map()
	for (const match of registrySrc.matchAll(/(\w+):\s*prefix\s*\+\s*"\.([\w.-]+)"/g)) {
		constToId.set(match[1], `${pkg.name}.${match[2]}`)
	}
	// 内部命令：只由代码 / 编辑器 CodeAction / 菜单调用，不需要命令面板条目
	const INTERNAL_ONLY = new Set([`${pkg.name}.worktreesButtonClicked`, `${pkg.name}.fixWithCline`])

	const files = []
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (["node_modules", "dist", "generated"].includes(entry.name)) continue
				walk(path.join(dir, entry.name))
			} else if (entry.name.endsWith(".ts")) {
				files.push(path.join(dir, entry.name))
			}
		}
	}
	walk(path.join(ROOT, "src"))

	const registered = new Map()
	for (const file of files) {
		const text = fs.readFileSync(file, "utf8")
		for (const match of text.matchAll(/registerCommand\(\s*"([\w.-]+)"/g)) {
			registered.set(match[1], file)
		}
		for (const match of text.matchAll(/registerCommand\(\s*commands\.(\w+)/g)) {
			const id = constToId.get(match[1])
			if (id) registered.set(id, file)
		}
	}

	for (const id of declared) {
		if (!registered.has(id)) {
			problems.push(`package.json 声明了但全仓没有 registerCommand：${id}`)
		}
	}
	for (const [id, file] of registered) {
		if (!id.startsWith(`${pkg.name}.`) || declared.has(id) || INTERNAL_ONLY.has(id)) {
			continue
		}
		problems.push(`registerCommand 注册了但 package.json 没声明：${id}（${path.relative(ROOT, file)}）`)
	}

	// 设置页按钮 → runCommand 的白名单：写错一个 id 就变成点了没反应，且不报错
	const runCmdSrc = fs.readFileSync(path.join(ROOT, "src/core/controller/ui/runCommand.ts"), "utf8")
	const allowBlock = /ALLOWED_COMMANDS\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/.exec(runCmdSrc)?.[1] ?? ""
	for (const match of allowBlock.matchAll(/"([\w.-]+)"/g)) {
		if (!declared.has(match[1])) {
			problems.push(`runCommand 白名单引用了未声明的命令：${match[1]}`)
		}
	}

	push(
		"命令注册一致性",
		problems.length === 0 ? `${declared.size} 条声明全部有注册` : `${problems.length} 处不一致`,
		problems.length === 0 ? "green" : "red",
		problems,
	)
}

// 1h) 分发边界：`.vscodeignore` 是**显式黑名单**，漏一个文件名就等于把开发资料发给用户。
//     实证：AGENTS.md（仓库协作说明）从 3.86 一路被打进 vsix 到 3.89.1 才被发现；
//     本地审计日志 `*-out.txt` 也差点跟着进去（`*.log` 已排，txt 没有）。
{
	const problems = []
	const ignoreRaw = fs.readFileSync(path.join(ROOT, ".vscodeignore"), "utf8")
	const patterns = ignoreRaw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!"))
	const isIgnored = (name) =>
		patterns.some((pattern) => {
			if (pattern === name) return true
			const star = pattern.indexOf("*")
			if (star < 0) return false
			const before = pattern.slice(0, star)
			const after = pattern.slice(star + 1)
			return name.startsWith(before) && name.endsWith(after)
		})

	for (const mustIgnore of ["AGENTS.md"]) {
		if (!isIgnored(mustIgnore)) {
			problems.push(`${mustIgnore} 没被 .vscodeignore 排除：会随 vsix 发给用户`)
		}
	}
	// 根目录的零散文本文件：排除 LICENSE.txt（vsce 自动生成）与忽略规则已覆盖的
	for (const name of fs.readdirSync(ROOT)) {
		if (!name.endsWith(".txt") || name === "LICENSE.txt") continue
		if (!isIgnored(name)) problems.push(`根目录 ${name} 会进 vsix（删掉或写进 .vscodeignore）`)
	}

	push(
		"分发边界",
		problems.length === 0 ? "AGENTS.md 与本地日志不随包分发" : `${problems.length} 个文件会混进 vsix`,
		problems.length === 0 ? "green" : "red",
		problems,
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

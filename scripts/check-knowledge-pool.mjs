#!/usr/bin/env node
/**
 * 内嵌知识库「候选池」体检（T1.2 持续机制的闸门）。
 *
 * 治的是三类静默漂移：
 * 1. 加了条目却没在候选池/NOTICE 登记 ⇒ 溯源断链（`era_knowledge` 照样能查到，看不出问题）；
 * 2. 候选池写着「常驻」、代码里 `injectedKnowledgeIds` 却没这条（或反之）⇒ 档位口径与实现分家；
 * 3. 候选的三要素（正本在不在／面多大／会不会很快过期）漏填 ⇒ 下一轮又得重新调研一遍。
 *
 * 用法：node scripts/check-knowledge-pool.mjs [--json]
 * 退出码：有问题 1；正本仓（shared-trae）拿不到时相关检查**如实标注未核**，⛔ 当通过。
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CORE = path.join(ROOT, "packages", "era-harness-core")
const POOL_FILE = path.join(CORE, "knowledge-candidates.json")
const DATA_DIR = path.join(CORE, "src", "knowledge", "data")
const INDEX_FILE = path.join(DATA_DIR, "index.ts")
const NOTICE_FILE = path.join(CORE, "NOTICE-knowledge-sources.md")
const DOMAIN_FILE = path.join(ROOT, "src", "core", "prompts", "system-prompt", "components", "era_domain.ts")

const STATUSES = new Set(["landed", "deferred", "candidate", "dropped"])
const problems = []
const unchecked = []

/** 集群枢纽仓：默认按 era-harness 的兄弟目录定位，跨机器用环境变量指路（⛔ 写死绝对路径） */
function resolveSharedTrae(pool) {
	const fromEnv = process.env.SHARED_TRAE_PATH
	const candidate = fromEnv ?? path.resolve(ROOT, pool?.sharedTrae?.defaultRelative ?? "../shared-trae")
	return fs.existsSync(path.join(candidate, "knowledge")) ? candidate : null
}

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"))
	} catch (error) {
		problems.push(`读不到或解析失败：${path.relative(ROOT, file)}（${String(error?.message ?? error)}）`)
		return null
	}
}

const pool = readJson(POOL_FILE)
/**
 * 在册条目＝(文件, id) 对。⚠️ 文件名与条目 id 可以不同
 * （`encoding-discipline.ts` 的 id 是 `interpreter-encoding-discipline`），所以 id 必须从文件里读。
 */
const entryFiles = fs.existsSync(DATA_DIR)
	? fs.readdirSync(DATA_DIR).filter((name) => name.endsWith(".ts") && name !== "index.ts")
	: []
const knownEntries = entryFiles
	.map((name) => {
		const text = fs.readFileSync(path.join(DATA_DIR, name), "utf8")
		const match = /^\s*id:\s*["']([^"']+)["']/m.exec(text)
		return { file: name.replace(/\.ts$/, ""), id: match?.[1] ?? "" }
	})
	.filter((item) => item.id)
const entryIds = knownEntries.map((item) => item.id)
const entryByFile = new Map(knownEntries.map((item) => [item.id, item.file]))
const indexText = fs.existsSync(INDEX_FILE) ? fs.readFileSync(INDEX_FILE, "utf8") : ""
const noticeText = fs.existsSync(NOTICE_FILE) ? fs.readFileSync(NOTICE_FILE, "utf8") : ""

if (pool) {
	if (!Array.isArray(pool.candidates) || pool.candidates.length === 0) {
		problems.push("候选池里没有任何候选（candidates 为空＝机制停摆）")
	}
	if (!Array.isArray(pool.judgement) || pool.judgement.length < 4) {
		problems.push("进产品判据应写满 4 条（稳定／可指回正本／不重叠／装得进一条）")
	}

	const trae = resolveSharedTrae(pool)
	if (!trae) {
		unchecked.push("拿不到 shared-trae 知识库 ⇒ 未核：候选 sources 的正本文件是否存在")
	}

	const seen = new Set()
	for (const item of pool.candidates ?? []) {
		const id = String(item?.id ?? "")
		if (!id) {
			problems.push("候选条目缺 id")
			continue
		}
		if (seen.has(id)) {
			problems.push(`候选 id 重复：${id}`)
		}
		seen.add(id)

		if (!STATUSES.has(item.status)) {
			problems.push(`${id}：status「${item.status}」不在 ${[...STATUSES].join("/")} 里`)
		}
		// 三要素——面多大 / 会不会过期，漏一项就意味着下一轮重新调研
		for (const field of ["surface", "stability", "verdict"]) {
			if (!String(item[field] ?? "").trim()) {
				problems.push(`${id}：缺 ${field}（候选必须写清面多大／会不会很快过期／为什么这么裁）`)
			}
		}
		if (item.status !== "landed" && !String(item.trigger ?? "").trim()) {
			problems.push(`${id}：暂缓/候选没写触发条件（什么时候重新评估）`)
		}
		if (!Array.isArray(item.sources) || item.sources.length === 0) {
			problems.push(`${id}：sources 为空 ⇒ 溯源断链`)
			continue
		}
		for (const source of item.sources) {
			if (trae && !fs.existsSync(path.join(trae, source))) {
				problems.push(`${id}：正本文件不存在 ${source}（在 ${trae} 下没找到）`)
			}
		}

		if (item.status === "landed") {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.landedAt ?? ""))) {
				problems.push(`${id}：已落地却没写 landedAt（YYYY-MM-DD）`)
			}
			const file = entryByFile.get(id)
			if (!file) {
				problems.push(`${id}：候选池记为 landed，但 src/knowledge/data/ 里没有声明该 id 的条目文件`)
			} else if (!indexText.includes(`./${file}.js`)) {
				problems.push(
					`${id}：条目文件 data/${file}.ts 在，却没登记进 data/index.ts（不会进 KNOWLEDGE_ENTRIES＝等于没内嵌）`,
				)
			}
			if (!noticeText.includes(`| \`${id}\` |`)) {
				problems.push(`${id}：缺 NOTICE 来源行（许可与正本边界断链）`)
			}
		}
	}

	// 反向：在册条目不要求进候选池（那是"待评估"清单），但**必须有 NOTICE 来源行**——否则随 vsix 分发却无正本
	for (const id of entryIds) {
		if (!noticeText.includes(`| \`${id}\` |`)) {
			problems.push(`在册条目 ${id} 缺 NOTICE 来源行（溯源断链）`)
		}
	}

	// 档位口径 ⇄ 代码：候选池声明的常驻清单必须与 era_domain.ts 的 injectedKnowledgeIds 一模一样
	const resident = pool.consumption?.resident ?? []
	for (const id of resident) {
		if (!entryIds.includes(id)) {
			problems.push(`常驻清单里的 ${id} 并不是在册条目（data/ 里没有声明该 id 的条目文件）`)
		}
	}
	if (fs.existsSync(DOMAIN_FILE)) {
		const domainText = fs.readFileSync(DOMAIN_FILE, "utf8")
		const match = /const injectedKnowledgeIds = new Set\(\[([^\]]*)\]\)/.exec(domainText)
		if (!match) {
			unchecked.push("era_domain.ts 里没找到 injectedKnowledgeIds 的字面量集合 ⇒ 未核：常驻档位是否与代码一致")
		} else {
			const inCode = match[1]
				.split(/,/)
				.map((token) => token.trim().replaceAll(/^["']|["']$/g, ""))
				.filter(Boolean)
				.sort()
			const onPool = [...resident].sort()
			if (inCode.join("|") !== onPool.join("|")) {
				problems.push(`常驻档位漂移：候选池 [${onPool.join(", ")}] ⇄ era_domain [${inCode.join(", ")}]`)
			}
		}
	} else {
		unchecked.push("未找到 era_domain.ts ⇒ 未核：常驻档位是否与代码一致")
	}
}

const ok = problems.length === 0
if (process.argv.includes("--json")) {
	console.log(
		JSON.stringify(
			{ ok, problems, unchecked, entries: entryIds, candidates: pool?.candidates?.map((c) => c.id) ?? [] },
			null,
			2,
		),
	)
} else {
	console.log(`候选池体检：${(pool?.candidates ?? []).length} 条候选／${entryIds.length} 条在册`)
	for (const problem of problems) {
		console.log(`❌ ${problem}`)
	}
	for (const note of unchecked) {
		console.log(`⬜ ${note}`)
	}
	if (ok) {
		console.log("✅ 候选池⇄条目⇄NOTICE⇄常驻档位四处一致")
	}
}
process.exit(ok ? 0 : 1)

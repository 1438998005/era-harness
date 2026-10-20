// era harness：把某个真实任务落盘的 api_conversation_history.json 逐回合过一遍解析器并打印，
// 用于「AI 亲自 debug」——不必再靠用户截图，指一个 task 目录就能看到解析结果。
// 运行：npm run replay:task -- "<task 目录或 api_conversation_history.json 路径>"
import fs from "node:fs"
import path from "node:path"
import { parseAssistantMessageV2 } from "@core/assistant-message"

type AnyBlock = { type: string; name?: string; params?: Record<string, string>; content?: string; partial?: boolean }

function resolveHistoryFile(arg: string): string {
	if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) {
		return path.join(arg, "api_conversation_history.json")
	}
	return arg
}

const arg = process.argv[2]
if (!arg) {
	console.error("用法: replay <task 目录 或 api_conversation_history.json>")
	process.exit(1)
}
const file = resolveHistoryFile(arg)
if (!fs.existsSync(file)) {
	console.error("找不到历史文件:", file)
	process.exit(1)
}

const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "")
const history = JSON.parse(raw) as Array<{ role: string; content: unknown }>

let turn = 0
for (const m of history) {
	if (m.role !== "assistant") continue
	turn++
	const texts: string[] = []
	const content = m.content
	if (typeof content === "string") {
		texts.push(content)
	} else if (Array.isArray(content)) {
		for (const b of content) {
			const bb = b as { type?: string; text?: string }
			if (bb && bb.type === "text" && typeof bb.text === "string") texts.push(bb.text)
		}
	}
	const joined = texts.join("")
	console.log(`\n===== assistant turn #${turn} (raw ${joined.length} chars) =====`)
	if (!joined.trim()) {
		console.log("(空文本回合)")
		continue
	}
	const blocks = parseAssistantMessageV2(joined) as AnyBlock[]
	const tools = blocks.filter((b) => b.type === "tool_use")
	const textBlocks = blocks.filter((b) => b.type === "text")
	const hasLeakedProgress = /<task_progress>/.test(joined)

	const text = textBlocks
		.map((b) => b.content || "")
		.join("")
		.trim()
	if (text) console.log(`[文本] ${JSON.stringify(text.slice(0, 160))}${text.length > 160 ? "…" : ""}`)

	if (tools.length === 0) {
		console.log(
			`[工具] 无（didToolUse=false）${hasLeakedProgress ? "  ⚠ 含独立 <task_progress>（应由 index.ts 路由到焦点链）" : ""}`,
		)
		continue
	}
	for (const tl of tools) {
		const params = tl.params || {}
		const summary = Object.entries(params)
			.map(([k, v]) => `${k}=${JSON.stringify((v || "").slice(0, 80))}${(v || "").length > 80 ? "…" : ""}`)
			.join(", ")
		console.log(`[工具] ${tl.name}${tl.partial ? " (partial)" : ""} { ${summary} }`)
	}
}

console.log(`\n共 ${turn} 个 assistant 回合`)

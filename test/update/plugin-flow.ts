/**
 * 插件流程验收 —— 直接调用**按钮真正执行的函数** `updateGameCommand()`。
 *
 *   node test/update/run.mjs plugin <游戏目录>            # 走到确认框就选「以后再说」
 *   node test/update/run.mjs plugin <游戏目录> --apply     # 一路走完（会真的更新）
 *
 * 与 `live` 的区别：`live` 是我自己拼的脚本，绕过了插件；
 * 这里走的是 `src/hosts/vscode/updateGame.ts` 的完整交互序列——
 * 找目录 → （多选）→ 确认弹窗 → 关进程检查 → 更新 → 结果弹窗 → （撤销按钮）。
 * 唯一的替身是 `vscode` 模块本身（无界面环境没有编辑器），业务代码一行没绕。
 */

import process from "node:process"
import { readNowVersion } from "../../src/core/update/discover"
import { updateGameCommand } from "../../src/hosts/vscode/updateGame"
import * as stubModule from "./vscode-stub.cjs"

interface DialogCall {
	kind: string
	message: string
	detail: string
	items: string[]
}

const stub = stubModule as any

function formatCall(call: DialogCall): string {
	const parts: string[] = []
	parts.push(`[${call.kind}] ${call.message}`)
	if (call.detail) {
		for (const line of call.detail.split("\n")) {
			parts.push(`        ${line}`)
		}
	}
	if (call.items.length > 0) {
		parts.push(`        按钮/选项: ${call.items.join(" | ")}`)
	}
	return parts.join("\n")
}

async function main(): Promise<void> {
	const root = process.argv[2]
	const apply = process.argv.includes("--apply")
	if (!root) {
		console.error("用法: node test/update/run.mjs plugin <游戏目录> [--apply]")
		process.exit(1)
	}

	const before = await readNowVersion(root)
	console.log(`游戏目录: ${root}`)
	console.log(`更新前版本: ${before ?? "未知"}`)
	console.log(`模式    : ${apply ? "走完整个流程（会真的更新）" : "只走到确认框"}`)
	console.log("")

	stub.__reset()
	// 模拟"用户用编辑器打开了游戏目录"——插件读 workspaceFolders[0]
	stub.__setWorkspaceFolders([root])
	// 多个候选时只勾选路径里含这个片段的那一个（用来测"多选"分支）
	const pickHint = process.env.ERA_PLUGIN_PICK
	stub.__setResponder((call: DialogCall) => {
		if (call.kind === "quickPick") {
			const pool = pickHint ? call.items.filter((label) => label.includes(pickHint)) : call.items
			// 没给提示时：勾掉副本，其余全选
			return pickHint ? pool : pool.filter((label) => !label.includes("$(copy)"))
		}
		if (call.items.includes("开始更新")) {
			return apply ? "开始更新" : "以后再说"
		}
		if (call.items.includes("撤销这次更新")) {
			return "知道了"
		}
		if (call.items.includes("我有压缩包")) {
			return "算了"
		}
		return undefined
	})

	await updateGameCommand()

	console.log("──────── 插件弹出的所有交互（按顺序） ────────")
	for (const call of stub.__calls()) {
		if (call.kind === "progress") {
			console.log(`[进度] ${call.message}`)
		} else if (call.kind === "progressStart") {
			console.log(`[进度开始] ${call.message}`)
		} else {
			console.log(formatCall(call))
		}
	}

	const after = await readNowVersion(root)
	console.log("")
	console.log(`更新后版本: ${after ?? "未知"}`)
	process.exit(after === before && apply ? 1 : 0)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})

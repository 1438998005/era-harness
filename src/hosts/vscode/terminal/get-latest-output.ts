import { readTextFromClipboard, writeTextToClipboard } from "@utils/env"
import * as vscode from "vscode"

/**
 * Gets the contents of the active terminal
 * @param terminal The terminal to capture. When provided, it is shown first so
 *   `workbench.action.terminal.selectAll` targets the right terminal instead of
 *   whichever terminal happens to be active.
 * @returns The terminal contents as a string
 */
export async function getLatestTerminalOutput(terminal?: vscode.Terminal): Promise<string> {
	// 读不到原剪贴板就无法在抓取后还原；继续下去会把终端内容（可能含密钥/路径）
	// 留在用户剪贴板里，因此直接视为“拿不到快照”，交给调用方走其它兜底。
	let originalClipboard: string
	try {
		originalClipboard = await readTextFromClipboard()
	} catch {
		return ""
	}

	const previousActiveTerminal = vscode.window.activeTerminal

	try {
		if (terminal && vscode.window.activeTerminal !== terminal) {
			// preserveFocus: keep the editor focused, but make this the active terminal
			// 本仓库固定的 vscode 类型里 show() 返回 void，不能 await；
			// activeTerminal 也不是同步生效的，靠下面的短暂等待兼顾
			terminal.show(true)
			await new Promise((resolve) => setTimeout(resolve, 50))
		}

		// Select terminal content
		await vscode.commands.executeCommand("workbench.action.terminal.selectAll")

		// Copy selection to clipboard
		await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

		// Clear the selection
		await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")

		// Get terminal contents from clipboard
		const terminalContentsRaw = (await readTextFromClipboard().catch(() => "")).trim()

		// Check if there's actually a terminal open
		if (!terminalContentsRaw || terminalContentsRaw === originalClipboard) {
			return ""
		}

		let terminalContents = terminalContentsRaw

		// Clean up command separation
		const lines = terminalContents.split("\n")
		const lastLine = lines.pop()?.trim()
		if (lastLine) {
			let i = lines.length - 1
			while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
				i--
			}
			terminalContents = lines.slice(Math.max(i, 0)).join("\n")
		}

		return terminalContents
	} finally {
		// 只要成功读到过原内容（包括空字符串）就必须还原，否则终端快照会残留在剪贴板
		await writeTextToClipboard(originalClipboard).catch(() => {})

		// 把活动终端还给用户原来那个，避免每次兜底都把终端面板切走
		if (previousActiveTerminal && vscode.window.activeTerminal !== previousActiveTerminal) {
			previousActiveTerminal.show(true)
		}
	}
}

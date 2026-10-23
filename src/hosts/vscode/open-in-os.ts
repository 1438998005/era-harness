/**
 * 在系统文件管理器里打开一个目录。
 *
 * 为什么不直接用 `vscode.env.openExternal(vscode.Uri.file(dir))`（2026-10-23 实测）：
 * VS Code 1.143.1 / Windows 上打开**目录**时，主进程 nativeHostMainService.openExternal
 * 底层 ShellExecute 返回 0x2（系统找不到指定的文件），用户只会看到一个裸的
 * 「打开外部程序时出错」对话框；而扩展侧**拿不到任何异常**——openExternal 失败时
 * 只是 resolve(false)，3.91.3 就是把这个 false 当成了成功，于是既没打开也没提示。
 *
 * 同一路径用 explorer.exe / cmd start 都能正常打开（该用户目录是 C:\Users\周远航，
 * 含中文；怀疑是 VS Code 原生层传路径时丢了编码），所以 Windows 上自己起 explorer：
 * 路径由 Node 以 UTF-16 传给 CreateProcess，不经过 VS Code 的 opener。
 *
 * 判据收在这里、只写一份：**只有确证打开了才算成功**。
 */
import { spawn } from "node:child_process"

/** 起后台进程并等它真的起来。返回 null = 起来了；返回字符串 = 失败原因。 */
export type SpawnDetached = (command: string, args: string[]) => Promise<string | null>

/** 对应 `vscode.env.openExternal`，返回它是否真的打开了。 */
export type OpenExternal = (dir: string) => Promise<boolean>

export interface OpenInOsDeps {
	platform: NodeJS.Platform
	spawnDetached: SpawnDetached
	openExternal: OpenExternal
}

/**
 * 返回 null 表示已成功打开；返回字符串表示失败原因（可直接给用户看）。
 *
 * ⚠️ `openExternal` 的 false 必须当成**失败**。它不抛错、只 resolve(false)，
 * 把它当成功就会退化成「界面毫无反应 + VS Code 自己弹一个裸错误框」。
 */
export async function openFolderInOs(dir: string, deps: OpenInOsDeps): Promise<string | null> {
	// Windows 先自己起 explorer；只有它起不来才退回 VS Code 的通道
	if (deps.platform === "win32" && !(await deps.spawnDetached("explorer.exe", [dir]))) {
		return null
	}

	try {
		const opened = await deps.openExternal(dir)
		return opened ? null : "系统没有打开这个目录（openExternal 返回 false）"
	} catch (error) {
		return error instanceof Error ? error.message : String(error)
	}
}

/** 组装真实依赖：Windows 用 explorer，其它平台交给 VS Code。 */
export function createOpenInOsDeps(openExternal: OpenExternal, platform: NodeJS.Platform = process.platform): OpenInOsDeps {
	return { platform, spawnDetached: spawnDetachedProcess, openExternal }
}

/**
 * 起一个不接管的进程。
 *
 * 只看 `spawn` 事件，**不看 exitCode**：explorer.exe 即使成功也常返回 1，
 * 拿退出码判成败会把正常打开误判成失败。
 */
export function spawnDetachedProcess(command: string, args: string[]): Promise<string | null> {
	return new Promise((resolve) => {
		let settled = false
		const done = (value: string | null) => {
			if (settled) {
				return
			}
			settled = true
			resolve(value)
		}
		try {
			const child = spawn(command, args, { detached: true, stdio: "ignore" })
			child.once("error", (error) => done(error.message))
			child.once("spawn", () => {
				child.unref()
				done(null)
			})
		} catch (error) {
			done(error instanceof Error ? error.message : String(error))
		}
	})
}

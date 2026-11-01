/**
 * 子代理只读命令守卫（#112）。
 *
 * 为什么需要它：`ToolResultUtils.askApprovalAndPushFeedback` 对子代理**直接返回 true**
 * （`config.isSubagentExecution` 分支），`ExecuteCommandToolHandler` 的 auto-approve 分支
 * 也在 `isSubagentExecution` 时短路。结果是：用户确认一次「用 3 个子代理」之后，
 * 每个子代理的每条命令都不再确认，可以后台跑 `curl … | sh`、`rm -rf`。
 *
 * 提示词里那句「Only use execute_command for readonly operations」是**软约束**——
 * 模型听话只是碰巧，不是边界。真正的边界放在这里。
 *
 * 设计取舍：
 * - **deny-by-default**：不在白名单里的命令一律拒，不做「猜测它可能安全」。
 * - **复用 `CommandPermissionController.getSegments`**：那套解析已经处理 `&& || | ;`、
 *   `$( )`、反引号、引号外换行、重定向，自写一个必被绕过。
 * - **纯函数、不 import vscode**：插件侧测试默认把 `vscode` 设为 external，
 *   带 vscode 依赖的模块进不了 `node --test`（见 `test/update/run.mjs:141`）。
 */

import { CommandPermissionController } from "./CommandPermissionController"

/**
 * 允许的命令。值 `"*"` 表示任意参数；数组表示「第一个子命令必须命中其中之一」。
 *
 * 只放**探索代码**真正需要的那批；写操作、网络、提权一律不在表内。
 */
export const SUBAGENT_READONLY_COMMANDS: Record<string, readonly string[] | "*"> = {
	// 目录与文件查看
	ls: "*",
	dir: "*",
	pwd: "*",
	cat: "*",
	head: "*",
	tail: "*",
	more: "*",
	wc: "*",
	file: "*",
	stat: "*",
	du: "*",
	where: "*",
	// 搜索
	grep: "*",
	rg: "*",
	findstr: "*",
	find: "*", // find 本身只读；-exec / -delete / -ok 由下面的逃逸片段拦
	// git：只读子命令。#126 收窄：`branch`/`remote`/`tag` 裸前缀会放进
	// `git tag -d`、`git branch -D`、`git remote add` 这类**写操作**（前缀匹配语义），
	// 必须写成带只读参数的完整子命令；`--ext-diff`/`--textconv` 由逃逸表拦。
	git: [
		"status",
		"log",
		"diff",
		"show",
		"branch --list",
		"branch -a",
		"branch -v",
		"branch -vv",
		"remote -v",
		"remote show",
		"remote get-url",
		"rev-parse",
		"ls-files",
		"blame",
		"describe",
		"tag --list",
		"tag -l",
		"tag -n",
		"stash list",
		"shortlog",
		"reflog",
	],
	// gh：只读子命令
	gh: ["pr view", "pr diff", "pr list", "pr checks", "issue view", "issue list", "repo view", "search"],
	// npm：只读子命令
	npm: ["ls", "view", "outdated", "list"],
	// 版本查询
	node: ["--version", "-v"],
	python: ["--version", "-V"],
	python3: ["--version", "-V"],
}

/**
 * 一旦出现就整条拒绝的片段：这些能把只读命令变成写盘 / 任意执行通道。
 *
 * 匹配方式是小写子串包含（不是精确 token），宁可误拒也不要漏。
 */
export const SUBAGENT_COMMAND_ESCAPE_TOKENS: readonly string[] = [
	// find 的写/执行分支
	"-exec",
	"-execdir",
	"-ok",
	"-delete",
	"-fprint",
	// 管道到写/执行
	"xargs",
	"tee",
	// 解释器与子 shell
	"eval",
	"source ",
	"sh -c",
	"bash -c",
	"zsh -c",
	"powershell",
	"pwsh",
	"cmd /c",
	"cmd.exe",
	"python -c",
	"python3 -c",
	"node -e",
	"node --eval",
	"perl -e",
	"ruby -e",
	"awk ",
	"sed -i",
	// 裸变量展开（#126）：shell-quote 只解析 `$(` 与 `${`，裸 `$VAR` 会被它当普通字符
	// 剥掉——守卫看到的是 `cat /.ssh/id_rsa`，真 shell 里却是 `cat $HOME/.ssh/id_rsa`。
	// 解析世界 ≠ 执行世界，索性全拒（只读探索用不到变量）。
	"$",
	"$(",
	"`",
	"${",
	// 网络
	"curl",
	"wget",
	"nc ",
	"ncat",
	"ssh ",
	"scp ",
	"rsync",
	"ftp ",
	"telnet",
	// 提权
	"sudo",
	"su ",
	"runas",
	// 写盘与进程控制
	"rm ",
	"rmdir",
	"del ",
	"start ",
	"mv ",
	"cp ",
	"dd ",
	"truncate",
	"mkfs",
	"chmod",
	"chown",
	"touch ",
	"mkdir",
	"kill ",
	"taskkill",
	"shutdown",
	"reg add",
	"reg delete",
	// git 的写/执行后门
	"git -c",
	"git config",
	"git push",
	"git commit",
	"git checkout",
	"git reset",
	"git clean",
	"git apply",
	"git am",
	"--exec=",
	"--upload-pack",
	"--receive-pack",
	// #126：--ext-diff / --textconv 会执行 .gitconfig 里配置的外部 diff/textconv 程序
	"--ext-diff",
	"--textconv",
]

/** 构造一次即可：注入配置只为绕开 `parseConfig()` 读环境变量，`getSegments` 本身不看配置 */
const parser = new CommandPermissionController({ allow: ["*"] })

export interface SubagentCommandVerdict {
	allowed: boolean
	reason?: string
	segment?: string
}

/**
 * 判断一条命令能否在子代理里执行。
 *
 * 返回 `{ allowed: false, reason }` 时调用方应把 `reason` 原样交给模型——
 * 子代理读到原因后会改用 `search_files` / `read_file`，而不是整批失败。
 */
export function isSubagentCommandAllowed(command: string): SubagentCommandVerdict {
	const trimmed = (command || "").trim()
	if (!trimmed) {
		return { allowed: false, reason: "命令为空" }
	}

	const lowered = trimmed.toLowerCase()
	for (const token of SUBAGENT_COMMAND_ESCAPE_TOKENS) {
		if (lowered.includes(token)) {
			return { allowed: false, reason: `包含不允许的片段「${token.trim()}」` }
		}
	}

	// 重定向、子 shell、反引号、命令替换都在这里被拦（返回 null）
	const segments = parser.getSegments(trimmed)
	if (!segments) {
		return { allowed: false, reason: "无法安全解析（含重定向、子 shell 或命令替换）" }
	}

	for (const segment of segments) {
		const parts = segment
			.trim()
			.split(/\s+/)
			.filter((part) => part !== "")
		const bin = parts[0]
		if (!bin) {
			continue
		}
		const allowedArgs = SUBAGENT_READONLY_COMMANDS[bin.toLowerCase()]
		if (!allowedArgs) {
			return { allowed: false, reason: `命令「${bin}」不在子代理只读白名单`, segment }
		}
		if (allowedArgs === "*") {
			continue
		}
		const sub = parts.slice(1).join(" ")
		const hit = allowedArgs.some((candidate) => sub === candidate || sub.startsWith(`${candidate} `))
		if (!hit) {
			return {
				allowed: false,
				reason: `「${bin}」的子命令不在白名单（只允许：${allowedArgs.join(" / ")}）`,
				segment,
			}
		}
	}

	return { allowed: true }
}

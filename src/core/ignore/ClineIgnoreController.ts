import { getEraProjectProfile } from "@core/era/project-profile"
import { fileExistsAtPath } from "@utils/fs"
import chokidar, { FSWatcher } from "chokidar"
import fs from "fs/promises"
import ignore, { Ignore } from "ignore"
import path from "path"
import { Logger } from "@/shared/services/Logger"

export const LOCK_TEXT_SYMBOL = "\u{1F512}"

/**
 * 内置忽略：只在探测到 Emuera 工程时生效，而且只忽略**实际探测到的**备份目录名。
 *
 * 两个都不能写死：
 * - 不能无条件忽略：普通项目里也可能有叫 `_备份` 的目录，它未必是可安全跳过的副本。
 * - 不能只认一个名字：不同整合包的备份目录可能叫 `_backup`、`备份`、`_old`。
 *
 * 探测结果来自 core/era/project-profile（带缓存），这里不做自己的目录猜测。
 * 注意：不能写到游戏目录的 `.clineignore`（目标目录只读）。
 */
export function getBuiltinIgnorePatterns(cwd: string): string[] {
	if (!cwd) {
		return []
	}
	const profile = getEraProjectProfile(cwd)
	if (!profile.isEra) {
		return []
	}
	return profile.backupDirNames.map((name) => `${name}/`)
}

/**
 * #166：剥掉每一段末尾的空格与点（Win32 文件层语义——"secrets.env " 与
 * "src/a." 打开的就是 "secrets.env" 与 "src/a"），让 ignore 匹配与文件层看到
 * 同一个路径。只影响段尾（中间/开头的空格不动），逐段处理。
 */
function stripTrailingWin32Chars(relativePath: string): string {
	return relativePath
		.split("/")
		.map((segment) => segment.replace(/[\s.]+$/, ""))
		.join("/")
}

/**
 * Controls LLM access to files by enforcing ignore patterns.
 * Designed to be instantiated once in Cline.ts and passed to file manipulation services.
 * Uses the 'ignore' library to support standard .gitignore syntax in .clineignore files.
 */
export class ClineIgnoreController {
	private cwd: string
	private ignoreInstance: Ignore
	private fileWatcher?: FSWatcher
	clineIgnoreContent: string | undefined

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.clineIgnoreContent = undefined
	}

	/**
	 * Initialize the controller by loading custom patterns and setting up file watcher
	 * Must be called after construction and before using the controller
	 */
	async initialize(): Promise<void> {
		// Set up file watcher for .clineignore
		this.setupFileWatcher()
		await this.loadClineIgnore()
	}

	/**
	 * Set up the file watcher for .clineignore changes
	 */
	private setupFileWatcher(): void {
		const ignorePath = path.join(this.cwd, ".clineignore")

		this.fileWatcher = chokidar.watch(ignorePath, {
			persistent: true, // Keep the process running as long as files are being watched
			ignoreInitial: true, // Don't fire 'add' events when discovering the file initially
			awaitWriteFinish: {
				// Wait for writes to finish before emitting events (handles chunked writes)
				stabilityThreshold: 100, // Wait 100ms for file size to remain constant
				pollInterval: 100, // Check file size every 100ms while waiting for stability
			},
			atomic: true, // Handle atomic writes where editors write to a temp file then rename
		})

		// Watch for file changes, creation, and deletion
		this.fileWatcher.on("change", () => {
			this.loadClineIgnore()
		})

		this.fileWatcher.on("add", () => {
			this.loadClineIgnore()
		})

		this.fileWatcher.on("unlink", () => {
			this.loadClineIgnore()
		})

		this.fileWatcher.on("error", (error) => {
			Logger.error("Error watching .clineignore file:", error)
		})
	}

	/**
	 * Load custom patterns from .clineignore if it exists.
	 * Supports "!include <filename>" to load additional ignore patterns from other files.
	 */
	private async loadClineIgnore(): Promise<void> {
		try {
			// #166：先在临时实例上构建，全部成功后才整体替换——原来第一行就把
			// ignoreInstance 重置为空再读文件，读取抛错（EBUSY/EPERM，常见于同步
			// 客户端锁文件）时旧规则已经没了，fail-open 到下一次成功加载为止。
			const nextInstance = ignore()
			const builtinPatterns = getBuiltinIgnorePatterns(this.cwd)
			if (builtinPatterns.length > 0) {
				nextInstance.add(builtinPatterns)
			}
			const ignorePath = path.join(this.cwd, ".clineignore")
			if (await fileExistsAtPath(ignorePath)) {
				const content = await fs.readFile(ignorePath, "utf8")
				this.clineIgnoreContent = content
				await this.processIgnoreContent(content, nextInstance)
				nextInstance.add(".clineignore")
			} else {
				this.clineIgnoreContent = undefined
			}
			this.ignoreInstance = nextInstance
		} catch (error) {
			// 读取失败：保留旧实例（内置 + 用户规则原样有效），只记日志
			Logger.error("Failed to load .clineignore, keeping previous rules:", error)
		}
	}

	/**
	 * Process ignore content and apply all ignore patterns
	 */
	private async processIgnoreContent(content: string, target: Ignore): Promise<void> {
		// Optimization: first check if there are any !include directives
		if (!content.includes("!include ")) {
			target.add(content)
			return
		}

		// Process !include directives
		const combinedContent = await this.processClineIgnoreIncludes(content)
		target.add(combinedContent)
	}

	/**
	 * Process !include directives and combine all included file contents
	 */
	private async processClineIgnoreIncludes(content: string): Promise<string> {
		let combinedContent = ""
		const lines = content.split(/\r?\n/)

		for (const line of lines) {
			const trimmedLine = line.trim()

			if (!trimmedLine.startsWith("!include ")) {
				combinedContent += "\n" + line
				continue
			}

			// Process !include directive
			const includedContent = await this.readIncludedFile(trimmedLine)
			if (includedContent) {
				combinedContent += "\n" + includedContent
			}
		}

		return combinedContent
	}

	/**
	 * Read content from an included file specified by !include directive
	 */
	private async readIncludedFile(includeLine: string): Promise<string | null> {
		const includePath = includeLine.substring("!include ".length).trim()
		const resolvedIncludePath = path.join(this.cwd, includePath)

		if (!(await fileExistsAtPath(resolvedIncludePath))) {
			Logger.debug(`[ClineIgnore] Included file not found: ${resolvedIncludePath}`)
			return null
		}

		return await fs.readFile(resolvedIncludePath, "utf8")
	}

	/**
	 * Check if a file should be accessible to the LLM
	 * @param filePath - Path to check (relative to cwd)
	 * @returns true if file is accessible, false if ignored
	 */
	validateAccess(filePath: string): boolean {
		// 注意：不能因为「没有 .clineignore」就直接放行——`ignoreInstance` 里还可能带着
		// 探测到 Emuera 工程后才注入的备份目录忽略规则；早期 return 会让它完全失效。
		try {
			// Normalize path to be relative to cwd and use forward slashes
			const absolutePath = path.resolve(this.cwd, filePath)
			const relativePath = path.relative(this.cwd, absolutePath).toPosix()
			// #166：Win32 文件层会剥掉路径末尾的空格与点（"secrets.env " 打开的就是
			// "secrets.env"），而 ignore 匹配是纯字符串——不归一就能用尾随空格/点
			// 绕过 .clineignore。只在 Windows 文件层语义下需要。
			const ignoreCandidate = process.platform === "win32" ? stripTrailingWin32Chars(relativePath) : relativePath

			// Ignore expects paths to be path.relative()'d
			return !this.ignoreInstance.ignores(ignoreCandidate)
		} catch (_error) {
			// Logger.error(`Error validating access for ${filePath}:`, error)
			// Ignore is designed to work with relative file paths, so will throw error for paths outside cwd. We are allowing access to all files outside cwd.
			return true
		}
	}

	/**
	 * Check if a terminal command should be allowed to execute based on file access patterns
	 * @param command - Terminal command to validate
	 * @returns path of file that is being accessed if it is being accessed, undefined if command is allowed
	 */
	validateCommand(command: string): string | undefined {
		// KB 08 #262：不能因为「没有 .clineignore」就早退放行——ignoreInstance 里还带着
		// 探测到 Emuera 工程后注入的备份目录规则（与 validateAccess 同一口径）。早退会让
		// file 工具读 `_备份/` 被拦、终端 `cat _备份/...` 却放行，内置忽略被终端绕过。
		// 没有任何规则时 ignores() 恒 false，行为与早退等价，只是多一次数组 includes。

		// Split command into parts and get the base command
		const parts = command.trim().split(/\s+/)
		const baseCommand = parts[0].toLowerCase()

		// Commands that read file contents
		const fileReadingCommands = [
			// Unix commands
			"cat",
			"less",
			"more",
			"head",
			"tail",
			"grep",
			"awk",
			"sed",
			// PowerShell commands and aliases
			"get-content",
			"gc",
			"type",
			"select-string",
			"sls",
		]

		if (fileReadingCommands.includes(baseCommand)) {
			// Check each argument that could be a file path
			for (let i = 1; i < parts.length; i++) {
				const arg = parts[i]
				// Skip command flags/options (both Unix and PowerShell style)
				if (arg.startsWith("-") || arg.startsWith("/")) {
					continue
				}
				// Ignore PowerShell parameter names
				if (arg.includes(":")) {
					continue
				}
				// Validate file access
				if (!this.validateAccess(arg)) {
					return arg
				}
			}
		}

		return undefined
	}

	/**
	 * Filter an array of paths, removing those that should be ignored
	 * @param paths - Array of paths to filter (relative to cwd)
	 * @returns Array of allowed paths
	 */
	filterPaths(paths: string[]): string[] {
		try {
			return paths
				.map((p) => ({
					path: p,
					allowed: this.validateAccess(p),
				}))
				.filter((x) => x.allowed)
				.map((x) => x.path)
		} catch (error) {
			Logger.error("Error filtering paths:", error)
			return [] // Fail closed for security
		}
	}

	/**
	 * Clean up resources when the controller is no longer needed
	 */
	async dispose(): Promise<void> {
		if (this.fileWatcher) {
			await this.fileWatcher.close()
			this.fileWatcher = undefined
		}
	}
}

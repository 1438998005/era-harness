import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import { workspaceResolver } from "@core/workspace"
import os from "os"
import * as path from "path"
import { HostProvider } from "@/hosts/host-provider"

/*
The Node.js 'path' module resolves and normalizes paths differently depending on the platform:
- On Windows, it uses backslashes (\) as the default path separator.
- On POSIX-compliant systems (Linux, macOS), it uses forward slashes (/) as the default path separator.

While modules like 'upath' can be used to normalize paths to use forward slashes consistently,
this can create inconsistencies when interfacing with other modules (like vscode.fs) that use
backslashes on Windows.

Our approach:
1. We present paths with forward slashes to the AI and user for consistency.
2. We use the 'arePathsEqual' function for safe path comparisons.
3. Internally, Node.js gracefully handles both backslashes and forward slashes.

This strategy ensures consistent path presentation while leveraging Node.js's built-in
path handling capabilities across different platforms.

Note: When interacting with the file system or VS Code APIs, we still use the native path module
to ensure correct behavior on all platforms. The toPosixPath and arePathsEqual functions are
primarily used for presentation and comparison purposes, not for actual file system operations.

Observations:
- Macos isn't so flexible with mixed separators, whereas windows can handle both. ("Node.js does automatically handle path separators on Windows, converting forward slashes to backslashes as needed. However, on macOS and other Unix-like systems, the path separator is always a forward slash (/), and backslashes are treated as regular characters.")
*/

function toPosixPath(p: string) {
	// Extended-Length Paths in Windows start with "\\?\" to allow longer paths and bypass usual parsing. If detected, we return the path unmodified to maintain functionality, as altering these paths could break their special syntax.
	const isExtendedLengthPath = p.startsWith("\\\\?\\")

	if (isExtendedLengthPath) {
		return p
	}

	return p.replace(/\\/g, "/")
}

// Declaration merging allows us to add a new method to the String type
// You must import this file in your entry point (extension.ts) to have access at runtime
declare global {
	interface String {
		toPosix(): string
	}
}

String.prototype.toPosix = function (this: string): string {
	return toPosixPath(this)
}

// Safe path comparison that works across different platforms
export function arePathsEqual(path1?: string, path2?: string): boolean {
	if (!path1 && !path2) {
		return true
	}
	if (!path1 || !path2) {
		return false
	}

	path1 = normalizePath(path1)
	path2 = normalizePath(path2)

	if (process.platform === "win32") {
		return path1.toLowerCase() === path2.toLowerCase()
	}
	return path1 === path2
}

function normalizePath(p: string): string {
	// normalize resolve ./.. segments, removes duplicate slashes, and standardizes path separators
	let normalized = path.normalize(p)
	// however it doesn't remove trailing slashes
	// remove trailing slash, except for root paths
	if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
		normalized = normalized.slice(0, -1)
	}
	return normalized
}

export function getReadablePath(cwd: string, relPath?: string): string {
	relPath = relPath || ""
	// path.resolve is flexible in that it will resolve relative paths like '../../' to the cwd and even ignore the cwd if the relPath is actually an absolute path
	const absolutePathResult = workspaceResolver.resolveWorkspacePath(cwd, relPath, "Utils.path.getReadablePath")
	const absolutePath = typeof absolutePathResult === "string" ? absolutePathResult : absolutePathResult.absolutePath
	if (arePathsEqual(cwd, getDesktopDir())) {
		// User opened vscode without a workspace, so cwd is the Desktop. Show the full absolute path to keep the user aware of where files are being created
		return absolutePath.toPosix()
	}
	if (arePathsEqual(path.normalize(absolutePath), path.normalize(cwd))) {
		const basenameResult = workspaceResolver.getBasename(absolutePath, "Utils.path.getReadablePath")
		return basenameResult.toPosix()
	}
	// show the relative path to the cwd
	const normalizedRelPath = path.relative(cwd, absolutePath)
	if (isLocatedInPath(cwd, absolutePath)) {
		return normalizedRelPath.toPosix()
	}
	// we are outside the cwd, so show the absolute path (useful for when cline passes in '../../' for example)
	return absolutePath.toPosix()
}

// Returns the path of the first workspace directory, or the defaultCwdPath if there is no workspace open.
export async function getCwd(defaultCwd = ""): Promise<string> {
	const workspacePaths = await HostProvider.workspace.getWorkspacePaths({})
	return workspacePaths.paths.shift() || defaultCwd
}

export function getDesktopDir(): string {
	if (cachedDesktopDir === undefined) {
		cachedDesktopDir = resolveDesktopDir()
	}
	return cachedDesktopDir
}

let cachedDesktopDir: string | undefined

/**
 * 解析桌面目录。
 *
 * Windows 上桌面经常被重定向（OneDrive 备份、改到 D 盘等），
 * 直接拼 `homedir/Desktop` 会得到一个并不存在的路径 —— 后面任何
 * access() 都会以 ENOENT 失败。所以先读注册表里的真实位置，再退回常见候选。
 */
function resolveDesktopDir(): string {
	const home = os.homedir()
	const defaultDesktop = path.join(home, "Desktop")

	// 绝大多数机器走这条快路径，不启动任何子进程
	if (exists(defaultDesktop)) {
		return defaultDesktop
	}

	const candidates: string[] = []
	if (process.platform === "win32") {
		const fromRegistry = readWindowsDesktopDir()
		if (fromRegistry) {
			candidates.push(fromRegistry)
		}
		candidates.push(path.join(home, "OneDrive", "Desktop"), path.join(home, "桌面"), path.join(home, "OneDrive", "桌面"))
	}

	for (const candidate of candidates) {
		if (exists(candidate)) {
			return candidate
		}
	}

	return defaultDesktop
}

function exists(p: string): boolean {
	try {
		return fs.existsSync(p)
	} catch {
		return false
	}
}

/** 从注册表读取 Windows 桌面目录（User Shell Folders），失败返回 undefined */
function readWindowsDesktopDir(): string | undefined {
	try {
		const output = execFileSync(
			"reg",
			["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders", "/v", "Desktop"],
			{ encoding: "utf8", windowsHide: true, timeout: 2000 },
		)
		const match = output.match(/Desktop\s+REG_(?:EXPAND_)?SZ\s+(.+)/)
		if (!match) {
			return undefined
		}
		return match[1].trim().replace(/%([^%]+)%/g, (whole, name: string) => process.env[name] ?? whole)
	} catch {
		return undefined
	}
}

// Returns the workspace path of the file in the current editor.
// If there is no open file, it returns the top level workspace directory.
export async function getWorkspacePath(defaultCwd = ""): Promise<string> {
	const currentFilePath = (await HostProvider.window.getActiveEditor({})).filePath
	if (!currentFilePath) {
		return await getCwd(defaultCwd)
	}

	const workspacePaths = (await HostProvider.workspace.getWorkspacePaths({})).paths
	for (const workspacePath of workspacePaths) {
		if (isLocatedInPath(workspacePath, currentFilePath)) {
			return workspacePath
		}
	}
	return await getCwd(defaultCwd)
}

export async function isLocatedInWorkspace(pathToCheck = ""): Promise<boolean> {
	const workspacePaths = (await HostProvider.workspace.getWorkspacePaths({})).paths
	for (const workspacePath of workspacePaths) {
		const resolvedPathResult = workspaceResolver.resolveWorkspacePath(
			workspacePath,
			pathToCheck,
			"Utils.path.isLocatedInWorkspace",
		)
		const resolvedPath = typeof resolvedPathResult === "string" ? resolvedPathResult : resolvedPathResult.absolutePath
		if (isLocatedInPath(workspacePath, resolvedPath)) {
			return true
		}
	}
	return false
}

// Returns true if `pathToCheck` is located inside `dirPath`.
export function isLocatedInPath(dirPath: string, pathToCheck: string): boolean {
	if (!dirPath || !pathToCheck) {
		return false
	}
	// Handle long paths in Windows
	if (dirPath.startsWith("\\\\?\\") || pathToCheck.startsWith("\\\\?\\")) {
		return pathToCheck.startsWith(dirPath)
	}

	const resolvedDirResult = workspaceResolver.resolveWorkspacePath(dirPath, "", "Utils.path.isLocatedInPath")
	const resolvedDir = typeof resolvedDirResult === "string" ? resolvedDirResult : resolvedDirResult.absolutePath
	const resolvedCheckResult = workspaceResolver.resolveWorkspacePath(pathToCheck, "", "Utils.path.isLocatedInPath")
	const resolvedCheck = typeof resolvedCheckResult === "string" ? resolvedCheckResult : resolvedCheckResult.absolutePath

	const relativePath = path.relative(resolvedDir, resolvedCheck)
	if (relativePath.startsWith("..")) {
		return false
	}
	if (path.isAbsolute(relativePath)) {
		// This can happen on windows when the two paths are on different drives.
		return false
	}
	return true
}

export async function asRelativePath(filePath: string): Promise<string> {
	const workspacePaths = await HostProvider.workspace.getWorkspacePaths({})
	for (const workspacePath of workspacePaths.paths) {
		if (isLocatedInPath(workspacePath, filePath)) {
			return path.relative(workspacePath, filePath)
		}
	}
	return filePath
}

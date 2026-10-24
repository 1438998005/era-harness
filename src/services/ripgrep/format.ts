import * as path from "path"

/*
search_files 结果格式化（纯函数，无 vscode / 进程依赖，供单元测试直测）。

输出格式：
- 每个文件一段，路径行 + `│----` 分隔
- 匹配行带 1 起始行号（`│{line} | {text}`，对齐 read_file 的 `N | text` 风格），
  上下文行保持裸文本——模型可以直接拿行号去 read_file，不必再跑命令自取
- 两种截断都可见：字节超限 / ripgrep 输出行数上限，均在尾部追加提示，不再静默
*/

export interface SearchResult {
	filePath: string
	line: number
	column: number
	match: string
	beforeContext: string[]
	afterContext: string[]
}

// eraTW 工程近 9800 个 ERB，同一标识符常有大量调用点；300 条会在排查
// 全局调用关系时被截断，因此提高到 500。
export const MAX_RESULTS = 500

export const MAX_RIPGREP_MB = 0.25
export const MAX_BYTE_SIZE = MAX_RIPGREP_MB * 1024 * 1024 // 0.25MB in bytes

export const BYTE_TRUNCATION_MESSAGE = `\n[Results truncated due to exceeding the ${MAX_RIPGREP_MB}MB size limit. Please use a more specific search pattern.]`
export const LINE_CAP_TRUNCATION_MESSAGE = `\n[Results truncated: ripgrep output line cap reached. Use a more specific search pattern.]`

// 与 src/utils/path 的 String.prototype.toPosix 同款逻辑；这里用模块函数，
// 本模块保持纯净（不依赖全局原型扩展，单测可直接跑）。
function toPosixPath(p: string): string {
	if (p.startsWith("\\\\?\\")) {
		return p
	}
	return p.replace(/\\/g, "/")
}

export function formatResults(results: SearchResult[], cwd: string, lineTruncated = false): string {
	const groupedResults: { [key: string]: SearchResult[] } = {}

	let output = ""
	if (results.length >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`
	} else {
		output += `Found ${results.length === 1 ? "1 result" : `${results.length.toLocaleString()} results`}.\n\n`
	}

	// Group results by file name
	results.slice(0, MAX_RESULTS).forEach((result) => {
		const relativeFilePath = path.relative(cwd, result.filePath)
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []
		}
		groupedResults[relativeFilePath].push(result)
	})

	// Track byte size
	let byteSize = Buffer.byteLength(output, "utf8")
	let wasLimitReached = false

	// 字节预算预扣截断提示的长度：旧实现只在「恰好还装得下」时才追加提示，
	// 紧贴上限时提示本身会被静默丢弃——又是静默截断。预扣后提示必然放得下。
	const effectiveLimit = MAX_BYTE_SIZE - Buffer.byteLength(BYTE_TRUNCATION_MESSAGE, "utf8")

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		// Check if adding this file's path would exceed the byte limit
		const filePathString = `${toPosixPath(filePath)}\n│----\n`
		const filePathBytes = Buffer.byteLength(filePathString, "utf8")

		if (byteSize + filePathBytes >= effectiveLimit) {
			wasLimitReached = true
			break
		}

		output += filePathString
		byteSize += filePathBytes

		for (let resultIndex = 0; resultIndex < fileResults.length; resultIndex++) {
			const result = fileResults[resultIndex]
			const allLines: Array<{ text: string | undefined; isMatch: boolean }> = [
				...result.beforeContext.map((text) => ({ text, isMatch: false })),
				{ text: result.match, isMatch: true },
				...result.afterContext.map((text) => ({ text, isMatch: false })),
			]

			// Calculate bytes in all lines for this result
			let resultBytes = 0
			const resultLines: string[] = []

			for (const entry of allLines) {
				const trimmedLine = entry.text?.trimEnd() ?? ""
				const lineString = entry.isMatch ? `│${result.line} | ${trimmedLine}\n` : `│${trimmedLine}\n`
				const lineBytes = Buffer.byteLength(lineString, "utf8")

				// Check if adding this line would exceed the byte limit
				if (byteSize + resultBytes + lineBytes >= effectiveLimit) {
					wasLimitReached = true
					break
				}

				resultLines.push(lineString)
				resultBytes += lineBytes
			}

			// If we hit the limit in the middle of processing lines, break out of the result loop
			if (wasLimitReached) {
				break
			}

			// Add all lines for this result to the output
			resultLines.forEach((line) => {
				output += line
			})
			byteSize += resultBytes

			// Add separator between results if needed
			if (resultIndex < fileResults.length - 1) {
				const separatorString = "│----\n"
				const separatorBytes = Buffer.byteLength(separatorString, "utf8")

				if (byteSize + separatorBytes >= effectiveLimit) {
					wasLimitReached = true
					break
				}

				output += separatorString
				byteSize += separatorBytes
			}

			// Check if we've hit the byte limit
			if (byteSize >= effectiveLimit) {
				wasLimitReached = true
				break
			}
		}

		// If we hit the limit, break out of the file loop
		if (wasLimitReached) {
			break
		}

		const closingString = "│----\n\n"
		const closingBytes = Buffer.byteLength(closingString, "utf8")

		if (byteSize + closingBytes >= effectiveLimit) {
			wasLimitReached = true
			break
		}

		output += closingString
		byteSize += closingBytes
	}

	// Add a message if we hit a limit (byte limit takes precedence; either way truncation is visible)
	if (wasLimitReached) {
		// Only add the message if it fits within the limit
		if (byteSize + Buffer.byteLength(BYTE_TRUNCATION_MESSAGE, "utf8") < MAX_BYTE_SIZE) {
			output += BYTE_TRUNCATION_MESSAGE
		}
	} else if (lineTruncated) {
		if (byteSize + Buffer.byteLength(LINE_CAP_TRUNCATION_MESSAGE, "utf8") < MAX_BYTE_SIZE) {
			output += LINE_CAP_TRUNCATION_MESSAGE
		}
	}

	return output.trim()
}

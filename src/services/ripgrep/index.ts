import { ClineIgnoreController } from "@core/ignore/ClineIgnoreController"
import * as childProcess from "child_process"
import * as readline from "readline"
import { Logger } from "@/shared/services/Logger"
import { getBinaryLocation } from "@/utils/fs"
import { formatResults, MAX_RESULTS, type SearchResult } from "./format"

/*
This file provides functionality to perform regex searches on files using ripgrep.
Inspired by: https://github.com/DiscreteTom/vscode-ripgrep-utils

Key components:
* execRipgrep: Executes the ripgrep command and returns the output.
* regexSearchFiles: The main function that performs regex searches on files.
   - Parameters:
     * cwd: The current working directory (for relative path calculation)
     * directoryPath: The directory to search in
     * regex: The regular expression to search for (Rust regex syntax)
     * filePattern: Optional glob pattern to filter files (default: '*')
   - Returns: A formatted string containing search results with context
     (formatting lives in ./format.ts — pure and unit-tested)

The search results include:
- Relative file paths
- 2 lines of context before and after each match
- Match lines prefixed with their 1-based line number (`│{line} | {text}`),
  context lines bare — so the model can cite/read_file by line number directly
  (2026-10-24: missing line numbers were driving models to spawn `python -c`
  commands just to obtain them; see 知识库 12 §12.24)

Usage example:
const results = await regexSearchFiles('/path/to/cwd', '/path/to/search', 'TODO:', '*.ts');

rel/path/to/app.ts
│----
│function processData(data: any) {
│  // Some processing logic here
│34 |   // TODO: Implement error handling
│  return processedData;
│}
│----

rel/path/to/helper.ts
│----
│  let result = 0;
│  for (let i = 0; i < input; i++) {
│56 |     // TODO: Optimize this function for performance
│    result += Math.pow(i, 2);
│  }
│----
*/

// --json 模式下每个结果约占 7 行 JSON（begin + 2×context + match + 2×context + end），
// 旧的上限按 5 行/结果估算（上游遗留），--context 2 会在 ~350 结果处提前静默截断。
const MAX_LINES_PER_RESULT = 8

async function execRipgrepInternal(args: string[]): Promise<{ output: string; lineTruncated: boolean }> {
	const binPath: string = await getBinaryLocation("rg")

	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(binPath, args)
		// cross-platform alternative to head, which is ripgrep author's recommendation for limiting output.
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity, // treat \r\n as a single line break even if it's split across chunks. This ensures consistent behavior across different operating systems.
		})

		let output = ""
		let lineCount = 0
		let lineTruncated = false
		const maxLines = MAX_RESULTS * MAX_LINES_PER_RESULT

		rl.on("line", (line) => {
			if (lineCount < maxLines) {
				output += line + "\n"
				lineCount++
			} else {
				lineTruncated = true
				rl.close()
				rgProcess.kill()
			}
		})

		let errorOutput = ""
		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})
		rl.on("close", () => {
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve({ output, lineTruncated })
			}
		})
		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

async function execRipgrep(args: string[]): Promise<string> {
	const { output } = await execRipgrepInternal(args)
	return output
}

/**
 * 轻量 ripgrep 调用：返回原始输出行（供 era_symbols 这类需要自己解析的调用方使用）。
 * 复用 execRipgrep 的输出行数上限，避免结果刷屏。
 */
export async function rawRipgrepLines(args: string[]): Promise<string[]> {
	const output = await execRipgrep(args)
	return output.split("\n").filter((line) => line.length > 0)
}

/**
 * era harness（2026-10-25 真实任务 1792887990433 取证）：eraTW 工程里存在**无 BOM 的
 * CP932/Shift-JIS 文件**，ripgrep 默认按 UTF-8 解码，CJK 模式对它们搜不到——DS 第 1 轮
 * 推理原话「CP932 文件读不出」正是它放弃 search_files、改写 python 双编码脚本的直接依据
 * （修复行号后依然绕开，见 知识库 12 §12.24 的因果链修订）。
 * 修复：默认遍之后追加 `--encoding shift-jis` 第二遍（WHATWG shift_jis 即 CP932 兼容），
 * 结果合并。合并规则：**默认遍已命中的文件不再采纳第二遍结果**——UTF-8 文件被按
 * Shift-JIS 转码后可能碰巧产生假阳性，按文件粒度整体排除。纯函数，单测锁定。
 */
export function mergeEncodingPasses(pass1: SearchResult[], pass2: SearchResult[]): SearchResult[] {
	const seen = new Set(pass1.map((r) => r.filePath))
	return [...pass1, ...pass2.filter((r) => !seen.has(r.filePath))]
}

/** 单遍 ripgrep --json：执行 + 解析成 SearchResult 列表。 */
async function runJsonPass(args: string[]): Promise<{ results: SearchResult[]; lineTruncated: boolean }> {
	let output: string
	let lineTruncated = false
	try {
		const rg = await execRipgrepInternal(args)
		output = rg.output
		lineTruncated = rg.lineTruncated
	} catch (error) {
		throw Error("Error calling ripgrep", { cause: error })
	}
	const results: SearchResult[] = []
	let currentResult: Partial<SearchResult> | null = null

	output.split("\n").forEach((line) => {
		if (line) {
			try {
				const parsed = JSON.parse(line)
				if (parsed.type === "match") {
					if (currentResult) {
						results.push(currentResult as SearchResult)
					}
					currentResult = {
						filePath: parsed.data.path.text,
						line: parsed.data.line_number,
						column: parsed.data.submatches[0].start,
						match: parsed.data.lines.text,
						beforeContext: [],
						afterContext: [],
					}
				} else if (parsed.type === "context" && currentResult) {
					if (parsed.data.line_number < currentResult.line!) {
						currentResult.beforeContext!.push(parsed.data.lines.text)
					} else {
						currentResult.afterContext!.push(parsed.data.lines.text)
					}
				}
			} catch (error) {
				Logger.error("Error parsing ripgrep output:", error)
			}
		}
	})

	if (currentResult) {
		results.push(currentResult as SearchResult)
	}

	return { results, lineTruncated }
}

export async function regexSearchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string,
	clineIgnoreController?: ClineIgnoreController,
): Promise<string> {
	// 上游对齐（cline#13384 记载的 fast path 即 2 行上下文；本文件头部注释也一直写着 2）：
	// 曾被改成 1，实测上下文不足是模型转向自写临时脚本检索的诱因之一（2026-10-24 取证）。
	const args = ["--json", "-e", regex, "--glob", filePattern || "*", "--context", "2", directoryPath]

	let merged: SearchResult[]
	let lineTruncated: boolean
	try {
		const pass1 = await runJsonPass(args)
		merged = pass1.results
		lineTruncated = pass1.lineTruncated
		if (!lineTruncated) {
			// CP932 第二遍：默认遍被截断时结果已到上限，不再跑第二遍
			const pass2 = await runJsonPass([...args, "--encoding", "shift-jis"])
			merged = mergeEncodingPasses(pass1.results, pass2.results)
			lineTruncated = pass2.lineTruncated
		}
	} catch (error) {
		throw Error("Error calling ripgrep", { cause: error })
	}

	// Filter results using ClineIgnoreController if provided
	const filteredResults = clineIgnoreController
		? merged.filter((result) => clineIgnoreController.validateAccess(result.filePath))
		: merged

	return formatResults(filteredResults, cwd, lineTruncated)
}

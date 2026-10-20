import { formatResponse } from "@core/prompts/responses"
import { workspaceResolver } from "@core/workspace"
import { decodeToUtf8 } from "@eraharness/encoding/encoding"
import {
	applyEol,
	type FileEncodingFacts,
	formatWriteTarget,
	formatWriteVerification,
	inspectFileBytes,
	type NewFileHints,
	planSafeWrite,
	verifyWrite,
	writeTargetMatches,
} from "@eraharness/encoding/write"
import { createDirectoriesForFile } from "@utils/fs"
import { getCwd } from "@utils/path"
import * as diff from "diff"
import * as fs from "fs/promises"
import * as iconv from "iconv-lite"
import * as path from "path"
import { HostProvider } from "@/hosts/host-provider"
import { diagnosticsToProblemsString, getNewDiagnostics } from "@/integrations/diagnostics"
import { DiagnosticSeverity, FileDiagnostics } from "@/shared/proto/index.cline"
import { Logger } from "@/shared/services/Logger"
import { detectEncoding } from "../misc/extract-text"
import { sanitizeNotebookForLLM } from "../misc/notebook-utils"
import { openFile } from "../misc/open-file"

/** 采样兄弟文件时最多看多少个 */
const MAX_BOM_SAMPLE_FILES = 12
/** 采样兄弟文件 BOM 时每个文件只读开头这几个字节 */
const SIBLING_SAMPLE_BYTES = 4096

export abstract class DiffViewProvider {
	editType?: "create" | "modify" | "delete"
	isEditing = false
	originalContent: string | undefined
	private createdDirs: string[] = []
	protected documentWasOpen = false
	private preDiagnostics: FileDiagnostics[] = []
	protected relPath?: string
	protected absolutePath?: string
	protected fileEncoding: string = "utf8"
	/** 打开时原文件是否带 UTF-8 BOM（Emuera 靠它识别 UTF-8，丢了会读不出首行标签） */
	protected originalHasBom = false
	/** 打开时原文件的编码事实（BOM / 行尾 / 末尾换行），写回与写后复检都以它为基准 */
	private originalFacts?: FileEncodingFacts
	private streamedLines: string[] = []
	private newContent?: string

	constructor() {}

	public async open(relPath: string, options?: { displayPath?: string }): Promise<void> {
		this.isEditing = true
		const cwd = await getCwd()
		const absolutePathResolved = workspaceResolver.resolveWorkspacePath(cwd, relPath, "DiffViewProvider.open.absolutePath")
		this.absolutePath = typeof absolutePathResolved === "string" ? absolutePathResolved : absolutePathResolved.absolutePath
		this.relPath = options?.displayPath ?? relPath
		const fileExists = this.editType === "modify"

		// if the file is already open, ensure it's not dirty before getting its contents
		if (fileExists) {
			await HostProvider.workspace.saveOpenDocumentIfDirty({
				filePath: this.absolutePath!,
			})

			const fileBuffer = await fs.readFile(this.absolutePath)
			this.fileEncoding = await detectEncoding(fileBuffer)
			this.originalHasBom =
				fileBuffer.length >= 3 && fileBuffer[0] === 0xef && fileBuffer[1] === 0xbb && fileBuffer[2] === 0xbf
			this.originalFacts = inspectFileBytes(fileBuffer)
			this.originalContent = iconv.decode(fileBuffer, this.fileEncoding)
		} else {
			this.originalContent = ""
			this.fileEncoding = "utf8"
			this.originalHasBom = false
			this.originalFacts = undefined
		}
		// for new files, create any necessary directories and keep track of new directories to delete if the user denies the operation
		this.createdDirs = await createDirectoriesForFile(this.absolutePath)
		// make sure the file exists before we open it
		if (!fileExists) {
			await fs.writeFile(this.absolutePath, "")
		}
		// get diagnostics before editing the file, we'll compare to diagnostics after editing to see if cline needs to fix anything
		this.preDiagnostics = (await HostProvider.workspace.getDiagnostics({})).fileDiagnostics
		await this.openDiffEditor()
		await this.scrollEditorToLine(0)
		this.streamedLines = []
	}

	/**
	 * Opens a diff editor or viewer for the current file.
	 *
	 * Called automatically by the `open` method after ensuring the file exists and
	 * creating any necessary directories.
	 *
	 * @returns A promise that resolves when the diff editor is open and ready
	 */
	protected abstract openDiffEditor(): Promise<void>

	/**
	 * Scrolls the diff editor to reveal a specific line.
	 *
	 * It's used during streaming updates to keep the user's view focused on the changing content.
	 *
	 * @param line The 0-based line number to scroll to
	 */
	protected abstract scrollEditorToLine(line: number): Promise<void>

	/**
	 * Creates a smooth scrolling animation between two lines in the diff editor.
	 *
	 * It's typically used when updates contain many lines, to help the user visually track the flow
	 * of significant changes in the document.
	 *
	 * @param startLine The 0-based line number to begin the animation from
	 * @param endLine The 0-based line number to animate to
	 */
	protected abstract scrollAnimation(startLine: number, endLine: number): Promise<void>

	/**
	 * Removes content from the specified line to the end of the document.
	 * Called after the final update is received.
	 */
	protected abstract truncateDocument(lineNumber: number): Promise<void>

	/**
	 * Returns the current line count of the document being edited.
	 * Used for boundary validation before calling truncateDocument.
	 */
	protected abstract getDocumentLineCount(): Promise<number>

	/**
	 * Safely truncates the document, ensuring the line number is within bounds.
	 * This prevents errors on hosts that strictly validate line numbers (e.g., JetBrains via gRPC).
	 */
	private async safelyTruncateDocument(lineNumber: number): Promise<void> {
		const lineCount = await this.getDocumentLineCount()
		// Only truncate if there's content beyond the specified line
		if (lineNumber < lineCount) {
			await this.truncateDocument(lineNumber)
		}
	}

	/**
	 * Get the contents of the diff editor document.
	 *
	 * Returns undefined if the diff editor was closed.
	 */
	protected abstract getDocumentText(): Promise<string | undefined>

	/**
	 * Get any new diagnostic problems that appeared after applying the diff.
	 *
	 * Getting diagnostics before and after the file edit is a better approach than
	 * automatically tracking problems in real-time. This method ensures we only
	 * report new problems that are a direct result of this specific edit.
	 * Since these are new problems resulting from Cline's edit, we know they're
	 * directly related to the work he's doing. This eliminates the risk of Cline
	 * going off-task or getting distracted by unrelated issues, which was a problem
	 * with the previous auto-debug approach. Some users' machines may be slow to
	 * update diagnostics, so this approach provides a good balance between automation
	 * and avoiding potential issues where Cline might get stuck in loops due to
	 * outdated problem information. If no new problems show up by the time the user
	 * accepts the changes, they can always debug later using the '@problems' mention.
	 * This way, Cline only becomes aware of new problems resulting from his edits
	 * and can address them accordingly. If problems don't change immediately after
	 * applying a fix, Cline won't be notified, which is generally fine since the
	 * initial fix is usually correct and it may just take time for linters to catch up.
	 */
	private async getNewDiagnosticProblems(): Promise<string> {
		// Get the diagnostics after changing the document.
		const postDiagnostics = (await HostProvider.workspace.getDiagnostics({})).fileDiagnostics

		const newProblems = getNewDiagnostics(this.preDiagnostics, postDiagnostics)
		// Only including errors since warnings can be distracting (if user wants to fix warnings they can use the @problems mention)
		// will be empty string if no errors
		const problems = await diagnosticsToProblemsString(newProblems, [DiagnosticSeverity.DIAGNOSTIC_ERROR])
		return problems
	}

	/**
	 * Save the contents of the diff editor UI to the file.
	 *
	 * @returns true if the file was saved.
	 */
	protected abstract saveDocument(): Promise<Boolean>

	/**
	 * Closes all open diff views.
	 */
	protected abstract closeAllDiffViews(): Promise<void>

	/**
	 * Cleans up the diff view resources and resets internal state.
	 */
	protected abstract resetDiffView(): Promise<void>

	/**
	 * Switches to a specialized editor for specific file types after final content is available.
	 * Called automatically by the `update` method when `isFinal` is true.
	 *
	 * For example, switches to Jupyter notebook editor for .ipynb files to provide
	 * enhanced editing experience with proper notebook cell rendering.
	 *
	 * Default is no-op. Subclasses can override to provide specialized behavior.
	 */
	protected async switchToSpecializedEditor(): Promise<void> {
		// Default no-op - subclasses can override if needed
	}

	private lastUpdateContentLength = -1
	private lastUpdateTime = 0
	private static readonly UPDATE_THROTTLE_MS = 100 // Throttle updates to max 10/second during streaming

	async update(
		accumulatedContent: string,
		isFinal: boolean,
		changeLocation?: { startLine: number; endLine: number; startChar: number; endChar: number },
	) {
		if (!this.isEditing) {
			throw new Error("Not editing any file")
		}

		// Throttle updates during streaming to prevent performance issues with large files
		// This is especially important for notebooks where streaming can trigger thousands of calls
		if (!isFinal) {
			const now = Date.now()
			const contentLength = accumulatedContent.length
			const timeSinceLastUpdate = now - this.lastUpdateTime

			// Skip if: no content, content unchanged, or throttle period not elapsed
			if (contentLength === 0 || contentLength === this.lastUpdateContentLength) {
				return
			}
			if (timeSinceLastUpdate < DiffViewProvider.UPDATE_THROTTLE_MS) {
				return // Throttle: too soon since last update
			}

			this.lastUpdateContentLength = contentLength
			this.lastUpdateTime = now
		}

		// --- Fix to prevent duplicate BOM ---
		// Strip potential BOM from incoming content. VS Code's `applyEdit` might implicitly handle the BOM
		// when replacing from the start (0,0), and we want to avoid duplication.
		// Final BOM is handled in `saveChanges`.
		if (accumulatedContent.startsWith("\ufeff")) {
			accumulatedContent = accumulatedContent.slice(1) // Remove the BOM character
		}

		this.newContent = accumulatedContent
		const accumulatedLines = accumulatedContent.split("\n")
		if (!isFinal) {
			accumulatedLines.pop() // remove the last partial line only if it's not the final update
		}
		const diffLines = accumulatedLines.slice(this.streamedLines.length)

		// Instead of animating each line, we'll update in larger chunks
		const currentLine = this.streamedLines.length + diffLines.length - 1
		if (currentLine >= 0) {
			// Only proceed if we have new lines

			// Replace all content up to the current line with accumulated lines
			// This is necessary (as compared to inserting one line at a time) to handle cases where html tags
			// on previous lines are auto closed for example
			let contentToReplace = accumulatedLines.slice(0, currentLine + 1).join("\n")
			if (!isFinal) {
				// During streaming, add trailing newline for cursor positioning
				contentToReplace += "\n"
			}

			// For the final update, replace the entire document to prevent concatenation
			// when content doesn't end with a newline. Without this, replacing lines 0-N
			// with content lacking a trailing newline causes line N+1's content to be
			// directly appended to our content (e.g., "Hello World" + "# Old Header" becomes
			// "Hello World# Old Header").
			const endLine = isFinal ? await this.getDocumentLineCount() : currentLine + 1

			const rangeToReplace = { startLine: 0, endLine }
			await this.replaceText(contentToReplace, rangeToReplace, currentLine)

			// Scroll to the actual change location if provided.
			if (changeLocation) {
				// We have the actual location of the change, scroll to it
				const targetLine = changeLocation.startLine
				await this.scrollEditorToLine(targetLine)
			} else {
				// Fallback to the old logic for non-replacement updates
				if (diffLines.length <= 5) {
					// For small changes, just jump directly to the line
					await this.scrollEditorToLine(currentLine)
				} else {
					// For larger changes, create a quick scrolling animation
					const startLine = this.streamedLines.length
					const endLine = currentLine
					await this.scrollAnimation(startLine, endLine)
					// Ensure we end at the final line
					await this.scrollEditorToLine(currentLine)
				}
			}
		}

		// Update the streamedLines with the new accumulated content
		this.streamedLines = accumulatedLines
		if (isFinal) {
			// Handle any remaining lines if the new content is shorter than the original
			await this.safelyTruncateDocument(this.streamedLines.length)
			// Allow subclasses to perform cleanup (e.g., clearing decorations)
			await this.onFinalUpdate()
			// Switch to specialized editor for specific file types (e.g., Jupyter notebooks)
			await this.switchToSpecializedEditor()
		}
	}

	/**
	 * Called after the final update is complete. Subclasses can override to perform cleanup.
	 */
	protected async onFinalUpdate(): Promise<void> {
		// Default no-op
	}

	async showFile(absolutePath: string): Promise<void> {
		await openFile(absolutePath, true)
	}

	/**
	 * Replaces text in the diff editor with the specified content.
	 *
	 * This abstract method must be implemented by subclasses to handle the actual
	 * text replacement in their specific diff editor implementation. It's called
	 * during the streaming update process to progressively show changes.
	 *
	 * @param content The new content to insert into the document
	 * @param rangeToReplace An object specifying the line range to replace
	 * @param currentLine The current line number being edited, used for scroll positioning
	 * @returns A promise that resolves when the text replacement is complete
	 */
	abstract replaceText(
		content: string,
		rangeToReplace: { startLine: number; endLine: number },
		currentLine: number | undefined,
	): Promise<void>

	/**
	 * Checks if the current file is a Jupyter notebook file.
	 *
	 * @returns true if the file has .ipynb extension
	 */
	protected isNotebookFile(): boolean {
		return this.relPath?.toLowerCase().endsWith(".ipynb") ?? false
	}

	/**
	 * Returns the original content sanitized for LLM context.
	 * For notebooks, strips all outputs since they aren't needed for editing.
	 */
	getOriginalContentForLLM(): string | undefined {
		if (this.originalContent === undefined) return undefined
		return this.isNotebookFile() ? sanitizeNotebookForLLM(this.originalContent, true) : this.originalContent
	}

	async saveChanges(): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		autoFormattingEdits: string | undefined
		finalContent: string | undefined
		/** 编码写回结论；符合判据时为 undefined */
		encodingNote: string | undefined
	}> {
		// get the contents before save operation which may do auto-formatting
		const preSaveContent = await this.getDocumentText()

		if (!this.relPath || !this.absolutePath || !this.newContent || preSaveContent === undefined) {
			return {
				newProblemsMessage: undefined,
				userEdits: undefined,
				autoFormattingEdits: undefined,
				finalContent: undefined,
				encodingNote: undefined,
			}
		}

		await this.saveDocument()
		const encodingNote = await this.enforceWriteEncoding()
		// get text after save in case there is any auto-formatting done by the editor
		const postSaveContent = (await this.getDocumentText()) || ""

		await this.showFile(this.absolutePath)
		await this.closeAllDiffViews()

		const newProblems = await this.getNewDiagnosticProblems()
		const newProblemsMessage =
			newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""

		// If the edited content has different EOL characters, we don't want to show a diff with all the EOL differences.
		const newContentEOL = this.newContent.includes("\r\n") ? "\r\n" : "\n"
		const normalizedPreSaveContent = preSaveContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL // trimEnd to fix issue where editor adds in extra new line automatically
		const normalizedPostSaveContent = postSaveContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL // this is the final content we return to the model to use as the new baseline for future edits
		// just in case the new content has a mix of varying EOL characters
		const normalizedNewContent = this.newContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL

		let userEdits: string | undefined
		if (normalizedPreSaveContent !== normalizedNewContent) {
			// user made changes before approving edit. let the model know about user made changes (not including post-save auto-formatting changes)
			userEdits = formatResponse.createPrettyPatch(this.relPath.toPosix(), normalizedNewContent, normalizedPreSaveContent)
			// return { newProblemsMessage, userEdits, finalContent: normalizedPostSaveContent }
		} else {
			// no changes to cline's edits
			// return { newProblemsMessage, userEdits: undefined, finalContent: normalizedPostSaveContent }
		}

		let autoFormattingEdits: string | undefined
		if (normalizedPreSaveContent !== normalizedPostSaveContent) {
			// auto-formatting was done by the editor
			autoFormattingEdits = formatResponse.createPrettyPatch(
				this.relPath.toPosix(),
				normalizedPreSaveContent,
				normalizedPostSaveContent,
			)
		}

		// Strip notebook outputs to reduce context size (outputs aren't needed for editing)
		const finalContent = this.isNotebookFile()
			? sanitizeNotebookForLLM(normalizedPostSaveContent, true)
			: normalizedPostSaveContent

		return {
			newProblemsMessage,
			userEdits,
			autoFormattingEdits,
			finalContent,
			encodingNote,
		}
	}

	/**
	 * 保存后按判据还原磁盘形态，并写后复检。
	 *
	 * 判据＝内嵌知识条目 `interpreter-encoding-discipline`：
	 * - 既有文件保持原编码、原 BOM、原行尾（⛔ CP932↔UTF-8 互转）；
	 * - 新建 .ERB/.ERH/.CSV 一律 UTF-8 带 BOM；
	 * - 写后复检 BOM 数量与行尾。
	 *
	 * 字节编码在宿主侧执行（iconv-lite），判据本身来自核心库 `@eraharness/encoding/write`。
	 * 失败只告警，绝不阻断保存——保存已经成功了，这里只是把形态修正回来。
	 *
	 * @returns 人话结论；符合判据且无需说明时返回 undefined（⛔ 给模型制造噪音）
	 */
	private async enforceWriteEncoding(): Promise<string | undefined> {
		if (!this.absolutePath || this.editType === "delete") {
			return undefined
		}

		try {
			const before = this.originalFacts ?? null
			const hints = before ? undefined : await this.sampleSiblingHints(path.extname(this.absolutePath).toLowerCase())
			const plan = planSafeWrite(before, this.absolutePath, hints)

			const current = await fs.readFile(this.absolutePath)
			let degraded = false
			if (!writeTargetMatches(inspectFileBytes(current), plan.target)) {
				const encoded = this.encodeToTarget(decodeToUtf8(current).text, plan.target)
				degraded = encoded.degraded
				// 只有字节真的变了才落盘：fs.writeFile 会刷新 mtime，而 mtime 是引擎
				// 懒加载索引判断「这个文件变没变」的依据，无谓重写会白白触发重新加载。
				if (!encoded.buffer.equals(current)) {
					await fs.writeFile(this.absolutePath, encoded.buffer)
				}
			}

			const finalBytes = await fs.readFile(this.absolutePath)
			const verification = verifyWrite(before, plan.target, finalBytes)
			const notes: string[] = []
			if (plan.encodingConverted || plan.eolChanged) {
				notes.push(`已按 ${formatWriteTarget(plan.target)} 写回（${plan.reason}）`)
			}
			if (degraded) {
				notes.push(
					`注意：新内容里有 CP932 表示不了的字符（简体中文等），写不回原编码；` +
						`已降级为 UTF-8 带 BOM —— 原文件是 CP932，这次改动等于把它转成了 UTF-8。`,
				)
			}
			const problemText = formatWriteVerification(verification)
			if (problemText) {
				notes.push(problemText)
			}
			return notes.length > 0 ? notes.join("\n\n") : undefined
		} catch (error) {
			Logger.warn("Failed to enforce write encoding/line endings:", error)
			return undefined
		}
	}

	/**
	 * 按目标形态把文本变成字节。
	 * CP932 目标下若新内容含 CP932 表示不了的字符（简体中文等），宁可降级 UTF-8 带 BOM
	 * 也不能写出满篇 '?' —— 降级会被 `verifyWrite` 报成 encoding-converted 让人看见。
	 */
	private encodeToTarget(
		text: string,
		target: { encoding: "utf8" | "cp932"; bom: "none" | "utf8"; eol: "lf" | "crlf" },
	): { buffer: Buffer; degraded: boolean } {
		const withEol = applyEol(text, target.eol)
		let body: Buffer
		let bom = target.bom
		if (target.encoding === "cp932") {
			const encoded = iconv.encode(withEol, "cp932")
			if (iconv.decode(encoded, "cp932") === withEol) {
				body = encoded
			} else {
				body = Buffer.from(withEol, "utf8")
				// 降级时补 BOM：无 BOM 的 UTF-8 一旦含坏字节会被引擎静默按 CP932 解（enc-07）
				bom = "utf8"
			}
		} else {
			body = Buffer.from(withEol, "utf8")
		}
		const buffer = bom === "utf8" ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]) : body
		return { buffer, degraded: target.encoding === "cp932" && bom !== target.bom }
	}

	/**
	 * 新建文件该写成什么样：采样**同目录同扩展名兄弟文件**的现状，而不是假设这是个什么工程。
	 * 这样在「全员带 BOM 的整合包」和「纯 UTF-8 无 BOM 的小工程」里都能跟上现状。
	 */
	private async sampleSiblingHints(extension: string): Promise<NewFileHints | undefined> {
		if (!this.absolutePath) {
			return undefined
		}

		let siblings: string[] = []
		try {
			const entries = await fs.readdir(path.dirname(this.absolutePath), { withFileTypes: true })
			siblings = entries
				.filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === extension)
				.map((entry) => path.join(path.dirname(this.absolutePath!), entry.name))
				.slice(0, MAX_BOM_SAMPLE_FILES)
		} catch (error) {
			Logger.warn("Failed to inspect sibling files for encoding hints:", error)
			return undefined
		}

		let withBom = 0
		let crlf = 0
		let lf = 0
		let sampled = 0
		for (const sibling of siblings) {
			try {
				const buffer = await fs.readFile(sibling)
				sampled++
				if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
					withBom++
				}
				// 只看开头一段：行尾形态在前几 KB 就定下来了，没必要读完整份大文件
				const head = buffer.subarray(0, Math.min(buffer.length, SIBLING_SAMPLE_BYTES))
				const eol = inspectFileBytes(head).eol
				if (eol === "crlf") crlf++
				else if (eol === "lf") lf++
			} catch {
				// 读不到的兄弟文件不计入样本
			}
		}

		if (sampled === 0) {
			return undefined
		}
		return {
			siblingBomRatio: withBom / sampled,
			siblingEol: crlf === 0 && lf === 0 ? null : crlf >= lf ? "crlf" : "lf",
		}
	}

	async revertChanges(): Promise<void> {
		if (!this.absolutePath || !this.isEditing) {
			return
		}
		const fileExists = this.editType === "modify"

		if (!fileExists) {
			// This is a load-bearing save statement- even though the file is saved and then immediately deleted.
			// In vscode, it will not close the diff editor correctly if the file is not saved.
			await this.saveDocument()
			await this.closeAllDiffViews()
			await fs.rm(this.absolutePath, { force: true })
			Logger.log(`File ${this.absolutePath} has been deleted.`)

			// Remove only the directories we created, in reverse order
			for (let i = this.createdDirs.length - 1; i >= 0; i--) {
				try {
					await fs.rmdir(this.createdDirs[i])
					Logger.log(`Directory ${this.createdDirs[i]} has been deleted.`)
				} catch (error) {
					Logger.log(`Could not delete directory ${this.createdDirs[i]}`, error)
				}
			}
		} else {
			// revert document
			// Apply the edit and save, since contents shouldn't have changed this won't show in local history unless of
			// course the user made changes and saved during the edit.
			const contents = (await this.getDocumentText()) || ""
			const lineCount = (contents.match(/\n/g) || []).length + 1
			await this.replaceText(this.originalContent ?? "", { startLine: 0, endLine: lineCount }, undefined)

			await this.saveDocument()
			Logger.log(`File ${this.absolutePath} has been reverted to its original content.`)
			if (this.documentWasOpen) {
				openFile(this.absolutePath, true)
			}
			await this.closeAllDiffViews()
		}

		// edit is done
		await this.reset()
	}

	async scrollToFirstDiff() {
		if (!this.isEditing) {
			return
		}
		const currentContent = (await this.getDocumentText()) || ""
		const diffs = diff.diffLines(this.originalContent || "", currentContent)
		let lineCount = 0
		for (const part of diffs) {
			if (part.added || part.removed) {
				// Found the first diff, scroll to it
				this.scrollEditorToLine(lineCount)
				return
			}
			if (!part.removed) {
				lineCount += part.count || 0
			}
		}
	}

	async deleteFile(fileName: string) {
		const fileLocation = this.absolutePath
		if (!fileLocation?.endsWith(fileName) || !this.isEditing) {
			return
		}

		// Close diff views before deleting the file
		await this.closeAllDiffViews()

		// Delete the file
		try {
			await fs.rm(fileLocation, { force: true })
			Logger.log(`File ${fileLocation} has been deleted.`)
		} catch (error) {
			Logger.error(`Failed to delete file ${fileLocation}:`, error)
		}

		this.isEditing = false
		this.newContent = undefined
	}

	// close editor if open?
	async reset() {
		this.isEditing = false
		this.editType = undefined
		this.absolutePath = undefined
		this.relPath = undefined
		this.preDiagnostics = []

		this.originalContent = undefined
		this.fileEncoding = "utf8"
		this.originalHasBom = false
		this.originalFacts = undefined
		this.documentWasOpen = false

		this.streamedLines = []
		this.createdDirs = []
		this.newContent = undefined
		this.lastUpdateContentLength = -1
		this.lastUpdateTime = 0

		await this.resetDiffView()
	}
}

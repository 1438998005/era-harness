import fs from "node:fs/promises"
import path from "node:path"
import { setTimeout as setTimeoutPromise } from "node:timers/promises"
import type { ToolUse } from "@core/assistant-message"
import { constructNewFileContent, getLineNumberFromCharIndex } from "@core/assistant-message/diff"
import { appendEncodingNote } from "@core/era/encoding-write"
import { appendErbStructureWarning, isErbLikePath } from "@core/era/erb-check"
import { formatResponse } from "@core/prompts/responses"
import { getWorkspaceBasename, resolveWorkspacePath } from "@core/workspace"
import { processFilesIntoText } from "@integrations/misc/extract-text"
import { ClineSayTool } from "@shared/ExtensionMessage"
import { getLastApiReqTotalTokens } from "@shared/getApiMetrics"
import { fileExistsAtPath } from "@utils/fs"
import { arePathsEqual, getReadablePath, isLocatedInWorkspace } from "@utils/path"
import { applyPatch } from "diff"
import { telemetryService } from "@/services/telemetry"
import { formatBytes } from "@/shared/content-limits"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import { showNotificationForApproval } from "../../utils"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { captureAccepted, captureRejected, getModelInfo } from "../utils/AiOutputTelemetry"
import { applyModelContentFixes } from "../utils/ModelContentProcessor"
import { ToolResultUtils } from "../utils/ToolResultUtils"

/** 超过这个体积的已存在文件，整篇覆盖时要额外把关 */
const LARGE_FILE_OVERWRITE_THRESHOLD_BYTES = 200 * 1024
/** 新内容不足原文这个比例时，判定为「模型只写了一小段」 */
const LARGE_FILE_SHRINK_RATIO = 0.6

export class WriteToFileToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.FILE_NEW // This handler supports write_to_file, replace_in_file, and new_rule

	constructor(private validator: ToolValidator) {}

	/**
	 * write_to_file 是整篇覆盖：已存在的大文件如果新内容明显缩水，先拦下来。
	 * 实测 eraTW 有 83 个 ERB 超过 400K 字符，模型只写一小段就会删掉用户大半口上。
	 */
	private async checkLargeFileOverwrite(absolutePath: string, newContent: string): Promise<string | undefined> {
		let originalSize: number
		try {
			originalSize = (await fs.stat(absolutePath)).size
		} catch (_error) {
			return undefined
		}
		if (originalSize <= LARGE_FILE_OVERWRITE_THRESHOLD_BYTES) {
			return undefined
		}

		const newSize = Buffer.byteLength(newContent, "utf8")
		if (newSize >= originalSize * LARGE_FILE_SHRINK_RATIO) {
			return undefined
		}

		const percent = Math.round((newSize / originalSize) * 100)
		return (
			`目标文件有 ${formatBytes(originalSize)}，本次写入只有 ${formatBytes(newSize)}（${percent}%）。` +
			`write_to_file 会整篇覆盖，继续将丢失 ${100 - percent}% 的原内容。\n\n` +
			`请改用 replace_in_file 只替换需要修改的段落；如果确实要重写整篇，请先用 ask_followup_question 向用户确认后再重试。`
		)
	}

	getDescription(block: ToolUse): string {
		return `[${block.name} for '${block.params.path || block.params.absolutePath}']`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const rawRelPath = block.params.path || block.params.absolutePath
		const rawContent = block.params.content // for write_to_file
		const rawDiff = block.params.diff // for replace_in_file

		// era harness（2026-10-25 真实任务 1792887990433 取证）：流式半截参数可能含闭合
		// 标签残片（实测 `_tmp_search6.py</path`——content 已完整、path 尾部吞了半截
		// `</path`），partial 分支会拿它去 diffViewProvider.open → mkdir(dirname) 直接
		// EINVAL。解析器终值化已剥严格前缀残片；这里再兜一层：partial 阶段路径含尖括号
		// 一律静默跳过预览（残缺是暂态，完整块的 execute() 有同名守卫给模型可读报错）。
		if (rawRelPath && /[<>]/.test(rawRelPath)) {
			return
		}

		// Wait for path + the param this tool needs. Use `== null` for content so empty-string
		// writes still stream into the editor (mirrors execute()'s validation).
		const hasContent = block.name === "replace_in_file" ? !!rawDiff : rawContent != null
		if (!rawRelPath || !hasContent) {
			return
		}

		const config = uiHelpers.getConfig()

		// Creates file if it doesn't exist, and opens editor to stream content in. We don't want to handle this in the try/catch below since the error handler for it resets the diff view, which wouldn't be open if this failed.
		const result = await this.validateAndPrepareFileOperation(config, block, rawRelPath, rawDiff, rawContent)
		// 字符串是错误文本：partial 阶段不展示，交给完整块执行时统一投递。
		if (typeof result === "string" || !result) {
			return
		}

		try {
			const { relPath, absolutePath, fileExists, diff, content, newContent, matchIndices } = result

			// Create and show partial UI message
			const sharedMessageProps: ClineSayTool = {
				tool: fileExists ? "editedExistingFile" : "newFileCreated",
				path: getReadablePath(
					config.cwd,
					uiHelpers.removeClosingTag(block, block.params.path ? "path" : "absolutePath", relPath),
				),
				content: diff || content,
				operationIsLocatedInWorkspace: await isLocatedInWorkspace(relPath),
				startLineNumbers: matchIndices?.map((idx) =>
					getLineNumberFromCharIndex(config.services.diffViewProvider.originalContent || "", idx),
				),
			}
			const partialMessage = JSON.stringify(sharedMessageProps)

			// Handle auto-approval vs manual approval for partial
			if (await uiHelpers.shouldAutoApproveToolWithPath(block.name, relPath)) {
				await uiHelpers.removeLastPartialMessageIfExistsWithType("ask", "tool") // in case the user changes auto-approval settings mid stream
				await uiHelpers.say("tool", partialMessage, undefined, undefined, block.partial)
			} else {
				await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
				await uiHelpers.ask("tool", partialMessage, block.partial).catch(() => {})
			}

			// CRITICAL: Open editor and stream content in real-time (from original code)
			if (!config.services.diffViewProvider.isEditing) {
				// Open the editor and prepare to stream content in
				await config.services.diffViewProvider.open(absolutePath, { displayPath: relPath })
			}
			// Editor is open, stream content in real-time (false = don't finalize yet)
			await config.services.diffViewProvider.update(newContent, false)
		} catch (error) {
			// Reset diff view on error
			await config.services.diffViewProvider.revertChanges()
			await config.services.diffViewProvider.reset()
			throw error
		}
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const rawRelPath = block.params.path || block.params.absolutePath
		const rawContent = block.params.content // for write_to_file
		const rawDiff = block.params.diff // for replace_in_file

		// Extract provider information for telemetry
		const { providerId, modelId } = getModelInfo(config)

		// Validate required parameters based on tool type
		if (!rawRelPath) {
			config.taskState.consecutiveMistakeCount++
			await config.services.diffViewProvider.reset()
			return await config.callbacks.sayAndCreateMissingParamError(
				block.name,
				block.params.absolutePath ? "absolutePath" : "path",
			)
		}

		// era harness（2026-10-24 真实任务取证）：模型方言残片或流式截断会让 path 混入
		// `<`/`>`（实测 `_tmp_scan.py</path`——dirname 会把 `_tmp_scan.py<` 当目录名传给
		// mkdir，报 EINVAL 且用户看不懂）。含尖括号的路径在 Windows 上必然非法，与其让
		// fs 抛系统错误，不如在这里给出可读错误让模型重发干净参数。
		if (/[<>]/.test(rawRelPath)) {
			config.taskState.consecutiveMistakeCount++
			await config.services.diffViewProvider.reset()
			return formatResponse.toolError(
				`Invalid path '${rawRelPath}': the ${block.name} path contains '<' or '>' (usually a leftover from malformed tool-call markup). Re-issue the call with a clean <path>...</path> value.`,
			)
		}

		if (block.name === "replace_in_file" && !rawDiff) {
			config.taskState.consecutiveMistakeCount++
			await config.services.diffViewProvider.reset()
			const relPath = rawRelPath || "unknown"
			await config.callbacks.say(
				"error",
				`Cline tried to use replace_in_file for '${relPath}' without value for required parameter 'diff'. Retrying...`,
			)
			return formatResponse.toolError(formatResponse.replaceInFileMissingDiffError(relPath))
		}

		if (block.name === "write_to_file" && rawContent == null) {
			config.taskState.consecutiveMistakeCount++
			await config.services.diffViewProvider.reset()

			// Use progressive error with token budget awareness
			const relPath = rawRelPath || "unknown"
			const contextWindow = config.api.getModel().info.contextWindow ?? 128_000
			const lastApiReqTotalTokens = getLastApiReqTotalTokens(config.messageState.getClineMessages())
			const contextUsagePercent = contextWindow > 0 ? Math.round((lastApiReqTotalTokens / contextWindow) * 100) : undefined
			const errorMessage = formatResponse.writeToFileMissingContentError(
				relPath,
				config.taskState.consecutiveMistakeCount,
				contextUsagePercent,
			)

			await config.callbacks.say(
				"error",
				`Cline tried to use write_to_file for '${relPath}' without value for required parameter 'content'. ${
					config.taskState.consecutiveMistakeCount >= 2
						? "This has happened multiple times — Cline will try a different approach."
						: "Retrying..."
				}`,
			)
			return formatResponse.toolError(errorMessage)
		}

		if (block.name === "new_rule" && !rawContent) {
			config.taskState.consecutiveMistakeCount++
			await config.services.diffViewProvider.reset()
			return await config.callbacks.sayAndCreateMissingParamError(block.name, "content")
		}

		// NOTE: Do NOT reset consecutiveMistakeCount here - it should only be reset after successful completion
		// The reset was moved to after saveChanges() succeeds to properly track consecutive failures

		try {
			const result = await this.validateAndPrepareFileOperation(config, block, rawRelPath, rawDiff, rawContent)
			// handler 只负责返回错误文本，投递与 outcome 判定统一由 ToolExecutor 完成。
			if (typeof result === "string") {
				return result
			}
			if (!result) {
				return "" // can only happen if the sharedLogic adds an error to userMessages
			}

			const { relPath, absolutePath, fileExists, diff, content, newContent, workspaceContext, matchIndices } = result

			// reset() 会清掉 originalContent，先存一份用于 ERB 结构对比
			const originalContentBeforeEdit = config.services.diffViewProvider.originalContent

			// Handle approval flow
			const sharedMessageProps: ClineSayTool = {
				tool: fileExists ? "editedExistingFile" : "newFileCreated",
				path: getReadablePath(config.cwd, relPath),
				content: diff || content,
				operationIsLocatedInWorkspace: await isLocatedInWorkspace(relPath),
				startLineNumbers: matchIndices?.map((idx) =>
					getLineNumberFromCharIndex(config.services.diffViewProvider.originalContent || "", idx),
				),
			}
			// if isEditingFile false, that means we have the full contents of the file already.
			// it's important to note how this function works, you can't make the assumption that the block.partial conditional will always be called since it may immediately get complete, non-partial data. So this part of the logic will always be called.
			// in other words, you must always repeat the block.partial logic here
			if (!config.services.diffViewProvider.isEditing) {
				// show gui message before showing edit animation
				const partialMessage = JSON.stringify(sharedMessageProps)
				await config.callbacks.ask("tool", partialMessage, true).catch(() => {}) // sending true for partial even though it's not a partial, this shows the edit row before the content is streamed into the editor
				await config.services.diffViewProvider.open(absolutePath, { displayPath: relPath })
			}
			await config.services.diffViewProvider.update(newContent, true)
			await setTimeoutPromise(300) // wait for diff view to update
			await config.services.diffViewProvider.scrollToFirstDiff()
			// showOmissionWarning(this.diffViewProvider.originalContent || "", newContent)

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: diff || content,
				operationIsLocatedInWorkspace: await isLocatedInWorkspace(relPath),
				// ? formatResponse.createPrettyPatch(
				// 		relPath,
				// 		this.diffViewProvider.originalContent,
				// 		newContent,
				// 	)
				// : undefined,
			} satisfies ClineSayTool)

			if (await config.callbacks.shouldAutoApproveToolWithPath(block.name, relPath)) {
				// Auto-approval flow
				await config.callbacks.removeLastPartialMessageIfExistsWithType("ask", "tool")
				await config.callbacks.say("tool", completeMessage, undefined, undefined, false)

				// Capture telemetry
				telemetryService.captureToolUsage(
					config.ulid,
					block.name,
					modelId,
					providerId,
					true,
					true,
					workspaceContext,
					block.isNativeToolCall,
				)

				// Capture AI output accepted telemetry with line diff stats
				captureAccepted({
					ulid: config.ulid,
					tool: block.name,
					source: "agent",
					beforeContent: config.services.diffViewProvider.originalContent || "",
					afterContent: newContent,
					providerId,
					modelId,
					filesCreated: fileExists ? 0 : 1,
				})

				// we need an artificial delay to let the diagnostics catch up to the changes
				await setTimeoutPromise(3_500)
			} else {
				// Manual approval flow with detailed feedback handling
				const notificationMessage = `Cline wants to ${fileExists ? "edit" : "create"} ${getWorkspaceBasename(relPath, "WriteToFile.notification")}`

				// Show notification
				showNotificationForApproval(notificationMessage, config.autoApprovalSettings.enableNotifications)

				await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "tool")

				// Need a more customized tool response for file edits to highlight the fact that the file was not updated (particularly important for deepseek)

				const { response, text, images, files } = await config.callbacks.ask("tool", completeMessage, false)

				if (response !== "yesButtonClicked") {
					// Handle rejection with detailed messages
					const fileDeniedNote = fileExists
						? "The file was not updated, and maintains its original contents."
						: "The file was not created."

					// Process user feedback if provided (with file content processing)
					if (text || (images && images.length > 0) || (files && files.length > 0)) {
						let fileContentString = ""
						if (files && files.length > 0) {
							fileContentString = await processFilesIntoText(files)
						}

						// Push additional tool feedback using existing utilities
						ToolResultUtils.pushAdditionalToolFeedback(
							config.taskState.userMessageContent,
							text,
							images,
							fileContentString,
						)
						await config.callbacks.say("user_feedback", text, images, files)
					}

					// // Clean up the diff view when operation is rejected
					// await config.services.diffViewProvider.revertChanges()
					// await config.services.diffViewProvider.reset()

					config.taskState.didRejectTool = true
					telemetryService.captureToolUsage(
						config.ulid,
						block.name,
						modelId,
						providerId,
						false,
						false,
						workspaceContext,
						block.isNativeToolCall,
					)

					// Capture AI output rejected telemetry with line diff stats
					captureRejected({
						ulid: config.ulid,
						tool: block.name,
						source: "agent",
						beforeContent: config.services.diffViewProvider.originalContent || "",
						afterContent: newContent,
						providerId,
						modelId,
						filesCreated: fileExists ? 0 : 1,
					})

					await config.services.diffViewProvider.revertChanges()
					return `The user denied this operation. ${fileDeniedNote}`
				}
				// User hit the approve button, and may have provided feedback
				if (text || (images && images.length > 0) || (files && files.length > 0)) {
					let fileContentString = ""
					if (files && files.length > 0) {
						fileContentString = await processFilesIntoText(files)
					}

					// Push additional tool feedback using existing utilities
					ToolResultUtils.pushAdditionalToolFeedback(
						config.taskState.userMessageContent,
						text,
						images,
						fileContentString,
					)
					await config.callbacks.say("user_feedback", text, images, files)
				}

				telemetryService.captureToolUsage(
					config.ulid,
					block.name,
					modelId,
					providerId,
					false,
					true,
					workspaceContext,
					block.isNativeToolCall,
				)

				// Capture AI output accepted telemetry with line diff stats (manual approval)
				captureAccepted({
					ulid: config.ulid,
					tool: block.name,
					source: "agent",
					beforeContent: config.services.diffViewProvider.originalContent || "",
					afterContent: newContent,
					providerId,
					modelId,
					filesCreated: fileExists ? 0 : 1,
				})
			}

			// Run PreToolUse hook after approval but before execution
			try {
				const { ToolHookUtils } = await import("../utils/ToolHookUtils")
				await ToolHookUtils.runPreToolUseIfEnabled(config, block)
			} catch (error) {
				const { PreToolUseHookCancellationError } = await import("@core/hooks/PreToolUseHookCancellationError")
				if (error instanceof PreToolUseHookCancellationError) {
					await config.services.diffViewProvider.revertChanges()
					await config.services.diffViewProvider.reset()
					return formatResponse.toolDenied()
				}
				throw error
			}

			// Mark the file as edited by Cline
			config.services.fileContextTracker.markFileAsEditedByCline(relPath)

			// Save the changes and get the result
			const { newProblemsMessage, userEdits, autoFormattingEdits, finalContent, encodingNote } =
				await config.services.diffViewProvider.saveChanges()

			// Reset consecutive mistake counter on successful file operation
			config.taskState.consecutiveMistakeCount = 0

			config.taskState.didEditFile = true // used to determine if we should wait for busy terminal to update before sending api request

			// Invalidate file read cache for this file so re-reads get fresh content
			config.taskState.fileReadCache.delete(absolutePath.toLowerCase())

			// Track file edit operation
			await config.services.fileContextTracker.trackFileContext(relPath, "cline_edited")

			// Reset the diff view
			await config.services.diffViewProvider.reset()

			// Handle user edits if any
			if (userEdits) {
				await config.services.fileContextTracker.trackFileContext(relPath, "user_edited")
				await config.callbacks.say(
					"user_feedback_diff",
					JSON.stringify({
						tool: fileExists ? "editedExistingFile" : "newFileCreated",
						path: relPath,
						diff: userEdits,
					}),
				)

				// Capture human edit telemetry: diff between agent's proposed content and user's pre-save edits
				// Use applyPatch to reconstruct pre-save content from userEdits, excluding auto-formatting noise
				const preSaveContent = applyPatch(newContent, userEdits)
				captureAccepted({
					ulid: config.ulid,
					tool: block.name,
					source: "human",
					beforeContent: newContent,
					afterContent: preSaveContent || finalContent || "",
					providerId,
					modelId,
				})

				return appendEncodingNote(
					formatResponse.fileEditWithUserChanges(
						relPath,
						userEdits,
						autoFormattingEdits,
						finalContent,
						newProblemsMessage,
					),
					encodingNote,
				)
			}
			const editResult = formatResponse.fileEditWithoutUserChanges(
				relPath,
				autoFormattingEdits,
				finalContent,
				newProblemsMessage,
			)
			const withEncoding = appendEncodingNote(editResult, encodingNote)
			return isErbLikePath(relPath)
				? appendErbStructureWarning(withEncoding, originalContentBeforeEdit, finalContent ?? newContent)
				: withEncoding
		} catch (error) {
			// Reset diff view on error
			await config.services.diffViewProvider.revertChanges()
			await config.services.diffViewProvider.reset()
			throw error
		}
	}

	/**
	 * Shared validation and preparation logic used by both handlePartialBlock and execute methods.
	 * This validates file access permissions, checks if the file exists, and constructs the new content
	 * from either direct content or diff patches. It handles both creation of new files and modifications
	 * to existing ones.
	 *
	 * @param config The task configuration containing services and state
	 * @param block The tool use block containing the operation parameters
	 * @param relPath The relative path to the target file
	 * @param diff Optional diff content for replace operations
	 * @param content Optional direct content for write operations
	 * @param provider Optional provider string for telemetry (used when capturing diff edit failures)
	 * @returns Object containing validated path, file existence status, diff/content, and constructed new content,
	 *          or undefined if validation fails
	 */
	async validateAndPrepareFileOperation(config: TaskConfig, block: ToolUse, relPath: string, diff?: string, content?: string) {
		// Parse workspace hint and resolve path for multi-workspace support
		const pathResult = resolveWorkspacePath(config, relPath, "WriteToFileToolHandler.validateAndPrepareFileOperation")
		const { absolutePath, resolvedPath } =
			typeof pathResult === "string"
				? { absolutePath: pathResult, resolvedPath: relPath }
				: { absolutePath: pathResult.absolutePath, resolvedPath: pathResult.resolvedPath }

		// Determine workspace context for telemetry
		const fallbackAbsolutePath = path.resolve(config.cwd, relPath)
		const workspaceContext = {
			isMultiRootEnabled: config.isMultiRootEnabled || false,
			usedWorkspaceHint: typeof pathResult !== "string", // multi-root path result indicates hint usage
			resolvedToNonPrimary: !arePathsEqual(absolutePath, fallbackAbsolutePath),
			resolutionMethod: (typeof pathResult !== "string" ? "hint" : "primary_fallback") as "hint" | "primary_fallback",
		}

		// Check clineignore access first
		const accessValidation = this.validator.checkClineIgnorePath(resolvedPath)
		if (!accessValidation.ok) {
			// Show error and return early (full original behavior)
			await config.callbacks.say("clineignore_error", resolvedPath)

			// 只 return，不在 handler 里 push：投递交给 ToolExecutor，否则结果会被判成 ok。
			return formatResponse.toolError(formatResponse.clineIgnoreError(resolvedPath))
		}

		// Check if file exists to determine the correct UI message
		let fileExists: boolean
		if (config.services.diffViewProvider.editType !== undefined) {
			fileExists = config.services.diffViewProvider.editType === "modify"
		} else {
			fileExists = await fileExistsAtPath(absolutePath)
			config.services.diffViewProvider.editType = fileExists ? "modify" : "create"
		}

		// Construct newContent from diff
		let newContent: string
		let matchIndices: number[] = []
		newContent = "" // default to original content if not editing

		if (diff) {
			// Handle replace_in_file with diff construction
			// Apply model-specific fixes (deepseek models tend to use unescaped html entities in diffs)
			diff = applyModelContentFixes(diff, config.api.getModel().id, resolvedPath)

			// open the editor if not done already.  This is to fix diff error when model provides correct search-replace text but Cline throws error
			// because file is not open.
			if (!config.services.diffViewProvider.isEditing) {
				await config.services.diffViewProvider.open(absolutePath, { displayPath: relPath })
			}

			try {
				const result = await constructNewFileContent(
					diff,
					config.services.diffViewProvider.originalContent || "",
					!block.partial, // Pass the partial flag correctly
				)
				newContent = result.newContent
				matchIndices = result.matchIndices
			} catch (error) {
				// During streaming (block.partial=true), the diff may fail repeatedly as incomplete content streams in.
				// Skip all error UI handling for partial blocks to prevent flickering.
				if (block.partial) {
					return
				}

				config.taskState.consecutiveMistakeCount++

				// Removes any existing diff_error messages to avoid duplicates.
				await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "diff_error")
				await config.callbacks.say("diff_error", relPath, undefined, undefined, true)

				// Extract provider information for telemetry
				const { providerId, modelId } = getModelInfo(config)

				// Extract error type from error message if possible
				const errorType =
					error instanceof Error && error.message.includes("does not match anything")
						? "search_not_found"
						: "other_diff_error"

				// Add telemetry for diff edit failure
				const isNativeToolCall = block.isNativeToolCall === true
				telemetryService.captureDiffEditFailure(config.ulid, modelId, providerId, errorType, isNativeToolCall)

				// 只 return，不在 handler 里 push：投递交给 ToolExecutor，否则这次失败会被记成 ok。
				const errorResponse = formatResponse.toolError(
					`${(error as Error)?.message}\n\n` +
						formatResponse.diffError(relPath, config.services.diffViewProvider.getOriginalContentForLLM()),
				)

				// Revert changes and reset diff view
				await config.services.diffViewProvider.revertChanges()
				await config.services.diffViewProvider.reset()

				return errorResponse
			}
		} else if (content != null) {
			// Handle write_to_file with direct content (empty string is valid)
			newContent = content

			// pre-processing newContent for cases where weaker models might add artifacts like markdown codeblock markers (deepseek/llama) or extra escape characters (gemini)
			if (newContent.startsWith("```")) {
				// this handles cases where it includes language specifiers like ```python ```js
				newContent = newContent.split("\n").slice(1).join("\n").trim()
			}
			if (newContent.endsWith("```")) {
				newContent = newContent.split("\n").slice(0, -1).join("\n").trim()
			}

			// Apply model-specific fixes (llama, gemini, and other models may add escape characters)
			newContent = applyModelContentFixes(newContent, config.api.getModel().id, resolvedPath)
		} else {
			// can't happen, since we already checked for content/diff above. but need to do this for type error
			return
		}

		// 大文件整篇覆盖保护（流式 partial 阶段不检查，那时内容本来就不完整）
		if (!block.partial && content != null && fileExists) {
			const overwriteWarning = await this.checkLargeFileOverwrite(absolutePath, newContent)
			if (overwriteWarning) {
				// 只 return，不在 handler 里 push：投递交给 ToolExecutor，否则这次失败会被记成 ok。
				return formatResponse.toolError(overwriteWarning)
			}
		}

		return { relPath, absolutePath, fileExists, diff, content, newContent, workspaceContext, matchIndices }
	}
}

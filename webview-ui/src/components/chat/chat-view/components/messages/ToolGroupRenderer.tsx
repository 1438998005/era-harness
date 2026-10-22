import { ClineMessage, ClineSayTool } from "@shared/ExtensionMessage"
import { StringRequest } from "@shared/proto/cline/common"
import i18next from "i18next"
import { memo, useCallback, useMemo, useState } from "react"
import { TypewriterText } from "@/components/chat/TypewriterText"
import { cleanPathPrefix } from "@/components/common/CodeAccordian"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileServiceClient } from "@/services/grpc-client"
import { findRoundModelId, getIconByToolName, getToolsNotInCurrentActivities, isLowStakesTool } from "../../utils/messageUtils"

interface ToolGroupRendererProps {
	messages: ClineMessage[]
	allMessages: ClineMessage[]
	isLastGroup: boolean
}

interface ToolWithReasoning {
	tool: ClineMessage
	parsedTool: ClineSayTool
	reasoning?: string
	isActive?: boolean
	activityText?: string
	/** 1 for a single call; N when identical read_file calls were merged into this row. */
	repeatCount?: number
}

const EXPANDABLE_TOOLS = new Set(["listFilesTopLevel", "listFilesRecursive", "listCodeDefinitionNames", "searchFiles"])

// Helper to format activity text for active items (from RequestStartRow logic)
const getActivityText = (tool: ClineSayTool): string | null => {
	const cleanedPath = cleanPathPrefix(tool.path || "")
	const formatSearchRegex = (regex: string, path: string, filePattern?: string): string => {
		const cleanedPath = cleanPathPrefix(path)
		const terms = regex
			.split("|")
			.map((t) => t.trim().replace(/\\b/g, "").replace(/\\s\?/g, " "))
			.filter(Boolean)
			.join(" | ")
		return filePattern && filePattern !== "*"
			? i18next.t("toolGroup.searchInPathWithPattern", { terms, path: cleanedPath, pattern: filePattern })
			: i18next.t("toolGroup.searchInPath", { terms, path: cleanedPath })
	}

	switch (tool.tool) {
		case "readFile": {
			if (!tool.path) {
				return null
			}
			const lineHint =
				tool.readLineStart != null && tool.readLineEnd != null
					? i18next.t("toolGroup.lines", { start: tool.readLineStart, end: tool.readLineEnd })
					: ""
			return i18next.t("toolGroup.reading", { path: cleanedPath, lineHint })
		}
		case "listFilesTopLevel":
		case "listFilesRecursive":
			return tool.path ? i18next.t("toolGroup.exploring", { path: cleanedPath }) : null
		case "searchFiles":
			return tool.regex && tool.path
				? i18next.t("toolGroup.searching", { query: formatSearchRegex(tool.regex, tool.path, tool.filePattern) })
				: null
		case "listCodeDefinitionNames":
			return tool.path ? i18next.t("toolGroup.analyzing", { path: cleanedPath }) : null
		default:
			return null
	}
}

// Calculate current activities (from RequestStartRow logic)
const getCurrentActivities = (allMessages: ClineMessage[]): ClineMessage[] => {
	// Find current api_req
	let currentApiReqIndex = -1
	for (let i = allMessages.length - 1; i >= 0; i--) {
		const msg = allMessages[i]
		if (msg.say === "api_req_started" && msg.text) {
			try {
				const info = JSON.parse(msg.text)
				const hasCost = info.cost != null
				if (!hasCost) {
					currentApiReqIndex = i
					break
				}
			} catch {
				// ignore
			}
		}
	}

	if (currentApiReqIndex === -1) {
		return []
	}

	// Collect tools AFTER the current api_req_started
	const activities: ClineMessage[] = []
	for (let i = currentApiReqIndex + 1; i < allMessages.length; i++) {
		const msg = allMessages[i]
		// Only collect tools that are currently executing (ask === "tool")
		// Skip completed tools (say === "tool") - they should be in the completed list
		if (msg.say === "tool" || msg.ask !== "tool") {
			continue
		}
		if (isLowStakesTool(msg)) {
			activities.push(msg)
		}
	}

	return activities
}

/**
 * Renders a collapsible group of low-stakes tool calls.
 * Shows both completed tools AND currently active tools in a unified list (only for last group).
 */
export const ToolGroupRenderer = memo(({ messages, allMessages, isLastGroup }: ToolGroupRendererProps) => {
	const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({})

	// Filter out tools in the "current activities" range (being shown in loading state)
	const filteredMessages = useMemo(() => getToolsNotInCurrentActivities(messages, allMessages), [messages, allMessages])

	// Get current activities (active reading/exploring) - only for last group
	const currentActivities = useMemo(() => {
		if (!isLastGroup) {
			return []
		}
		return getCurrentActivities(allMessages)
	}, [allMessages, isLastGroup])

	// Build completed tool items
	const completedTools = useMemo(() => buildToolsWithReasoning(filteredMessages), [filteredMessages])

	// Build active tool items
	const activeTools = useMemo(() => {
		return currentActivities
			.map((msg) => {
				const parsedTool = parseToolSafe(msg.text)
				return {
					tool: msg,
					parsedTool,
					reasoning: undefined,
					repeatCount: 1,
					isActive: true,
					activityText: getActivityText(parsedTool),
				}
			})
			.filter((item) => item.activityText)
	}, [currentActivities])

	// Merge: completed items first, then active items (active only added to last group)
	// Deduplicate - exclude completed items that match active items by path
	const allTools = useMemo(() => {
		// Get paths of active items
		const activePaths = new Set(activeTools.map((item) => item.parsedTool.path).filter(Boolean))

		// Filter out completed items that are also being actively read
		const dedupedCompleted = completedTools.filter((item) => !activePaths.has(item.parsedTool.path))

		return [...dedupedCompleted, ...activeTools]
	}, [completedTools, activeTools])

	const summary = getToolGroupSummaryFromParsedTools(completedTools.map((item) => item.parsedTool))

	// 本轮模型名（每轮模型名显示锚点之二）：无思考行的回合（纯工具分组可见）才在分组头显示；
	// 有思考行的回合一律由思考行展示（giveUpAtReasoning=true 去重，见 messageUtils 注释）。
	const roundModelId = useMemo(() => {
		const firstTool = messages.find(isLowStakesTool)
		return firstTool ? findRoundModelId(firstTool.ts, allMessages, true) : undefined
	}, [messages, allMessages])

	const handleOpenFile = useCallback((filePath: string) => {
		FileServiceClient.openFileRelativePath(StringRequest.create({ value: filePath })).catch((err) =>
			console.error("Failed to open file:", err),
		)
	}, [])

	const handleItemToggle = useCallback((ts: number) => {
		setExpandedItems((prev) => ({ ...prev, [ts]: !prev[ts] }))
	}, [])

	// Don't render if no tools to show
	if (allTools.length === 0) {
		return null
	}

	return (
		<div className={cn("px-4 py-2 ml-1 text-description")}>
			{/* Header */}
			<div className="text-[13px] text-description font-semibold mb-1">
				{summary}:
				{roundModelId && (
					<span className="ml-1.5 font-normal text-[11px] opacity-80" title={roundModelId}>
						{i18next.t("requestStart.model")}: {roundModelId}
					</span>
				)}
			</div>

			{/* Content - unified list of completed + active tools */}
			<div className="min-w-0">
				{allTools.map(({ tool, parsedTool, isActive, activityText, repeatCount }) => {
					const info = getToolDisplayInfo(parsedTool)
					if (!info) {
						return null
					}

					const isExpandable = EXPANDABLE_TOOLS.has(parsedTool.tool)
					const isItemExpanded = expandedItems[tool.ts] ?? false
					const content = parsedTool.content || null

					// Active items render with "Reading..." TypewriterText (match completed item structure exactly)
					if (isActive && activityText) {
						return (
							<div className="min-w-0" key={tool.ts}>
								{/* ACTIVE "READING..." ITEM STYLING - Modify vertical spacing here via py-0 and -my-0.5 */}
								<Button
									className="flex items-center gap-[3px] text-[13px] text-description py-[1px] min-w-0 max-w-full px-0 leading-tight -my-0.5"
									disabled
									size="icon"
									variant="text">
									<info.icon className="opacity-70 shrink-0 size-[12px]" />
									<span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-left text-[13px]">
										<TypewriterText speed={15} text={activityText} />
									</span>{" "}
								</Button>
							</div>
						)
					}

					// Completed items render normally (clickable)
					return (
						<div className="min-w-0" key={tool.ts}>
							<Button
								className="flex items-center gap-[3px] cursor-pointer text-[13px] text-description py-[1px] hover:text-link min-w-0 max-w-full px-0 leading-tight -my-0.5"
								onClick={() => (isExpandable ? handleItemToggle(tool.ts) : handleOpenFile(info.path))}
								size="icon"
								variant="text">
								<info.icon className="opacity-70 shrink-0 size-[12px]" />
								<span
									className={cn(
										"flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-left [direction:rtl] text-[13px]",
										{
											"[direction:ltr]": !!info.displayText,
										},
									)}>
									{`${info.displayText || cleanPathPrefix(info.path)}\u200E`}
								</span>
								{repeatCount !== undefined && repeatCount > 1 && (
									<span className="shrink-0 ml-1 text-[11px] opacity-70" title={`${repeatCount} 次相同调用`}>
										×{repeatCount}
									</span>
								)}
							</Button>
							{/* Expanded content for folders/search/definitions - file lists only */}
							{isExpandable && isItemExpanded && content && (
								<pre className="m-1 ml-4 text-xs opacity-80 whitespace-pre-wrap break-words p-2 max-h-40 overflow-auto rounded-xs">
									{content}
								</pre>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
})

/**
 * 两次 read_file 能否合并成一行。
 *
 * 「无区间」必须当通配：审批流里 `ask("tool")` 只带 path，完成后的 `say("tool")` 一定带行区间，
 * 严格比区间会把同一次读取拆成两行（也会让 ×N 累加失效）。
 */
function isSameRead(previous: ClineSayTool | undefined, current: ClineSayTool): boolean {
	if (!previous || previous.tool !== "readFile" || current.tool !== "readFile") {
		return false
	}
	if (!previous.path || previous.path !== current.path) {
		return false
	}

	const previousHasRange = previous.readLineStart !== undefined || previous.readLineEnd !== undefined
	const currentHasRange = current.readLineStart !== undefined || current.readLineEnd !== undefined
	if (!previousHasRange || !currentHasRange) {
		return true
	}

	return previous.readLineStart === current.readLineStart && previous.readLineEnd === current.readLineEnd
}

/**
 * Build tool items WITHOUT reasoning.
 * Reasoning should not be displayed in file lists - only file/folder content.
 */
export function buildToolsWithReasoning(messages: ClineMessage[]): ToolWithReasoning[] {
	const result: ToolWithReasoning[] = []

	for (const msg of messages) {
		// Skip reasoning messages - they should not be in file lists
		if (msg.say === "reasoning") {
			continue
		}

		if (isLowStakesTool(msg)) {
			const parsedTool = parseToolSafe(msg.text)
			const previous = result.at(-1)

			// Merge every repeat of the same file+range into the previous row and count it.
			// The previous rule only collapsed the "ask tool → say tool" approval hand-off,
			// so consecutive `say` rows piled up and made one repeated read look like dozens.
			const mergesPreviousRead = isSameRead(previous?.parsedTool, parsedTool)

			if (mergesPreviousRead) {
				// 只有「两条已完成的 say」才算真正的重复调用；
				// ask→say（审批交接）和流式 partial 都是同一次读取，不能把计数 +1（否则单次读取会显示 ×2）。
				const bothCompleted = previous?.tool.say === "tool" && msg.say === "tool"
				// 无区间的消息（审批 ask / partial）不能把已完成行的区间抹掉：
				// 否则「读 A 1-100 → 审批 ask → 读 A 200-300」会只剩最后一行，前一次读取从列表消失。
				const previousHasRange =
					previous?.parsedTool.readLineStart !== undefined || previous?.parsedTool.readLineEnd !== undefined
				const currentHasRange = parsedTool.readLineStart !== undefined || parsedTool.readLineEnd !== undefined
				const keepPreviousDisplay = !currentHasRange && !!previousHasRange

				result[result.length - 1] = {
					tool: keepPreviousDisplay && previous ? previous.tool : msg,
					parsedTool: keepPreviousDisplay && previous ? previous.parsedTool : parsedTool,
					reasoning: undefined,
					repeatCount: bothCompleted ? (previous?.repeatCount ?? 1) + 1 : (previous?.repeatCount ?? 1),
				}
				continue
			}
			result.push({
				tool: msg,
				parsedTool,
				reasoning: undefined, // Never show reasoning in file lists
				repeatCount: 1,
			})
		}
	}

	return result
}

/**
 * Safely parse tool JSON, returning empty tool on failure.
 */
function parseToolSafe(text: string | undefined): ClineSayTool {
	try {
		return JSON.parse(text || "{}") as ClineSayTool
	} catch {
		return {} as ClineSayTool
	}
}

/**
 * Get display info for a tool.
 */
function getToolDisplayInfo(tool: ClineSayTool) {
	const icon = getIconByToolName(tool.tool)
	const filePath = tool.path || ""
	const folderPath = `${filePath}/`

	switch (tool.tool) {
		case "readFile": {
			const lineNote =
				tool.readLineStart != null && tool.readLineEnd != null ? `${tool.readLineStart}-${tool.readLineEnd}` : null
			return {
				icon,
				path: filePath,
				label: "read",
				displayText: lineNote ? `${cleanPathPrefix(filePath)} · ${lineNote}` : undefined,
			}
		}
		case "listFilesTopLevel":
			return { icon, path: folderPath, label: "listed" }
		case "listFilesRecursive":
			return { icon, path: folderPath, label: "listed recursively" }
		case "listCodeDefinitionNames":
			return { icon, path: folderPath, label: "definitions" }
		case "searchFiles":
			return {
				icon,
				path: folderPath,
				label: `search: ${tool.regex}`,
				displayText: formatSearchDisplay(tool.regex || "", filePath, tool.filePattern),
			}
		default:
			return null
	}
}

/**
 * Format search regex for display - simplify complex patterns
 */
function formatSearchDisplay(regex: string, path: string, filePattern?: string): string {
	// Split by | and clean up regex syntax
	const terms = regex
		.split("|")
		.map((t) => t.trim().replace(/\\b/g, "").replace(/\\s\?/g, " "))
		.filter(Boolean)

	const termDisplay =
		terms.length > 3 ? i18next.t("toolGroup.patternsCount", { count: terms.length }) : `"${terms.join(" | ")}"`

	return filePattern && filePattern !== "*"
		? i18next.t("toolGroup.searchInPathWithPattern", {
				terms: termDisplay,
				path: cleanPathPrefix(path),
				pattern: filePattern,
			})
		: i18next.t("toolGroup.searchInPath", { terms: termDisplay, path: cleanPathPrefix(path) })
}

/**
 * Get summary label for a tool group - shows what's been added to context.
 */
export function getToolGroupSummaryFromParsedTools(tools: ClineSayTool[]): string {
	const counts = { read: 0, list: 0, search: 0, def: 0 }

	for (const tool of tools) {
		switch (tool.tool) {
			case "readFile":
				counts.read++
				break
			case "listFilesTopLevel":
			case "listFilesRecursive":
				counts.list++
				break
			case "searchFiles":
				counts.search++
				break
			case "listCodeDefinitionNames":
				counts.def++
				break
		}
	}

	const parts: string[] = []
	const action = counts.read > 0 || counts.list > 0 ? i18next.t("toolGroup.read") : " "

	if (counts.read > 0) {
		parts.push(`${counts.read} ${i18next.t(counts.read > 1 ? "toolGroup.files" : "toolGroup.file")}`)
	}
	if (counts.list > 0) {
		parts.push(`${counts.list} ${i18next.t(counts.list > 1 ? "toolGroup.folders" : "toolGroup.folder")}`)
	}
	if (counts.def > 0) {
		parts.push(`${counts.def} ${i18next.t(counts.def > 1 ? "toolGroup.definitions" : "toolGroup.definition")}`)
	}
	if (counts.search > 0) {
		parts.push(
			`${i18next.t("toolGroup.performed")} ${counts.search} ${i18next.t(counts.search > 1 ? "toolGroup.searches" : "toolGroup.search")}`,
		)
	}

	return parts.length === 0
		? i18next.t("toolGroup.context")
		: i18next.t("toolGroup.summaryClineAction", { action, parts: parts.join(i18next.t("toolGroup.summaryPartsSeparator")) })
}

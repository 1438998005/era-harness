import { Anthropic } from "@anthropic-ai/sdk"
import { AssistantMessageContent } from "@core/assistant-message"
import { ClineAskResponse } from "@shared/WebviewMessage"
import type { HookExecution } from "./types/HookExecution"

export class TaskState {
	// Task-level timing
	taskStartTimeMs = Date.now()
	taskFirstTokenTimeMs?: number

	// Streaming flags
	isStreaming = false
	isWaitingForFirstChunk = false
	didCompleteReadingStream = false

	// Content processing
	currentStreamingContentIndex = 0
	assistantMessageContent: AssistantMessageContent[] = []
	userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam)[] = []
	userMessageContentReady = false
	// Map of tool names to their tool_use_id for creating proper ToolResultBlockParam
	toolUseIdMap: Map<string, string> = new Map()

	// Presentation locks
	presentAssistantMessageLocked = false
	presentAssistantMessageHasPendingUpdates = false

	// Ask/Response handling
	askResponse?: ClineAskResponse
	askResponseText?: string
	askResponseImages?: string[]
	askResponseFiles?: string[]
	lastMessageTs?: number

	// Plan mode specific state
	isAwaitingPlanResponse = false
	didRespondToPlanAskBySwitchingMode = false

	// Context and history
	conversationHistoryDeletedRange?: [number, number]

	// Tool execution flags
	didRejectTool = false
	didAlreadyUseTool = false
	didEditFile = false
	lastToolName = "" // Track last tool used for consecutive call detection
	lastToolParams = "" // Canonical signature of last tool's params (via toolCallSignature)
	consecutiveIdenticalToolCount = 0 // Consecutive calls with identical tool name + params

	// Windowed repetition tracking — catches "read A, read A, search, read A" patterns
	// that the strict-consecutive counter above resets on. Capped at REPEAT_WINDOW_SIZE.
	recentToolSignatures: Array<{ name: string; signature: string }> = []
	warnedRepeatSignatures: Set<string> = new Set() // soft warning emitted at most once per tool+signature

	// Per-range read counters (key = `${lowercased path}|${startLine}|${endLine}`).
	// Drives the graded repeat-read degradation in ReadFileToolHandler; cleared for a
	// path whenever its fileReadCache entry is evicted (file edited / mtime changed).
	fileReadCounts: Map<string, number> = new Map()

	// File read deduplication cache - prevents the model from endlessly reading the same files
	// Maps absolute file path → { readCount: times read in this task, mtime: last modified timestamp, imageBlock: optional image data for multimodal models, lastRange: last displayed line range (so a suppressed repeat can still be grouped in the UI) }
	fileReadCache: Map<
		string,
		{ readCount: number; mtime: number; imageBlock?: Anthropic.ImageBlockParam; lastRange?: [number, number] }
	> = new Map()

	// Error tracking
	consecutiveMistakeCount = 0
	// 本次熔断是否由循环检测升级直接拉满计数触发（ToolExecutor 的 escalate 路径）。
	// 用途：用户点「仍然继续」却不带文字时，据此注入一条「必须换策略」的提示——
	// 只重置计数会让模型重犯同一策略，形成「重置→重犯→再升级」死循环（2026-10-24
	// 真实任务 1792824640404 取证，见 知识库/12 §12.23）。在熔断处理处消费后复位。
	fuseArmedByLoopEscalation = false
	// 未知方言循环检测（2026-10-25，08 #46）：上一轮无工具正文的方言签名哈希。
	// 模型输出整块未识别方言（如单竖线 DSML）落正文时会同文重试无限烧钱；
	// 连续相同签名计入 consecutiveMistakeCount（3 轮即弹 mistake_limit 打断）。
	dialectLoopLastHash?: string
	doubleCheckCompletionPending = false
	didAutomaticallyRetryFailedApiRequest = false
	checkpointManagerErrorMessage?: string

	// Retry tracking for auto-retry feature
	autoRetryAttempts = 0

	// Task Initialization
	isInitialized = false

	// Focus Chain / Todo List Management
	apiRequestCount = 0
	apiRequestsSinceLastTodoUpdate = 0
	currentFocusChainChecklist: string | null = null
	todoListWasUpdatedByUser = false

	// era harness（D4，2026-10-25）：最近一次请求实际服务的 provider/model 快照。
	// 用户切 provider 后中止旧任务，abort 审计若实时读设置会把新 provider 记到旧任务
	// 头上（08 #46 嵌合记录的另一成因）；请求时快照才是「这个任务当时由谁服务」。
	lastRequestProviderInfo?: { provider?: string; model?: string }

	// era harness（D3，2026-10-25）：read_file 缓存命中元数据——handler 命中缓存时设置、
	// ToolExecutor 写审计时消费并清空，同一次 read_file 只落一条审计（此前 handler 与
	// ToolExecutor 各写一条，间隔 ~200ms，统计双计）。
	readToolAuditMeta?: { cacheHit: boolean; readCount: number }

	// Task Abort / Cancellation
	abort = false
	didFinishAbortingStream = false
	abandoned = false

	// Hook execution tracking for cancellation
	activeHookExecution?: HookExecution

	// Auto-context summarization
	currentlySummarizing = false
	lastAutoCompactTriggerIndex?: number
}

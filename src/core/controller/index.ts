import type { Anthropic } from "@anthropic-ai/sdk"
import { buildApiHandler } from "@core/api"
import { getHooksEnabledSafe } from "@core/hooks/hooks-utils"
import { parseIdentityFromText, setCurrentIdentityMode } from "@core/identity/scope"
import { recordAudit } from "@core/logging/auditLog"
import { tryAcquireTaskLockWithRetry } from "@core/task/TaskLockUtils"
import { detectWorkspaceRoots } from "@core/workspace/detection"
import { setupWorkspaceManager } from "@core/workspace/setup"
import type { WorkspaceRootManager } from "@core/workspace/WorkspaceRootManager"
import { cleanupLegacyCheckpoints } from "@integrations/checkpoints/CheckpointMigration"
import { McpHub } from "@services/mcp/McpHub"
import type { ApiProvider } from "@shared/api"
import type { ChatContent } from "@shared/ChatContent"
import type { ExtensionState, Platform } from "@shared/ExtensionMessage"
import type { HistoryItem } from "@shared/HistoryItem"
import type { McpMarketplaceCatalog } from "@shared/mcp"
import { type Settings } from "@shared/storage/state-keys"
import type { Mode } from "@shared/storage/types"
import type { TelemetrySetting } from "@shared/TelemetrySetting"
import type { UserInfo } from "@shared/UserInfo"
import { fileExistsAtPath } from "@utils/fs"
import axios from "axios"
import fs from "fs/promises"
import open from "open"
import pWaitFor from "p-wait-for"
import * as path from "path"
import { ClineEnv } from "@/config"
import type { FolderLockWithRetryResult } from "@/core/locks/types"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { BannerService } from "@/services/banner/BannerService"
import { featureFlagsService } from "@/services/feature-flags"
import { getDistinctId } from "@/services/logging/distinctId"
import { telemetryService } from "@/services/telemetry"
import { ClineExtensionContext } from "@/shared/cline"
import { getAxiosSettings } from "@/shared/net"
import { ShowMessageType } from "@/shared/proto/host/window"
import { Logger } from "@/shared/services/Logger"
import { Session } from "@/shared/services/Session"
import { getLatestAnnouncementId } from "@/utils/announcements"
import { getCwd } from "@/utils/path"
import { PromptRegistry } from "../prompts/system-prompt"
import { ensureMcpServersDirectoryExists, ensureSettingsDirectoryExists, GlobalFileNames } from "../storage/disk"
import { fetchRemoteConfig } from "../storage/remote-config/fetch"
import { type PersistenceErrorEvent, StateManager } from "../storage/StateManager"
import { Task } from "../task"
import { sendMcpMarketplaceCatalogEvent } from "./mcp/subscribeToMcpMarketplaceCatalog"
import { checkCliInstallation } from "./state/checkCliInstallation"
import { sendStateUpdate } from "./state/subscribeToState"
import { sendChatButtonClickedEvent } from "./ui/subscribeToChatButtonClicked"

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

export class Controller {
	task?: Task

	mcpHub: McpHub
	readonly stateManager: StateManager

	// NEW: Add workspace manager (optional initially)
	private workspaceManager?: WorkspaceRootManager
	private backgroundCommandRunning = false
	private backgroundCommandTaskId?: string

	// Flag to prevent duplicate cancellations from spam clicking
	private cancelInProgress = false

	// Public getter for workspace manager with lazy initialization - To get workspaces when task isn't initialized (Used by file mentions)
	async ensureWorkspaceManager(): Promise<WorkspaceRootManager | undefined> {
		if (!this.workspaceManager) {
			try {
				this.workspaceManager = await setupWorkspaceManager({
					stateManager: this.stateManager,
					detectRoots: detectWorkspaceRoots,
				})
			} catch (error) {
				Logger.error("[Controller] Failed to initialize workspace manager:", error)
			}
		}
		return this.workspaceManager
	}

	// Synchronous getter for workspace manager
	getWorkspaceManager(): WorkspaceRootManager | undefined {
		return this.workspaceManager
	}

	constructor(readonly context: ClineExtensionContext) {
		Session.reset() // Reset session on controller initialization
		PromptRegistry.getInstance() // Ensure prompts and tools are registered
		this.stateManager = StateManager.get()
		StateManager.get().registerCallbacks({
			onPersistenceError: async ({ error }: PersistenceErrorEvent) => {
				// Just log - don't call reInitialize() (that sets isInitialized=false which
				// breaks running tasks) and don't show a warning (data is safe in memory
				// and will be retried automatically on the next debounced persistence).
				Logger.error("[Controller] Storage persistence failed (will retry):", error)
			},
			onSyncExternalChange: async () => {
				await this.postStateToWebview()
			},
		})
		BannerService.initialize(this)

		this.mcpHub = new McpHub(
			() => ensureMcpServersDirectoryExists(),
			() => ensureSettingsDirectoryExists(),
			ExtensionRegistryInfo.version,
			telemetryService,
		)

		// Clean up legacy checkpoints
		cleanupLegacyCheckpoints().catch((error) => {
			Logger.error("Failed to cleanup legacy checkpoints:", error)
		})

		// Check CLI installation status once on startup
		checkCliInstallation(this)

		Logger.log("[Controller] ClineProvider instantiated")
	}

	/*
	VSCode extensions use the disposable pattern to clean up resources when the sidebar/editor tab is closed by the user or system. This applies to event listening, commands, interacting with the UI, etc.
	- https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/
	- https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	*/
	async dispose() {
		await this.clearTask()
		this.mcpHub.dispose()

		Logger.error("Controller disposed")
	}

	async setUserInfo(info?: UserInfo) {
		this.stateManager.setGlobalState("userInfo", info)
	}

	async initTask(
		task?: string,
		images?: string[],
		files?: string[],
		historyItem?: HistoryItem,
		taskSettings?: Partial<Settings>,
	) {
		// 身份 = 文件修改范围，随消息前缀下发；这里同步给自动批准判定
		const identityFromTask = parseIdentityFromText(task)
		if (identityFromTask) {
			setCurrentIdentityMode(identityFromTask)
		}

		// Fire-and-forget: We intentionally don't await fetchRemoteConfig here.
		// Remote config was removed in the era harness local-only build; this call is a no-op
		// kept for call-site compatibility.
		fetchRemoteConfig(this)

		await this.clearTask() // ensures that an existing task doesn't exist before starting a new one, although this shouldn't be possible since user must clear task before starting a new one

		const autoApprovalSettings = this.stateManager.getGlobalSettingsKey("autoApprovalSettings")
		const shellIntegrationTimeout = this.stateManager.getGlobalSettingsKey("shellIntegrationTimeout")
		const terminalReuseEnabled = this.stateManager.getGlobalStateKey("terminalReuseEnabled")
		const vscodeTerminalExecutionMode = this.stateManager.getGlobalStateKey("vscodeTerminalExecutionMode")
		const terminalOutputLineLimit = this.stateManager.getGlobalSettingsKey("terminalOutputLineLimit")
		const defaultTerminalProfile = this.stateManager.getGlobalSettingsKey("defaultTerminalProfile")
		const isNewUser = this.stateManager.getGlobalStateKey("isNewUser")
		const taskHistory = this.stateManager.getGlobalStateKey("taskHistory")

		const NEW_USER_TASK_COUNT_THRESHOLD = 10

		// Check if the user has completed enough tasks to no longer be considered a "new user"
		if (isNewUser && !historyItem && taskHistory && taskHistory.length >= NEW_USER_TASK_COUNT_THRESHOLD) {
			this.stateManager.setGlobalState("isNewUser", false)
			await this.postStateToWebview()
		}

		if (autoApprovalSettings) {
			const updatedAutoApprovalSettings = {
				...autoApprovalSettings,
				version: (autoApprovalSettings.version ?? 1) + 1,
			}
			this.stateManager.setGlobalState("autoApprovalSettings", updatedAutoApprovalSettings)
		}

		// Initialize and persist the workspace manager (multi-root or single-root) with telemetry + fallback
		this.workspaceManager = await setupWorkspaceManager({
			stateManager: this.stateManager,
			detectRoots: detectWorkspaceRoots,
		})

		// 只认工作区根；没有打开文件夹时为空字符串，由 UI 提示用户先打开工程目录
		const cwd = this.workspaceManager?.getPrimaryRoot()?.path || (await getCwd(""))

		const taskId = historyItem?.id || Date.now().toString()

		// Acquire task lock
		let taskLockAcquired = false
		const lockResult: FolderLockWithRetryResult = await tryAcquireTaskLockWithRetry(taskId)

		if (!lockResult.acquired && !lockResult.skipped) {
			const errorMessage = lockResult.conflictingLock
				? `Task locked by instance (${lockResult.conflictingLock.held_by})`
				: "Failed to acquire task lock"
			throw new Error(errorMessage) // Prevents task initialization
		}

		taskLockAcquired = lockResult.acquired
		if (lockResult.acquired) {
			Logger.debug(`[Task ${taskId}] Task lock acquired`)
		} else {
			Logger.debug(`[Task ${taskId}] Task lock skipped (VS Code)`)
		}

		await this.stateManager.loadTaskSettings(taskId)
		if (taskSettings) {
			this.stateManager.setTaskSettingsBatch(taskId, taskSettings)
		}

		this.task = new Task({
			controller: this,
			mcpHub: this.mcpHub,
			updateTaskHistory: (historyItem) => this.updateTaskHistory(historyItem),
			postStateToWebview: () => this.postStateToWebview(),
			reinitExistingTaskFromId: (taskId) => this.reinitExistingTaskFromId(taskId),
			cancelTask: () => this.cancelTask(),
			shellIntegrationTimeout,
			terminalReuseEnabled: terminalReuseEnabled ?? true,
			terminalOutputLineLimit: terminalOutputLineLimit ?? 500,
			defaultTerminalProfile: defaultTerminalProfile ?? "default",
			vscodeTerminalExecutionMode,
			cwd,
			stateManager: this.stateManager,
			workspaceManager: this.workspaceManager,
			task,
			images,
			files,
			historyItem,
			taskId,
			taskLockAcquired,
		})

		if (historyItem) {
			this.task.resumeTaskFromHistory()
		} else if (task || images || files) {
			this.task.startTask(task, images, files)
		}

		return this.task.taskId
	}

	async reinitExistingTaskFromId(taskId: string) {
		const history = await this.getTaskWithId(taskId)
		if (history) {
			// era harness（D4 事件边界，2026-10-25）：任务重建后 apiRequestCount 归零，
			// 审计里 turn 从头数没有解释；resume 事件补上边界。
			recordAudit({ event: "task", taskId, turn: 0, action: "resume" })
			await this.initTask(undefined, undefined, undefined, history.historyItem)
		}
	}

	async updateTelemetrySetting(telemetrySetting: TelemetrySetting) {
		// Get previous setting to detect state changes
		const previousSetting = this.stateManager.getGlobalSettingsKey("telemetrySetting")
		const wasOptedIn = previousSetting !== "disabled"
		const isOptedIn = telemetrySetting !== "disabled"

		// Capture opt-out event BEFORE updating (so it gets sent while telemetry is still enabled)
		if (wasOptedIn && !isOptedIn) {
			telemetryService.captureUserOptOut()
		}

		this.stateManager.setGlobalState("telemetrySetting", telemetrySetting)
		telemetryService.updateTelemetryState(isOptedIn)

		// Capture opt-in event AFTER updating (so telemetry is enabled to receive it)
		if (!wasOptedIn && isOptedIn) {
			telemetryService.captureUserOptIn()
		}

		await this.postStateToWebview()
	}

	async toggleActModeForYoloMode(): Promise<boolean> {
		const modeToSwitchTo: Mode = "act"

		// Switch to act mode
		this.stateManager.setGlobalState("mode", modeToSwitchTo)

		// Update API handler with new mode (buildApiHandler now selects provider based on mode)
		if (this.task) {
			const apiConfiguration = this.stateManager.getApiConfiguration()
			this.task.api = buildApiHandler({ ...apiConfiguration, ulid: this.task.ulid }, modeToSwitchTo)
		}

		await this.postStateToWebview()

		// Additional safety
		if (this.task) {
			return true
		}
		return false
	}

	async togglePlanActMode(modeToSwitchTo: Mode, chatContent?: ChatContent): Promise<boolean> {
		const didSwitchToActMode = modeToSwitchTo === "act"

		// Store mode to global state
		this.stateManager.setGlobalState("mode", modeToSwitchTo)

		// Capture mode switch telemetry | Capture regardless of if we know the taskId
		telemetryService.captureModeSwitch(this.task?.ulid ?? "0", modeToSwitchTo)

		// Update API handler with new mode (buildApiHandler now selects provider based on mode)
		if (this.task) {
			const apiConfiguration = this.stateManager.getApiConfiguration()
			this.task.api = buildApiHandler({ ...apiConfiguration, ulid: this.task.ulid }, modeToSwitchTo)
		}

		await this.postStateToWebview()

		if (this.task) {
			if (this.task.taskState.isAwaitingPlanResponse && didSwitchToActMode) {
				this.task.taskState.didRespondToPlanAskBySwitchingMode = true
				// Use chatContent if provided, otherwise use default message
				await this.task.handleWebviewAskResponse(
					"messageResponse",
					chatContent?.message || "PLAN_MODE_TOGGLE_RESPONSE",
					chatContent?.images || [],
					chatContent?.files || [],
				)

				return true
			}
			this.cancelTask()
			return false
		}

		return false
	}

	async cancelTask() {
		// Prevent duplicate cancellations from spam clicking
		if (this.cancelInProgress) {
			Logger.log(`[Controller.cancelTask] Cancellation already in progress, ignoring duplicate request`)
			return
		}

		if (!this.task) {
			return
		}

		// Set flag to prevent concurrent cancellations
		this.cancelInProgress = true

		try {
			this.updateBackgroundCommandState(false)

			try {
				await this.task.abortTask()
			} catch (error) {
				Logger.error("Failed to abort task", error)
			}

			await pWaitFor(
				() =>
					this.task === undefined ||
					this.task.taskState.isStreaming === false ||
					this.task.taskState.didFinishAbortingStream ||
					this.task.taskState.isWaitingForFirstChunk, // if only first chunk is processed, then there's no need to wait for graceful abort (closes edits, browser, etc)
				{
					timeout: 3_000,
				},
			).catch(() => {
				Logger.error("Failed to abort task")
			})

			if (this.task) {
				// 'abandoned' will prevent this cline instance from affecting future cline instance gui. this may happen if its hanging on a streaming request
				this.task.taskState.abandoned = true
			}

			// Small delay to ensure state manager has persisted the history update
			//await new Promise((resolve) => setTimeout(resolve, 100))

			// NOW try to get history after abort has finished (hook may have saved messages)
			let historyItem: HistoryItem | undefined
			try {
				const result = await this.getTaskWithId(this.task.taskId)
				historyItem = result.historyItem
			} catch (error) {
				// Task not in history yet (new task with no messages); catch the
				// error to enable the agent to continue making progress.
				Logger.log(`[Controller.cancelTask] Task not found in history: ${error}`)
			}

			// Only re-initialize if we found a history item, otherwise just clear
			if (historyItem) {
				// Re-initialize task to keep it visible in UI with resume button
				await this.initTask(undefined, undefined, undefined, historyItem, undefined)
			} else {
				await this.clearTask()
			}

			await this.postStateToWebview()
		} finally {
			// Always clear the flag, even if cancellation fails
			this.cancelInProgress = false
		}
	}

	updateBackgroundCommandState(running: boolean, taskId?: string) {
		const nextTaskId = running ? taskId : undefined
		if (this.backgroundCommandRunning === running && this.backgroundCommandTaskId === nextTaskId) {
			return
		}
		this.backgroundCommandRunning = running
		this.backgroundCommandTaskId = nextTaskId
		void this.postStateToWebview()
	}

	async cancelBackgroundCommand(): Promise<void> {
		const didCancel = await this.task?.cancelBackgroundCommand()
		if (!didCancel) {
			this.updateBackgroundCommandState(false)
		}
	}

	async handleMcpOAuthCallback(serverHash: string, code: string, state: string | null) {
		try {
			await this.mcpHub.completeOAuth(serverHash, code, state)
			await this.postStateToWebview()
			HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: `Successfully authenticated MCP server`,
			})
		} catch (error) {
			Logger.error("Failed to complete MCP OAuth:", error)
			HostProvider.window.showMessage({
				type: ShowMessageType.ERROR,
				message: `Failed to authenticate MCP server`,
			})
		}
	}

	async handleTaskCreation(prompt: string) {
		await sendChatButtonClickedEvent()
		await this.initTask(prompt)
	}

	// MCP Marketplace
	private async fetchMcpMarketplaceFromApi(): Promise<McpMarketplaceCatalog> {
		// era harness 减法：MCP 市场（cline.bot）已移除。
		// 本地版不拉取远端目录，MCP 服务器完全由本地 mcp_settings.json 管理。
		return { items: [] }
	}

	async refreshMcpMarketplace(sendCatalogEvent: boolean): Promise<McpMarketplaceCatalog | undefined> {
		try {
			const catalog = await this.fetchMcpMarketplaceFromApi()
			if (catalog && sendCatalogEvent) {
				await sendMcpMarketplaceCatalogEvent(catalog)
			}
			return catalog
		} catch (error) {
			Logger.error("Failed to refresh MCP marketplace:", error)
			return undefined
		}
	}

	// OpenRouter

	async handleOpenRouterCallback(code: string) {
		let apiKey: string
		try {
			const response = await axios.post("https://openrouter.ai/api/v1/auth/keys", { code }, getAxiosSettings())
			if (response.data && response.data.key) {
				apiKey = response.data.key
			} else {
				throw new Error("Invalid response from OpenRouter API")
			}
		} catch (error) {
			Logger.error("Error exchanging code for API key:", error)
			throw error
		}

		const openrouter: ApiProvider = "openrouter"
		const currentMode = this.stateManager.getGlobalSettingsKey("mode")

		// Update API configuration through cache service
		const currentApiConfiguration = this.stateManager.getApiConfiguration()
		const updatedConfig = {
			...currentApiConfiguration,
			planModeApiProvider: openrouter,
			actModeApiProvider: openrouter,
			openRouterApiKey: apiKey,
		}
		this.stateManager.setApiConfiguration(updatedConfig)

		await this.postStateToWebview()
		if (this.task) {
			this.task.api = buildApiHandler({ ...updatedConfig, ulid: this.task.ulid }, currentMode)
		}
		// Dont send settingsButtonClicked because its bad ux if user is on welcome
	}

	// Requesty

	async handleRequestyCallback(code: string) {
		const requesty: ApiProvider = "requesty"
		const currentMode = this.stateManager.getGlobalSettingsKey("mode")
		const currentApiConfiguration = this.stateManager.getApiConfiguration()
		const updatedConfig = {
			...currentApiConfiguration,
			planModeApiProvider: requesty,
			actModeApiProvider: requesty,
			requestyApiKey: code,
		}
		this.stateManager.setApiConfiguration(updatedConfig)
		await this.postStateToWebview()
		if (this.task) {
			this.task.api = buildApiHandler({ ...updatedConfig, ulid: this.task.ulid }, currentMode)
		}
	}

	// Task history

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		uiMessagesFilePath: string
		contextHistoryFilePath: string
		taskMetadataFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = this.stateManager.getGlobalStateKey("taskHistory")
		const historyItem = history.find((item) => item.id === id)
		if (historyItem) {
			const taskDirPath = path.join(HostProvider.get().globalStorageFsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory)
			const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages)
			const contextHistoryFilePath = path.join(taskDirPath, GlobalFileNames.contextHistory)
			const taskMetadataFilePath = path.join(taskDirPath, GlobalFileNames.taskMetadata)
			const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					uiMessagesFilePath,
					contextHistoryFilePath,
					taskMetadataFilePath,
					apiConversationHistory,
				}
			}
		}
		// if we tried to get a task that doesn't exist, remove it from state
		// FIXME: this seems to happen sometimes when the json file doesn't save to disk for some reason
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	async exportTaskWithId(id: string) {
		const { taskDirPath } = await this.getTaskWithId(id)
		Logger.log(`[EXPORT] Opening task directory: ${taskDirPath}`)
		await open(taskDirPath)
	}

	async deleteTaskFromState(id: string) {
		// Remove the task from history
		const taskHistory = this.stateManager.getGlobalStateKey("taskHistory")
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		this.stateManager.setGlobalState("taskHistory", updatedTaskHistory)

		// Notify the webview that the task has been deleted
		await this.postStateToWebview()

		return updatedTaskHistory
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview()
		await sendStateUpdate(state)
	}

	async getStateToPostToWebview(): Promise<ExtensionState> {
		// Get API configuration from cache for immediate access
		const apiConfiguration = this.stateManager.getApiConfiguration()
		const lastShownAnnouncementId = this.stateManager.getGlobalStateKey("lastShownAnnouncementId")
		const taskHistory = this.stateManager.getGlobalStateKey("taskHistory")
		const autoApprovalSettings = this.stateManager.getGlobalSettingsKey("autoApprovalSettings")
		const focusChainSettings = this.stateManager.getGlobalSettingsKey("focusChainSettings")
		const preferredLanguage = this.stateManager.getGlobalSettingsKey("preferredLanguage")
		const mode = this.stateManager.getGlobalSettingsKey("mode")
		const strictPlanModeEnabled = this.stateManager.getGlobalSettingsKey("strictPlanModeEnabled")
		const yoloModeToggled = this.stateManager.getGlobalSettingsKey("yoloModeToggled")
		const useAutoCondense = this.stateManager.getGlobalSettingsKey("useAutoCondense")
		const subagentsEnabled = this.stateManager.getGlobalSettingsKey("subagentsEnabled")
		const userInfo = this.stateManager.getGlobalStateKey("userInfo")
		const mcpMarketplaceEnabled = this.stateManager.getGlobalStateKey("mcpMarketplaceEnabled")
		const mcpDisplayMode = this.stateManager.getGlobalStateKey("mcpDisplayMode")
		const telemetrySetting = this.stateManager.getGlobalSettingsKey("telemetrySetting")
		const planActSeparateModelsSetting = this.stateManager.getGlobalSettingsKey("planActSeparateModelsSetting")
		const enableCheckpointsSetting = this.stateManager.getGlobalSettingsKey("enableCheckpointsSetting")
		const globalClineRulesToggles = this.stateManager.getGlobalSettingsKey("globalClineRulesToggles")
		const globalWorkflowToggles = this.stateManager.getGlobalSettingsKey("globalWorkflowToggles")
		const globalSkillsToggles = this.stateManager.getGlobalSettingsKey("globalSkillsToggles")
		const localSkillsToggles = this.stateManager.getWorkspaceStateKey("localSkillsToggles")
		const remoteRulesToggles = this.stateManager.getGlobalStateKey("remoteRulesToggles")
		const remoteWorkflowToggles = this.stateManager.getGlobalStateKey("remoteWorkflowToggles")
		const shellIntegrationTimeout = this.stateManager.getGlobalSettingsKey("shellIntegrationTimeout")
		const terminalReuseEnabled = this.stateManager.getGlobalStateKey("terminalReuseEnabled")
		const vscodeTerminalExecutionMode = this.stateManager.getGlobalStateKey("vscodeTerminalExecutionMode")
		const defaultTerminalProfile = this.stateManager.getGlobalSettingsKey("defaultTerminalProfile")
		const isNewUser = this.stateManager.getGlobalStateKey("isNewUser")
		// Can be undefined but is set to either true or false by the migration that runs on extension launch in extension.ts
		const welcomeViewCompleted = !!this.stateManager.getGlobalStateKey("welcomeViewCompleted")

		const customPrompt = this.stateManager.getGlobalSettingsKey("customPrompt")
		const mcpResponsesCollapsed = this.stateManager.getGlobalStateKey("mcpResponsesCollapsed")
		const terminalOutputLineLimit = this.stateManager.getGlobalSettingsKey("terminalOutputLineLimit")
		const maxConsecutiveMistakes = this.stateManager.getGlobalSettingsKey("maxConsecutiveMistakes")
		const favoritedModelIds = this.stateManager.getGlobalStateKey("favoritedModelIds")
		const lastDismissedInfoBannerVersion = this.stateManager.getGlobalStateKey("lastDismissedInfoBannerVersion") || 0
		const lastDismissedModelBannerVersion = this.stateManager.getGlobalStateKey("lastDismissedModelBannerVersion") || 0
		const lastDismissedCliBannerVersion = this.stateManager.getGlobalStateKey("lastDismissedCliBannerVersion") || 0
		const dismissedBanners = this.stateManager.getGlobalStateKey("dismissedBanners")
		const doubleCheckCompletionEnabled = this.stateManager.getGlobalSettingsKey("doubleCheckCompletionEnabled")
		const lazyTeammateModeEnabled = this.stateManager.getGlobalSettingsKey("lazyTeammateModeEnabled")
		const showFeatureTips = this.stateManager.getGlobalSettingsKey("showFeatureTips")

		const localClineRulesToggles = this.stateManager.getWorkspaceStateKey("localClineRulesToggles")
		const localWindsurfRulesToggles = this.stateManager.getWorkspaceStateKey("localWindsurfRulesToggles")
		const localCursorRulesToggles = this.stateManager.getWorkspaceStateKey("localCursorRulesToggles")
		const localAgentsRulesToggles = this.stateManager.getWorkspaceStateKey("localAgentsRulesToggles")
		const workflowToggles = this.stateManager.getWorkspaceStateKey("workflowToggles")

		const currentTaskItem = this.task?.taskId ? (taskHistory || []).find((item) => item.id === this.task?.taskId) : undefined
		// Spread to create new array reference - React needs this to detect changes in useEffect dependencies
		const clineMessages = [...(this.task?.messageStateHandler.getClineMessages() || [])]
		const checkpointManagerErrorMessage = this.task?.taskState.checkpointManagerErrorMessage

		const processedTaskHistory = (taskHistory || [])
			.filter((item) => item.ts && item.task)
			.sort((a, b) => b.ts - a.ts)
			.slice(0, 100) // for now we're only getting the latest 100 tasks, but a better solution here is to only pass in 3 for recent task history, and then get the full task history on demand when going to the task history view (maybe with pagination?)

		const latestAnnouncementId = getLatestAnnouncementId()
		const shouldShowAnnouncement = lastShownAnnouncementId !== latestAnnouncementId
		const platform = process.platform as Platform
		const distinctId = getDistinctId()
		const version = ExtensionRegistryInfo.version
		const clineConfig = ClineEnv.config()
		const environment = clineConfig.environment
		const banners = BannerService.get().getActiveBanners() ?? []
		const welcomeBanners = BannerService.get().getWelcomeBanners() ?? []

		// Check OpenAI Codex authentication status
		const { openAiCodexOAuthManager } = await import("@/integrations/openai-codex/oauth")
		const openAiCodexIsAuthenticated = await openAiCodexOAuthManager.isAuthenticated()

		// era harness：webview 打开但尚未启动任务时 this.workspaceManager 仍为 undefined，
		// 会让 WorkspaceGateBanner 误报「尚未打开工作区」。惰性确保初始化后再读真实工作区根。
		const wsManager = this.workspaceManager ?? (await this.ensureWorkspaceManager())

		return {
			version,
			apiConfiguration,
			currentTaskItem,
			clineMessages,
			currentFocusChainChecklist: this.task?.taskState.currentFocusChainChecklist || null,
			checkpointManagerErrorMessage,
			autoApprovalSettings,
			focusChainSettings,
			preferredLanguage,
			mode,
			strictPlanModeEnabled,
			yoloModeToggled,
			useAutoCondense,
			subagentsEnabled,
			userInfo,
			mcpMarketplaceEnabled,
			mcpDisplayMode,
			telemetrySetting,
			planActSeparateModelsSetting,
			enableCheckpointsSetting: enableCheckpointsSetting ?? false,
			platform,
			environment,
			distinctId,
			globalClineRulesToggles: globalClineRulesToggles || {},
			localClineRulesToggles: localClineRulesToggles || {},
			localWindsurfRulesToggles: localWindsurfRulesToggles || {},
			localCursorRulesToggles: localCursorRulesToggles || {},
			localAgentsRulesToggles: localAgentsRulesToggles || {},
			localWorkflowToggles: workflowToggles || {},
			globalWorkflowToggles: globalWorkflowToggles || {},
			globalSkillsToggles: globalSkillsToggles || {},
			localSkillsToggles: localSkillsToggles || {},
			remoteRulesToggles: remoteRulesToggles,
			remoteWorkflowToggles: remoteWorkflowToggles,
			shellIntegrationTimeout,
			terminalReuseEnabled,
			vscodeTerminalExecutionMode: vscodeTerminalExecutionMode,
			defaultTerminalProfile,
			isNewUser,
			welcomeViewCompleted,
			// era harness：Cline 免费模型引导已移除，字段恒为空
			onboardingModels: undefined,
			mcpResponsesCollapsed,
			terminalOutputLineLimit,
			maxConsecutiveMistakes,
			customPrompt,
			taskHistory: processedTaskHistory,
			shouldShowAnnouncement,
			favoritedModelIds,
			backgroundCommandRunning: this.backgroundCommandRunning,
			backgroundCommandTaskId: this.backgroundCommandTaskId,
			// NEW: Add workspace information
			workspaceRoots: wsManager?.getRoots() ?? [],
			primaryRootIndex: wsManager?.getPrimaryIndex() ?? 0,
			isMultiRootWorkspace: (wsManager?.getRoots().length ?? 0) > 1,
			multiRootSetting: {
				user: this.stateManager.getGlobalStateKey("multiRootEnabled"),
				featureFlag: true, // Multi-root workspace is now always enabled
			},
			clineWebToolsEnabled: {
				user: this.stateManager.getGlobalSettingsKey("clineWebToolsEnabled"),
				featureFlag: featureFlagsService.getWebtoolsEnabled(),
			},
			worktreesEnabled: {
				user: this.stateManager.getGlobalSettingsKey("worktreesEnabled"),
				featureFlag: featureFlagsService.getWorktreesEnabled(),
			},
			hooksEnabled: getHooksEnabledSafe(this.stateManager.getGlobalSettingsKey("hooksEnabled")),
			lastDismissedInfoBannerVersion,
			lastDismissedModelBannerVersion,
			remoteConfigSettings: this.stateManager.getRemoteConfigSettings(),
			lastDismissedCliBannerVersion,
			dismissedBanners,
			nativeToolCallSetting: this.stateManager.getGlobalStateKey("nativeToolCallEnabled"),
			enableParallelToolCalling: this.stateManager.getGlobalSettingsKey("enableParallelToolCalling"),
			backgroundEditEnabled: this.stateManager.getGlobalSettingsKey("backgroundEditEnabled"),
			optOutOfRemoteConfig: this.stateManager.getGlobalSettingsKey("optOutOfRemoteConfig"),
			doubleCheckCompletionEnabled,
			lazyTeammateModeEnabled,
			showFeatureTips,
			banners,
			welcomeBanners,
			openAiCodexIsAuthenticated,
		}
	}

	async clearTask() {
		if (this.task) {
			// Clear task settings cache when task ends
			await this.stateManager.clearTaskSettings()
		}
		await this.task?.abortTask()
		this.task = undefined // removes reference to it, so once promises end it will be garbage collected
	}

	// Caching mechanism to keep track of webview messages + API conversation history per provider instance

	/*
	Now that we use retainContextWhenHidden, we don't have to store a cache of cline messages in the user's state, but we could to reduce memory footprint in long conversations.

	- We have to be careful of what state is shared between ClineProvider instances since there could be multiple instances of the extension running at once. For example when we cached cline messages using the same key, two instances of the extension could end up using the same key and overwriting each other's messages.
	- Some state does need to be shared between the instances, i.e. the API key--however there doesn't seem to be a good way to notify the other instances that the API key has changed.

	We need to use a unique identifier for each ClineProvider instance's message cache since we could be running several instances of the extension outside of just the sidebar i.e. in editor panels.

	// conversation history to send in API requests

	/*
	It seems that some API messages do not comply with vscode state requirements. Either the Anthropic library is manipulating these values somehow in the backend in a way that's creating cyclic references, or the API returns a function or a Symbol as part of the message content.
	VSCode docs about state: "The value must be JSON-stringifyable ... value — A value. MUST not contain cyclic references."
	For now we'll store the conversation history in memory, and if we need to store in state directly we'd need to do a manual conversion to ensure proper json stringification.
	*/

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = this.stateManager.getGlobalStateKey("taskHistory")
		const existingItemIndex = history.findIndex((h) => h.id === item.id)
		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item
		} else {
			history.push(item)
		}
		this.stateManager.setGlobalState("taskHistory", history)
		return history
	}
}

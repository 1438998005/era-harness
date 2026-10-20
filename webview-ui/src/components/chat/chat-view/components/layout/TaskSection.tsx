import { ClineMessage } from "@shared/ExtensionMessage"
import type { LastApiReqUsage } from "@shared/getApiMetrics"
import React from "react"
import type { IdentityMode } from "@/components/chat/identity/identity"
import TaskHeader from "@/components/chat/task-header/TaskHeader"
import { MessageHandlers } from "../../types/chatTypes"

interface TaskSectionProps {
	task: ClineMessage
	apiMetrics: {
		totalTokensIn: number
		totalTokensOut: number
		totalCacheWrites?: number
		totalCacheReads?: number
		totalCost: number
	}
	lastApiReqTotalTokens?: number
	lastApiReqUsage?: LastApiReqUsage
	selectedModelInfo: {
		supportsPromptCache: boolean
		supportsImages: boolean
		priceCurrency?: "USD" | "CNY"
	}
	messageHandlers: MessageHandlers
	lastProgressMessageText?: string
	showFocusChainPlaceholder?: boolean
	identityMode?: IdentityMode
}

/**
 * Task section shown when there's an active task
 * Includes the task header and manages task-specific UI
 */
export const TaskSection: React.FC<TaskSectionProps> = ({
	task,
	apiMetrics,
	lastApiReqTotalTokens,
	lastApiReqUsage,
	selectedModelInfo,
	messageHandlers,
	lastProgressMessageText,
	showFocusChainPlaceholder,
	identityMode,
}) => {
	return (
		<TaskHeader
			cacheReads={apiMetrics.totalCacheReads}
			cacheWrites={apiMetrics.totalCacheWrites}
			doesModelSupportPromptCache={selectedModelInfo.supportsPromptCache}
			identityMode={identityMode}
			lastApiReqTotalTokens={lastApiReqTotalTokens}
			lastApiReqUsage={lastApiReqUsage}
			lastProgressMessageText={lastProgressMessageText}
			onClose={messageHandlers.handleTaskCloseButtonClick}
			onSendMessage={messageHandlers.handleSendMessage}
			priceCurrency={selectedModelInfo.priceCurrency}
			showFocusChainPlaceholder={showFocusChainPlaceholder}
			task={task}
			tokensIn={apiMetrics.totalTokensIn}
			tokensOut={apiMetrics.totalTokensOut}
			totalCost={apiMetrics.totalCost}
		/>
	)
}

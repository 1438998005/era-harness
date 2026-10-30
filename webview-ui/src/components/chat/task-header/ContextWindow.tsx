import { getContextBudget } from "@shared/context-budget"
import type { LastApiReqUsage } from "@shared/getApiMetrics"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import debounce from "debounce"
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Progress } from "@/components/ui/progress"
import { formatLargeNumber as formatTokenNumber } from "@/utils/format"
import CompactTaskButton from "./buttons/CompactTaskButton"
import { ContextWindowSummary } from "./ContextWindowSummary"

// Type definitions
interface ContextWindowInfoProps {
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	size?: number
}

interface ContextWindowProgressProps extends ContextWindowInfoProps {
	useAutoCondense: boolean
	lastApiReqTotalTokens?: number
	lastApiReqUsage?: LastApiReqUsage
	contextWindow?: number
	/** 模型目录的输出上限（#58）：窗口含输出时用于预留；输入输出独立时不影响分母 */
	maxOutputTokens?: number
	/** 窗口是否含输出（#80，来自模型目录）；缺省 false = 不扣预留 */
	contextWindowIncludesOutput?: boolean
	onSendMessage?: (command: string, files: string[], images: string[]) => void
}

const ConfirmationDialog = memo<{
	onConfirm: (e: React.MouseEvent) => void
	onCancel: (e: React.MouseEvent) => void
}>(({ onConfirm, onCancel }) => {
	const { t } = useTranslation("common")
	return (
		<div className="text-sm my-2 flex items-center gap-0 justify-between">
			<span className="font-semibold text-sm">{t("taskHeader.compactQuestion")}?</span>
			<span className="flex gap-1">
				<VSCodeButton
					appearance="secondary"
					className="text-sm"
					onClick={onCancel}
					title={t("taskHeader.no")}
					type="button">
					{t("buttons.cancel")}
				</VSCodeButton>
				<VSCodeButton
					appearance="primary"
					autoFocus={true}
					className="text-sm"
					onClick={onConfirm}
					title={t("taskHeader.yes")}
					type="button">
					{t("taskHeader.yes")}
				</VSCodeButton>
			</span>
		</div>
	)
})
ConfirmationDialog.displayName = "ConfirmationDialog"

const ContextWindow: React.FC<ContextWindowProgressProps> = ({
	contextWindow = 0,
	maxOutputTokens,
	contextWindowIncludesOutput,
	lastApiReqTotalTokens = 0,
	lastApiReqUsage,
	onSendMessage,
	useAutoCondense,
	tokensIn,
	tokensOut,
	cacheWrites,
	cacheReads,
}) => {
	const { t } = useTranslation("common")
	const [isOpened, setIsOpened] = useState(false)
	const [confirmationNeeded, setConfirmationNeeded] = useState(false)
	const progressBarRef = useRef<HTMLDivElement>(null)

	const handleCompactClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setConfirmationNeeded(!confirmationNeeded)
		},
		[confirmationNeeded],
	)

	const handleConfirm = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()
			onSendMessage?.("/compact", [], [])
			setConfirmationNeeded(false)
		},
		[onSendMessage],
	)

	const handleCancel = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setConfirmationNeeded(false)
	}, [])

	const tokenData = useMemo(() => {
		if (!contextWindow) {
			return null
		}
		// #80：分母 = 有效输入预算，公式与扩展侧共用 `getContextBudget`。
		// 只有目录显式标了 `contextWindowIncludesOutput` 的模型才预留输出（如 glm-4.5-flash）；
		// MiMo / DeepSeek / GLM-5.1+ 的上下文是纯输入，扣了等于凭空少 128K～384K。
		const budget = getContextBudget({
			contextWindow,
			maxTokens: maxOutputTokens,
			contextWindowIncludesOutput,
		})
		return {
			// 防溢出：即使个别提供方上报异常用量，进度条也不超过 100%
			percentage: Math.min(100, (lastApiReqTotalTokens / budget.effectiveInputBudget) * 100),
			max: budget.effectiveInputBudget,
			windowSize: budget.contextWindow,
			reservedOutput: budget.reservedOutput,
			used: lastApiReqTotalTokens,
		}
	}, [contextWindow, maxOutputTokens, contextWindowIncludesOutput, lastApiReqTotalTokens])

	// 缓存命中徽标：与进度条同源，取「上一次请求」的分段用量（而非整段对话累计），
	// 否则会出现「命中 > 已用」的错觉。命中量 = 本次 cacheReads，命中率 = 命中 / 本次总输入。
	const cacheHitInfo = useMemo(() => {
		const hit = lastApiReqUsage?.cacheReads || 0
		const totalInput = lastApiReqUsage?.total || 0
		return { hit, rate: totalInput > 0 ? (hit / totalInput) * 100 : 0 }
	}, [lastApiReqUsage])

	const debounceCloseHover = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		const showHover = debounce((open: boolean) => setIsOpened(open), 100)

		return showHover(false)
	}, [])

	const handleFocus = useCallback(() => {
		setIsOpened(true)
	}, [])

	// Close tooltip when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element
			const isInsideProgressBar = progressBarRef.current?.contains(target as Node)

			// Check if click is inside any tooltip content by looking for our custom class
			const isInsideTooltipContent = target.closest(".context-window-tooltip-content") !== null

			if (!isInsideProgressBar && !isInsideTooltipContent) {
				setIsOpened(false)
			}
		}

		if (isOpened) {
			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [isOpened])

	if (!tokenData) {
		return null
	}

	return (
		<div className="flex flex-col my-1.5" onMouseLeave={debounceCloseHover}>
			<div className="flex gap-1 flex-row @max-xs:flex-col @max-xs:items-start items-center text-sm">
				<div className="flex items-center gap-1.5 flex-1 whitespace-nowrap">
					<span className="cursor-pointer text-sm" title={t("contextWindow.promptTokens")}>
						{formatTokenNumber(tokenData.used)}
					</span>
					{cacheHitInfo.hit > 0 && (
						<span
							className="text-xs text-muted-foreground cursor-pointer"
							title={`${t("contextWindow.cacheHitRate")}: ${cacheHitInfo.rate.toFixed(0)}%`}>
							{t("contextWindow.cacheHitChip")} {formatTokenNumber(cacheHitInfo.hit)}
						</span>
					)}
					<div className="flex relative items-center gap-1 flex-1 w-full h-full" onMouseEnter={() => setIsOpened(true)}>
						<HoverCard>
							<HoverCardContent className="bg-menu rounded-xs shadow-sm">
								<ContextWindowSummary
									cacheReads={cacheReads}
									cacheWrites={cacheWrites}
									contextWindow={tokenData.max}
									percentage={tokenData.percentage}
									reservedOutput={tokenData.reservedOutput}
									tokensIn={tokensIn}
									tokensOut={tokensOut}
									tokenUsed={tokenData.used}
									windowSize={tokenData.windowSize}
								/>
							</HoverCardContent>
							<HoverCardTrigger asChild>
								{/* TODO: Re-add role="slider", aria-value*, onKeyDown, onClick, and tabIndex
								    when click-to-set-threshold is implemented. See PR #9348 for context. */}
								<div
									className="relative w-full text-foreground context-window-progress brightness-100"
									onFocus={handleFocus}
									ref={progressBarRef}>
									<Progress
										aria-label={t("contextWindow.contextWindowUsage")}
										color="success"
										value={tokenData.percentage}
									/>
									{isOpened}
								</div>
							</HoverCardTrigger>
						</HoverCard>
					</div>
					<span className="cursor-pointer text-sm" title={t("taskHeader.maxContextWindow")}>
						{formatTokenNumber(tokenData.max)}
					</span>
				</div>
				<CompactTaskButton onClick={handleCompactClick} />
			</div>
			{confirmationNeeded && <ConfirmationDialog onCancel={handleCancel} onConfirm={handleConfirm} />}
		</div>
	)
}

export default memo(ContextWindow)

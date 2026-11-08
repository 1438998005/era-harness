import { ClineMessage } from "@shared/ExtensionMessage"
import { FREE_PINNED_RECOVERY_MARKER } from "@shared/free-pools"
import { AskResponseRequest } from "@shared/proto/cline/task"
import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import CreditLimitError from "@/components/chat/CreditLimitError"
import { useApiConfigurationHandlers } from "@/components/settings/utils/useApiConfigurationHandlers"
import { TaskServiceClient } from "@/services/grpc-client"
import { ClineError, ClineErrorType } from "../../../../src/services/error/ClineError"
import { isDuplicateErrorCode } from "../../../../src/services/error/error-code"
import { extractBigmodelError } from "../../../../src/shared/bigmodel-request"

const _errorColor = "var(--vscode-errorForeground)"

interface ErrorRowProps {
	message: ClineMessage
	errorType: "error" | "mistake_limit_reached" | "diff_error" | "clineignore_error"
	apiRequestFailedMessage?: string
	apiReqStreamingFailedMessage?: string
}

const ErrorRow = memo(({ message, errorType, apiRequestFailedMessage, apiReqStreamingFailedMessage }: ErrorRowProps) => {
	const { t } = useTranslation("common")
	const { handleFieldsChange } = useApiConfigurationHandlers()
	const [recovered, setRecovered] = useState(false)

	// KB 08 #242：host 侧 composePinnedError 在错误文本尾部写恢复标记；webview 据此渲染
	// 「切回自动路由并重试」按钮。标记**先剥掉**再交给 ClineError.parse / 展示，
	// 否则用户会看到裸 [ERA_FREE_PINNED_RECOVERY]，且可能干扰 JSON 错误解析。
	const errorText = apiRequestFailedMessage || apiReqStreamingFailedMessage
	// KB 08 #249 代码审查修订：⛔ 不要只对短路后的 errorText 做检测 —— 若
	// apiRequestFailedMessage 非空但不含 marker、而 apiReqStreamingFailedMessage 含 marker，
	// 原写法会漏判「切回自动路由并重试」按钮（#243）。三个来源分别检测。
	const pinnedRecovery = [apiRequestFailedMessage, apiReqStreamingFailedMessage, message.text].some((text) =>
		text?.includes(FREE_PINNED_RECOVERY_MARKER),
	)
	const clean = (text: string | undefined): string | undefined => text?.split(FREE_PINNED_RECOVERY_MARKER).join("")
	const rawApiError = clean(errorText)?.trim()

	const renderErrorContent = () => {
		switch (errorType) {
			case "error":
			case "mistake_limit_reached":
				// Handle API request errors with special error parsing
				if (rawApiError) {
					// FIXME: ClineError parsing should not be applied to non-Cline providers, but it seems we're using clineErrorMessage below in the default error display
					const clineError = ClineError.parse(rawApiError)
					const requestId = clineError?._error?.request_id
					const providerId = clineError?.providerId || clineError?._error?.providerId
					const errorCode = clineError?._error?.code
					// #60：BigModel 错误翻人话（1261 指出路）。宿主在产生错误时已改写过 message，
					// 这里再兜一层——旧任务历史里存的还是原始消息，按结构化字段现场重翻。
					const bigmodelError =
						providerId === "bigmodel" || providerId === "bigmodel-plan"
							? extractBigmodelError(clineError?._error)
							: undefined
					const errorMessage = clean(
						bigmodelError?.humanMessage || clineError?._error?.message || clineError?.message || rawApiError,
					)
					// code 常常就是 status 的字符串形式（服务端回 "401"），而 message 自己也以
					// "401 Invalid API Key" 开头 → 直接拼会渲染成 `[MIMO] 401401 Invalid API Key`。
					const showErrorCode = !!errorCode && !isDuplicateErrorCode(clineError?._error?.status, errorCode)

					if (clineError?.isErrorType(ClineErrorType.Balance)) {
						const errorDetails = clineError._error?.details
						return (
							<CreditLimitError
								buyCreditsUrl={errorDetails?.buy_credits_url}
								currentBalance={errorDetails?.current_balance}
								message={errorDetails?.message}
								totalPromotions={errorDetails?.total_promotions}
								totalSpent={errorDetails?.total_spent}
							/>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.RateLimit)) {
						return (
							<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</p>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.QuotaExceeded)) {
						const detailMessage = clean(clineError?._error?.details?.message || errorMessage)
						return <p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">{detailMessage}</p>
					}

					return (
						<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere flex flex-col gap-3">
							{/* Display the well-formatted error extracted from the ClineError instance */}

							<header>
								{providerId && <span className="uppercase">[{providerId}] </span>}
								{showErrorCode && <span className="mr-1">{errorCode}</span>}
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</header>

							{/* Windows Powershell Issue */}
							{errorMessage?.toLowerCase()?.includes("powershell") && (
								<div>
									{t("error.powershellIssue")}{" "}
									<a
										className="underline text-inherit"
										href="https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22">
										{t("error.troubleshootingGuide")}
									</a>
									.
								</div>
							)}

							{/* KB 08 #249：rawApiError 是 ClineError.serialize() 的结构化 JSON，只作
								ClineError.parse() 的数据（还原 request id / provider 专属展示），⛔ 绝不作可见文本。
								旧逻辑「人话 ≠ 原文就回显原文」对任何合法 JSON 恒真 —— parse 成功后 errorMessage
								是纯人话、rawApiError 是整串 JSON，于是必然把裸 JSON 渲染成第二遍；#60 只给
								BigModel 豁免、#84 只改 retry 卡片正文，都没收敛本分支（同族第三次复发）。
								上游 cline PR #4984 维护者评论亦主张把 error parsing 下沉到 backend。 */}
							{/* 解析失败时 rawApiError 本身就是人话，已由上面的 <header> 显示，无需兜底回显。 */}

							<div className="mt-4">
								<span className="text-description">{t("error.clickRetry")}</span>
							</div>
						</p>
					)
				}

				// Regular error message
				return <p className="m-0 mt-0 whitespace-pre-wrap text-error wrap-anywhere">{clean(message.text)}</p>

			case "diff_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>{t("error.diffError")}</div>
					</div>
				)

			case "clineignore_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>
							{t("error.clineignoreError")} <code>{message.text}</code> {t("error.clineignoreBlocked")}{" "}
							<code>.clineignore</code> {t("error.clineignoreFile")}
							file.
						</div>
					</div>
				)

			default:
				return null
		}
	}

	const content = renderErrorContent()
	if (!pinnedRecovery) {
		return content
	}

	// 用户裁定：失败时**只给按钮**，绝不自动切回自动路由。点了才清 pinned + 触发重试。
	return (
		<div className="flex flex-col gap-2">
			{content}
			<button
				className="text-xs px-2 py-1 cursor-pointer border border-(--vscode-panel-border) rounded"
				disabled={recovered}
				onClick={async () => {
					try {
						// 先落配置：即使下面的重试触发失败，也已经切回自动路由，不该让用户反复点。
						// #243：写空串才能真正清除——setApiConfiguration 跳过 undefined；host 侧的
						// 显式删除通道会把空串从磁盘删掉，读侧再归一成 undefined。
						await handleFieldsChange({ pinnedModelId: "", freeUseOpenRouterRouter: false })
						setRecovered(true)
						await TaskServiceClient.askResponse(AskResponseRequest.create({ responseType: "yesButtonClicked" }))
					} catch (error) {
						console.error("Failed to clear pinned free model / retry:", error)
					}
				}}
				style={{
					color: "var(--vscode-textLink-foreground, #3794FF)",
					background: "transparent",
				}}
				type="button">
				{t("error.freePinnedRecovery")}
			</button>
			<span className="text-[11px]" style={{ color: "var(--vscode-descriptionForeground, #AAAAAA)" }}>
				{t("error.freePinnedRecoveryHint")}
			</span>
		</div>
	)
})

export default ErrorRow

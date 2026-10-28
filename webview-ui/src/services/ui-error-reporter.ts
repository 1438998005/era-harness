/**
 * webview 侧未捕获错误 → 扩展宿主落审计（3.92.0）。
 *
 * 此前 webview 的运行时错误只存在于 webview 自己的 devtools console，扩展侧与
 * 诊断包完全看不见。这里通过 postMessage（与 grpc_request 同一条通道）把
 * window.onerror / unhandledrejection / React ErrorBoundary 的现场回传宿主，
 * 宿主侧落 `event: "error", source: "webview"` 审计事件，随诊断包导出。
 *
 * 与宿主的 UiErrorReport（src/shared/WebviewMessage.ts）是手写镜像协议——
 * webview 不 import 宿主模块，改形状时两边同步。
 */

import { PLATFORM_CONFIG } from "../config/platform.config"

export interface UiErrorReport {
	kind: "window.onerror" | "unhandledrejection" | "react-error-boundary"
	message: string
	stack?: string
}

/** 单会话上限：错误风暴时不再回传（console 仍可见），避免消息通道被灌满 */
const MAX_REPORTS_PER_SESSION = 20

let reportedCount = 0

export function reportUiError(report: UiErrorReport): void {
	if (reportedCount >= MAX_REPORTS_PER_SESSION) {
		return
	}
	reportedCount++
	PLATFORM_CONFIG.postMessage({ type: "ui_error", ui_error: report })
}

function reasonToMessage(reason: unknown): string {
	if (reason instanceof Error) {
		return reason.message || String(reason)
	}
	return typeof reason === "string" ? reason : String(reason)
}

/** 在应用启动时调用一次：挂 window.onerror + unhandledrejection 全局兜底。 */
export function installUiErrorHandlers(): void {
	window.addEventListener("error", (event) => {
		const message = event.message || (event.error instanceof Error ? event.error.message : "")
		if (!message) {
			return
		}
		console.error("[webview] 未捕获错误:", event.error ?? message)
		reportUiError({
			kind: "window.onerror",
			message,
			stack: event.error instanceof Error ? event.error.stack : undefined,
		})
	})
	window.addEventListener("unhandledrejection", (event) => {
		console.error("[webview] 未处理的 Promise 拒绝:", event.reason)
		reportUiError({
			kind: "unhandledrejection",
			message: reasonToMessage(event.reason),
			stack: event.reason instanceof Error ? event.reason.stack : undefined,
		})
	})
}

export interface WebviewMessage {
	type: "grpc_request" | "grpc_request_cancel" | "ui_error"
	grpc_request?: GrpcRequest
	grpc_request_cancel?: GrpcCancel
	/** type === "ui_error"：webview 侧未捕获的错误（window.onerror / unhandledrejection / ErrorBoundary） */
	ui_error?: UiErrorReport
}

/** webview 侧错误回传的载荷（截断/脱敏由宿主侧审计层统一负责，这里只透传） */
export interface UiErrorReport {
	kind: "window.onerror" | "unhandledrejection" | "react-error-boundary"
	message: string
	stack?: string
}

export type GrpcRequest = {
	service: string
	method: string
	message: any // JSON serialized protobuf message
	request_id: string // For correlating requests and responses
	is_streaming: boolean // Whether this is a streaming request
}

export type GrpcCancel = {
	request_id: string // ID of the request to cancel
}

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"

export type ClineCheckpointRestore = "task" | "workspace" | "taskAndWorkspace"

export type TaskFeedbackType = "thumbs_up" | "thumbs_down"

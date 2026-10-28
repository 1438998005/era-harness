/**
 * 扩展宿主全局错误兜底（3.92.0）：未捕获的 Promise 拒绝与同步异常此前只会落到
 * VS Code 自带的 "Extension Host" 输出（用户不可见、无归档），诊断包里完全没有。
 * 这里只做**观察**：落审计（随诊断包导出）+ Logger.error（进 "Cline" 输出通道），
 * 不改变原有冒泡行为——uncaughtException 的进程处置权仍在宿主手里。
 */
import { Logger } from "@/shared/services/Logger"
import { recordAudit } from "./auditLog"

function recordRuntimeError(kind: "unhandledRejection" | "uncaughtException", error: unknown): void {
	const message = error instanceof Error ? error.message : String(error)
	const stack = error instanceof Error ? error.stack : undefined
	Logger.error(`[${kind}] ${message}`)
	recordAudit({
		event: "error",
		source: "host",
		errorKind: kind,
		outcome: "error",
		message,
		snapshot: stack,
	})
}

/** 激活时挂全局兜底，返回卸载函数（进 context.subscriptions）。 */
export function registerGlobalErrorCapture(): () => void {
	const onRejection = (reason: unknown) => recordRuntimeError("unhandledRejection", reason)
	const onException = (error: unknown) => recordRuntimeError("uncaughtException", error)
	process.on("unhandledRejection", onRejection)
	process.on("uncaughtException", onException)
	return () => {
		process.off("unhandledRejection", onRejection)
		process.off("uncaughtException", onException)
	}
}

import { type CSSProperties, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

/**
 * 「eraTW 更新中心」面板（计划任务 D / F5）：更新全程的可视镜像。
 *
 * 这是独立的 Vite 入口（多页构建），与侧栏共享构建链但不共享运行时。
 * 扩展侧（hosts/vscode/updatePanel.ts）通过 postMessage 推三类消息：
 * - event：阶段 / 进度 / 当前文件
 * - result：最终结果（标题 + 明细行 + 备份目录 + 合并/保留计数）
 * 取消按钮发 { type: "cancel" }，扩展侧在下一个事件边界安全停下
 * （写入阶段的取消会触发 apply.ts 的整体回滚）。
 */

interface PanelMessage {
	type: "event" | "result"
	stage?: string
	message?: string
	progress?: { done: number; total: number }
	title?: string
	lines?: string[]
	backupDir?: string | null
	merged?: number
	kept?: number
	/** 仅更新成功落盘时为 true：决定结果态是否显示「撤销这次更新」按钮 */
	canUndo?: boolean
}

const vscodeApi = (window as unknown as { acquireVsCodeApi?: () => { postMessage(msg: unknown): void } }).acquireVsCodeApi?.()

const STAGE_LABEL: Record<string, string> = {
	check: "检查社区版本",
	download: "下载社区版本",
	snapshot: "读取文件清单",
	scan: "扫描本地文件",
	labels: "建函数索引",
	plan: "比对更新内容",
	merge: "合并你改过的文件",
	apply: "备份并写入",
	verify: "校验写入结果",
}

function App() {
	const [stage, setStage] = useState("准备中…")
	const [percent, setPercent] = useState<number | null>(null)
	const [log, setLog] = useState<string[]>([])
	const [result, setResult] = useState<{
		title: string
		lines: string[]
		backupDir: string | null
		merged?: number
		kept?: number
		canUndo?: boolean
	} | null>(null)
	const [undoRequested, setUndoRequested] = useState(false)
	const logRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const data = event.data as PanelMessage
			if (!data || typeof data !== "object") {
				return
			}
			if (data.type === "event") {
				const label = STAGE_LABEL[data.stage ?? ""] ?? data.stage ?? ""
				setStage(data.message ? `${label}：${data.message}` : label)
				if (data.progress && data.progress.total > 0) {
					setPercent(Math.min(100, Math.round((data.progress.done / data.progress.total) * 100)))
				} else {
					setPercent(null)
				}
				if (data.message) {
					// 08 #181：心跳会周期性重发同一句话，连续重复不追加（防刷屏）
					const next = data.message as string
					setLog((prev) => (prev[prev.length - 1] === next ? prev : [...prev.slice(-200), next]))
				}
				return
			}
			if (data.type === "result") {
				setResult({
					title: data.title ?? "",
					lines: data.lines ?? [],
					backupDir: data.backupDir ?? null,
					merged: data.merged,
					kept: data.kept,
					canUndo: data.canUndo,
				})
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	useEffect(() => {
		logRef.current?.scrollTo(0, logRef.current.scrollHeight)
	}, [log])

	const cancel = () => {
		vscodeApi?.postMessage({ type: "cancel" })
	}

	const requestUndo = () => {
		setUndoRequested(true)
		vscodeApi?.postMessage({ type: "undo" })
	}

	const openBackup = (event: { preventDefault(): void }) => {
		event.preventDefault()
		vscodeApi?.postMessage({ type: "openBackup" })
	}

	const mono: CSSProperties = { fontFamily: "var(--vscode-editor-font-family, monospace)", fontSize: 12 }

	return (
		<div style={{ padding: "12px 16px", color: "var(--vscode-foreground)", fontFamily: "var(--vscode-font-family)" }}>
			<h2 style={{ fontSize: 15, margin: "0 0 8px" }}>eraTW 更新中心</h2>

			<div style={{ fontSize: 13, marginBottom: 6 }}>{result ? "更新流程已结束" : stage}</div>

			{!result && (
				<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
					<div
						style={{
							flex: 1,
							height: 6,
							borderRadius: 3,
							background: "var(--vscode-progressBar-background, #3794FF)",
							opacity: percent === null ? 0.25 : 1,
							width: percent === null ? "100%" : `${percent}%`,
							transition: "width 0.2s ease",
						}}
					/>
					<button
						onClick={cancel}
						style={{
							background: "var(--vscode-errorBackground, #5A1D1D)",
							color: "var(--vscode-errorForeground, #F48771)",
							border: "1px solid var(--vscode-errorForeground, #F48771)",
							borderRadius: 2,
							padding: "4px 14px",
							cursor: "pointer",
							whiteSpace: "nowrap",
						}}
						title="取消在下一个步骤边界安全停下；写入阶段的取消会自动回滚到更新前"
						type="button">
						取消更新
					</button>
				</div>
			)}
			{!result && (
				<div style={{ fontSize: 11, opacity: 0.75, marginBottom: 10 }}>
					取消在下一个步骤边界安全停下；写入阶段的取消会自动回滚。
				</div>
			)}

			{result && (
				<div
					style={{
						border: "1px solid var(--vscode-panel-border, #444)",
						borderRadius: 4,
						padding: "8px 12px",
						marginBottom: 10,
					}}>
					<div style={{ fontWeight: 600, marginBottom: 4 }}>{result.title}</div>
					{result.lines.map((line, i) => (
						<div key={i} style={{ fontSize: 12, marginTop: 2 }}>
							{line}
						</div>
					))}
					{typeof result.merged === "number" && result.merged > 0 && (
						<div style={{ fontSize: 12, marginTop: 4 }}>AI 帮你合并了 {result.merged} 个文件，建议进游戏看一眼。</div>
					)}
					{typeof result.kept === "number" && result.kept > 0 && (
						<div style={{ fontSize: 12, marginTop: 2 }}>
							有 {result.kept} 个你改过的文件原样保留（社区这次没能更新它们，下次更新会再问）。
						</div>
					)}
					{result.backupDir && (
						<div style={{ fontSize: 12, marginTop: 4 }}>
							备份位置：
							<a
								href="#"
								onClick={openBackup}
								style={{ color: "var(--vscode-textLink-foreground, #4daafc)" }}
								title="在资源管理器中打开备份目录">
								{result.backupDir}
							</a>
						</div>
					)}
					{result.canUndo && result.backupDir && (
						<div style={{ marginTop: 8 }}>
							<button
								disabled={undoRequested}
								onClick={requestUndo}
								style={{
									background: undoRequested
										? "var(--vscode-button-secondaryBackground, #3A3D41)"
										: "var(--vscode-button-background, #0E639C)",
									color: "var(--vscode-button-foreground, #FFFFFF)",
									border: "none",
									borderRadius: 2,
									padding: "5px 14px",
									cursor: undoRequested ? "default" : "pointer",
								}}
								type="button">
								{undoRequested ? "正在撤销…" : "撤销这次更新"}
							</button>
							<span style={{ fontSize: 11, opacity: 0.75, marginLeft: 8 }}>
								把游戏恢复到更新前的样子（用上面的备份）
							</span>
						</div>
					)}
				</div>
			)}

			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>过程明细（最近 200 条）：</div>
			<div
				ref={logRef}
				style={{
					...mono,
					height: 220,
					overflowY: "auto",
					border: "1px solid var(--vscode-panel-border, #444)",
					borderRadius: 4,
					padding: "6px 10px",
					whiteSpace: "pre-wrap",
					wordBreak: "break-all",
					background: "var(--vscode-editor-background)",
				}}>
				{log.length === 0 ? "（还没有输出）" : log.map((line, i) => <div key={i}>{line}</div>)}
			</div>

			<p style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
				可以随时关闭这个面板，更新会继续在后台进行；结果会照常弹窗。
			</p>
		</div>
	)
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)

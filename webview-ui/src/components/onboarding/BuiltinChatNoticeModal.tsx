import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { AlertTriangleIcon, CheckIcon, XIcon } from "lucide-react"
import { memo, useEffect, useRef } from "react"

/**
 * 首启必须确认的说明模态：右侧「聊天」是 VS Code 自带的 Copilot，不是 era harness。
 *
 * 用户裁定（2026-11-04）：最强制形态——必须点「知道了」才能继续。
 * 2026-11-04 审查加固：只在模态 div 上挂 onKeyDown 挡不住键盘绕过——初始焦点在 body，
 * Tab 会先落到背景的「开始配置」按钮（DOM 顺序在模态之前），事件根本不经过模态；
 * 背景按钮一按 Enter 就切到 config step，模态因 step 条件直接消失，用户从未确认。
 * 现在改为：① 挂载即把焦点移到确认按钮；② document 捕获阶段拦 Tab/Escape/Enter/Space；
 * ③ 背景容器在 EraOnboardingView 里置 inert；④ 模态不再受 step 限制。
 * 「仅首启」仍由 welcomeViewCompleted 生命周期保证，不新增持久化字段（知识库 04 §4.23）。
 */
const BuiltinChatNoticeModal = memo(({ onAck }: { onAck: () => void }) => {
	const cardRef = useRef<HTMLDivElement | null>(null)
	const ackRef = useRef<HTMLElement | null>(null)
	const onAckRef = useRef(onAck)
	onAckRef.current = onAck

	useEffect(() => {
		const ack =
			cardRef.current?.querySelector<HTMLElement>("[data-notice-ack]") ??
			cardRef.current?.querySelector<HTMLElement>("vscode-button, button") ??
			null
		ackRef.current = ack
		ack?.focus()

		// 捕获阶段挂在 document，而不是模态 div：焦点还在背景时也要拦得住。
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Tab" || event.key === "Escape") {
				event.preventDefault()
				ackRef.current?.focus()
				return
			}
			if ((event.key === "Enter" || event.key === " ") && event.target !== ackRef.current) {
				// 焦点不在确认按钮上时，回车/空格等价于确认，且绝不能落到背景控件上。
				event.preventDefault()
				onAckRef.current()
			}
		}
		document.addEventListener("keydown", onKeyDown, true)
		return () => document.removeEventListener("keydown", onKeyDown, true)
	}, [])

	return (
		<div
			aria-labelledby="builtin-chat-notice-title"
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 animate-in fade-in-0 duration-200"
			role="alertdialog">
			<div
				className="w-full max-w-md rounded-md border flex flex-col gap-3 p-5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200"
				ref={cardRef}
				style={{
					background: "var(--vscode-editorWidget-background)",
					borderColor: "var(--vscode-inputValidation-warningBorder)",
				}}>
				<div className="flex items-start gap-2.5">
					<AlertTriangleIcon
						className="mt-0.5 shrink-0"
						size={18}
						style={{ color: "var(--vscode-editorWarning-foreground)" }}
					/>
					<h2 className="text-sm font-semibold m-0 leading-snug" id="builtin-chat-notice-title">
						先确认：右侧的「聊天」窗口不是 era harness
					</h2>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div
						className="rounded px-2.5 py-2 flex items-center gap-1.5 text-xs leading-snug"
						style={{ background: "var(--vscode-inputValidation-infoBackground)" }}>
						<CheckIcon className="shrink-0" size={13} style={{ color: "var(--vscode-charts-green)" }} />
						<span>
							<b>era harness</b>：左侧活动栏的本插件图标
						</span>
					</div>
					<div
						className="rounded px-2.5 py-2 flex items-center gap-1.5 text-xs leading-snug"
						style={{ background: "var(--vscode-inputValidation-warningBackground)" }}>
						<XIcon className="shrink-0" size={13} style={{ color: "var(--vscode-charts-red)" }} />
						<span>右侧「聊天」= 编辑器自带 Copilot</span>
					</div>
				</div>

				<p className="text-xs m-0 leading-relaxed">
					VS Code 右侧自带的「聊天」窗口是它内置的 Copilot，<b>不是 era harness</b>
					——发到那里的消息不会进入本插件，也不会被本插件的任何功能处理。
				</p>
				<p className="text-xs m-0 leading-relaxed text-(--vscode-descriptionForeground)">
					本插件的对话就在当前窗口：点左侧活动栏的 era harness 图标即可回到这里。
				</p>

				<VSCodeButton appearance="primary" className="w-full mt-1" data-notice-ack="" onClick={onAck}>
					知道了
				</VSCodeButton>
			</div>
		</div>
	)
})

BuiltinChatNoticeModal.displayName = "BuiltinChatNoticeModal"

export default BuiltinChatNoticeModal

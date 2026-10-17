import { BookOpenIcon, UserIcon, ZapIcon } from "lucide-react"
import { IDENTITY_MODES, IdentityMode } from "./identity"

interface IdentityPickerModalProps {
	isOpen: boolean
	currentMode: IdentityMode
	askOnNew: boolean
	onSelect: (mode: IdentityMode) => void
	onToggleAskOnNew: (value: boolean) => void
	onClose: () => void
}

const MODE_ICONS: Record<IdentityMode, typeof UserIcon> = {
	self: UserIcon,
	persona: BookOpenIcon,
	unrestricted: ZapIcon,
}

/**
 * 身份选择弹窗：新对话自动弹出一次，也可从输入区身份条随时唤出。
 * 点选即生效并关闭——切换身份是高频动作，不该有二次确认。
 */
export function IdentityPickerModal({
	isOpen,
	currentMode,
	askOnNew,
	onSelect,
	onToggleAskOnNew,
	onClose,
}: IdentityPickerModalProps) {
	if (!isOpen) {
		return null
	}

	return (
		<div
			onClick={onClose}
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 1000,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(0, 0, 0, 0.45)",
				padding: 16,
			}}>
			<div
				aria-label="选择身份"
				aria-modal="true"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				style={{
					width: "min(460px, 100%)",
					maxHeight: "calc(100vh - 64px)",
					overflowY: "auto",
					borderRadius: 10,
					padding: "16px 16px 12px",
					background: "var(--vscode-editorWidget-background, var(--vscode-sidebar-background))",
					border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.3))",
					boxShadow: "0 10px 32px rgba(0, 0, 0, 0.4)",
					color: "var(--vscode-foreground)",
				}}>
				<div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.2px" }}>选择身份</div>
				<div
					style={{
						fontSize: 11,
						marginTop: 4,
						marginBottom: 12,
						color: "var(--vscode-descriptionForeground)",
						lineHeight: 1.6,
					}}>
					新对话先定身份，对话中随时可切换。身份决定模型的输出口径，其中「权限全开」同时放开工具批准档位。
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					{IDENTITY_MODES.map((item) => {
						const Icon = MODE_ICONS[item.id]
						const selected = item.id === currentMode
						return (
							<button
								key={item.id}
								onClick={() => onSelect(item.id)}
								style={{
									display: "flex",
									gap: 10,
									alignItems: "flex-start",
									textAlign: "left",
									width: "100%",
									padding: "10px 12px",
									borderRadius: 8,
									cursor: "pointer",
									color: "inherit",
									font: "inherit",
									background: selected
										? "color-mix(in srgb, var(--vscode-focusBorder) 14%, transparent)"
										: "color-mix(in srgb, var(--vscode-foreground) 5%, transparent)",
									border: `1px solid ${
										selected
											? "var(--vscode-focusBorder)"
											: "color-mix(in srgb, var(--vscode-foreground) 10%, transparent)"
									}`,
								}}>
								<Icon size={15} style={{ marginTop: 1, flexShrink: 0, opacity: selected ? 1 : 0.75 }} />
								<div style={{ minWidth: 0 }}>
									<div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
										<span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
										<span style={{ fontSize: 10, color: "var(--vscode-descriptionForeground)" }}>
											{item.hint}
										</span>
									</div>
									<div
										style={{
											fontSize: 11,
											marginTop: 3,
											lineHeight: 1.55,
											color: "var(--vscode-descriptionForeground)",
										}}>
										{item.description}
									</div>
								</div>
							</button>
						)
					})}
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 12,
						marginTop: 14,
					}}>
					<label
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							fontSize: 11,
							cursor: "pointer",
							color: "var(--vscode-descriptionForeground)",
						}}>
						<input
							checked={askOnNew}
							onChange={(e) => onToggleAskOnNew(e.target.checked)}
							style={{ cursor: "pointer", margin: 0 }}
							type="checkbox"
						/>
						每次新开对话都询问
					</label>
					<button
						onClick={onClose}
						style={{
							padding: "4px 10px",
							fontSize: 11,
							borderRadius: 4,
							cursor: "pointer",
							color: "var(--vscode-button-secondaryForeground, var(--vscode-foreground))",
							background: "var(--vscode-button-secondaryBackground, rgba(128,128,128,0.2))",
							border: "none",
						}}>
						保持当前
					</button>
				</div>
			</div>
		</div>
	)
}

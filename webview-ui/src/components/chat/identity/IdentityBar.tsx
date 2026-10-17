import { ChevronDownIcon } from "lucide-react"
import { IdentityModeDef } from "./identity"

interface IdentityBarProps {
	modeDef: IdentityModeDef
	onOpen: () => void
}

const MODE_DOT_COLOR: Record<string, string> = {
	self: "#4aa3ff",
	persona: "#a78bfa",
	unrestricted: "#f5a524",
}

/**
 * 输入区上方的身份条。点一下换身份，不打断输入。
 */
export function IdentityBar({ modeDef, onOpen }: IdentityBarProps) {
	const dotColor = MODE_DOT_COLOR[modeDef.id] ?? "#4aa3ff"

	return (
		<div className="mx-3.5 pt-2 flex items-center gap-2 select-none">
			<button
				onClick={onOpen}
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					padding: "2px 8px 2px 7px",
					borderRadius: 999,
					cursor: "pointer",
					font: "inherit",
					fontSize: 11,
					lineHeight: 1.6,
					color: "var(--vscode-foreground)",
					background: "color-mix(in srgb, var(--vscode-foreground) 7%, transparent)",
					border: "1px solid color-mix(in srgb, var(--vscode-foreground) 12%, transparent)",
				}}
				title="切换身份（对话中随时可换）">
				<span
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: dotColor,
						boxShadow: `0 0 6px ${dotColor}80`,
						flexShrink: 0,
					}}
				/>
				<span style={{ color: "var(--vscode-descriptionForeground)" }}>身份</span>
				<span style={{ fontWeight: 600 }}>{modeDef.label}</span>
				<ChevronDownIcon size={11} style={{ opacity: 0.6 }} />
			</button>
			<span style={{ fontSize: 10, color: "var(--vscode-descriptionForeground)", opacity: 0.75 }}>{modeDef.hint}</span>
		</div>
	)
}

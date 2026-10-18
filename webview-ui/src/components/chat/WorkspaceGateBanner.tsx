import { FolderOpenIcon } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { FileServiceClient } from "@/services/grpc-client"

/**
 * 未打开工作区时的引导条。
 *
 * era harness 只在用户打开的文件夹里读写：没有工作区就不发消息，
 * 免得工具在空 cwd 上乱撞（旧版会兜底到「桌面」，用户完全不知情）。
 * 这里直接给一个「打开文件夹」按钮，而不是让用户自己去翻菜单。
 */
export function WorkspaceGateBanner() {
	const { workspaceRoots } = useExtensionState()

	if (workspaceRoots && workspaceRoots.length > 0) {
		return null
	}

	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 8,
				margin: "0 0 8px",
				padding: "8px 10px",
				borderRadius: 6,
				border: "1px solid var(--vscode-inputValidation-warningBorder, rgba(204, 167, 0, 0.6))",
				background: "var(--vscode-inputValidation-warningBackground, rgba(204, 167, 0, 0.12))",
				color: "var(--vscode-foreground)",
				fontSize: 12,
				lineHeight: 1.5,
			}}>
			<FolderOpenIcon
				size={14}
				style={{ flexShrink: 0, marginTop: 2, color: "var(--vscode-editorWarning-foreground, #cca700)" }}
			/>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontWeight: 600 }}>尚未打开工作区</div>
				<div style={{ color: "var(--vscode-descriptionForeground)" }}>
					era harness 只读取你打开的文件夹。选中 eraTW 工程目录（含 ERB/ 与 CSV/ 的那一层）后再开始对话。
				</div>
				<button
					onClick={() => void FileServiceClient.openWorkspaceFolder({})}
					style={{
						marginTop: 6,
						padding: "3px 10px",
						borderRadius: 4,
						border: "1px solid var(--vscode-button-border, transparent)",
						background: "var(--vscode-button-background)",
						color: "var(--vscode-button-foreground)",
						fontSize: 12,
						cursor: "pointer",
					}}
					type="button">
					打开文件夹
				</button>
			</div>
		</div>
	)
}

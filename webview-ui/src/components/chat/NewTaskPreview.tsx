import React from "react"
import { useTranslation } from "react-i18next"
import MarkdownBlock from "../common/MarkdownBlock"

interface NewTaskPreviewProps {
	context: string
}

const NewTaskPreview: React.FC<NewTaskPreviewProps> = ({ context }) => {
	const { t } = useTranslation("common")
	return (
		<div className="bg-(--vscode-textBlockQuote-background) text-(--vscode-foreground) rounded-[3px] border border-(--vscode-panel-border) p-[14px] pb-[6px]">
			<span style={{ fontWeight: "bold" }}>{t("newTaskPreview.task")}</span>
			<MarkdownBlock markdown={context} />
		</div>
	)
}

export default NewTaskPreview

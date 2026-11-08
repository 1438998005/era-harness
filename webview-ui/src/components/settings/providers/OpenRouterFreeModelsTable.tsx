/**
 * 「OpenRouter 列表」视图：上游可能被选中的免费模型，**不是路由顺序**。
 *
 * 与默认 `FreePoolTable` 的三点差异：① 没有「指定」列（黑盒随机，不可指定）；
 * ② 渠道列统一标「上游随机」；③ 行数随官方清单变化。高度仍从
 * `FREE_POOL_MIN_VISIBLE_ROWS` 单源派生（KB 08 #236：整页滚为主、表格内滚）。
 */
import { FREE_POOL_MIN_VISIBLE_ROWS } from "@shared/free-pools"
import type { OpenRouterFreeModel } from "@shared/openrouter-free-models"
import React from "react"
import { useTranslation } from "react-i18next"

const dimColor = "var(--vscode-descriptionForeground, #AAAAAA)"
const POOL_ROW_HEIGHT_PX = 22
const POOL_HEADER_HEIGHT_PX = 24
const TABLE_HEIGHT_PX = FREE_POOL_MIN_VISIBLE_ROWS * POOL_ROW_HEIGHT_PX + POOL_HEADER_HEIGHT_PX

/** 0 = 官方未列，显示「—」而不是 0K */
function formatContextWindow(tokens: number): string {
	if (tokens <= 0) {
		return "—"
	}
	if (tokens >= 1_000_000) {
		const millions = tokens / 1_000_000
		return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`
	}
	return `${Math.round(tokens / 1000)}K`
}

interface OpenRouterFreeModelsTableProps {
	models: readonly OpenRouterFreeModel[]
	loading: boolean
	/** true = 无可用缓存，正在展示内置静态快照 */
	fromSnapshot: boolean
	/** true = 本次未成功刷新（回落旧缓存或内置快照） */
	stale: boolean
}

export const OpenRouterFreeModelsTable: React.FC<OpenRouterFreeModelsTableProps> = ({ models, loading, fromSnapshot, stale }) => {
	const { t } = useTranslation("settings")
	const warningColor = "var(--vscode-editorWarning-foreground, #CCA700)"
	return (
		<>
			{loading && (
				<p className="shrink-0 text-[11px] m-0" style={{ color: dimColor }}>
					{t("settings.freeListLoading")}
				</p>
			)}
			{!loading && stale && fromSnapshot && (
				<p className="shrink-0 text-[11px] m-0" style={{ color: warningColor }}>
					{t("settings.freeListSnapshot")}
				</p>
			)}
			{!loading && stale && !fromSnapshot && (
				<p className="shrink-0 text-[11px] m-0" style={{ color: warningColor }}>
					{t("settings.freeListStale")}
				</p>
			)}
			<div
				className="overflow-x-hidden overflow-y-auto scrollable"
				style={{ minHeight: TABLE_HEIGHT_PX, maxHeight: TABLE_HEIGHT_PX }}>
				<table className="w-full text-xs border-collapse">
					<thead>
						<tr style={{ color: dimColor, backgroundColor: "var(--vscode-sideBar-background, transparent)" }}>
							<th className="sticky top-0 z-1 text-left font-normal pb-1 bg-(--vscode-sideBar-background)">
								{t("settings.freePoolModel")}
							</th>
							<th className="sticky top-0 z-1 text-left font-normal pb-1 w-24 bg-(--vscode-sideBar-background)">
								{t("settings.freeListUpstreamRandom")}
							</th>
							<th className="sticky top-0 z-1 text-right font-normal pb-1 w-14 bg-(--vscode-sideBar-background)">
								{t("settings.freePoolContext")}
							</th>
							<th className="sticky top-0 z-1 text-right font-normal pb-1 w-10 bg-(--vscode-sideBar-background)">
								{t("settings.freePoolVision")}
							</th>
						</tr>
					</thead>
					<tbody>
						{models.map((model) => (
							<tr
								className="border-t border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground) transition-colors"
								key={model.id}>
								<td className="py-1 pr-2">{model.name}</td>
								<td className="py-1">
									<span
										className="rounded-full px-1.5 py-px text-[10px] leading-none"
										style={{
											backgroundColor: "rgba(204,167,0,0.15)",
											color: "var(--vscode-editorWarning-foreground, #CCA700)",
										}}>
										{t("settings.freeListUpstreamRandom")}
									</span>
								</td>
								<td className="py-1 text-right" style={{ color: dimColor }}>
									{formatContextWindow(model.contextWindow)}
								</td>
								<td className="py-1 text-right">{model.vision ? "✓" : "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	)
}

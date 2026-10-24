import { type FreeCandidate, type FreeLane, getAllFreeCandidates, LANE_META } from "@shared/free-pools"
import type { Mode } from "@shared/storage/types"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import type React from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

interface FreeModelProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

const dimColor = "var(--vscode-descriptionForeground, #AAAAAA)"

/** 上下文窗口展示格式：1048576 → 1M，65536 → 64K */
function formatContextWindow(tokens: number): string {
	if (tokens >= 1_000_000) {
		const millions = tokens / 1_000_000
		return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`
	}
	return `${Math.round(tokens / 1000)}K`
}

/** 渠道徽标配色（OVH / Kilo 在用；zen 条目随 `FreeLane` 类型保留，移出池后不渲染） */
const LANE_BADGE_STYLE: Record<FreeLane, { backgroundColor: string; color: string }> = {
	zen: { backgroundColor: "rgba(0,120,212,0.15)", color: "#0078D4" },
	kilo: { backgroundColor: "rgba(46,160,67,0.15)", color: "#2EA043" },
	ovh: { backgroundColor: "rgba(139,92,246,0.15)", color: "#8B5CF6" },
}

const LANE_LABEL: Record<FreeLane, string> = {
	zen: "Zen",
	kilo: "Kilo",
	ovh: "OVHcloud",
}

/** 小徽标（需代理 / 收集数据），与渠道 pill 同族样式 */
function badge(backgroundColor: string, color: string, label: string, title?: string): React.ReactNode {
	return (
		<span className="rounded-full px-1.5 py-px text-[10px] leading-none" style={{ backgroundColor, color }} title={title}>
			{label}
		</span>
	)
}

const FreePoolTable: React.FC<{ candidates: FreeCandidate[]; excludeCollecting: boolean }> = ({
	candidates,
	excludeCollecting,
}) => {
	const { t } = useTranslation("settings")
	return (
		// 池已收敛为两渠道 15 项，取消固定 300px 内滚：整表自然展开、由设置页外层滚动容器
		// （TabContent flex-1 overflow-auto）兜底，避免「下方大片空白 + 表内滚动条」并存。
		<div className="overflow-x-hidden">
			<table className="w-full text-xs border-collapse">
				<thead>
					<tr style={{ color: dimColor, backgroundColor: "var(--vscode-sideBar-background, transparent)" }}>
						<th className="sticky top-0 z-1 text-left font-normal pb-1 bg-(--vscode-sideBar-background)">
							{t("settings.freePoolModel")}
						</th>
						<th className="sticky top-0 z-1 text-left font-normal pb-1 w-20 bg-(--vscode-sideBar-background)">
							{t("settings.freePoolLane")}
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
					{candidates.map((candidate) => {
						// 隐私开关开启时，收集渠道行降透明度示意「已被排除」（实际路由按 LANE_META 过滤）
						const excluded = excludeCollecting && LANE_META[candidate.lane].collectsData
						return (
							<tr
								className="border-t border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground) transition-colors"
								key={candidate.id || candidate.displayName}
								style={excluded ? { opacity: 0.45 } : undefined}>
								<td className="py-1 pr-2">
									<span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
										{candidate.displayName}
										{excluded &&
											badge(
												"rgba(120,120,120,0.15)",
												"var(--vscode-descriptionForeground, #AAAAAA)",
												t("settings.freePoolExcluded"),
												t("settings.freePoolExcludedTip"),
											)}
										{candidate.needsProxy &&
											badge(
												"rgba(204,167,0,0.15)",
												"#CCA700",
												t("settings.freePoolProxy"),
												t("settings.freePoolProxyTip"),
											)}
										{LANE_META[candidate.lane].collectsData &&
											badge(
												"rgba(241,76,76,0.12)",
												"var(--vscode-errorForeground, #F14C4C)",
												t("settings.freePoolCollect"),
												t("settings.freePoolCollectTip"),
											)}
									</span>
								</td>
								<td className="py-1">
									<span
										className="rounded-full px-1.5 py-px text-[10px] leading-none"
										style={LANE_BADGE_STYLE[candidate.lane]}>
										{LANE_LABEL[candidate.lane]}
									</span>
								</td>
								<td className="py-1 text-right" style={{ color: dimColor }}>
									{formatContextWindow(candidate.contextWindow)}
								</td>
								<td className="py-1 text-right">{candidate.vision ? "✓" : "—"}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

/**
 * 免费模型配置卡片：两渠道（Kilo / OVHcloud AI Endpoints）单一优先级池清单（Zen 已暂时移出池，
 * 代码保留待恢复）；模型池表格内部滚动。零配置开箱即用——无 API Key 输入框、无模型下拉
 * （路由自动选模型，呼应「不可选」）。附隐私开关：仅路由不收集提示词的渠道。
 */
export const FreeModelProvider: React.FC<FreeModelProviderProps> = () => {
	const { t } = useTranslation("settings")
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange } = useApiConfigurationHandlers()

	const excludeCollecting = apiConfiguration?.freeExcludeCollecting === true
	const candidates = getAllFreeCandidates()

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs m-0" style={{ color: dimColor }}>
				{t("settings.freeModelDesc")}
			</p>

			<div>
				<VSCodeCheckbox
					checked={excludeCollecting}
					onChange={() => handleFieldChange("freeExcludeCollecting", !excludeCollecting)}>
					{t("settings.freePrivacyToggle")}
				</VSCodeCheckbox>
				<div className="text-xs text-description mt-0.5">
					{excludeCollecting ? t("settings.freePrivacyHintOn") : t("settings.freePrivacyHintOff")}
				</div>
			</div>

			<div className="flex flex-col gap-1">
				<span className="text-xs font-medium">{t("settings.freePoolTitle")}</span>
				<FreePoolTable candidates={candidates} excludeCollecting={excludeCollecting} />
				<span className="text-[11px]" style={{ color: dimColor }}>
					{t("settings.freePoolHint")}
				</span>
			</div>
		</div>
	)
}

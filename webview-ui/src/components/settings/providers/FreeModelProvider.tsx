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
		// 池为两渠道动态规模（2026-11-05 全渠道存活复核后为 18 项；数字不写死在逻辑里，仅注释备查）。
		// 2026-11-04 用户裁定：滚动条只许出现在表格右缘，页面其余部分固定不滚——
		// 本 wrapper 为弹性内滚容器（flex-1 + overflow-y-auto，高度链自 ApiConfigurationSection
		// 的 isFree 分支打通），min-h-40 防极矮视口塌缩；行数装得下时无滚动条、无空白并存。
		// （同日早前曾改为整表展开 + 外层整页滚动，因滚动条贯穿整页被否；更早为固定 300px 内滚，
		// 因「下方空白 + 表内滚动条」并存被否。）
		<div className="flex-1 min-h-40 overflow-x-hidden overflow-y-auto scrollable">
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
 * 代码保留待恢复）；模型池表格弹性内部滚动——滚动条仅出现在表格右缘，页面不滚
 * （高度链依赖 ApiConfigurationSection / ApiOptions 的 isFree 条件类名）。
 * 零配置开箱即用——无 API Key 输入框、无模型下拉（路由自动选模型，呼应「不可选」）。
 * 附隐私开关：仅路由不收集提示词的渠道。
 */
export const FreeModelProvider: React.FC<FreeModelProviderProps> = () => {
	const { t } = useTranslation("settings")
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange } = useApiConfigurationHandlers()

	const excludeCollecting = apiConfiguration?.freeExcludeCollecting === true
	const candidates = getAllFreeCandidates()

	return (
		<div className="flex flex-1 min-h-0 flex-col gap-3">
			<p className="shrink-0 text-xs m-0" style={{ color: dimColor }}>
				{t("settings.freeModelDesc")}
			</p>

			<div className="shrink-0">
				<VSCodeCheckbox
					checked={excludeCollecting}
					onChange={() => handleFieldChange("freeExcludeCollecting", !excludeCollecting)}>
					{t("settings.freePrivacyToggle")}
				</VSCodeCheckbox>
				<div className="text-xs text-description mt-0.5">
					{excludeCollecting ? t("settings.freePrivacyHintOn") : t("settings.freePrivacyHintOff")}
				</div>
			</div>

			<div className="flex flex-1 min-h-0 flex-col gap-1">
				<span className="shrink-0 text-xs font-medium">{t("settings.freePoolTitle")}</span>
				<FreePoolTable candidates={candidates} excludeCollecting={excludeCollecting} />
				<span className="shrink-0 text-[11px]" style={{ color: dimColor }}>
					{t("settings.freePoolHint")}
				</span>
			</div>
		</div>
	)
}

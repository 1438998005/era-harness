import {
	FREE_POOL_MIN_VISIBLE_ROWS,
	type FreeCandidate,
	type FreeLane,
	getAllFreeCandidates,
	LANE_META,
} from "@shared/free-pools"
import type { Mode } from "@shared/storage/types"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"
import { OpenRouterFreeModelsTable } from "./OpenRouterFreeModelsTable"
import { useOpenRouterFreeModels } from "./useOpenRouterFreeModels"

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

/**
 * KB 08 #236（用户裁定「整页滚为主、表格内滚只在表格区域生效」）：
 * 把保底可视行数换算成表格容器高度。行高/表头是 UI 像素细节，行数本身只从
 * FREE_POOL_MIN_VISIBLE_ROWS 这一个单源常量派生（元测试会钉住这一点）。
 * ⛔ 不要改回 flex-1 min-h-0 高度链：那会让模型池吃满视口、把辅助模型区挤出屏幕。
 */
const POOL_ROW_HEIGHT_PX = 22
const POOL_HEADER_HEIGHT_PX = 24
const POOL_TABLE_HEIGHT_PX = FREE_POOL_MIN_VISIBLE_ROWS * POOL_ROW_HEIGHT_PX + POOL_HEADER_HEIGHT_PX

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

interface FreePoolTableProps {
	candidates: FreeCandidate[]
	excludeCollecting: boolean
	/** KB 08 #242：存真实上游模型 ID，不是 displayName、不是池内下标 */
	pinnedModelId?: string
	onPin: (id: string | undefined) => void
}

const FreePoolTable: React.FC<FreePoolTableProps> = ({ candidates, excludeCollecting, pinnedModelId, onPin }) => {
	const { t } = useTranslation("settings")
	return (
		// 池为两渠道动态规模（2026-11-08 补入 LFM3-1.7B 后为 19 项；数字不写死在逻辑里，仅注释备查）。
		// KB 08 #236：固定高度 = 保底 10 行 + 表头。内滚条只在表格区域生效；
		// 刻意**不**用 overscroll-behavior: contain —— 表格滚到底后滚轮自然交给外层整页继续滚，
		// 这样从模型池往下滚能一路到辅助模型区、中间无断点（2026-11-05 用户裁定）。
		<div
			className="overflow-x-hidden overflow-y-auto scrollable"
			style={{ minHeight: POOL_TABLE_HEIGHT_PX, maxHeight: POOL_TABLE_HEIGHT_PX }}>
			<table className="w-full text-xs border-collapse">
				<thead>
					<tr style={{ color: dimColor, backgroundColor: "var(--vscode-sideBar-background, transparent)" }}>
						<th className="sticky top-0 z-1 text-left font-normal pb-1 w-8 bg-(--vscode-sideBar-background)">
							{t("settings.freePinnedColumn")}
						</th>
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
								<td className="py-1 pr-1">
									{/* KB 08 #242：被隐私开关排除的行禁用 + tooltip（tooltip 挂 span，
									    原生 disabled input 自身不触发 hover 事件） */}
									<span title={excluded ? t("settings.freePinnedDisabledTip") : t("settings.freePinnedPick")}>
										<input
											aria-label={`${t("settings.freePinnedPick")} ${candidate.displayName}`}
											checked={pinnedModelId === candidate.id}
											disabled={excluded}
											name="free-pinned-model"
											onChange={() => onPin(candidate.id)}
											type="radio"
										/>
									</span>
								</td>
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
 * 代码保留待恢复）。KB 08 #236：整页滚为主，表格自己按保底 10 行限高、内滚只在表格区域生效，
 * 从表格往下滚可连续到达辅助模型区。零配置开箱即用——无 API Key 输入框。
 * KB 08 #242：可指定单个模型（存真实上游 ID，全局一份），常驻限流风险告知。
 * KB 08 #244：告知按 locale 单语（zh-CN 中文 / en 英文），推翻 #242 原「强制中英双语」裁定。
 */
export const FreeModelProvider: React.FC<FreeModelProviderProps> = () => {
	const { t } = useTranslation("settings")
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange, handleFieldsChange } = useApiConfigurationHandlers()
	const [justPinned, setJustPinned] = useState(false)

	const excludeCollecting = apiConfiguration?.freeExcludeCollecting === true
	const useOpenRouterRouter = apiConfiguration?.freeUseOpenRouterRouter === true
	const candidates = getAllFreeCandidates()
	const routerState = useOpenRouterFreeModels(useOpenRouterRouter)
	// 三态互斥：路由模式优先，旧数据里残留的 pinned 不参与 UI 判定（handler 也以该标志优先）。
	const pinnedModelId = useOpenRouterRouter ? undefined : apiConfiguration?.pinnedModelId?.trim() || undefined
	const pinnedCandidate = pinnedModelId ? candidates.find((c) => c.id === pinnedModelId) : undefined
	const pinnedExcluded = excludeCollecting && pinnedCandidate ? LANE_META[pinnedCandidate.lane].collectsData : false

	// 2026-11-08：列表切换（默认列表 ⇄ OpenRouter 列表）与自动路由 / 指定模型互斥。多字段必须**原子写**，
	// ⛔ 连续调 handleFieldChange 会基于同一份旧配置互相覆盖；清空 pin 仍写空串（#243）。
	const selectMode = (mode: "auto" | "router") => {
		// ⛔ 不动隐私开关：静默关掉、切回自动路由又不恢复，等于永久丢失用户偏好。
		// 两者同时为真时由下方 radio 门禁与冲突提示处理（2026-11-08 代码审查修订）。
		void handleFieldsChange(
			mode === "router"
				? { freeUseOpenRouterRouter: true, pinnedModelId: "" }
				: { freeUseOpenRouterRouter: false, pinnedModelId: "" },
		)
		setJustPinned(false)
	}

	// 点了才写；⛔ 失败时不在这里、也不在路由层自动清掉 pinned（用户裁定）
	// #243：清空必须写**空串**而不是 undefined —— setApiConfiguration 跳过 undefined，
	// 传 undefined 只会让旧值留在磁盘上（UI 假动作）。所有消费点都做 `.trim() || undefined`
	// 归一化，空串等价于未指定；host 侧的显式删除通道会把这个空串从磁盘删掉。
	const pin = (id: string | undefined) => {
		void handleFieldsChange({ pinnedModelId: id ?? "", freeUseOpenRouterRouter: false })
		setJustPinned(!!id)
	}

	return (
		<div className="flex flex-col gap-3">
			{/* 默认列表按优先级依次尝试且可指定模型；OpenRouter 列表是黑盒随机、不能指定。
			    两套说明必须随列表切换，否则同一屏会自相矛盾。 */}
			<p className="shrink-0 text-xs m-0" style={{ color: dimColor }}>
				{useOpenRouterRouter ? t("settings.freeModelDescOpenRouter") : t("settings.freeModelDesc")}
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

			{/* KB 08 #242：指定模型区；2026-11-08 改为「列表切换」后，OpenRouter 列表下禁用指定 */}
			<div className="shrink-0 flex flex-col gap-1.5">
				<span className="text-xs font-medium">{t("settings.freePinnedTitle")}</span>
				<label className="flex items-center gap-1.5 text-xs" style={useOpenRouterRouter ? { opacity: 0.45 } : undefined}>
					<input
						checked={!pinnedModelId && !useOpenRouterRouter}
						disabled={useOpenRouterRouter}
						name="free-pinned-model"
						onChange={() => selectMode("auto")}
						type="radio"
					/>
					{t("settings.freePinnedAuto")}
				</label>
				{useOpenRouterRouter && (
					<p className="text-[11px] m-0 leading-relaxed" style={{ color: dimColor }}>
						{t("settings.freeListPinnedDisabled")}
					</p>
				)}
				{useOpenRouterRouter && excludeCollecting && (
					<p className="text-[11px] m-0 leading-relaxed" style={{ color: "var(--vscode-errorForeground, #F14C4C)" }}>
						{t("settings.freeRouterPrivacyConflict")}
					</p>
				)}
				{/* 常驻 + 按 locale 单语：写清「链长=1 → switchable 无处可切」的因果，不是泛泛警示 */}
				{!useOpenRouterRouter && (
					<p className="text-[11px] m-0 leading-relaxed" style={{ color: "var(--vscode-errorForeground, #F14C4C)" }}>
						{t("settings.freePinnedRisk")}
					</p>
				)}
				{justPinned && pinnedModelId && (
					<p className="text-[11px] m-0 leading-relaxed" style={{ color: dimColor }}>
						{t("settings.freePinnedConfirm")}
					</p>
				)}
				{pinnedModelId && !pinnedCandidate && (
					<p className="text-[11px] m-0 leading-relaxed" style={{ color: "var(--vscode-errorForeground, #F14C4C)" }}>
						{t("settings.freePinnedMissing")}
					</p>
				)}
				{pinnedExcluded && (
					<p className="text-[11px] m-0 leading-relaxed" style={{ color: "var(--vscode-errorForeground, #F14C4C)" }}>
						{t("settings.freePinnedExcluded")}
					</p>
				)}
				{pinnedModelId && (
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-[11px]" style={{ color: dimColor }}>
							{t("settings.freePinnedCurrent")} {pinnedCandidate?.displayName ?? pinnedModelId}
						</span>
						<button
							className="text-[11px] p-0 border-0 bg-transparent cursor-pointer"
							onClick={() => pin(undefined)}
							style={{ color: "var(--vscode-textLink-foreground, #3794FF)" }}
							type="button">
							{t("settings.freePinnedClear")}
						</button>
					</div>
				)}
			</div>

			<div className="flex flex-col gap-1">
				<div className="shrink-0 flex items-center justify-between gap-2 flex-wrap">
					<span className="text-xs font-medium">
						{useOpenRouterRouter ? t("settings.freeListOpenRouterTitle") : t("settings.freePoolTitle")}
					</span>
					{/* 2026-11-08 用户裁定：把「第三个并列 radio」改成表格上方的列表切换。
					    切换即原子写既有布尔设置（见上方 selectMode），底层推理链路逐字不动。 */}
					<div className="flex items-center gap-3 flex-wrap">
						<label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
							<input
								checked={!useOpenRouterRouter}
								name="free-list-switch"
								onChange={() => selectMode("auto")}
								type="radio"
							/>
							{t("settings.freeListSwitchDefault")}
						</label>
						<label
							className="flex items-center gap-1.5 text-[11px] cursor-pointer"
							title={excludeCollecting ? t("settings.freeRouterPrivacyConflict") : undefined}>
							<input
								checked={useOpenRouterRouter}
								disabled={excludeCollecting}
								name="free-list-switch"
								onChange={() => selectMode("router")}
								type="radio"
							/>
							{t("settings.freeListSwitchOpenRouter")}
						</label>
					</div>
				</div>
				{useOpenRouterRouter ? (
					<OpenRouterFreeModelsTable
						fromSnapshot={routerState.fromSnapshot}
						loading={routerState.loading}
						models={routerState.models}
						stale={routerState.stale}
					/>
				) : (
					<FreePoolTable
						candidates={candidates}
						excludeCollecting={excludeCollecting}
						onPin={pin}
						pinnedModelId={pinnedModelId}
					/>
				)}
				{useOpenRouterRouter ? (
					<>
						<p
							className="shrink-0 text-[11px] m-0 leading-relaxed"
							style={{ color: "var(--vscode-editorWarning-foreground, #CCA700)" }}>
							{t("settings.freeListNonSequential")}
						</p>
						<p className="shrink-0 text-[11px] m-0 leading-relaxed" style={{ color: dimColor }}>
							{t("settings.freeRouterOption")}
						</p>
						<p
							className="shrink-0 text-[11px] m-0 leading-relaxed"
							style={{ color: "var(--vscode-errorForeground, #F14C4C)" }}>
							{t("settings.freeRouterRisk")}
						</p>
						<span className="shrink-0 text-[11px]" style={{ color: dimColor }}>
							{t("settings.freeRouterHint")}
						</span>
					</>
				) : (
					<span className="shrink-0 text-[11px]" style={{ color: dimColor }}>
						{pinnedModelId ? t("settings.freePoolHintPinned") : t("settings.freePoolHint")}
					</span>
				)}
			</div>
		</div>
	)
}

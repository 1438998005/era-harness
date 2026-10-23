import {
	deepSeekDefaultModelId,
	deepSeekModels,
	mimoDefaultModelId,
	mimoModels,
	modelIdToWriteOnProviderSwitch,
} from "@shared/api"
import { DEEPSEEK_PEAK_MULTIPLIER, isDeepSeekPeakHour } from "@shared/deepseekPricing"
import type { Mode } from "@shared/storage/types"
import { Brain, Check, Settings2, Smartphone, Zap } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import styled from "styled-components"
import { normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import { useApiConfigurationHandlers } from "@/components/settings/utils/useApiConfigurationHandlers"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface ModelQuickSwitchMenuProps {
	mode: Mode
	/** 触发器（聊天底部模型按钮），由调用方提供以保留原有样式 */
	trigger: React.ReactNode
}

interface QuickSwitchEntry {
	provider: "free" | "deepseek" | "mimo" | "openai"
	label: string
	icon: React.ReactNode
	iconColor: string
	badge?: string
	badgeBg: string
	badgeFg: string
	priceText: string
	priceColor: string
	priceWeight?: number
	hint?: string
}

/**
 * 模型按钮上拉快速切换：免离开对话在 免费模型 / DeepSeek / OpenAI 自定义 间切换。
 * 免费模型带绿色「免费」徽标并与下方付费方案分区；底部通栏「打开 API 设置」。
 *
 * 配色说明：所有文字色走内联 `var(--vscode-*)` + 回退值（Portal 场景下不依赖
 * tailwind 颜色类的生成结果），主题自适应；交互态用 styled-components（真实 CSS）。
 */
export const ModelQuickSwitchMenu: React.FC<ModelQuickSwitchMenuProps> = ({ mode, trigger }) => {
	const { t } = useTranslation("common")
	const { apiConfiguration, navigateToSettingsModelPicker } = useExtensionState()
	const { handleModeFieldsChange } = useApiConfigurationHandlers()
	// 受控开合：任何跳转/切换前显式关闭，避免浮层（Portal）残留延续到后续视图
	const [open, setOpen] = useState(false)

	const { selectedProvider } = normalizeApiConfiguration(apiConfiguration, mode)

	// DeepSeek 价格：输入 = 缓存命中–未命中两档，输出单列（元/百万 tokens）。
	// 实时按当前北京时间判定峰/谷：高峰时段（工作日 09:00–12:00、14:00–18:00）整体 ×2。
	const deepSeekInfo = deepSeekModels[deepSeekDefaultModelId]
	const deepSeekPeak = isDeepSeekPeakHour()
	const deepSeekMultiplier = deepSeekPeak ? DEEPSEEK_PEAK_MULTIPLIER : 1
	const fmtDeepSeekPrice = (n?: number) => Number(((n ?? 0) * deepSeekMultiplier).toFixed(4)).toString()
	const deepSeekPrice = `输入 ¥${fmtDeepSeekPrice(deepSeekInfo.cacheReadsPrice)}–${fmtDeepSeekPrice(deepSeekInfo.cacheWritesPrice)} / 输出 ¥${fmtDeepSeekPrice(deepSeekInfo.outputPrice)}`

	// MiMo 无峰谷倍率，价格取默认档（flash）。字段口径与 DeepSeek 相同：
	// cacheReadsPrice = 输入命中、cacheWritesPrice = 输入未命中（不是缓存写入费）。
	const mimoInfo = mimoModels[mimoDefaultModelId]
	const mimoPrice = `输入 ¥${mimoInfo.cacheReadsPrice}–${mimoInfo.cacheWritesPrice} / 输出 ¥${mimoInfo.outputPrice}`

	const entries: QuickSwitchEntry[] = [
		{
			provider: "free",
			label: t("chat.freeModelName"),
			icon: <Zap size={13} />,
			iconColor: "var(--vscode-charts-green, #2EA043)",
			badge: t("chat.freeModelBadge"),
			badgeBg: "var(--vscode-badge-background, #238636)",
			badgeFg: "var(--vscode-badge-foreground, #FFFFFF)",
			priceText: "Free",
			priceColor: "var(--vscode-charts-green, #2EA043)",
			priceWeight: 600,
			hint: t("chat.freeModelDesc"),
		},
		{
			provider: "deepseek",
			label: "DeepSeek",
			icon: <Brain size={13} />,
			iconColor: "var(--vscode-foreground, #E7E7E7)",
			badgeBg: "transparent",
			badgeFg: "inherit",
			priceText: deepSeekPrice,
			priceColor: "var(--vscode-foreground, #E7E7E7)",
			hint: deepSeekPeak ? t("chat.deepseekPriceHintPeak") : t("chat.deepseekPriceHint"),
		},
		{
			provider: "mimo",
			label: "小米 MiMo",
			icon: <Smartphone size={13} />,
			iconColor: "var(--vscode-foreground, #E7E7E7)",
			badgeBg: "transparent",
			badgeFg: "inherit",
			priceText: mimoPrice,
			priceColor: "var(--vscode-foreground, #E7E7E7)",
		},
		{
			provider: "openai",
			label: t("chat.openaiCustom"),
			icon: <Settings2 size={13} />,
			iconColor: "var(--vscode-foreground, #E7E7E7)",
			badgeBg: "transparent",
			badgeFg: "inherit",
			priceText: t("chat.customProviderPrice"),
			priceColor: "var(--vscode-foreground, #E7E7E7)",
		},
	]

	const handleSelect = async (provider: QuickSwitchEntry["provider"]) => {
		setOpen(false)
		if (provider === selectedProvider) {
			return
		}

		// provider 与 modelId 必须同批原子写入，且必须调设置页那份判据（@shared/api）。
		// 只改 provider 会把上一家的模型 id 留在原地：从 MiMo 切到 DeepSeek 后，
		// 界面显示小米模型、请求却打到 DeepSeek 官方（实测 402），是真实踩过的坑。
		const targetModelId =
			provider === "openai"
				? mode === "plan"
					? apiConfiguration?.planModeOpenAiModelId
					: apiConfiguration?.actModeOpenAiModelId
				: mode === "plan"
					? apiConfiguration?.planModeApiModelId
					: apiConfiguration?.actModeApiModelId
		const modelIdToWrite = modelIdToWriteOnProviderSwitch(provider, targetModelId)

		await handleModeFieldsChange(
			{
				provider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
				...(modelIdToWrite ? { modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" } } : {}),
			},
			{
				provider,
				...(modelIdToWrite ? { modelId: modelIdToWrite } : {}),
			},
			mode,
		)
	}

	const handleOpenSettings = () => {
		// 先关浮层再跳转：Portal 内容不会随视图切换自动卸载
		setOpen(false)
		navigateToSettingsModelPicker({ targetSection: "api-config" })
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[320px] max-w-[calc(100vw-24px)] p-0 overflow-hidden"
				side="top"
				sideOffset={8}>
				<HeaderRow>
					{t("chat.quickSwitchTitle")}
					<span style={{ opacity: 0.7 }}> · {mode === "plan" ? t("chat.planMode") : t("chat.actMode")}</span>
				</HeaderRow>

				<div className="flex flex-col">
					{entries.map((entry, index) => {
						const isActive = entry.provider === selectedProvider
						return (
							<div key={entry.provider}>
								{index === 1 && (
									<>
										<SectionDivider />
										<SectionCaption>{t("chat.paidSection")}</SectionCaption>
									</>
								)}
								<EntryRow isActive={isActive} onClick={() => handleSelect(entry.provider)} type="button">
									<span
										className="flex h-4 w-4 shrink-0 items-center justify-center"
										style={{ color: entry.iconColor }}>
										{entry.icon}
									</span>
									<span className="flex min-w-0 flex-1 items-center gap-1.5">
										<span className="truncate text-xs font-medium">{entry.label}</span>
										{entry.badge && (
											<span
												className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium leading-none"
												style={{ backgroundColor: entry.badgeBg, color: entry.badgeFg }}>
												{entry.badge}
											</span>
										)}
									</span>
									<span className="flex shrink-0 items-center gap-1.5">
										{entry.hint && <HintText>{entry.hint}</HintText>}
										<span
											className="text-[11px]"
											style={{ color: entry.priceColor, fontWeight: entry.priceWeight ?? 400 }}>
											{entry.priceText}
										</span>
										{isActive && (
											<Check size={12} style={{ color: "var(--vscode-textLink-foreground, #3794FF)" }} />
										)}
									</span>
								</EntryRow>
							</div>
						)
					})}
				</div>

				<FooterButton onClick={handleOpenSettings} type="button">
					<Settings2 size={12} />
					{t("chat.openApiSettings")}
				</FooterButton>
			</PopoverContent>
		</Popover>
	)
}

// ---------------------------------------------------------------------------
// styled-components：交互态与文字色（Portal 下不依赖 tailwind 颜色类生成）
// ---------------------------------------------------------------------------

const textColor = "var(--vscode-foreground, #E7E7E7)"
const dimColor = "var(--vscode-descriptionForeground, #AAAAAA)"

const HeaderRow = styled.div`
	padding: 10px 12px 6px;
	font-size: 12px;
	color: ${dimColor};
`

const SectionDivider = styled.div`
	margin: 4px 12px;
	border-top: 1px solid var(--vscode-panel-border, #3C3C3C);
`

const SectionCaption = styled.div`
	padding: 0 12px 4px;
	font-size: 12px;
	color: ${dimColor};
`

const EntryRow = styled.button<{ isActive: boolean }>`
	display: flex;
	width: 100%;
	align-items: center;
	gap: 8px;
	padding: 7px 12px;
	text-align: left;
	background: ${({ isActive }) => (isActive ? "var(--vscode-list-activeSelectionBackground, #04395E)" : "transparent")};
	color: ${textColor};
	border: none;
	cursor: pointer;
	transition: background 0.1s ease;

	&:hover {
		background: var(--vscode-list-hoverBackground, #2A2D2E);
	}
`

const HintText = styled.span`
	font-size: 10px;
	color: ${textColor};
	opacity: 0.85;
`

const FooterButton = styled.button`
	margin-top: 4px;
	display: flex;
	width: 100%;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 8px 12px;
	font-size: 12px;
	color: ${textColor};
	background: transparent;
	border: none;
	border-top: 1px solid var(--vscode-panel-border, #3C3C3C);
	cursor: pointer;
	transition: background 0.1s ease;

	&:hover {
		background: var(--vscode-list-hoverBackground, #2A2D2E);
	}
`

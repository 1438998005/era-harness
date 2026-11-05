import {
	apiProviderDefaultModelId,
	bigmodelDefaultModelId,
	bigmodelModels,
	deepSeekDefaultModelId,
	deepSeekModels,
	type ModelInfo,
	mimoDefaultModelId,
	mimoModels,
	moonshotDefaultModelId,
	moonshotModels,
	shouldResetModelForProvider,
} from "@shared/api"
import { DEEPSEEK_PEAK_MULTIPLIER, isDeepSeekPeakHour } from "@shared/deepseekPricing"
import type { Mode } from "@shared/storage/types"
import { Brain, Check, Settings2, Smartphone, Sparkles, Zap } from "lucide-react"
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
	provider: "free" | "deepseek" | "mimo" | "bigmodel" | "bigmodel-plan" | "moonshot" | "openai"
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

	// #52：价格行跟随「该家当前记忆的模型」（没有记忆用默认档），不再永远显示默认档——
	// 用户在设置里为某家选了非默认档时，菜单价格应与切换后实际生效的模型一致。
	const rememberedIds = mode === "plan" ? apiConfiguration?.planModeProviderModelIds : apiConfiguration?.actModeProviderModelIds

	// DeepSeek 价格：输入 = 缓存命中–未命中两档，输出单列（元/百万 tokens）。
	// 实时按当前北京时间判定峰/谷：高峰时段（工作日 09:00–12:00、14:00–18:00）整体 ×2。
	// 目录是字面量键类型，记忆 id 是运行时字符串：走 Record 视图 + 默认档兑底。
	const deepSeekInfo =
		(deepSeekModels as Record<string, ModelInfo>)[rememberedIds?.deepseek ?? ""] ?? deepSeekModels[deepSeekDefaultModelId]
	const deepSeekPeak = isDeepSeekPeakHour()
	const deepSeekMultiplier = deepSeekPeak ? DEEPSEEK_PEAK_MULTIPLIER : 1
	const fmtDeepSeekPrice = (n?: number) => Number(((n ?? 0) * deepSeekMultiplier).toFixed(4)).toString()
	const deepSeekPrice = `输入 ¥${fmtDeepSeekPrice(deepSeekInfo.cacheReadsPrice)}–${fmtDeepSeekPrice(deepSeekInfo.cacheWritesPrice)} / 输出 ¥${fmtDeepSeekPrice(deepSeekInfo.outputPrice)}`

	// MiMo 无峰谷倍率。字段口径与 DeepSeek 相同：
	// cacheReadsPrice = 输入命中、cacheWritesPrice = 输入未命中（不是缓存写入费）。
	const mimoInfo = (mimoModels as Record<string, ModelInfo>)[rememberedIds?.mimo ?? ""] ?? mimoModels[mimoDefaultModelId]
	const mimoPrice = `输入 ¥${mimoInfo.cacheReadsPrice}–${mimoInfo.cacheWritesPrice} / 输出 ¥${mimoInfo.outputPrice}`

	// BigModel 无峰谷倍率。字段口径与 DeepSeek/MiMo 相同。
	const bigmodelInfo =
		(bigmodelModels as Record<string, ModelInfo>)[rememberedIds?.bigmodel ?? ""] ?? bigmodelModels[bigmodelDefaultModelId]
	const bigmodelPrice = `输入 ¥${bigmodelInfo.cacheReadsPrice}–${bigmodelInfo.cacheWritesPrice} / 输出 ¥${bigmodelInfo.outputPrice}`

	// Kimi：命中/未命中两档输入 + 输出，无峰谷倍率（口径同 MiMo/BigModel）。
	const moonshotInfo =
		(moonshotModels as Record<string, ModelInfo>)[rememberedIds?.moonshot ?? ""] ?? moonshotModels[moonshotDefaultModelId]
	const moonshotPrice = `输入 ¥${moonshotInfo.cacheReadsPrice}–${moonshotInfo.cacheWritesPrice} / 输出 ¥${moonshotInfo.outputPrice}`

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
			provider: "bigmodel",
			label: "智谱 BigModel",
			icon: <Sparkles size={13} />,
			iconColor: "var(--vscode-foreground, #E7E7E7)",
			badgeBg: "transparent",
			badgeFg: "inherit",
			priceText: bigmodelPrice,
			priceColor: "var(--vscode-foreground, #E7E7E7)",
		},
		{
			// 套餐不按 token 计费：价格行写「套餐内不计费」而不是一排 ¥0（¥0 会被读成"免费"）
			provider: "bigmodel-plan",
			label: "智谱 GLM 套餐",
			icon: <Sparkles size={13} />,
			iconColor: "var(--vscode-charts-blue, #3B82F6)",
			badge: "套餐",
			badgeBg: "var(--vscode-charts-blue, #3B82F6)",
			badgeFg: "#FFFFFF",
			priceText: "套餐内不计费",
			priceColor: "var(--vscode-descriptionForeground, #9D9D9D)",
			// 08 #180：这里以前挂了一句 23 字的 hint（「GLM Coding Plan 订阅额度，与按量 Key 不通用」），
			// 菜单行没有为长句设计——右侧信息列不收缩，把主名挤成 0 宽，整行溢出被裁。
			// 菜单行不放长句：「与按量 Key 不通用」在设置页套餐面板里已有（BigmodelPlanProvider），不重复。
		},
		{
			// 08 #180 的教训：菜单行不放长句 hint（双入口/密钥不互通的说明在设置页 Kimi 卡片里）
			provider: "moonshot",
			label: "Kimi (Moonshot)",
			icon: <Sparkles size={13} />,
			iconColor: "var(--vscode-charts-purple, #A371F7)",
			badgeBg: "transparent",
			badgeFg: "inherit",
			priceText: moonshotPrice,
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

		// #52：切走前先把「当前 provider + 当前模型」存进 per-provider 记忆——
		// 这是「切走再切回能恢复上次的模型」的保存侧（free 不吃 modelId、openai 有独立字段，都不存）。
		const providerModelIdsField = mode === "plan" ? "planModeProviderModelIds" : "actModeProviderModelIds"
		const currentMap = apiConfiguration?.[providerModelIdsField] ?? {}
		const currentModelId = mode === "plan" ? apiConfiguration?.planModeApiModelId : apiConfiguration?.actModeApiModelId
		const savedMap =
			selectedProvider !== "free" && selectedProvider !== "openai" && currentModelId
				? { ...currentMap, [selectedProvider]: currentModelId }
				: currentMap

		// 切到目标家：优先恢复记忆的模型（#52）。记忆 id 若已从本家清单消失且明显属于别家，
		// 仍兑底默认档——归属校验不得绕过（KB18 §18.11 教训）；未知 id（官方新增/同步来的）保留。
		// provider 与 modelId 必须同批原子写入，且必须调设置页那份判据（@shared/api）：
		// 只改 provider 会把上一家的模型 id 留在原地（实测 402 串家坑）。
		const slotId = mode === "plan" ? apiConfiguration?.planModeApiModelId : apiConfiguration?.actModeApiModelId
		const rememberedId = savedMap[provider]
		let modelIdToWrite: string | undefined
		if (provider === "openai") {
			// openai 用自己的 planMode/actModeOpenAiModelId 字段，不经槽位
			modelIdToWrite = undefined
		} else if (provider === "free") {
			modelIdToWrite = undefined
		} else {
			const candidate = rememberedId ?? slotId
			modelIdToWrite = candidate
				? shouldResetModelForProvider(provider, candidate)
					? apiProviderDefaultModelId(provider)
					: candidate
				: apiProviderDefaultModelId(provider)
		}

		// 记忆同步为校验后的值：默认档兑底也落进记忆，下次直接命中
		const updatedMap =
			provider !== "free" && provider !== "openai" && modelIdToWrite
				? { ...savedMap, [provider]: modelIdToWrite }
				: savedMap

		await handleModeFieldsChange(
			{
				provider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
				...(modelIdToWrite ? { modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" } } : {}),
				...(provider !== "free" && provider !== "openai"
					? { providerModelIds: { plan: "planModeProviderModelIds", act: "actModeProviderModelIds" } }
					: {}),
			},
			{
				provider,
				...(modelIdToWrite ? { modelId: modelIdToWrite } : {}),
				...(provider !== "free" && provider !== "openai" ? { providerModelIds: updatedMap } : {}),
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
								{/* data-provider 供结构性测试比对 providers.json：新增 provider 忘了加菜单条目会红 */}
								<EntryRow
									data-provider={entry.provider}
									isActive={isActive}
									onClick={() => handleSelect(entry.provider)}
									type="button">
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
									<span className="flex shrink-0 items-center gap-1.5 max-w-[55%] overflow-hidden">
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
	max-width: 110px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
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

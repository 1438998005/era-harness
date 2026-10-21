import { UpdateSettingsRequest } from "@shared/proto/cline/state"
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { UiServiceClient } from "@/services/grpc-client"
import Section from "../Section"
import SettingsSlider from "../SettingsSlider"
import { updateSetting } from "../utils/settingsHandlers"

// Reusable checkbox component for feature settings
interface FeatureCheckboxProps {
	checked: boolean | undefined
	onChange: (checked: boolean) => void
	label: string
	description: ReactNode
	disabled?: boolean
	isRemoteLocked?: boolean
	remoteTooltip?: string
	isVisible?: boolean
}

// Interface for feature toggle configuration
interface FeatureToggle {
	id: string
	label: string
	description: ReactNode
	settingKey: keyof UpdateSettingsRequest
	stateKey: string
	/** If set, the setting value is nested with this key (e.g., "enabled" -> { enabled: checked }) */
	nestedKey?: string
}

const agentFeatures: FeatureToggle[] = [
	{
		id: "subagents",
		label: "Subagents",
		description: "Let era harness run focused subagents in parallel to explore the codebase for you.",
		stateKey: "subagentsEnabled",
		settingKey: "subagentsEnabled",
	},
	{
		id: "native-tool-call",
		label: "Native Tool Call",
		description: "Use native function calling when available",
		stateKey: "nativeToolCallSetting",
		settingKey: "nativeToolCallEnabled",
	},
	{
		id: "parallel-tool-calling",
		label: "Parallel Tool Calling",
		description: "Execute multiple tool calls simultaneously",
		stateKey: "enableParallelToolCalling",
		settingKey: "enableParallelToolCalling",
	},
	{
		id: "strict-plan-mode",
		label: "Strict Plan Mode",
		description: "Prevents file edits while in Plan mode",
		stateKey: "strictPlanModeEnabled",
		settingKey: "strictPlanModeEnabled",
	},
	{
		id: "auto-compact",
		label: "Auto Compact",
		description: "Automatically compress conversation history.",
		stateKey: "useAutoCondense",
		settingKey: "useAutoCondense",
	},
	{
		id: "focus-chain",
		label: "Focus Chain",
		description: "Maintain context focus across interactions",
		stateKey: "focusChainEnabled",
		settingKey: "focusChainSettings",
		nestedKey: "enabled",
	},
]

const editorFeatures: FeatureToggle[] = [
	{
		id: "show-feature-tips",
		label: "Feature Tips",
		description: "Show rotating tips during the thinking phase to help you discover era harness features.",
		stateKey: "showFeatureTips",
		settingKey: "showFeatureTips",
	},
	{
		id: "background-edit",
		label: "Background Edit",
		description: "Allow edits without stealing editor focus",
		stateKey: "backgroundEditEnabled",
		settingKey: "backgroundEditEnabled",
	},
	{
		id: "checkpoints",
		label: "Checkpoints",
		description: "Save progress at key points for easy rollback",
		stateKey: "enableCheckpointsSetting",
		settingKey: "enableCheckpointsSetting",
	},
	{
		id: "cline-web-tools",
		label: "era harness Web Tools",
		description: "Access web browsing and search capabilities",
		stateKey: "clineWebToolsEnabled",
		settingKey: "clineWebToolsEnabled",
	},
	{
		id: "worktrees",
		label: "Worktrees",
		description: "Enables git worktree management for running parallel era harness tasks.",
		stateKey: "worktreesEnabled",
		settingKey: "worktreesEnabled",
	},
]

const experimentalFeatures: FeatureToggle[] = [
	{
		id: "yolo",
		label: "Yolo Mode",
		description:
			"Execute tasks without user's confirmation. Auto-switches from Plan to Act mode and disables the ask question tool. Use with extreme caution.",
		stateKey: "yoloModeToggled",
		settingKey: "yoloModeToggled",
	},
	{
		id: "double-check-completion",
		label: "Double-Check Completion",
		description:
			"Rejects the first completion attempt and asks the model to re-verify its work against the original task requirements before accepting.",
		stateKey: "doubleCheckCompletionEnabled",
		settingKey: "doubleCheckCompletionEnabled",
	},
	{
		id: "lazy-teammate",
		label: "Lazy Teammate Mode",
		description: "Sometimes era harness just isn't feeling it today. For entertainment purposes only.",
		stateKey: "lazyTeammateModeEnabled",
		settingKey: "lazyTeammateModeEnabled",
	},
]

const advancedFeatures: FeatureToggle[] = [
	{
		id: "hooks",
		label: "Hooks",
		description: "Enable lifecycle and tool hooks during task execution.",
		stateKey: "hooksEnabled",
		settingKey: "hooksEnabled",
	},
]

const FeatureRow = memo(
	({
		checked = false,
		onChange,
		label,
		description,
		disabled,
		isRemoteLocked,
		isVisible = true,
		remoteTooltip,
	}: FeatureCheckboxProps) => {
		if (!isVisible) {
			return null
		}

		const checkbox = (
			<div className="flex items-center justify-between w-full">
				<div>{label}</div>
				<div>
					<Switch
						checked={checked}
						className="shrink-0"
						disabled={disabled || isRemoteLocked}
						id={label}
						onCheckedChange={onChange}
						size="lg"
					/>
					{isRemoteLocked && <i className="codicon codicon-lock text-description text-sm" />}
				</div>
			</div>
		)

		return (
			<div className="flex flex-col items-start justify-between gap-4 py-3 w-full">
				<div className="space-y-0.5 flex-1 w-full">
					{isRemoteLocked ? (
						<Tooltip>
							<TooltipTrigger asChild>{checkbox}</TooltipTrigger>
							<TooltipContent className="max-w-xs" side="top">
								{remoteTooltip}
							</TooltipContent>
						</Tooltip>
					) : (
						checkbox
					)}
				</div>
				<div className="text-xs text-description">{description}</div>
			</div>
		)
	},
)

interface FeatureSettingsSectionProps {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

/** 「工具」区的行：标题 + 说明 + 右侧/下方按钮（不依赖 Cline 的 proto 设置项） */
const ActionRow = memo(({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) => (
	<div className="flex flex-col gap-2">
		<div className="text-sm font-medium text-foreground">{title}</div>
		<div className="text-xs text-description">{description}</div>
		<div className="flex flex-wrap gap-2">{children}</div>
	</div>
))

const LANGUAGE_OWNER_OPTIONS = [
	{ value: "era", label: "era harness", hint: "内置高亮（默认）" },
	{ value: "sasami", label: "sasami.erabasic", hint: "需已安装该扩展" },
] as const

type LanguageOwner = (typeof LANGUAGE_OWNER_OPTIONS)[number]["value"]

/** EraBasic 语法归属：二选一的单选卡，选中项实心高亮 */
const EraBasicOwnerChoice = memo(() => {
	const [owner, setOwner] = useState<LanguageOwner | null>(null)
	const [pending, setPending] = useState<LanguageOwner | null>(null)
	const [error, setError] = useState<string | null>(null)

	const readOwner = useCallback(async (): Promise<LanguageOwner> => {
		const res = await UiServiceClient.getEraBasicLanguageOwner({})
		return res.value === "sasami" ? "sasami" : "era"
	}, [])

	useEffect(() => {
		let cancelled = false
		readOwner()
			.then((value) => {
				if (!cancelled) {
					setOwner(value)
				}
			})
			.catch((e) => console.error("getEraBasicLanguageOwner failed", e))
		return () => {
			cancelled = true
		}
	}, [readOwner])

	const switchTo = useCallback(
		async (next: LanguageOwner) => {
			if (next === owner || pending) {
				return
			}
			setPending(next)
			setError(null)
			try {
				await UiServiceClient.runCommand({
					value: next === "sasami" ? "eraHarness.erabasic.yieldToSasami" : "eraHarness.erabasic.reclaimFiles",
				})
				// sasami 未安装时命令会被拒绝，回读真实状态，不做乐观更新
				setOwner(await readOwner())
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e))
			} finally {
				setPending(null)
			}
		},
		[owner, pending, readOwner],
	)

	return (
		<div className="flex flex-col gap-2">
			<div className="text-sm font-medium text-foreground">EraBasic 语法归属</div>
			<div className="text-xs text-description">
				.erb / .erh 的语法高亮由谁提供，二选一。切换会写入用户级 files.associations，随时可换回。
			</div>
			<div aria-label="EraBasic 语法归属" className="grid grid-cols-2 gap-2 pt-1" role="radiogroup">
				{LANGUAGE_OWNER_OPTIONS.map((option) => {
					const active = owner === option.value
					const busy = pending === option.value
					return (
						<button
							aria-checked={active}
							className={cn(
								"flex cursor-pointer flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-default",
								active
									? "border-button-background bg-button-background text-primary-foreground"
									: "border-editor-widget-border/60 bg-transparent text-foreground hover:bg-accent/10",
								pending && !busy && "opacity-60",
							)}
							disabled={owner === null || pending !== null}
							key={option.value}
							onClick={() => void switchTo(option.value)}
							role="radio"
							type="button">
							<span className="flex items-center gap-1.5 text-sm font-medium">
								<i className={cn("codicon", active ? "codicon-check" : "codicon-circle-outline opacity-40")} />
								{option.label}
								{busy && <i className="codicon codicon-loading codicon-modifier-spin" />}
							</span>
							<span className={cn("text-xs", active ? "opacity-80" : "text-description")}>
								{option.hint}
								{active && " · 当前"}
							</span>
						</button>
					)
				})}
			</div>
			{owner === null && <div className="text-xs text-description">读取当前归属…</div>}
			{error && <div className="text-error text-xs">切换失败：{error}</div>}
		</div>
	)
})

const FeatureSettingsSection = ({ renderSectionHeader }: FeatureSettingsSectionProps) => {
	const { t } = useTranslation("settings")

	const featureTranslations: Record<string, { label: string; description: ReactNode }> = {
		subagents: { label: t("featureSettings.subagents"), description: t("featureSettings.subagentsDescription") },
		"native-tool-call": {
			label: t("featureSettings.nativeToolCall"),
			description: t("featureSettings.nativeToolCallDescription"),
		},
		"parallel-tool-calling": {
			label: t("featureSettings.parallelToolCalling"),
			description: t("featureSettings.parallelToolCallingDescription"),
		},
		"strict-plan-mode": {
			label: t("featureSettings.strictPlanMode"),
			description: t("featureSettings.strictPlanModeDescription"),
		},
		"auto-compact": { label: t("featureSettings.autoCompact"), description: t("featureSettings.autoCompactDescription") },
		"focus-chain": { label: t("featureSettings.focusChain"), description: t("featureSettings.focusChainDescription") },
		"show-feature-tips": {
			label: t("featureSettings.featureTips"),
			description: t("featureSettings.featureTipsDescription"),
		},
		"background-edit": {
			label: t("featureSettings.backgroundEdit"),
			description: t("featureSettings.backgroundEditDescription"),
		},
		checkpoints: { label: t("featureSettings.checkpoints"), description: t("featureSettings.checkpointsDescription") },
		"cline-web-tools": {
			label: t("featureSettings.clineWebTools"),
			description: t("featureSettings.clineWebToolsDescription"),
		},
		worktrees: { label: t("featureSettings.worktrees"), description: t("featureSettings.worktreesDescription") },
		yolo: { label: t("featureSettings.yoloMode"), description: t("featureSettings.yoloModeDescription") },
		"double-check-completion": {
			label: t("featureSettings.doubleCheckCompletion"),
			description: t("featureSettings.doubleCheckCompletionDescription"),
		},
		"lazy-teammate": {
			label: t("featureSettings.lazyTeammateMode"),
			description: t("featureSettings.lazyTeammateModeDescription"),
		},
		hooks: { label: t("featureSettings.hooks"), description: t("featureSettings.hooksDescription") },
	}

	const {
		enableCheckpointsSetting,
		hooksEnabled,
		mcpDisplayMode,
		strictPlanModeEnabled,
		yoloModeToggled,
		useAutoCondense,
		subagentsEnabled,
		clineWebToolsEnabled,
		worktreesEnabled,
		focusChainSettings,
		remoteConfigSettings,
		nativeToolCallSetting,
		enableParallelToolCalling,
		backgroundEditEnabled,
		doubleCheckCompletionEnabled,
		lazyTeammateModeEnabled,
		showFeatureTips,
	} = useExtensionState()

	const handleFocusChainIntervalChange = useCallback(
		(value: number) => {
			updateSetting("focusChainSettings", { ...focusChainSettings, remindClineInterval: value })
		},
		[focusChainSettings],
	)

	const isYoloRemoteLocked = remoteConfigSettings?.yoloModeToggled !== undefined

	// 设置页里的“执行扩展命令”按钮（runCommand 在宿主侧有白名单）
	const runEraCommand = useCallback(async (command: string) => {
		try {
			await UiServiceClient.runCommand({ value: command })
		} catch (error) {
			console.error(`runCommand(${command}) failed`, error)
		}
	}, [])

	// era harness 只暴露和 eraTW 开发直接相关的开关；worktree、Web 工具、
	// 功能提示这些属于上游遗留，先不显示，避免用户被无关选项淹没。
	// （子代理曾一并隐藏，但用户明确需要，已恢复。）
	// era harness（0 门槛）：隐藏「原生工具调用」开关——工具调用统一走 XML，用户无需也无需区分原生/非原生。
	const ERA_FEATURE_ALLOWLIST = new Set([
		"parallel-tool-calling",
		"strict-plan-mode",
		"auto-compact",
		"checkpoints",
		"hooks",
		"subagents",
	])
	const keepFeature = (feature: FeatureToggle) => ERA_FEATURE_ALLOWLIST.has(feature.id)
	const visibleAgentFeatures = useMemo(() => agentFeatures.filter(keepFeature), [])
	const visibleEditorFeatures = useMemo(() => editorFeatures.filter(keepFeature), [])
	const visibleExperimentalFeatures = useMemo(() => experimentalFeatures.filter(keepFeature), [])

	// State lookup for mapped features
	const featureState: Record<string, boolean | undefined> = {
		showFeatureTips,
		enableCheckpointsSetting,
		strictPlanModeEnabled,
		hooksEnabled,
		nativeToolCallSetting,
		focusChainEnabled: focusChainSettings?.enabled,
		useAutoCondense,
		subagentsEnabled,
		clineWebToolsEnabled: clineWebToolsEnabled?.user,
		worktreesEnabled: worktreesEnabled?.user,
		enableParallelToolCalling,
		backgroundEditEnabled,
		doubleCheckCompletionEnabled,
		lazyTeammateModeEnabled,
		yoloModeToggled: isYoloRemoteLocked ? remoteConfigSettings?.yoloModeToggled : yoloModeToggled,
	}

	// Visibility lookup for features with feature flags
	const featureVisibility: Record<string, boolean | undefined> = {
		clineWebToolsEnabled: clineWebToolsEnabled?.featureFlag,
		worktreesEnabled: worktreesEnabled?.featureFlag,
	}

	// Handler for feature toggle changes, supports nested settings like focusChainSettings
	const handleFeatureChange = useCallback(
		(feature: FeatureToggle, checked: boolean) => {
			if (feature.nestedKey) {
				// For nested settings, spread the existing value and set the nested key
				let currentValue = {}
				if (feature.settingKey === "focusChainSettings") {
					currentValue = focusChainSettings ?? {}
				}
				updateSetting(feature.settingKey, { ...currentValue, [feature.nestedKey]: checked })
			} else {
				updateSetting(feature.settingKey, checked)
			}
		},
		[focusChainSettings],
	)

	return (
		<div className="mb-2">
			{renderSectionHeader("features")}
			<Section>
				<div className="mb-5 flex flex-col gap-3">
					{/* Core features */}
					<div>
						<div className="text-xs font-medium text-foreground/80 uppercase tracking-wider mb-3">
							{t("featureSettings.agent")}
						</div>
						<div
							className="relative p-3 pt-0 my-3 rounded-md border border-editor-widget-border/50"
							id="agent-features">
							{visibleAgentFeatures.map((feature) => (
								<div key={feature.id}>
									<FeatureRow
										checked={featureState[feature.stateKey]}
										description={featureTranslations[feature.id]?.description || feature.description}
										isVisible={featureVisibility[feature.stateKey] ?? true}
										key={feature.id}
										label={featureTranslations[feature.id]?.label || feature.label}
										onChange={(checked) =>
											feature.nestedKey === "enabled"
												? handleFeatureChange(feature, checked)
												: updateSetting(feature.settingKey, checked)
										}
									/>
									{feature.id === "focus-chain" && featureState[feature.stateKey] && (
										<SettingsSlider
											label={t("settings.reminderInterval")}
											max={10}
											min={1}
											onChange={handleFocusChainIntervalChange}
											step={1}
											value={focusChainSettings?.remindClineInterval || 6}
											valueWidth="w-6"
										/>
									)}
								</div>
							))}
						</div>
					</div>

					{/* Editor features */}
					<div>
						<div className="text-xs font-medium text-foreground/80 uppercase tracking-wider mb-3">
							{t("featureSettings.editor")}
						</div>
						<div
							className="relative p-3 pt-0 my-3 rounded-md border border-editor-widget-border/50"
							id="optional-features">
							{visibleEditorFeatures.map((feature) => (
								<FeatureRow
									checked={featureState[feature.stateKey]}
									description={featureTranslations[feature.id]?.description || feature.description}
									isVisible={featureVisibility[feature.stateKey] ?? true}
									key={feature.id}
									label={featureTranslations[feature.id]?.label || feature.label}
									onChange={(checked) => handleFeatureChange(feature, checked)}
								/>
							))}
						</div>
					</div>

					{/* Experimental features */}
					<div>
						<div className="text-xs font-medium uppercase tracking-wider mb-3 text-warning/80">
							{t("featureSettings.experimental")}
						</div>
						<div
							className="relative p-3 pt-0 my-3 rounded-md border border-editor-widget-border/50 w-full"
							id="experimental-features">
							{visibleExperimentalFeatures.map((feature) => (
								<FeatureRow
									checked={featureState[feature.stateKey]}
									description={featureTranslations[feature.id]?.description || feature.description}
									disabled={feature.id === "yolo" && isYoloRemoteLocked}
									isRemoteLocked={feature.id === "yolo" && isYoloRemoteLocked}
									isVisible={featureVisibility[feature.stateKey] ?? true}
									key={feature.id}
									label={featureTranslations[feature.id]?.label || feature.label}
									onChange={(checked) => handleFeatureChange(feature, checked)}
									remoteTooltip={t("remoteConfig.settingsManagedByOrg")}
								/>
							))}
						</div>
					</div>
				</div>

				{/* Advanced */}
				<div>
					<div className="text-xs font-medium text-foreground/80 uppercase tracking-wider mb-3">
						{t("featureSettings.advanced")}
					</div>
					<div className="relative p-3 my-3 rounded-md border border-editor-widget-border/50" id="advanced-features">
						<div className="space-y-3">
							{advancedFeatures.map((feature) => (
								<FeatureRow
									checked={featureState[feature.stateKey]}
									description={featureTranslations[feature.id]?.description || feature.description}
									isVisible={featureVisibility[feature.stateKey] ?? true}
									key={feature.id}
									label={featureTranslations[feature.id]?.label || feature.label}
									onChange={(checked) => handleFeatureChange(feature, checked)}
								/>
							))}

							{/* MCP Display Mode */}
							<div className="space-y-2">
								<Label className="text-sm font-medium text-foreground">
									{t("featureSettings.mcpDisplayMode")}
								</Label>
								<p className="text-xs text-muted-foreground">{t("featureSettings.mcpDisplayModeDescription")}</p>
								<Select onValueChange={(v) => updateSetting("mcpDisplayMode", v)} value={mcpDisplayMode}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="plain">{t("featureSettings.plainText")}</SelectItem>
										<SelectItem value="rich">{t("featureSettings.richDisplay")}</SelectItem>
										<SelectItem value="markdown">{t("featureSettings.markdown")}</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				</div>

				{/* eraTW 工具：需要真实 VS Code 命令的操作放这里（不走 proto 设置项） */}
				<div>
					<div className="text-xs font-medium text-foreground/80 uppercase tracking-wider mb-3">eraTW 工具</div>
					<div className="relative p-3 my-3 rounded-md border border-editor-widget-border/50 space-y-4">
						<ActionRow
							description="检查上游 → 扫本地改动 → 生成计划 → 弹窗确认后才写入；被覆盖或删除的原文件进 _备份/update_backup_*，可一键撤销。"
							title="更新 eraTW（跟社区最新版）">
							<Button onClick={() => void runEraCommand("era-harness.updateGame")} variant="default">
								<i className="codicon codicon-cloud-download text-sm" />
								检查并更新
							</Button>
						</ActionRow>
						<EraBasicOwnerChoice />
					</div>
				</div>
			</Section>
		</div>
	)
}
export default memo(FeatureSettingsSection)

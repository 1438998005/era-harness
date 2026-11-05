import {
	type ApiConfiguration,
	type ApiProvider,
	bigmodelModels,
	deepSeekModels,
	type ModelInfo,
	mimoModels,
	moonshotModels,
} from "@shared/api"
import { AUXILIARY_CONFIG_KEYS, AUXILIARY_SUPPORTED_PROVIDERS } from "@shared/aux-model"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ApiKeyField } from "./common/ApiKeyField"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

/**
 * 「提示词增强 / 子代理」独立模型配置（2026-11-04，用户裁定各一套完整独立配置、可跨厂商）。
 *
 * - 未选 provider = 跟随主模型（默认态，零行为变化）；
 * - 判据单源在 @shared/aux-model（回落/密钥槽/归属纠偏/yaml 优先级），这里只做表单接线；
 * - 模型下拉用内置清单（不做在线同步：更多模型可在主配置区同步后原样填 id，读侧按未知 id 保留）；
 * - Kimi 双入口由辅助配置独立选择（与主配置互不影响）。
 */

const PROVIDER_LABELS: Record<string, string> = {
	deepseek: "DeepSeek",
	mimo: "Xiaomi MiMo",
	bigmodel: "智谱 BigModel",
	"bigmodel-plan": "智谱 GLM 套餐（Coding Plan）",
	moonshot: "Kimi (Moonshot)",
	free: "免费模型",
}

const PROVIDER_MODELS: Partial<Record<ApiProvider, Record<string, ModelInfo>>> = {
	deepseek: deepSeekModels as Record<string, ModelInfo>,
	mimo: mimoModels as Record<string, ModelInfo>,
	bigmodel: bigmodelModels as Record<string, ModelInfo>,
	moonshot: moonshotModels as Record<string, ModelInfo>,
}

interface AuxCardProps {
	prefix: "enhance" | "subagent"
	title: string
	description: string
}

const AuxModelCard = ({ prefix, title, description }: AuxCardProps) => {
	const { apiConfiguration } = useExtensionState()
	const { handleFieldsChange } = useApiConfigurationHandlers()

	const provider = apiConfiguration?.[`${prefix}ApiProvider` as keyof typeof apiConfiguration] as string | undefined as
		| ApiProvider
		| undefined
	const apiKey = (apiConfiguration?.[`${prefix}ApiKey` as keyof typeof apiConfiguration] as string | undefined) ?? ""
	const modelId = (apiConfiguration?.[`${prefix}ApiModelId` as keyof typeof apiConfiguration] as string | undefined) ?? ""
	const reasoningEffort =
		(apiConfiguration?.[`${prefix}ReasoningEffort` as keyof typeof apiConfiguration] as string | undefined) ?? ""
	const moonshotApiLine =
		(apiConfiguration?.[`${prefix}MoonshotApiLine` as keyof typeof apiConfiguration] as string | undefined) ?? "china"

	const models = provider ? PROVIDER_MODELS[provider] : undefined

	/**
	 * #230/#235：字段名由 prefix 拼出，TS 无法把计算键收窄成具体 key，但泛型约束
	 * `K extends keyof ApiConfiguration` 仍会在字段名拼错时编译报错——比原先那种把整个
	 * updates 对象断言成 never、彻底绕过类型检查的写法安全。清空整组时字段名直接取自
	 * @shared/aux-model 的单源清单，与 host 侧 `auxiliaryFieldsToClear` 用同一份，不会漏字段。
	 */
	const setAuxField = <K extends keyof ApiConfiguration>(key: K, value: ApiConfiguration[K] | undefined) =>
		void handleFieldsChange({ [key]: value } as Partial<ApiConfiguration>)
	const clearAuxConfig = (prefix: "enhance" | "subagent"): Partial<ApiConfiguration> =>
		Object.fromEntries(AUXILIARY_CONFIG_KEYS[prefix].map((key) => [key, undefined])) as Partial<ApiConfiguration>

	return (
		<div className="rounded-md border p-3 flex flex-col gap-2" style={{ borderColor: "var(--vscode-panel-border)" }}>
			<div>
				<div className="text-sm font-medium">{title}</div>
				<div className="text-xs mt-0.5 text-(--vscode-descriptionForeground) leading-relaxed">{description}</div>
			</div>

			{/* provider 下拉：空值 = 跟随主模型 */}
			<label className="flex flex-col gap-1">
				<span className="text-xs font-medium">模型服务</span>
				<select
					className="w-full text-xs rounded px-2 py-1.5 cursor-pointer"
					onChange={(e) => {
						const next = e.target.value as ApiProvider | ""
						// 清空 provider = 回到「跟随主模型」，其余字段一并清掉（避免半配置：有 key 没 provider）。
						// host 侧会把这份完整配置里为空的辅助字段走 clearApiConfigurationFields 真删，
						// 不会因 setApiConfiguration 跳过 undefined 而留下旧密钥。
						next ? setAuxField(`${prefix}ApiProvider`, next) : void handleFieldsChange(clearAuxConfig(prefix))
					}}
					style={{
						background: "var(--vscode-dropdown-background)",
						color: "var(--vscode-dropdown-foreground)",
						border: "1px solid var(--vscode-dropdown-border)",
					}}
					value={provider ?? ""}>
					<option value="">跟随主模型（不单独配置）</option>
					{AUXILIARY_SUPPORTED_PROVIDERS.map((p) => (
						<option key={p} value={p}>
							{PROVIDER_LABELS[p] ?? p}
						</option>
					))}
				</select>
			</label>

			{provider && provider !== "free" && (
				<ApiKeyField
					initialValue={apiKey}
					onChange={(value) => setAuxField(`${prefix}ApiKey`, value)}
					providerName={PROVIDER_LABELS[provider] ?? provider}
					signupUrl=""
				/>
			)}

			{provider === "moonshot" && (
				<label className="flex flex-col gap-1">
					<span className="text-xs font-medium">Kimi 入口（密钥不互通）</span>
					<select
						className="w-full text-xs rounded px-2 py-1.5 cursor-pointer"
						onChange={(e) => setAuxField(`${prefix}MoonshotApiLine`, e.target.value)}
						style={{
							background: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
						}}
						value={moonshotApiLine}>
						<option value="china">国内站（api.moonshot.cn）</option>
						<option value="international">国际站（api.moonshot.ai）</option>
					</select>
				</label>
			)}

			{provider && models && (
				<label className="flex flex-col gap-1">
					<span className="text-xs font-medium">模型（留空用该家默认档）</span>
					<select
						className="w-full text-xs rounded px-2 py-1.5 cursor-pointer"
						onChange={(e) => setAuxField(`${prefix}ApiModelId`, e.target.value || undefined)}
						style={{
							background: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
						}}
						value={modelId}>
						<option value="">默认档</option>
						{modelId && !models[modelId] && <option value={modelId}>{modelId}</option>}
						{Object.keys(models).map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
				</label>
			)}

			{provider && provider !== "free" && (
				<label className="flex flex-col gap-1">
					<span className="text-xs font-medium">思考强度（可选）</span>
					<select
						className="w-full text-xs rounded px-2 py-1.5 cursor-pointer"
						onChange={(e) => setAuxField(`${prefix}ReasoningEffort`, e.target.value || undefined)}
						style={{
							background: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
						}}
						value={reasoningEffort}>
						<option value="">跟随该服务默认</option>
						<option value="low">低（low）</option>
						<option value="high">高（high）</option>
						<option value="xhigh">最大（xhigh/max）</option>
					</select>
				</label>
			)}
		</div>
	)
}

const AuxiliaryModelSettings = () => (
	<div className="flex flex-col gap-3 mt-5">
		<div>
			<div className="text-sm font-semibold">辅助模型（高级）</div>
			<div className="text-xs mt-0.5 text-(--vscode-descriptionForeground) leading-relaxed">
				为「提示词增强」与「子代理」单独指定模型服务与密钥，可与主模型不同厂商（例如主模型用 MiMo、辅助用便宜的
				DeepSeek）。默认跟随主模型；只选服务不填密钥不会生效。
			</div>
		</div>
		<AuxModelCard
			description="输入框旁「增强提示词」按钮使用的模型。改写失败时保留原文。"
			prefix="enhance"
			title="提示词增强"
		/>
		<AuxModelCard
			description="use_subagents 派生的探索子代理使用的模型（agent YAML 里的 modelId 覆盖仍优先）。免费池下子代理不可用的门控不变。"
			prefix="subagent"
			title="子代理"
		/>
	</div>
)

export default AuxiliaryModelSettings

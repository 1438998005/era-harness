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
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

/**
 * 「提示词增强 / 子代理」独立模型配置（2026-11-04 建立；2026-11-05 KB 08 #237 修订）。
 *
 * - 未选 provider = 跟随主模型（默认态，零行为变化）；
 * - 判据单源在 @shared/aux-model（回落/配置槽/归属纠偏/yaml 优先级），这里只做表单接线；
 * - 模型下拉用内置清单（不做在线同步：更多模型可在主配置区同步后原样填 id，读侧按未知 id 保留）；
 * - ⚠️ #237 用户裁定：两套都**只选 provider + 模型**。密钥、思维强度、Kimi 入口一律跟随
 *   所选服务的主 API 配置（「各存各的」「一起改」），因此这里不再渲染密钥框 / 思考强度下拉 /
 *   Kimi 入口下拉——**只选服务即生效**。旧字段保留在存储与清空清单里但四处都不读。
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
	const modelId = (apiConfiguration?.[`${prefix}ApiModelId` as keyof typeof apiConfiguration] as string | undefined) ?? ""

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

			{/* KB 08 #237：密钥 / 思维强度 / Kimi 入口不再单独配置，一律跟随所选服务的主配置 */}
			{provider && provider !== "free" && (
				<p className="text-xs m-0 leading-relaxed" style={{ color: "var(--vscode-descriptionForeground)" }}>
					密钥与思维强度跟随该服务的主配置（在上方对应服务页设置），此处无需重复填写；只选服务即可生效。
				</p>
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
		</div>
	)
}

const AuxiliaryModelSettings = () => (
	<div className="flex flex-col gap-3 mt-5">
		<div>
			<div className="text-sm font-semibold">辅助模型（高级）</div>
			<div className="text-xs mt-0.5 text-(--vscode-descriptionForeground) leading-relaxed">
				为「提示词增强」与「子代理」单独指定模型服务与模型，可与主模型不同厂商（例如主模型用 MiMo、辅助用便宜的
				DeepSeek）。默认跟随主模型；密钥与思维强度跟随该服务的主配置，只选服务即可生效。
			</div>
		</div>
		<AuxModelCard
			description="输入框旁「增强提示词」按钮使用的模型。改写失败时保留原文。密钥与思维强度跟随该服务的主配置。"
			prefix="enhance"
			title="提示词增强"
		/>
		<AuxModelCard
			description="use_subagents 派生的探索子代理使用的模型（agent YAML 里的 modelId 覆盖仍优先）。免费池下子代理不可用的门控不变。密钥与思维强度跟随该服务的主配置。"
			prefix="subagent"
			title="子代理"
		/>
	</div>
)

export default AuxiliaryModelSettings

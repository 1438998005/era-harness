import {
	isGLMModelFamily,
	isLocalModel,
	isNextGenModelFamily,
	isNextGenModelProvider,
	isTrinityModelFamily,
} from "@utils/model-utils"
import { ModelFamily } from "@/shared/prompts"
import { Logger } from "@/shared/services/Logger"
import { ClineDefaultTool } from "@/shared/tools"
import { TOOL_USE_TEMPLATE_TEXT } from "../../components/tool_use"
import { SystemPromptSection } from "../../templates/placeholders"
import { TEMPLATE_OVERRIDES as NATIVE_TEMPLATE_OVERRIDES } from "../native-next-gen/template"
import { createVariant } from "../variant-builder"
import { validateVariant } from "../variant-validator"
import { baseTemplate } from "./template"

export const config = createVariant(ModelFamily.GENERIC)
	.description("The fallback prompt for generic use cases and models.")
	.version(1)
	.tags("fallback", "stable")
	.labels({
		stable: 1,
		fallback: 1,
		// #254：仅当 Task 判定「free 指定模型已实测支持原生 function calling」时，
		// context.enableNativeToolCalls 才为 true；其余场景仍走 XML 文本工具。
		use_native_tools: 1,
	})
	// Generic matcher - fallback for everything that doesn't match other variants
	// This will match anything that doesn't match the other specific variants
	.matcher((context) => {
		const providerInfo = context.providerInfo
		if (!providerInfo.providerId || !providerInfo.model.id) {
			return true
		}
		const modelId = providerInfo.model.id.toLowerCase()
		return (
			// Not a local model with compact prompt enabled
			!(providerInfo.customPrompt === "compact" && isLocalModel(providerInfo)) &&
			// Not a next-gen model
			!(isNextGenModelProvider(providerInfo) && isNextGenModelFamily(modelId)) &&
			// Not a GLM model
			!isGLMModelFamily(modelId) &&
			// Not a Trinity model
			!isTrinityModelFamily(modelId)
		)
	})
	.template(baseTemplate)
	.components(
		SystemPromptSection.AGENT_ROLE,
		SystemPromptSection.TOOL_USE,
		SystemPromptSection.TASK_PROGRESS,
		SystemPromptSection.MCP,
		SystemPromptSection.EDITING_FILES,
		SystemPromptSection.ACT_VS_PLAN,
		SystemPromptSection.CAPABILITIES,
		SystemPromptSection.RULES,
		SystemPromptSection.SYSTEM_INFO,
		SystemPromptSection.OBJECTIVE,
		SystemPromptSection.USER_INSTRUCTIONS,
		SystemPromptSection.SKILLS,
	)
	.tools(
		ClineDefaultTool.BASH,
		ClineDefaultTool.FILE_READ,
		ClineDefaultTool.FILE_NEW,
		ClineDefaultTool.FILE_EDIT,
		ClineDefaultTool.SEARCH,
		ClineDefaultTool.LIST_FILES,
		ClineDefaultTool.LIST_CODE_DEF,
		ClineDefaultTool.WEB_SEARCH,
		ClineDefaultTool.WEB_FETCH,
		ClineDefaultTool.MCP_USE,
		ClineDefaultTool.MCP_ACCESS,
		ClineDefaultTool.ASK,
		ClineDefaultTool.ATTEMPT,
		ClineDefaultTool.PLAN_MODE,
		ClineDefaultTool.MCP_DOCS,
		ClineDefaultTool.TODO,
		ClineDefaultTool.GENERATE_EXPLANATION,
		ClineDefaultTool.USE_SKILL,
		ClineDefaultTool.USE_SUBAGENTS,
		ClineDefaultTool.LOG_DIAGNOSE,
		ClineDefaultTool.ERA_SYMBOLS,
		ClineDefaultTool.ERA_REFERENCE,
		ClineDefaultTool.ERA_KNOWLEDGE,
		ClineDefaultTool.GLOBAL_MEMORY,
		ClineDefaultTool.SETTING_HELP,
		ClineDefaultTool.RUN_GAME,
		ClineDefaultTool.ERA_VERIFY,
	)
	.placeholders({
		MODEL_FAMILY: "generic",
	})
	.config({})
	// #254：同一个 generic variant 兼容两条工具通道——
	// 原生通道（仅 free 已实测模型）：工具由 API 声明，TOOL_USE 换成 native 版，不再教 XML；
	// 其余场景保持默认 XML 版。切换依据 context.enableNativeToolCalls。
	.overrideComponent(SystemPromptSection.TOOL_USE, {
		template: (context) =>
			context.enableNativeToolCalls ? NATIVE_TEMPLATE_OVERRIDES.TOOL_USE(context) : TOOL_USE_TEMPLATE_TEXT(context),
	})
	.build()

// Compile-time validation
const validationResult = validateVariant({ ...config, id: "generic" }, { strict: true })
if (!validationResult.isValid) {
	Logger.error("Generic variant configuration validation failed:", validationResult.errors)
	throw new Error(`Invalid generic variant configuration: ${validationResult.errors.join(", ")}`)
}

if (validationResult.warnings.length > 0) {
	Logger.warn("Generic variant configuration warnings:", validationResult.warnings)
}

// Export type information for better IDE support
export type GenericVariantConfig = typeof config

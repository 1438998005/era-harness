import { ApiConfiguration } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { getModeSpecificFields } from "@/components/settings/utils/providerUtils"

export function validateApiConfiguration(currentMode: Mode, apiConfiguration?: ApiConfiguration): string | undefined {
	if (apiConfiguration) {
		const { apiProvider, openAiModelId } = getModeSpecificFields(apiConfiguration, currentMode)

		switch (apiProvider) {
			case "deepseek":
				if (!apiConfiguration.deepSeekApiKey) {
					return "请填写有效的 API 密钥，或改用其他提供方。"
				}
				break
			case "openai":
				if (!apiConfiguration.openAiBaseUrl || !apiConfiguration.openAiApiKey || !openAiModelId) {
					return "请填写有效的 Base URL、API 密钥与模型 ID。"
				}
				break
		}
	}
	return undefined
}

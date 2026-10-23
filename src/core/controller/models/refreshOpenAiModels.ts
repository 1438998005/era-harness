import { StringArray } from "@shared/proto/cline/common"
import { OpenAiModelsRequest } from "@shared/proto/cline/models"
import { formatModelListError } from "@shared/utils/model-list-error"
import type { AxiosRequestConfig } from "axios"
import axios from "axios"
import { getAxiosSettings } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"
import { Controller } from ".."

/**
 * Fetches available models from the OpenAI API
 * @param controller The controller instance
 * @param request Request containing the base URL and API key
 * @returns Array of model names
 */
export async function refreshOpenAiModels(_controller: Controller, request: OpenAiModelsRequest): Promise<StringArray> {
	try {
		if (!request.baseUrl) {
			return StringArray.create({ values: [] })
		}

		if (!URL.canParse(request.baseUrl)) {
			return StringArray.create({ values: [] })
		}

		const config: AxiosRequestConfig = {}
		if (request.apiKey) {
			config["headers"] = { Authorization: `Bearer ${request.apiKey}` }
		}

		const response = await axios.get(`${request.baseUrl}/models`, {
			...config,
			...getAxiosSettings(),
		})
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		const models = [...new Set<string>(modelsArray)]

		return StringArray.create({ values: models })
	} catch (error) {
		Logger.error("Error fetching OpenAI models:", error)
		// 以前这里 `return values: []`，把 401 说成「没有模型」——设置页据此显示了
		// 一句假话。抛出去，让调用方拿到真实原因（各 provider 卡片本来就都有 try/catch）。
		throw new Error(formatModelListError(error))
	}
}

import { BooleanRequest } from "@shared/proto/cline/common"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { memo, useEffect, useState } from "react"
import ApiOptions from "@/components/settings/ApiOptions"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StateServiceClient } from "@/services/grpc-client"
import { validateApiConfiguration } from "@/utils/validate"

/**
 * era harness 本地版欢迎页：无登录、无账号、无远端引导。
 * 配置一个模型服务（DeepSeek 或自定义 OpenAI 兼容端点）即可开始。
 */
const WelcomeView = memo(() => {
	const { apiConfiguration, mode } = useExtensionState()
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)

	const disableLetsGoButton = apiErrorMessage != null

	const handleSubmit = async () => {
		try {
			await StateServiceClient.setWelcomeViewCompleted(BooleanRequest.create({ value: true }))
		} catch (error) {
			console.error("Failed to complete welcome view:", error)
		}
	}

	useEffect(() => {
		setApiErrorMessage(validateApiConfiguration(mode, apiConfiguration))
	}, [apiConfiguration, mode])

	return (
		<div className="fixed inset-0 p-0 flex flex-col">
			<div className="h-full px-5 overflow-auto flex flex-col gap-2.5">
				<h2 className="text-lg font-semibold">era harness</h2>
				<p className="text-(--vscode-descriptionForeground)">
					eraTW 画蛇添足版开发助手：配置一个模型服务即可开始，无需登录。所有对话与文件操作都在本机完成。
				</p>

				<div className="mt-2">
					<ApiOptions currentMode={mode} showModelOptions={false} />
				</div>

				{apiErrorMessage && <p className="text-(--vscode-errorForeground)">{apiErrorMessage}</p>}

				<VSCodeButton appearance="primary" className="mt-1 w-full" disabled={disableLetsGoButton} onClick={handleSubmit}>
					开始使用
				</VSCodeButton>

				<p className="text-(--vscode-descriptionForeground) mt-2">
					推荐：DeepSeek（填写 API Key 即可）；或选择「OpenAI 兼容」接入本地/自建服务（如 Ollama、LM Studio、vLLM）。
				</p>
			</div>
		</div>
	)
})

export default WelcomeView

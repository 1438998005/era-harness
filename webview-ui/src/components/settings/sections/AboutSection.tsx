import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StateServiceClient, UiServiceClient } from "@/services/grpc-client"
import Section from "../Section"

interface AboutSectionProps {
	version: string
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

const AboutSection = ({ version, renderSectionHeader }: AboutSectionProps) => {
	const { t } = useTranslation("settings")
	const { setShowWelcome } = useExtensionState()

	const replayOnboarding = async () => {
		try {
			await StateServiceClient.setWelcomeViewCompleted({ value: false })
			setShowWelcome(true)
		} catch (error) {
			console.error("Failed to reset onboarding state:", error)
		}
	}

	const checkForUpdates = async () => {
		try {
			await UiServiceClient.runCommand({ value: "era-harness.checkForUpdates" })
		} catch (error) {
			console.error("Failed to check for updates:", error)
		}
	}

	return (
		<div>
			{renderSectionHeader("about")}
			<Section>
				<div className="flex px-4 flex-col gap-2">
					<h2 className="text-lg font-semibold">era harness v{version}</h2>
					<p className="m-0">
						eraTW 画蛇添足版（R18）开发助手。不发布到插件市场，仅通过本仓库 Release 分发；也可以直接 sideload 本地
						vsix。
					</p>

					<div className="flex items-center gap-2">
						<VSCodeButton appearance="secondary" onClick={checkForUpdates}>
							检查更新
						</VSCodeButton>
						<VSCodeLink href="https://github.com/1438998005/era-harness/releases/latest">Release 页面</VSCodeLink>
					</div>
					<p className="m-0 text-xs text-description">
						只有你点「检查更新」才会联网检查；发现有新版本后，还要再点「下一步：下载并安装」才会下载安装，装完需重载窗口生效。启动时不会自动检查。
					</p>

					<h3 className="text-md font-semibold mt-2">本地版说明</h3>
					<p className="m-0">
						无账号、无登录、无遥测、无插件市场。模型提供方只保留 DeepSeek 与 OpenAI 兼容端点，密钥只存在本机。
					</p>

					<h3 className="text-md font-semibold mt-2">上游血缘</h3>
					<p className="m-0">
						<VSCodeLink href="https://github.com/cline/cline">Cline</VSCodeLink>
						{" → "}
						<VSCodeLink href="https://github.com/SSYCloud/cline-chinese">Cline Chinese</VSCodeLink>
						{"（Apache-2.0）。本仓库为其减法改造版，与上游团队无隶属关系。"}
					</p>

					<div className="mt-3">
						<VSCodeButton appearance="secondary" onClick={replayOnboarding}>
							重新查看引导页
						</VSCodeButton>
					</div>
				</div>
			</Section>
		</div>
	)
}

export default AboutSection

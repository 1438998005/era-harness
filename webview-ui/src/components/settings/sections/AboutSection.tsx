import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
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
	/** 只是让按钮在 gRPC 往返期间别看起来"死着"；真正的进度在右下角通知区 */
	const [checking, setChecking] = useState(false)

	const replayOnboarding = async () => {
		try {
			await StateServiceClient.setWelcomeViewCompleted({ value: false })
			setShowWelcome(true)
		} catch (error) {
			console.error("Failed to reset onboarding state:", error)
		}
	}

	const checkForUpdates = async () => {
		setChecking(true)
		try {
			// 第二步（下载安装）在扩展侧已经脱离这条链，所以这里很快就返回
			await UiServiceClient.runCommand({ value: "era-harness.checkForUpdates" })
		} catch (error) {
			console.error("Failed to check for updates:", error)
		} finally {
			setChecking(false)
		}
	}

	const openDiagnosticsFolder = async () => {
		try {
			await UiServiceClient.runCommand({ value: "era-harness.openDiagnosticsFolder" })
		} catch (error) {
			console.error("Failed to open diagnostics folder:", error)
		}
	}

	const exportDiagnostics = async () => {
		try {
			await UiServiceClient.runCommand({ value: "era-harness.exportDiagnostics" })
		} catch (error) {
			console.error("Failed to export diagnostics:", error)
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
						<VSCodeButton appearance="secondary" disabled={checking} onClick={checkForUpdates}>
							{checking ? "已发起…" : "检查更新"}
						</VSCodeButton>
						<VSCodeLink href="https://github.com/1438998005/era-harness/releases/latest">Release 页面</VSCodeLink>
					</div>
					<p className="m-0 text-xs text-description">
						只有你点「检查更新」才会联网检查；发现有新版本后，要你自己选「直接下载」或「用镜像下载」才会下载安装，装完需重载窗口生效。启动时不会自动检查。
					</p>
					<p className="m-0 text-xs text-description">
						下载进度显示在右下角通知区（百分比 / 已下多少 / 速度 /
						约剩多久），随时可点「取消」。直连慢就在通知里改用镜像，或点「复制下载链接」用浏览器/下载器拉下来手动装。镜像地址在设置里改
						<code className="mx-1">eraHarness.update.mirrorPrefix</code>，留空则不出现镜像选项。
					</p>

					<h3 className="text-md font-semibold mt-2">操作日志 / 排障</h3>
					<div className="flex items-center gap-2">
						<VSCodeButton appearance="secondary" onClick={exportDiagnostics}>
							导出诊断包
						</VSCodeButton>
						<VSCodeButton appearance="secondary" onClick={openDiagnosticsFolder}>
							打开诊断目录
						</VSCodeButton>
					</div>
					<p className="m-0 text-xs text-description">
						每次工具调用（读了哪个文件、第几次、耗时、成功与否）都会记到诊断目录，只记元数据，不记对话正文与密钥；保留
						14 天。 遇到奇怪行为时，先点「导出诊断包」，把生成的 txt 发给开发者即可定位。
					</p>

					<h3 className="text-md font-semibold mt-2">本地版说明</h3>
					<p className="m-0">
						无账号、无登录、无遥测、无插件市场。模型提供方保留 DeepSeek、Xiaomi MiMo 与 OpenAI
						兼容端点，密钥只存在本机。
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

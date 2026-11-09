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

/** 贡献者名单：新增/调整在此加一行即可；contact 为可选的联系方式行，links 为可选的主页链接 */
const CONTRIBUTORS: {
	name: string
	role: string
	contact?: string
	links?: { label: string; href: string }[]
}[] = [
	{
		name: "Mishu",
		role: "项目开发",
		contact: "QQ：1438998005 ｜ 邮箱：1438998005@qq.com / a1438998005@gmail.com",
		links: [
			{ label: "GitHub", href: "https://github.com/1438998005" },
			{ label: "jihulab", href: "https://jihulab.com/1438998005" },
		],
	},
	{
		name: "qirchen421",
		role: "项目开发 / 知识库提供",
		links: [
			{ label: "GitHub", href: "https://github.com/qirchen421" },
			{ label: "GitGud", href: "https://gitgud.io/qrchen" },
		],
	},
	{ name: "March3", role: "赞助" },
]

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
						eraTW 画蛇添足版开发助手。不发布到插件市场，主发布渠道为 GitHub Releases，jihulab 为备用镜像与备用 Release
						渠道；也可以直接 sideload 本地 vsix。
					</p>

					<div className="flex items-center gap-2">
						<VSCodeButton appearance="secondary" disabled={checking} onClick={checkForUpdates}>
							{checking ? "已发起…" : "检查更新"}
						</VSCodeButton>
						<VSCodeLink href="https://github.com/1438998005/era-harness/releases/latest">Release 页面</VSCodeLink>
					</div>
					<p className="m-0 text-xs text-description">
						只有你点「检查更新」才会联网检查；发现有新版本后，要你自己选「从 GitHub 下载」或「从 jihulab
						下载」才会下载安装，装完需重载窗口生效。启动时不会自动检查。
					</p>
					<p className="m-0 text-xs text-description">
						两个按钮走两条互不相干的链路：哪边通就用哪边，一边失败不会自动换另一边（换源等于替你决定信谁）。下载进度显示在右下角通知区（百分比
						/ 已下多少 / 速度 /
						约剩多久），随时可点「取消」。两边都不通时，点「复制下载链接」用浏览器或下载器手动拉下来装。每个包都会校验
						sha256，对不上直接丢弃。
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
						诊断目录里记两类东西，都只记元数据，不记对话正文与密钥；保留 14 天。
					</p>
					<ul className="m-0 text-xs text-description pl-4">
						<li>工具调用：读了哪个文件、第几次、耗时、成功与否。</li>
						<li>
							运行时错误：界面上按钮点了没反应或报错的失败、未捕获的异常与 Promise
							拒绝、侧栏渲染崩溃——连错误堆栈一起记下。
						</li>
					</ul>
					<p className="m-0 text-xs text-description">
						导出的 txt 头部会写清「这个包里有多少条运行时错误」，为 0 也明写 0，所以导一次就能看出捕获有没有在工作。
						遇到奇怪行为时，先点「导出诊断包」，把生成的 txt 发给开发者即可定位。
					</p>

					<h3 className="text-md font-semibold mt-2">本地版说明</h3>
					<p className="m-0">
						无账号、无登录、无遥测、无插件市场。模型提供方保留 DeepSeek、Xiaomi MiMo 与 OpenAI
						兼容端点，密钥只存在本机。
					</p>

					<h3 className="text-md font-semibold mt-2">作者 / 贡献者 / 鸣谢</h3>
					<ul className="m-0 pl-4">
						{CONTRIBUTORS.map((c) => (
							<li key={c.name}>
								<span className="font-medium">{c.name}</span>
								{"（"}
								{c.role}
								{"）"}
								{c.contact && <div className="text-xs text-description">{c.contact}</div>}
								{c.links && (
									<div className="text-xs text-description flex items-center gap-2">
										{c.links.map((link) => (
											<VSCodeLink href={link.href} key={link.href}>
												{link.label}
											</VSCodeLink>
										))}
									</div>
								)}
							</li>
						))}
					</ul>
					<p className="m-0 text-xs text-description">以及所有提交 issue、参与测试与反馈的社区贡献者。</p>
					<p className="m-0">
						交流群：QQ 1129762718（
						<VSCodeLink href="https://qm.qq.com/q/YjcKauGzK4">点击加入</VSCodeLink>）
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

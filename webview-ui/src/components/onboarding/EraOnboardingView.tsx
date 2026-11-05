import { BooleanRequest } from "@shared/proto/cline/common"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ArrowLeftIcon, FileCode2Icon, ShieldCheckIcon, SparklesIcon } from "lucide-react"
import { memo, type ReactNode, useEffect, useRef, useState } from "react"
import EraLogo from "@/assets/EraLogo"
import BuiltinChatNoticeModal from "@/components/onboarding/BuiltinChatNoticeModal"
import ApiOptions from "@/components/settings/ApiOptions"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StateServiceClient } from "@/services/grpc-client"
import { validateApiConfiguration } from "@/utils/validate"

/**
 * era harness 首启引导。
 *
 * 只做两件事：说清这是什么 → 配一个模型服务。
 * 无登录、无账号、无多步问卷；已有的配置可直接跳过。
 */
const EraOnboardingView = memo(() => {
	const { apiConfiguration, mode } = useExtensionState()
	const [step, setStep] = useState<"intro" | "config">("intro")
	// 首启必须确认的「右侧聊天不是本插件」模态（2026-11-04 用户裁定：太不显眼 → 强制确认）。
	// 仅首启由 App.tsx 的 showWelcome（welcomeViewCompleted）门控，这里只管本次会话内是否已确认。
	const [showBuiltinChatNotice, setShowBuiltinChatNotice] = useState(true)
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [hasAttempted, setHasAttempted] = useState(false)
	const backgroundRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		setApiErrorMessage(validateApiConfiguration(mode, apiConfiguration))
	}, [apiConfiguration, mode])

	// 模态显示期间把背景内容置 inert：遮罩只挡鼠标，键盘仍可 Tab 到「开始配置」/
	// 「直接进入」按钮并绕过确认（2026-11-04 审查）。inert 同时切断鼠标与键盘，
	// 卸载/确认后恢复，避免影响后续配置步骤。
	useEffect(() => {
		const el = backgroundRef.current as (HTMLDivElement & { inert?: boolean }) | null
		if (!el) {
			return
		}
		el.inert = showBuiltinChatNotice
		return () => {
			el.inert = false
		}
	}, [showBuiltinChatNotice])

	const finish = async () => {
		if (apiErrorMessage) {
			setHasAttempted(true)
			return
		}
		try {
			await StateServiceClient.setWelcomeViewCompleted(BooleanRequest.create({ value: true }))
		} catch (error) {
			console.error("Failed to complete welcome view:", error)
		}
	}

	const isConfigured = !apiErrorMessage

	return (
		<div className="fixed inset-0 flex flex-col overflow-auto">
			<div className="m-auto w-full max-w-[520px] px-6 py-10 flex flex-col gap-6" ref={backgroundRef}>
				<div className="flex items-center gap-4">
					<EraLogo className="size-16 shrink-0 text-(--vscode-foreground)" />
					<div>
						<h1 className="text-xl font-semibold m-0">era harness</h1>
						<p className="text-xs m-0 mt-1 text-(--vscode-descriptionForeground)">eraTW 画蛇添足版开发助手</p>
					</div>
				</div>

				{step === "intro" ? (
					<>
						<p className="text-sm m-0 text-(--vscode-descriptionForeground) leading-relaxed">
							给 eraTW / Emuera
							这类日文脚本工程做长期改造的夹具。不是通用编程助手——它把编码、diff、审批当成一等约束。
						</p>

						<div className="flex flex-col gap-3">
							<FeatureRow
								description="CP932 / UTF-8 双写校验，编码不对就拒绝落盘"
								icon={<FileCode2Icon size={15} />}
								title="编码安全读写"
							/>
							<FeatureRow
								description="无登录、无账号、无遥测；对话与文件操作都在本机"
								icon={<ShieldCheckIcon size={15} />}
								title="纯本地运行"
							/>
							<FeatureRow
								description="本体侧与口上侧互斥，跨范围改文件一律手动确认；只约束可写范围，不改对话风格"
								icon={<SparklesIcon size={15} />}
								title="文件修改范围可切换"
							/>
						</div>

						<div className="flex flex-col gap-2 mt-2">
							<VSCodeButton appearance="primary" className="w-full" onClick={() => setStep("config")}>
								开始配置
							</VSCodeButton>
							{isConfigured && (
								<button
									className="text-xs bg-transparent border-none cursor-pointer py-1"
									onClick={finish}
									style={{ color: "var(--vscode-textLink-foreground)" }}
									type="button">
									已有可用的模型配置，直接进入
								</button>
							)}
						</div>
					</>
				) : (
					<>
						<button
							className="flex items-center gap-1 text-xs bg-transparent border-none cursor-pointer p-0 self-start"
							onClick={() => setStep("intro")}
							style={{ color: "var(--vscode-textLink-foreground)" }}
							type="button">
							<ArrowLeftIcon size={12} />
							返回
						</button>

						<div>
							<h2 className="text-base font-semibold m-0">配置模型服务</h2>
							<p className="text-xs m-0 mt-1 text-(--vscode-descriptionForeground)">
								密钥只保存在本机。推荐 DeepSeek；也可选「OpenAI 兼容」接入 Ollama / LM Studio / vLLM 等自建服务。
							</p>
						</div>

						<ApiOptions currentMode={mode} showModelOptions={true} />

						{hasAttempted && apiErrorMessage && (
							<p className="text-xs m-0" style={{ color: "var(--vscode-errorForeground)" }}>
								{apiErrorMessage}
							</p>
						)}

						<VSCodeButton appearance="primary" className="w-full" onClick={finish}>
							完成，开始使用
						</VSCodeButton>
					</>
				)}
			</div>

			{/* 不受 step 限制：只要本次会话还没确认就一直挡着，防止切到 config 后提示消失 */}
			{showBuiltinChatNotice && <BuiltinChatNoticeModal onAck={() => setShowBuiltinChatNotice(false)} />}
		</div>
	)
})

const FeatureRow = ({ icon, title, description }: { icon: ReactNode; title: string; description: string }) => (
	<div className="flex items-start gap-2.5">
		<span className="mt-0.5 shrink-0 opacity-80">{icon}</span>
		<div>
			<div className="text-sm font-medium">{title}</div>
			<div className="text-xs mt-0.5 text-(--vscode-descriptionForeground) leading-relaxed">{description}</div>
		</div>
	</div>
)

export default EraOnboardingView

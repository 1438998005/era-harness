import { memo, useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { UiServiceClient } from "@/services/grpc-client"

const LANGUAGE_OWNER_OPTIONS = [
	{ value: "era", label: "era harness", hint: "内置高亮（默认）" },
	{ value: "sasami", label: "sasami.erabasic", hint: "需已安装该扩展" },
	{ value: "off", label: "关闭高亮", hint: "原版 Ruby 配色；补全/跳转/符号同失" },
] as const

export type LanguageOwner = (typeof LANGUAGE_OWNER_OPTIONS)[number]["value"]

/** EraBasic 语法归属：三选一的单选卡，选中项实心高亮；off = 把 .erb/.erh 绑到内置 Ruby（保留原版配色，补全/跳转/符号同失） */
export const EraBasicOwnerChoice = memo(() => {
	const [owner, setOwner] = useState<LanguageOwner | null>(null)
	const [pending, setPending] = useState<LanguageOwner | null>(null)
	const [error, setError] = useState<string | null>(null)

	const readOwner = useCallback(async (): Promise<LanguageOwner> => {
		const res = await UiServiceClient.getEraBasicLanguageOwner({})
		return res.value === "sasami" || res.value === "off" ? res.value : "era"
	}, [])

	useEffect(() => {
		let cancelled = false
		readOwner()
			.then((value) => {
				if (!cancelled) {
					setOwner(value)
				}
			})
			.catch((e) => console.error("getEraBasicLanguageOwner failed", e))
		return () => {
			cancelled = true
		}
	}, [readOwner])

	const switchTo = useCallback(
		async (next: LanguageOwner) => {
			if (next === owner || pending) {
				return
			}
			setPending(next)
			setError(null)
			try {
				await UiServiceClient.runCommand({
					value:
						next === "sasami"
							? "eraHarness.erabasic.yieldToSasami"
							: next === "off"
								? "eraHarness.erabasic.disableHighlighting"
								: "eraHarness.erabasic.reclaimFiles",
				})
				// sasami 未安装时命令会被拒绝，回读真实状态，不做乐观更新
				setOwner(await readOwner())
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e))
			} finally {
				setPending(null)
			}
		},
		[owner, pending, readOwner],
	)

	return (
		<div className="flex flex-col gap-2">
			<div className="text-sm font-medium text-foreground">EraBasic 语法归属</div>
			<div className="text-xs text-description">
				.erb / .erh 的语法高亮由谁提供，三选一。切换会写入用户级 files.associations，随时可换回；「关闭高亮」会关掉
				EraBasic 着色、保留 VS Code 原版 Ruby 配色，补全/跳转/符号对这些文件同时失效。
			</div>
			<div aria-label="EraBasic 语法归属" className="grid grid-cols-3 gap-2 pt-1" role="radiogroup">
				{LANGUAGE_OWNER_OPTIONS.map((option) => {
					const active = owner === option.value
					const busy = pending === option.value
					return (
						<button
							aria-checked={active}
							className={cn(
								"flex cursor-pointer flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-default",
								active
									? "border-button-background bg-button-background text-primary-foreground"
									: "border-editor-widget-border/60 bg-transparent text-foreground hover:bg-accent/10",
								pending && !busy && "opacity-60",
							)}
							disabled={owner === null || pending !== null}
							key={option.value}
							onClick={() => void switchTo(option.value)}
							role="radio"
							type="button">
							<span className="flex items-center gap-1.5 text-sm font-medium">
								<i className={cn("codicon", active ? "codicon-check" : "codicon-circle-outline opacity-40")} />
								{option.label}
								{busy && <i className="codicon codicon-loading codicon-modifier-spin" />}
							</span>
							<span className={cn("text-xs", active ? "opacity-80" : "text-description")}>
								{option.hint}
								{active && " · 当前"}
							</span>
						</button>
					)
				})}
			</div>

			{owner === null && <div className="text-xs text-description">读取当前归属…</div>}
			{error && <div className="text-error text-xs">切换失败：{error}</div>}
		</div>
	)
})

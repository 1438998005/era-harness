import type { KnowledgeBaseAction, KnowledgeBaseActionResult, KnowledgeBaseListItem } from "@shared/knowledgeBase"
import { VSCodeButton, VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useEffect, useState } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { UiServiceClient } from "@/services/grpc-client"
import Section from "../Section"

interface KnowledgeBaseSectionProps {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

function formatTime(value: string): string {
	if (!value) {
		return "未知"
	}
	try {
		return new Date(value).toLocaleString()
	} catch {
		return value
	}
}

function countSummary(item: KnowledgeBaseListItem): string {
	const counts = item.counts
	if (!counts) {
		return item.fileCount > 0 ? `${item.fileCount} 个分片` : "还没有内容"
	}
	const labels: Record<string, string> = { function: "函数", constant: "常量", table: "表", other: "其他" }
	const parts = Object.entries(counts)
		.filter(([, n]) => typeof n === "number" && n > 0)
		.map(([kind, n]) => `${labels[kind] ?? kind} ${n}`)
	return parts.length > 0 ? parts.join(" / ") : "还没有内容"
}

/**
 * 设置 → 专属知识库。
 *
 * 设计要点（用户 2026-10-31 定）：
 * 1. **扩展不内置任何游戏知识**，库由 AI 在对话里读当前工作区生成；
 * 2. 「新建 / 更新」都只是**开一场对话**，所以按钮点完直接跳回聊天（`hideSettings`）；
 * 3. 每个库可单独开关「载入到对话」、可删除（挪进 `.trash/`，可找回）；
 * 4. 将来支持别的游戏不需要改这里——库是按工作区/工程走的。
 */
const KnowledgeBaseSection = ({ renderSectionHeader }: KnowledgeBaseSectionProps) => {
	const { hideSettings } = useExtensionState()
	const [items, setItems] = useState<KnowledgeBaseListItem[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [busySlug, setBusySlug] = useState<string | null>(null)
	const [creating, setCreating] = useState(false)
	const [draftName, setDraftName] = useState("")
	const [draftMode, setDraftMode] = useState<"full" | "blank">("blank")
	const [fullConfirmed, setFullConfirmed] = useState(false)
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
	const [confirmUpdate, setConfirmUpdate] = useState<string | null>(null)
	const [incrementSlug, setIncrementSlug] = useState<string | null>(null)
	const [incrementKind, setIncrementKind] = useState<"recent" | "topic">("recent")
	const [incrementTopic, setIncrementTopic] = useState("")
	const [notice, setNotice] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		setLoading(true)
		try {
			const response = await UiServiceClient.getKnowledgeBases({})
			const parsed = response?.value ? (JSON.parse(response.value) as KnowledgeBaseListItem[]) : []
			setItems(Array.isArray(parsed) ? parsed : [])
			setError(null)
		} catch (err) {
			console.error("getKnowledgeBases failed", err)
			setError("读取知识库列表失败，重载窗口后再试。")
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const runAction = useCallback(
		async (action: KnowledgeBaseAction, options?: { jumpToChat?: boolean; slug?: string }) => {
			setError(null)
			setNotice(null)
			setBusySlug(options?.slug ?? (action.action === "create" ? "__create__" : null))
			try {
				const response = await UiServiceClient.knowledgeBaseAction({ value: JSON.stringify(action) })
				const result = response?.value ? (JSON.parse(response.value) as KnowledgeBaseActionResult) : { ok: false }
				if (!result.ok) {
					setError(result.message || "操作失败。")
					await refresh()
					return null
				}
				if (options?.jumpToChat) {
					// 建库/更新都是「开一场对话」：直接跳回聊天，让用户看到 AI 开始干活
					hideSettings()
					return result
				}
				await refresh()
				return result
			} catch (err) {
				console.error("knowledgeBaseAction failed", err)
				setError("操作失败，重载窗口后再试。")
				return null
			} finally {
				setBusySlug(null)
			}
		},
		[hideSettings, refresh],
	)

	const handleCreate = useCallback(async () => {
		const name = draftName.trim()
		if (!name) {
			setError("先给知识库起个名字。")
			return
		}
		const mode = draftMode
		const result = await runAction({ action: "create", name, mode }, { jumpToChat: mode === "full" })
		if (result?.ok) {
			if (mode === "blank") {
				setNotice("空白知识库已创建。在卡片上点「续写」按范围补内容（产物与完整建库相同）。")
			}
			setCreating(false)
			setDraftName("")
			setFullConfirmed(false)
			setDraftMode("blank")
		}
	}, [draftName, draftMode, runAction])

	return (
		<div>
			{renderSectionHeader("knowledge")}
			<Section>
				<div className="text-xs text-description">
					这里是**给具体游戏**的专属知识库：函数含义、常量与变量槽位、CSV 表结构、机制与坑。它不是内置的——
					点「新建知识库」会开一场对话，让 AI 读当前工作区，把结果写成
					<code className="mx-1">.era-harness/knowledge/</code>
					下的一组文档（总索引 + 分片）。
					<br />
					载入后它只作为**参考**进对话：与代码冲突时以代码为准；发现不符请点「更新」让 AI 重新核对。
				</div>

				{error && (
					<div className="text-xs" style={{ color: "var(--vscode-errorForeground)" }}>
						{error}
					</div>
				)}

				{notice && (
					<div className="text-xs" style={{ color: "var(--vscode-descriptionForeground)" }}>
						{notice}
					</div>
				)}

				{loading ? (
					<div className="text-xs text-description">正在读取…</div>
				) : items.length === 0 ? (
					<div className="text-xs text-description">
						还没有专属知识库。新建之后，后续对话就能直接查到「这个函数/常量是干什么的」，不必每次重读整个工程。
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{items.map((item) => (
							<div
								className="flex flex-col gap-1 rounded border p-2"
								key={item.slug}
								style={{ borderColor: "var(--vscode-panel-border)" }}>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<span className="text-sm font-medium truncate">{item.name}</span>
										{item.stale && (
											<span
												className="text-xs px-1 rounded"
												style={{
													color: "var(--vscode-editorWarning-foreground, #CCA700)",
													border: "1px solid var(--vscode-editorWarning-foreground, #CCA700)",
												}}>
												可能过期
											</span>
										)}
										{item.broken && (
											<span className="text-xs" style={{ color: "var(--vscode-errorForeground)" }}>
												已损坏
											</span>
										)}
										{item.buildStatus === "draft" && (
											<span
												className="text-xs px-1 rounded"
												style={{
													color: "var(--vscode-descriptionForeground)",
													border: "1px solid var(--vscode-panel-border)",
												}}>
												空白（仅骨架）
											</span>
										)}
										{item.buildStatus === "building" && (
											<span
												className="text-xs px-1 rounded"
												style={{
													color: "var(--vscode-textLink-foreground)",
													border: "1px solid var(--vscode-textLink-foreground)",
												}}>
												构建中
											</span>
										)}
										{item.buildStatus === "failed" && (
											<span
												className="text-xs px-1 rounded"
												style={{
													color: "var(--vscode-editorWarning-foreground, #CCA700)",
													border: "1px solid var(--vscode-editorWarning-foreground, #CCA700)",
												}}>
												上次未完成
											</span>
										)}
									</div>
									{item.broken ? (
										<VSCodeButton
											appearance="secondary"
											disabled={busySlug === item.slug}
											onClick={() => setConfirmDelete(item.slug)}>
											删除
										</VSCodeButton>
									) : (
										<VSCodeCheckbox
											checked={item.enabled}
											disabled={busySlug === item.slug}
											onChange={(e: any) =>
												void runAction(
													{ action: "enable", slug: item.slug, enabled: Boolean(e.target?.checked) },
													{ slug: item.slug },
												)
											}>
											载入到对话
										</VSCodeCheckbox>
									)}
								</div>

								<div className="text-xs text-description">
									{countSummary(item)} · {item.fileCount} 个分片 · 更新于 {formatTime(item.updatedAt)}
									{item.gameVersion ? ` · 建库版本 ${item.gameVersion}` : ""}
									{item.stale && item.currentGameVersion ? ` · 当前版本 ${item.currentGameVersion}` : ""}
								</div>

								{item.buildError && (
									<div className="text-xs" style={{ color: "var(--vscode-errorForeground)" }}>
										{item.buildError}
									</div>
								)}

								{!item.broken && (
									<>
										<div className="flex flex-wrap gap-2 mt-1">
											<VSCodeButton
												disabled={busySlug === item.slug || item.buildStatus === "building"}
												onClick={() => setConfirmUpdate(item.slug)}>
												{item.buildStatus === "failed" ? "继续构建" : "更新"}
											</VSCodeButton>
											<VSCodeButton
												appearance="secondary"
												disabled={busySlug === item.slug || item.buildStatus === "building"}
												onClick={() => {
													setIncrementSlug(item.slug === incrementSlug ? null : item.slug)
													setIncrementKind("recent")
													setIncrementTopic("")
												}}>
												续写
											</VSCodeButton>
											<VSCodeButton
												appearance="secondary"
												disabled={busySlug === item.slug}
												onClick={() =>
													void runAction({ action: "reveal", slug: item.slug }, { slug: item.slug })
												}>
												打开目录
											</VSCodeButton>
											<VSCodeButton
												appearance="secondary"
												disabled={busySlug === item.slug || item.buildStatus === "building"}
												onClick={() => setConfirmDelete(item.slug)}>
												删除
											</VSCodeButton>
										</div>

										{confirmUpdate === item.slug && (
											<div className="flex flex-col gap-1 mt-1 rounded border p-2">
												<div className="text-xs">
													更新会开一场对话：可能 30–60
													分钟；期间不要切模型/开新对话；可中断但会留半成品。
												</div>
												<div className="flex flex-wrap gap-2">
													<VSCodeButton
														disabled={busySlug === item.slug}
														onClick={() => {
															setConfirmUpdate(null)
															void runAction(
																{ action: "update", slug: item.slug },
																{ jumpToChat: true, slug: item.slug },
															)
														}}>
														开始更新
													</VSCodeButton>
													<VSCodeButton appearance="secondary" onClick={() => setConfirmUpdate(null)}>
														取消
													</VSCodeButton>
												</div>
											</div>
										)}

										{incrementSlug === item.slug && (
											<div className="flex flex-col gap-1 mt-1 rounded border p-2">
												<div className="text-xs text-description">
													只补这个范围；不重读整个工程；产物与完整建库完全相同。
													<b>完整建库的库同样可以续写。</b>
													<br />
													「本次对话涉及的文件」需要先有一个读过工程文件的对话；没有对话时改用「指定目录或主题」。
												</div>
												<label className="flex items-center gap-2 text-xs">
													<input
														checked={incrementKind === "recent"}
														onChange={() => setIncrementKind("recent")}
														type="radio"
													/>
													本次对话涉及的文件
												</label>
												<label className="flex items-center gap-2 text-xs">
													<input
														checked={incrementKind === "topic"}
														onChange={() => setIncrementKind("topic")}
														type="radio"
													/>
													指定目录或主题
												</label>
												{incrementKind === "topic" && (
													<VSCodeTextField
														onInput={(e: any) => setIncrementTopic(e.target?.value ?? "")}
														placeholder="如 ERB/口上・メッセージ関連 或「战斗系统」"
														value={incrementTopic}
													/>
												)}
												<div className="flex flex-wrap gap-2">
													<VSCodeButton
														disabled={busySlug === item.slug}
														onClick={() => {
															const scope =
																incrementKind === "recent"
																	? ({ kind: "recent" } as const)
																	: ({ kind: "topic", topic: incrementTopic.trim() } as const)
															if (scope.kind === "topic" && !scope.topic) {
																setError("先填一个目录或主题。")
																return
															}
															void runAction(
																{ action: "increment", slug: item.slug, scope },
																{ jumpToChat: true, slug: item.slug },
															)
														}}>
														开始续写
													</VSCodeButton>
													<VSCodeButton appearance="secondary" onClick={() => setIncrementSlug(null)}>
														取消
													</VSCodeButton>
												</div>
											</div>
										)}
									</>
								)}

								{confirmDelete === item.slug && (
									<div className="flex flex-wrap items-center gap-2 mt-1">
										<span className="text-xs" style={{ color: "var(--vscode-errorForeground)" }}>
											删除会把这个库挪到 <code>.trash/</code>（可手动找回）。确定？
										</span>
										<VSCodeButton
											disabled={busySlug === item.slug}
											onClick={() => {
												setConfirmDelete(null)
												void runAction({ action: "delete", slug: item.slug }, { slug: item.slug })
											}}>
											确定删除
										</VSCodeButton>
										<VSCodeButton appearance="secondary" onClick={() => setConfirmDelete(null)}>
											取消
										</VSCodeButton>
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{creating ? (
					<div className="flex flex-col gap-2 rounded border p-2" style={{ borderColor: "var(--vscode-panel-border)" }}>
						<VSCodeTextField
							onInput={(e: any) => setDraftName(e.target?.value ?? "")}
							placeholder="给这个知识库起个名字，如「eratw 画蛇添足版」"
							value={draftName}
						/>

						<div className="text-xs font-medium">建库方式（两种都必须能续写，产物完全相同）</div>

						<label className="flex flex-col gap-1 rounded border p-2 cursor-pointer">
							<div className="flex items-center gap-2">
								<input checked={draftMode === "full"} onChange={() => setDraftMode("full")} type="radio" />
								<span className="text-sm">构建完整知识库</span>
							</div>
							<div className="text-xs text-description">
								开一场对话通读整个工程；30–120 分钟，费用可能数十元。建完即可用，之后也能续写。
							</div>
						</label>

						<label className="flex flex-col gap-1 rounded border p-2 cursor-pointer">
							<div className="flex items-center gap-2">
								<input checked={draftMode === "blank"} onChange={() => setDraftMode("blank")} type="radio" />
								<span className="text-sm">构建空白知识库</span>
							</div>
							<div className="text-xs text-description">
								只建空索引骨架（index.md + kb.json），不花钱、不开对话；之后在卡片上点「续写」分多次补。
							</div>
						</label>

						{draftMode === "full" && (
							<div
								className="flex flex-col gap-1 rounded border p-2"
								style={{ borderColor: "var(--vscode-editorWarning-foreground, #CCA700)" }}>
								<div className="text-xs">
									⏱ 可能持续 30–120 分钟；期间不要切换模型、不要新开对话（会中止本任务）。
								</div>
								<div className="text-xs">
									💰 实测：一次失控的完整建库消耗 102 元（5 个子代理，其中一个 1936
									次工具调用）。本版已加预算上限（单子代理 ¥3 / 单次调用 ¥10 / 10 分钟），但仍建议先看余额。
								</div>
								<div className="text-xs">
									🧠 建议使用智能程度高的模型；弱模型写出的分片质量差、更容易半途跑偏。
								</div>
								<div className="text-xs">
									🧩 不想一次跑完？改用「构建空白知识库」：同一套 index + 分片，之后随时点「续写」分次补。
								</div>
								<VSCodeCheckbox
									checked={fullConfirmed}
									onChange={(e: any) => setFullConfirmed(Boolean(e.target?.checked))}>
									我已了解：耗时可能很长、期间不切模型/不开新对话、可能产生费用。
								</VSCodeCheckbox>
							</div>
						)}

						<div className="flex flex-wrap gap-2">
							<VSCodeButton
								disabled={busySlug === "__create__" || (draftMode === "full" && !fullConfirmed)}
								onClick={() => void handleCreate()}>
								{draftMode === "full" ? "开始构建（可能数十元）" : "创建空白知识库"}
							</VSCodeButton>
							<VSCodeButton
								appearance="secondary"
								onClick={() => {
									setCreating(false)
									setDraftName("")
									setFullConfirmed(false)
									setDraftMode("blank")
									setError(null)
								}}>
								取消
							</VSCodeButton>
						</div>
						<div className="text-xs text-description">
							两种方式只决定<b>第一场任务怎么跑</b>；建完之后都能在卡片上点「续写」按范围添砖加瓦。
						</div>
					</div>
				) : (
					<div className="flex flex-wrap gap-2">
						<VSCodeButton onClick={() => setCreating(true)}>新建知识库</VSCodeButton>
						<VSCodeButton appearance="secondary" disabled={loading} onClick={() => void refresh()}>
							刷新
						</VSCodeButton>
					</div>
				)}
			</Section>
		</div>
	)
}

export default KnowledgeBaseSection

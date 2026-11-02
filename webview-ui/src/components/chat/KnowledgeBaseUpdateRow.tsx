import type { ClineMessage } from "@shared/ExtensionMessage"
import {
	isKnowledgeBaseUpdateTurnEnd,
	type KnowledgeBaseActionResult,
	type KnowledgeBaseListItem,
	pickKnowledgeBaseUpdateTargets,
} from "@shared/knowledgeBase"
import { BookOpen } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { UiServiceClient } from "@/services/grpc-client"

/**
 * 08 #175：对话里「更新专属知识库」的一键入口。
 *
 * 用户裁定：不做后台自动执行（会 abort 当前对话、且在用户没预期时花钱）。
 * 改成「AI 回复完 → 回复下方出现一个按钮 → 用户点一下才开更新对话」。
 *
 * 开关就是设置页每张卡片上已有的「载入到对话」复选框（写 `ui.json`）：
 * 不想让它进对话的库，也不该被一键更新。
 */

/** 列表缓存：只在「等你回复」这一刻挂载，15 秒足够覆盖一次重渲染风暴 */
const CACHE_TTL_MS = 15_000
let listCache: { at: number; items: KnowledgeBaseListItem[] } | undefined

async function loadTargets(): Promise<KnowledgeBaseListItem[]> {
	const now = Date.now()
	if (listCache && now - listCache.at < CACHE_TTL_MS) {
		return pickKnowledgeBaseUpdateTargets(listCache.items)
	}
	const response = await UiServiceClient.getKnowledgeBases({})
	const parsed = response?.value ? (JSON.parse(response.value) as KnowledgeBaseListItem[]) : []
	const items = Array.isArray(parsed) ? parsed : []
	listCache = { at: now, items }
	return pickKnowledgeBaseUpdateTargets(items)
}

export function KnowledgeBaseUpdateRow({
	message,
	onHeightChange,
}: {
	message: ClineMessage
	onHeightChange?: (isTaller: boolean) => void
}) {
	const { t } = useTranslation()
	const [targets, setTargets] = useState<KnowledgeBaseListItem[]>([])
	const [picking, setPicking] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const visible = isKnowledgeBaseUpdateTurnEnd(message)
	// 虚拟列表的高度回调可能每次渲染都换引用；用 ref 避免它触发重复拉取
	const heightRef = useRef(onHeightChange)
	heightRef.current = onHeightChange

	useEffect(() => {
		if (!visible) {
			return
		}
		let alive = true
		void loadTargets()
			.then((items) => {
				if (!alive) {
					return
				}
				setTargets(items)
				if (items.length > 0) {
					// 按钮是异步出现的：不通知 Virtuoso 的话最后一行会被裁掉
					heightRef.current?.(true)
				}
			})
			.catch(() => {
				// 读不到库就不显示按钮——这是纯增强，不能报错打扰用户
			})
		return () => {
			alive = false
		}
	}, [visible])

	const runUpdate = useCallback(
		async (slug: string) => {
			setBusy(true)
			setError(null)
			try {
				const response = await UiServiceClient.knowledgeBaseAction({
					value: JSON.stringify({ action: "increment", slug, scope: { kind: "recent" } }),
				})
				const result = response?.value ? (JSON.parse(response.value) as KnowledgeBaseActionResult) : { ok: false }
				if (!result.ok) {
					setError(result.message || t("chat.kbUpdateFailed"))
				}
				// 成功不提示：当前对话会被更新对话替换，用户马上就看到新任务了
			} catch {
				setError(t("chat.kbUpdateFailed"))
			} finally {
				setBusy(false)
				setPicking(false)
			}
		},
		[t],
	)

	if (!visible || targets.length === 0) {
		return null
	}

	const single = targets.length === 1 ? targets[0] : undefined

	return (
		<div className="mt-1 pl-1 flex flex-col gap-1">
			<button
				className="inline-flex items-center gap-1.5 self-start rounded border px-2 py-0.5 text-xs"
				disabled={busy}
				onClick={() => (single ? void runUpdate(single.slug) : setPicking(true))}
				style={{
					background: "transparent",
					borderColor: "var(--vscode-panel-border)",
					color: "var(--vscode-descriptionForeground)",
					cursor: busy ? "default" : "pointer",
					opacity: busy ? 0.6 : 1,
				}}
				title={t("chat.kbUpdateHint")}
				type="button">
				<BookOpen size={12} />
				{busy
					? t("chat.kbUpdating")
					: single
						? t("chat.kbUpdateButton", { name: single.name })
						: t("chat.kbUpdateButtonMulti", { n: targets.length })}
			</button>

			{error && (
				<div className="text-xs" style={{ color: "var(--vscode-errorForeground)" }}>
					{error}
				</div>
			)}

			{picking && (
				<div
					onClick={() => setPicking(false)}
					style={{
						position: "fixed",
						inset: 0,
						zIndex: 1000,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "rgba(0, 0, 0, 0.45)",
						padding: 16,
					}}>
					<div
						aria-modal="true"
						onClick={(event) => event.stopPropagation()}
						role="dialog"
						style={{
							width: "min(420px, 100%)",
							maxHeight: "calc(100vh - 64px)",
							overflowY: "auto",
							borderRadius: 10,
							padding: "16px 16px 12px",
							background: "var(--vscode-editorWidget-background, var(--vscode-sidebar-background))",
							border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.3))",
							boxShadow: "0 10px 32px rgba(0, 0, 0, 0.4)",
							color: "var(--vscode-foreground)",
						}}>
						<div style={{ fontSize: 14, fontWeight: 600 }}>{t("chat.kbUpdatePickerTitle")}</div>
						<div
							style={{
								fontSize: 11,
								marginTop: 4,
								marginBottom: 12,
								lineHeight: 1.6,
								color: "var(--vscode-descriptionForeground)",
							}}>
							{t("chat.kbUpdatePickerHint")}
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
							{targets.map((item) => (
								<button
									key={item.slug}
									onClick={() => void runUpdate(item.slug)}
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 2,
										alignItems: "flex-start",
										width: "100%",
										padding: "8px 10px",
										borderRadius: 8,
										cursor: "pointer",
										textAlign: "left",
										color: "inherit",
										font: "inherit",
										background: "color-mix(in srgb, var(--vscode-foreground) 5%, transparent)",
										border: "1px solid color-mix(in srgb, var(--vscode-foreground) 10%, transparent)",
									}}>
									<span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
									<span style={{ fontSize: 11, color: "var(--vscode-descriptionForeground)" }}>
										{item.fileCount} 个分片 · 更新于 {formatUpdatedAt(item.updatedAt)}
									</span>
								</button>
							))}
						</div>
						<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
							<button
								onClick={() => setPicking(false)}
								style={{
									padding: "4px 10px",
									fontSize: 11,
									borderRadius: 4,
									cursor: "pointer",
									border: "none",
									color: "var(--vscode-button-secondaryForeground, var(--vscode-foreground))",
									background: "var(--vscode-button-secondaryBackground, rgba(128,128,128,0.2))",
								}}
								type="button">
								{t("chat.kbUpdateCancel")}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

function formatUpdatedAt(value: string): string {
	if (!value) {
		return "未知"
	}
	try {
		return new Date(value).toLocaleString()
	} catch {
		return value
	}
}

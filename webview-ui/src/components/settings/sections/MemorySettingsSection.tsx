import {
	GLOBAL_MEMORY_LIMITS,
	type GlobalMemoryDocument,
	type GlobalMemoryEntry,
	normalizeGlobalMemoryDocument,
} from "@shared/global-memory"
import { VSCodeButton, VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { UiServiceClient } from "@/services/grpc-client"
import Section from "../Section"

interface MemorySettingsSectionProps {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

const SOURCE_LABEL: Record<string, string> = {
	plugin: "插件",
	model: "模型",
	user: "用户",
}

function formatTime(ts: number): string {
	try {
		return new Date(ts).toLocaleString()
	} catch {
		return "-"
	}
}

/**
 * 设置 → 记忆。
 *
 * 三件事必须同时可用，否则「过拟合」没有出口：
 * 1) 开关（关掉后 AI 既不读也不写，但这里仍能管理已有条目）；
 * 2) 逐条删除；
 * 3) 清空全部（两段式确认）。
 */
const MemorySettingsSection = ({ renderSectionHeader }: MemorySettingsSectionProps) => {
	const [document, setDocument] = useState<GlobalMemoryDocument>(() => normalizeGlobalMemoryDocument(undefined))
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [draft, setDraft] = useState("")
	const [confirmClear, setConfirmClear] = useState(false)
	const [error, setError] = useState<string | undefined>()

	const load = useCallback(async () => {
		setLoading(true)
		setError(undefined)
		try {
			const response = await UiServiceClient.getGlobalMemory({})
			setDocument(normalizeGlobalMemoryDocument(JSON.parse(response.value || "{}")))
		} catch (loadError) {
			setError(`读取全局记忆失败：${loadError instanceof Error ? loadError.message : String(loadError)}`)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	/**
	 * 串行队列：连点两次时两个 mutate 不能拿到同一个写前快照再相互覆盖，
	 * 后一个操作必须看到前一个的写入结果。
	 */
	const queueRef = useRef<Promise<unknown>>(Promise.resolve())

	/**
	 * 每次操作都先 re-read、在最新文档上改、再写回：
	 * 设置页可能停留很久，期间模型通过 global_memory 工具新增的条目
	 * 不能被挂载时的旧快照整份覆盖。出错时抛给调用方（让它决定是否保留输入）。
	 */
	const mutate = useCallback(
		(apply: (current: GlobalMemoryDocument) => GlobalMemoryDocument): Promise<void> => {
			const run = queueRef.current.then(async () => {
				setSaving(true)
				setError(undefined)
				try {
					const response = await UiServiceClient.getGlobalMemory({})
					const current = normalizeGlobalMemoryDocument(JSON.parse(response.value || "{}"))
					const next = apply(current)
					if (next === current) {
						// 没变化就不写：不 bump updatedAt，也不把一次无效操作变成覆盖
						return
					}

					const normalized = normalizeGlobalMemoryDocument(next)
					setDocument(normalized)
					await UiServiceClient.updateGlobalMemory({ value: JSON.stringify(normalized) })
				} catch (saveError) {
					setError(`保存失败：${saveError instanceof Error ? saveError.message : String(saveError)}`)
					await load()
					throw saveError
				} finally {
					setSaving(false)
				}
			})

			// 队列只关心“上一个跑完”，不吃上一个的失败
			queueRef.current = run.catch(() => {})
			return run
		},
		[load],
	)

	const handleToggleEnabled = useCallback(() => {
		void mutate((current) => ({ ...current, enabled: !current.enabled })).catch(() => {})
	}, [mutate])

	const handleAdd = useCallback(() => {
		const text = draft.trim()
		if (!text) {
			return
		}
		const now = Date.now()
		const entry: GlobalMemoryEntry = {
			id: `user-${now.toString(36)}`,
			text,
			tags: [],
			source: "user",
			createdAt: now,
			updatedAt: now,
		}

		// 输入框只在写入成功后清空：满额 / 写失败时不能静默吞掉用户刚打的字
		void mutate((current) => {
			if (current.entries.length >= GLOBAL_MEMORY_LIMITS.maxEntries) {
				throw new Error(`已达 ${GLOBAL_MEMORY_LIMITS.maxEntries} 条上限，请先删除不用的条目`)
			}
			return { ...current, entries: [...current.entries, entry] }
		})
			.then(() => setDraft(""))
			.catch(() => {
				/* 错已展示在 error 区，draft 保留 */
			})
	}, [draft, mutate])

	const handleRemove = useCallback(
		(id: string) => {
			setConfirmClear(false)
			void mutate((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) })).catch(
				() => {},
			)
		},
		[mutate],
	)

	const handleClearAll = useCallback(() => {
		if (!confirmClear) {
			setConfirmClear(true)
			return
		}
		setConfirmClear(false)
		void mutate((current) => ({ ...current, entries: [] })).catch(() => {})
	}, [confirmClear, mutate])

	const atLimit = document.entries.length >= GLOBAL_MEMORY_LIMITS.maxEntries

	return (
		<div>
			{renderSectionHeader("memory")}
			<Section>
				<div className="flex flex-col gap-3 px-4">
					<div className="text-xs text-description">
						全局记忆只存「跨项目长期有效」的偏好（称呼、回答语言、工作习惯）。它不是项目知识库：项目内的事实请写进
						AGENTS.md / 代码注释。AI 每次写入都会在聊天里留一条可审计的记录。
					</div>

					<VSCodeCheckbox checked={document.enabled} disabled={loading || saving} onChange={handleToggleEnabled}>
						启用全局记忆
					</VSCodeCheckbox>

					{!document.enabled && (
						<div className="text-xs text-description">
							AI 不会读取或写入；你仍可在这里管理条目。重新勾选后，下一轮对话开始生效。
						</div>
					)}

					{error && <div className="text-xs text-error">{error}</div>}

					<div className="flex items-end gap-2">
						<div className="flex-1">
							<VSCodeTextField
								disabled={loading || saving || atLimit}
								onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
								placeholder={atLimit ? "已达条数上限，请先删除不用的条目" : "例如：解释代码时先给结论"}
								value={draft}>
								添加一条记忆
							</VSCodeTextField>
						</div>
						<VSCodeButton disabled={loading || saving || atLimit || !draft.trim()} onClick={handleAdd}>
							添加
						</VSCodeButton>
					</div>

					<div className="flex items-center justify-between text-xs text-description">
						<span>
							已用 {document.entries.length}/{GLOBAL_MEMORY_LIMITS.maxEntries} 条 · 单条最多{" "}
							{GLOBAL_MEMORY_LIMITS.maxEntryChars} 字 · 注入上限{" "}
							{Math.round(GLOBAL_MEMORY_LIMITS.maxPromptBytes / 1024)}KB
						</span>
						{loading && <span>读取中…</span>}
					</div>

					<div className="flex flex-col gap-2">
						{document.entries.length === 0 && (
							<div className="text-xs text-description">
								还没有条目。插件只会在开启后写入「回答语言」与「称呼」两条种子。
							</div>
						)}
						{document.entries.map((entry) => (
							<div
								className="flex items-start justify-between gap-2 rounded-xs border border-editorGroup-border p-2"
								key={entry.id}>
								<div className="flex flex-col gap-1">
									<span>{entry.text}</span>
									<span className="text-xs text-description">
										{SOURCE_LABEL[entry.source] ?? entry.source}
										{entry.tags.length > 0 ? ` · ${entry.tags.join("、")}` : ""}
										{` · ${formatTime(entry.updatedAt)}`}
									</span>
								</div>
								<button
									aria-label={`删除：${entry.text}`}
									className="bg-transparent border-0 cursor-pointer p-0 text-description hover:text-error"
									disabled={saving}
									onClick={() => handleRemove(entry.id)}
									title="删除这条记忆"
									type="button">
									<span className="codicon codicon-trash" />
								</button>
							</div>
						))}
					</div>

					<div className="flex items-center gap-2 pt-1">
						<VSCodeButton
							appearance={confirmClear ? "primary" : "secondary"}
							disabled={loading || saving || document.entries.length === 0}
							onClick={handleClearAll}>
							{confirmClear ? "再次点击确认清空" : "清空全部记忆"}
						</VSCodeButton>
						{confirmClear && (
							<VSCodeButton appearance="secondary" onClick={() => setConfirmClear(false)}>
								取消
							</VSCodeButton>
						)}
					</div>
				</div>
			</Section>
		</div>
	)
}

export default MemorySettingsSection

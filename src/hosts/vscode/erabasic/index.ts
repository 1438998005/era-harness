// EraBasic 语言支持整合入口（复刻 sasami/vscode-erabasic 的高亮/补全/跳转/符号能力）。
//
// 关键设计：高亮走 **静态语言声明**，不碰用户配置。
//   - `package.json` → `contributes.languages[0].extensions: [".erb", ".erh"]`。
//     这是 VS Code 的标准做法：语言随扩展注册，**禁用/卸载即自动注销**，`.erb` 会回到内置 Ruby，
//     不会在 settings.json 里留下指向不存在语言 id 的脏 `files.associations`
//     （早期版本正是那么做的，导致禁用本扩展后 .erb 变纯文本，比不装还糟）。
//   - 本文件**不再自动写任何用户设置**。唯一会写 `files.associations` 的是两条显式命令：
//       · `eraHarness.erabasic.yieldToSasami` —— 用户主动把 .erb/.erh 让给 sasami.erabasic；
//       · `eraHarness.erabasic.reclaimFiles`   —— 撤销上述让位（以及清理历史脏值）。
//   - 启动时会**自愈**：把旧版本写进去的 `"*.erb": "era-erb"` 静默删掉（现在不需要它了）。

import type { ExtensionContext } from "vscode"
import * as vscode from "vscode"
import { BuiltinComplationItems } from "./completionData"
import { DeclarationProvider } from "./declarationProvider"
import { DefinitionRepository } from "./definitionProvider"
import { readSymbolInformations, SymbolInformationRepository } from "./symbolProvider"

const ERABASIC_EXTENSION_ID = "sasami.erabasic"
const LANGUAGE_ID = "era-erb"
const MANAGED_ASSOCIATIONS = ["*.erb", "*.erh"]
const OWNER_SECTION = "eraHarness.erabasic"
const OWNER_KEY = "languageOwner"

type LanguageOwner = "era" | "sasami"

export function registerEraBasicLanguageSupport(context: ExtensionContext): void {
	let declarationProvider: DeclarationProvider | undefined
	let registrations: vscode.Disposable[] = []

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1)
	statusBarItem.command = "eraHarness.erabasic.revealSymbols"
	context.subscriptions.push(statusBarItem)

	const selector: vscode.DocumentSelector = { language: LANGUAGE_ID }

	function setupProviders(): void {
		if (registrations.length > 0) {
			return
		}
		declarationProvider = new DeclarationProvider(context)
		const definitionRepo = new DefinitionRepository(declarationProvider)
		const symbolRepo = new SymbolInformationRepository(declarationProvider)
		registrations = [
			declarationProvider,
			vscode.languages.registerCompletionItemProvider(selector, {
				provideCompletionItems: () => BuiltinComplationItems,
			}),
			vscode.languages.registerDefinitionProvider(selector, {
				provideDefinition: (document, position) =>
					definitionRepo.sync().then(() => Array.from(definitionRepo.find(document, position))),
			}),
			vscode.languages.registerDocumentSymbolProvider(selector, {
				provideDocumentSymbols: (document) => readSymbolInformations(document.uri, document.getText()),
			}),
			vscode.languages.registerWorkspaceSymbolProvider({
				provideWorkspaceSymbols: (query) => symbolRepo.sync().then(() => Array.from(symbolRepo.find(query))),
			}),
		]
	}

	function teardownProviders(): void {
		for (const d of registrations) {
			d.dispose()
		}
		registrations = []
		declarationProvider = undefined
	}

	/** 当前用户级 files.associations（只读快照） */
	async function readAssociations(): Promise<Record<string, string>> {
		const cfg = vscode.workspace.getConfiguration("files")
		return { ...(cfg.get<Record<string, string>>("associations", {}) ?? {}) }
	}

	/**
	 * 写用户级 files.associations。
	 * ⚠️ 只允许被**用户显式点的命令**调到（让位 / 收回），⛔ 不要在 evaluate() 里自动调——
	 * 自动写入会在扩展被禁用后留下指向不存在语言 id 的关联，.erb 会变成纯文本。
	 */
	async function writeAssociations(assoc: Record<string, string>): Promise<void> {
		await vscode.workspace.getConfiguration("files").update("associations", assoc, vscode.ConfigurationTarget.Global)
	}

	/** sasami.erabasic 声明的第一个语言 id（让位时写到它的语言上，不猜） */
	function erabasicLanguageId(): string | undefined {
		// ⚠️ `Extension.packageJSON` 是整份 package.json，语言声明在 `contributes.languages` 下；
		// 顶层 `languages` 只是旧写法的兼容分支。早期只读顶层 → 永远拿不到 id，让位命令必定失败。
		const pkg = vscode.extensions.getExtension(ERABASIC_EXTENSION_ID)?.packageJSON as
			| {
					languages?: Array<{ id?: string }>
					contributes?: { languages?: Array<{ id?: string }> }
			  }
			| undefined
		const languages = pkg?.contributes?.languages ?? pkg?.languages
		return languages?.find((entry) => typeof entry.id === "string")?.id
	}

	/**
	 * 自愈：删掉旧版本（≤3.88.0）在激活时写进用户设置里的 "*.erb": "era-erb"。
	 * 那时不声明 extensions 只能靠关联抢文件；现在语言声明替了它，这两条值既多余、
	 * 又正是「禁用扩展后 .erb 变纯文本」的根因。只在真的存在脏值时才写一次。
	 */
	async function healLegacyAssociations(): Promise<void> {
		const assoc = await readAssociations()
		let changed = false
		for (const key of MANAGED_ASSOCIATIONS) {
			if (assoc[key] === LANGUAGE_ID) {
				delete assoc[key]
				changed = true
			}
		}
		if (changed) {
			await writeAssociations(assoc)
		}
	}

	/** 设置里的「EraBasic 语言归属」 */
	function readOwner(): LanguageOwner {
		const value = vscode.workspace.getConfiguration(OWNER_SECTION).get<string>(OWNER_KEY, "era")
		return value === "sasami" ? "sasami" : "era"
	}

	async function setOwner(owner: LanguageOwner): Promise<void> {
		await vscode.workspace.getConfiguration(OWNER_SECTION).update(OWNER_KEY, owner, vscode.ConfigurationTarget.Global)
	}

	/**
	 * 把「语言归属」落到 files.associations。
	 * 只动本扩展管理的两个键，且只认 era-erb / sasami 的语言 id —— 用户自己写的映射不碰。
	 * ⚠️ 调用方只能是**用户动作**（设置项变更 / 让位 / 收回命令），⛔ 不要在 evaluate() 里自动调。
	 */
	async function applyOwner(owner: LanguageOwner): Promise<{ ok: boolean; changed: string[] }> {
		const target = erabasicLanguageId()
		if (owner === "sasami" && !target) {
			void vscode.window.showWarningMessage(
				"设置已选「sasami.erabasic」，但没有找到它（未安装 / 未启用 / 没声明语言 id）。装好后再切换一次，或先切回 era harness。",
			)
			return { ok: false, changed: [] }
		}
		const assoc = await readAssociations()
		const changed: string[] = []
		for (const key of MANAGED_ASSOCIATIONS) {
			const value = assoc[key]
			if (owner === "sasami" && target) {
				if (value !== target) {
					assoc[key] = target
					changed.push(key)
				}
			} else if (value === LANGUAGE_ID || (target !== undefined && value === target)) {
				delete assoc[key]
				changed.push(key)
			}
		}
		if (changed.length > 0) {
			await writeAssociations(assoc)
		}
		return { ok: true, changed }
	}

	/** 让位：设置与关联一起切到 sasami（用户主动点的命令） */
	async function yieldToSasami(): Promise<void> {
		const target = erabasicLanguageId()
		if (!target) {
			void vscode.window.showWarningMessage(
				"没有找到 sasami.erabasic，或它没有声明语言 id，无法让位。装好并启用它之后重试。",
			)
			return
		}
		const { changed } = await applyOwner("sasami")
		await setOwner("sasami")
		void vscode.window.showInformationMessage(
			changed.length > 0
				? `已让位：.erb/.erh 改用 ${target}（sasami.erabasic）。想收回：执行「收回 .erb/.erh 的语法归属」，或把设置「EraBasic 语言归属」切回 era。`
				: `当前已由 ${target}（sasami.erabasic）接管 .erb/.erh，无需重复让位。`,
		)
	}

	/** 收回：只删本扩展写过的值（era-erb 或 erabasic 的语言 id），不碰用户自己的映射；设置切回 era */
	async function reclaimFiles(): Promise<void> {
		const { changed } = await applyOwner("era")
		await setOwner("era")
		if (changed.length > 0) {
			void vscode.window.showInformationMessage(
				`已收回 ${changed.join("、")} 的文件关联，.erb/.erh 重新由语言声明决定（禁用本扩展即回到 Ruby）。`,
			)
		} else {
			void vscode.window.showInformationMessage("files.associations 里没有 era harness 写入的条目，无需清理。")
		}
	}

	function evaluate(): void {
		const present = vscode.extensions.getExtension(ERABASIC_EXTENSION_ID) !== undefined
		const autoTakeover = vscode.workspace.getConfiguration(OWNER_SECTION).get<boolean>("autoTakeover", true)
		const owner = readOwner()
		const yielded = present && owner === "sasami"

		// provider 按语言 id 注册，所以装了 erabasic 也无需撤销：
		// 若那个文件最终归到 erabasic 的语言，我们的 provider 本就不会被触发。
		if (autoTakeover) {
			setupProviders()
		} else {
			teardownProviders()
		}

		statusBarItem.backgroundColor = undefined
		if (present && owner !== "sasami") {
			// 语法归属仍是 era-erb（静态声明无法运行时让），所以把让位入口摆在状态栏：
			// 点一下才写 files.associations，不自动代用户决策。
			statusBarItem.command = "eraHarness.erabasic.yieldToSasami"
			statusBarItem.text = "$(arrow-swap) EraBasic：让 sasami 接管高亮"
			statusBarItem.tooltip =
				"检测到 sasami.erabasic。点这里把 .erb/.erh 的语法与高亮交给它（会写入你的 files.associations；随时可收回）"
			statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
		} else if (yielded) {
			statusBarItem.command = "eraHarness.erabasic.reclaimFiles"
			statusBarItem.text = "$(check) EraBasic：高亮归 sasami"
			statusBarItem.tooltip = "当前 .erb/.erh 由 sasami.erabasic 接管。点这里收回，改回 era harness 的语言声明"
		} else if (owner === "sasami") {
			// 设置还指着 sasami，但它被卸载/禁用了：关联可能指向不存在的语言 id，必须给一个明显的收回入口
			statusBarItem.command = "eraHarness.erabasic.reclaimFiles"
			statusBarItem.text = "$(warning) EraBasic：sasami 不见了，点此收回"
			statusBarItem.tooltip =
				"设置里仍指向 sasami.erabasic，但它现在不可用。点这里把 .erb/.erh 收回 era harness，避免变成纯文本"
			statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
		} else if (autoTakeover) {
			statusBarItem.command = "eraHarness.erabasic.revealSymbols"
			statusBarItem.text = "$(file-code) EraBasic: era harness"
			statusBarItem.tooltip = "era harness 提供 .erb/.erh 的 EraBasic 语法与补全/跳转（点击搜索 ERB 符号）"
		} else {
			statusBarItem.command = "eraHarness.erabasic.revealSymbols"
			statusBarItem.text = "$(circle-slash) EraBasic: 补全已关闭"
			statusBarItem.tooltip = "eraHarness.erabasic.autoTakeover 已关闭：只保留内置方法数据，不提供补全/跳转/符号"
		}
		statusBarItem.show()
	}

	// 内化：从状态栏一键搜索工作区 ERB 符号并跳转（接管时用我们的索引，让位时用 erabasic 的）。
	context.subscriptions.push(
		vscode.commands.registerCommand("eraHarness.erabasic.yieldToSasami", () => yieldToSasami()),
		vscode.commands.registerCommand("eraHarness.erabasic.reclaimFiles", () => reclaimFiles()),
		vscode.commands.registerCommand("eraHarness.erabasic.revealSymbols", async () => {
			const query = await vscode.window.showInputBox({
				prompt: "搜索工作区 ERB 符号（@函数 / #DIM 变量），支持驼峰缩写模糊匹配",
				placeHolder: "例如 GETCHARA 或缩写 gch",
			})
			if (!query) {
				return
			}
			const symbols =
				(await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
					"vscode.executeWorkspaceSymbolProvider",
					query,
				)) ?? []
			const picked = await vscode.window.showQuickPick(
				symbols.map((s) => ({
					label: s.name,
					description: s.containerName,
					detail: vscode.workspace.asRelativePath(s.location.uri),
					symbol: s,
				})),
				{ placeHolder: `匹配到 ${symbols.length} 个 ERB 符号` },
			)
			if (!picked) {
				return
			}
			const doc = await vscode.workspace.openTextDocument(picked.symbol.location.uri)
			const editor = await vscode.window.showTextDocument(doc)
			editor.selection = new vscode.Selection(picked.symbol.location.range.start, picked.symbol.location.range.end)
			editor.revealRange(picked.symbol.location.range)
		}),
	)

	context.subscriptions.push(
		vscode.extensions.onDidChange(() => {
			void (async () => {
				// sasami 刚装上、而用户之前已选 sasami：把关联补上（用户意图的延续，不是自动接管）
				if (readOwner() === "sasami" && vscode.extensions.getExtension(ERABASIC_EXTENSION_ID) !== undefined) {
					await applyOwner("sasami")
				}
				evaluate()
			})()
		}),
	)
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(`${OWNER_SECTION}.${OWNER_KEY}`)) {
				// 用户改了「语言归属」：把设置落实到 files.associations
				void applyOwner(readOwner()).then(() => evaluate())
				return
			}
			if (e.affectsConfiguration(OWNER_SECTION)) {
				evaluate()
			}
		}),
	)
	context.subscriptions.push({ dispose: () => teardownProviders() })

	// 先自愈旧版留下的脏关联，再决定状态；两者都是异步写盘，不阻塞激活
	void healLegacyAssociations().catch(() => {
		/* 用户设置写不了（只读配置/远程工作区）不是致命错误，忽略 */
	})
	evaluate()
}

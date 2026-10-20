// EraBasic 语言支持整合入口（复刻 sasami/vscode-erabasic 的高亮/补全/跳转/符号能力）。
//
// 关键设计：TextMate grammar / languages / snippets 是 VS Code 静态贡献，激活后无法运行时卸载。
// 因此"装了 erabasic 就关闭我们的语法高亮"不能靠注销 grammar，只能靠**让 .erb/.erh 不绑定到我们的语言**：
//   - 本扩展贡献独立语言 id `era-erb`（不声明 extensions，自身不抢占任何文件）。
//   - 激活时检测 sasami.erabasic：
//       · 存在且启用 → 让位：撤销关联、注销 provider，.erb/.erh 继续用 erabasic 的 grammar。
//       · 不存在/被禁用 → 接管：经 files.associations 把 *.erb/*.erh 指向 era-erb，并注册 provider。

import type { ExtensionContext } from "vscode"
import * as vscode from "vscode"
import { BuiltinComplationItems } from "./completionData"
import { DeclarationProvider } from "./declarationProvider"
import { DefinitionRepository } from "./definitionProvider"
import { readSymbolInformations, SymbolInformationRepository } from "./symbolProvider"

const ERABASIC_EXTENSION_ID = "sasami.erabasic"
const LANGUAGE_ID = "era-erb"
const MANAGED_ASSOCIATIONS = ["*.erb", "*.erh"]

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

	async function syncAssociations(enable: boolean): Promise<void> {
		const cfg = vscode.workspace.getConfiguration("files")
		const assoc: Record<string, string | undefined> = { ...(cfg.get<Record<string, string>>("associations", {}) ?? {}) }
		let changed = false
		for (const key of MANAGED_ASSOCIATIONS) {
			if (enable) {
				// 仅在用户未自定义该扩展名时接管，绝不覆盖已有偏好。
				if (assoc[key] === undefined) {
					assoc[key] = LANGUAGE_ID
					changed = true
				}
			} else if (assoc[key] === LANGUAGE_ID) {
				// 只清除由本扩展写入的关联，保留用户自定义值。
				delete assoc[key]
				changed = true
			}
		}
		if (changed) {
			await cfg.update("associations", assoc, vscode.ConfigurationTarget.Global)
		}
	}

	function evaluate(): void {
		const present = vscode.extensions.getExtension(ERABASIC_EXTENSION_ID) !== undefined
		const autoTakeover = vscode.workspace.getConfiguration("eraHarness.erabasic").get<boolean>("autoTakeover", true)
		if (present) {
			teardownProviders()
			void syncAssociations(false)
			statusBarItem.text = "$(circle-slash) EraBasic: 让位 erabasic"
			statusBarItem.tooltip = "检测到 sasami.erabasic 已启用，era harness 不接管 .erb/.erh 语法高亮"
			statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
			statusBarItem.show()
		} else {
			if (autoTakeover) {
				void syncAssociations(true)
			}
			setupProviders()
			statusBarItem.text = "$(file-code) EraBasic: era harness"
			statusBarItem.tooltip = "未检测到 erabasic，era harness 提供 .erb/.erh 高亮/补全/跳转（点击搜索 ERB 符号）"
			statusBarItem.backgroundColor = undefined
			statusBarItem.show()
		}
	}

	// 内化：从状态栏一键搜索工作区 ERB 符号并跳转（接管时用我们的索引，让位时用 erabasic 的）。
	context.subscriptions.push(
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

	context.subscriptions.push(vscode.extensions.onDidChange(() => evaluate()))
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("eraHarness.erabasic")) {
				evaluate()
			}
		}),
	)
	context.subscriptions.push({ dispose: () => teardownProviders() })

	evaluate()
}

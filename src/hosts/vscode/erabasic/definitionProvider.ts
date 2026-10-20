// 跳转定义仓库：按 word 在当前文档 / 打开的脏文档 / 缓存的全局声明中查找定义位置。
// 移植自 sasami/vscode-erabasic (MIT License)，https://github.com/sasami/vscode-erabasic

import type { Location, Position, TextDocument, Uri } from "vscode"
import * as vscode from "vscode"
import type { DeclarationProvider } from "./declarationProvider"
import { type Declaration, readDeclarations } from "./declarations"

function declToDefinition(uri: Uri, decl: Declaration): Location {
	return new vscode.Location(uri, decl.nameRange)
}

class DefinitionInfo {
	constructor(
		public name: string,
		public location: Location,
	) {}
}

export class DefinitionRepository {
	private cache: Map<string, DefinitionInfo[]> = new Map()

	constructor(private provider: DeclarationProvider) {
		provider.onDidChange((e) => {
			this.cache.set(
				e.uri.fsPath,
				e.decls.filter((d) => d.isGlobal).map((d) => new DefinitionInfo(d.name, declToDefinition(e.uri, d))),
			)
		})
		provider.onDidDelete((e) => {
			this.cache.delete(e.uri.fsPath)
		})
		provider.onDidReset(() => {
			this.cache.clear()
		})
	}

	public sync(): Promise<void> {
		return this.provider.sync()
	}

	public *find(document: TextDocument, position: Position): IterableIterator<Location> {
		const word = this.getWord(document, position)
		if (word === undefined) {
			return
		}
		yield* this.findInCurrentDocument(document, position, word)
		const ws = vscode.workspace.getWorkspaceFolder(document.uri)
		if (ws === undefined) {
			return
		}
		const fresh: Set<string> = new Set([document.uri.fsPath])
		for (const doc of vscode.workspace.textDocuments) {
			if (!doc.isDirty) {
				continue
			}
			if (doc === document) {
				continue
			}
			if (!this.cache.has(doc.uri.fsPath)) {
				continue
			}
			if (!this.provider.reachable(ws, doc.uri.fsPath)) {
				continue
			}
			fresh.add(doc.uri.fsPath)
			yield* this.findInDocument(doc, word)
		}
		for (const [path, defs] of this.cache.entries()) {
			if (fresh.has(path)) {
				continue
			}
			if (!this.provider.reachable(ws, path)) {
				continue
			}
			yield* defs.filter((d) => d.name === word).map((d) => d.location)
		}
	}

	private getWord(document: TextDocument, position: Position): string | undefined {
		const range = document.getWordRangeAtPosition(position, /[^\s\x21-\x2f\x3a-\x40\x5b-\x5e\x7b-\x7e]+/)
		return range !== undefined ? document.getText(range) : undefined
	}

	private findInCurrentDocument(document: TextDocument, position: Position, word: string): Location[] {
		return readDeclarations(document.getText())
			.filter((d) => d.name === word && d.visible(position))
			.map((d) => declToDefinition(document.uri, d))
	}

	private findInDocument(document: TextDocument, word: string): Location[] {
		return readDeclarations(document.getText())
			.filter((d) => d.name === word && d.isGlobal)
			.map((d) => declToDefinition(document.uri, d))
	}
}

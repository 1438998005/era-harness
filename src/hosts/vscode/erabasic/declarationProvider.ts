// ERB 声明索引后端：监听 **/*.[Ee][Rr][BbHh] 变化，解析并缓存全局声明。
// 移植自 sasami/vscode-erabasic (MIT License)；此处把原 fs.readFile + iconv-lite 解码
// 换成 VS Code 原生 workspace.openTextDocument（编辑器内部按 files.encoding 处理 CP932/BOM/UTF-16）。

import type { Disposable, Event, ExtensionContext, Uri, WorkspaceFolder } from "vscode"
import * as vscode from "vscode"
import { EventEmitter } from "vscode"
import { type Declaration, readDeclarations } from "./declarations"

class BuiltinDeclarationFiles {
	private files: Uri[]

	constructor(context: ExtensionContext) {
		// 内置伪声明文件随扩展分发，供无工作区/跨工作区时也能跳转与补全内置方法。
		this.files = [
			vscode.Uri.joinPath(context.extensionUri, "assets", "erabasic", "exmeth.erb"),
			vscode.Uri.joinPath(context.extensionUri, "assets", "erabasic", "exvar.erh"),
		]
	}

	public has(path: string): boolean {
		return this.files.find((uri) => uri.fsPath === path) !== undefined
	}

	public uris(): Uri[] {
		return this.files
	}
}

export class DeclarationChangeEvent {
	constructor(
		public uri: Uri,
		public decls: Declaration[],
	) {}
}

export class DeclarationDeleteEvent {
	constructor(public uri: Uri) {}
}

export class DeclarationProvider implements Disposable {
	private fullscan = true

	private dirty: Map<string, Uri> = new Map()

	private syncing: Promise<void> | undefined

	private builtin: BuiltinDeclarationFiles

	private disposable: Disposable

	private onDidChangeEmitter: EventEmitter<DeclarationChangeEvent> = new EventEmitter()
	private onDidDeleteEmitter: EventEmitter<DeclarationDeleteEvent> = new EventEmitter()
	private onDidResetEmitter: EventEmitter<void> = new EventEmitter()

	constructor(context: ExtensionContext) {
		this.builtin = new BuiltinDeclarationFiles(context)

		const subscriptions: Disposable[] = []

		const watcher = vscode.workspace.createFileSystemWatcher("**/*.[Ee][Rr][BbHh]")
		watcher.onDidCreate(this.onDidChangeFile, this)
		watcher.onDidChange(this.onDidChangeFile, this)
		watcher.onDidDelete(this.onDidDeleteFile, this)
		subscriptions.push(watcher)

		vscode.workspace.onDidChangeConfiguration(this.onDidChangeWorkspace, this, subscriptions)
		vscode.workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspace, this, subscriptions)

		this.disposable = vscode.Disposable.from(...subscriptions)
	}

	get onDidChange(): Event<DeclarationChangeEvent> {
		return this.onDidChangeEmitter.event
	}

	get onDidDelete(): Event<DeclarationDeleteEvent> {
		return this.onDidDeleteEmitter.event
	}

	get onDidReset(): Event<void> {
		return this.onDidResetEmitter.event
	}

	public reachable(ws: WorkspaceFolder, path: string): boolean {
		return path.startsWith(ws.uri.fsPath) || this.builtin.has(path)
	}

	public sync(): Promise<void> {
		if (this.syncing === undefined) {
			this.syncing = this.flush().then(() => {
				this.syncing = undefined
			})
		}
		return this.syncing
	}

	public dispose() {
		this.disposable.dispose()
	}

	private onDidChangeFile(uri: Uri) {
		this.dirty.set(uri.fsPath, uri)
	}

	private onDidDeleteFile(uri: Uri) {
		this.dirty.delete(uri.fsPath)
		this.onDidDeleteEmitter.fire(new DeclarationDeleteEvent(uri))
	}

	private onDidChangeWorkspace() {
		this.fullscan = true
		this.dirty.clear()
		this.onDidResetEmitter.fire()
	}

	private async flush(): Promise<void> {
		if (this.fullscan) {
			this.fullscan = false
			for (const uri of this.builtin.uris()) {
				this.dirty.set(uri.fsPath, uri)
			}
			for (const uri of await vscode.workspace.findFiles("**/*.[Ee][Rr][BbHh]")) {
				this.dirty.set(uri.fsPath, uri)
			}
		}
		if (this.dirty.size === 0) {
			return
		}
		for (const [path, uri] of Array.from(this.dirty)) {
			let input: string | undefined
			try {
				const doc = await vscode.workspace.openTextDocument(uri)
				input = doc.getText()
			} catch {
				// 文件已删除或无法解码：视作删除，交还原有 onDidDelete 语义
				input = undefined
			}
			if (input === undefined) {
				this.dirty.delete(path)
				this.onDidDeleteEmitter.fire(new DeclarationDeleteEvent(uri))
				continue
			}
			if (this.dirty.delete(path)) {
				this.onDidChangeEmitter.fire(new DeclarationChangeEvent(uri, readDeclarations(input)))
			}
		}
	}
}

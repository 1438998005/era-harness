/**
 * `vscode` 模块的替身 —— 让 `src/hosts/vscode/updateGame.ts` 能在命令行里跑。
 *
 * 为什么需要它：插件里那个「更新 eraTW」按钮执行的正是 `updateGameCommand()`。
 * 想验证插件这条路（而不是绕过它写个脚本），就得把 `vscode` 这个模块喂给它。
 *
 * 覆盖范围 = `updateGame.ts` 真正用到的 API：
 *   window.showQuickPick / showWarningMessage / showInformationMessage /
 *   showErrorMessage / showOpenDialog / withProgress
 *   workspace.workspaceFolders
 *   ProgressLocation
 *
 * 其余成员给空实现，避免依赖链上别的东西在加载期炸掉。
 *
 * 控制面（`__` 开头，只有测试会用）：
 *   __reset()                  清空记录
 *   __setWorkspaceFolders([p]) 设定"打开的文件夹"
 *   __setResponder(fn)         决定每个弹窗怎么回答
 *   __calls()                  取出所有弹窗/进度记录
 */

const state = {
	calls: [],
	responder: null,
	folders: [],
}

function ask(call) {
	state.calls.push(call)
	if (!state.responder) {
		return undefined
	}
	return state.responder(call)
}

function noteProgress(message) {
	state.calls.push({ kind: "progress", message, items: [], detail: "", options: undefined })
}

function uriOf(fsPath) {
	return { fsPath, scheme: "file", path: fsPath, toString: () => `file://${fsPath}` }
}

const window = {
	async showQuickPick(items, options) {
		const list = Array.isArray(items) ? items : []
		const labels = list.map((item) => (typeof item === "string" ? item : item.label))
		const answer = ask({
			kind: "quickPick",
			message: options?.title ?? "",
			detail: options?.placeHolder ?? "",
			items: labels,
			options,
		})
		if (answer === undefined || answer === null) {
			return undefined
		}
		const wanted = Array.isArray(answer) ? answer : [answer]
		return list.filter((item) => wanted.includes(typeof item === "string" ? item : item.label))
	},

	async showWarningMessage(message, options, ...buttons) {
		return ask({
			kind: "warning",
			message,
			detail: options?.detail ?? "",
			items: buttons,
			options,
		})
	},

	async showInformationMessage(message, options, ...buttons) {
		return ask({
			kind: "information",
			message,
			detail: options?.detail ?? "",
			items: buttons,
			options,
		})
	},

	async showErrorMessage(message, options, ...buttons) {
		return ask({
			kind: "error",
			message,
			detail: options?.detail ?? "",
			items: buttons,
			options,
		})
	},

	async showOpenDialog(options) {
		const answer = ask({ kind: "open", message: options?.title ?? "", detail: "", items: [], options })
		if (!answer) {
			return undefined
		}
		return (Array.isArray(answer) ? answer : [answer]).map(uriOf)
	},

	async withProgress(options, task) {
		state.calls.push({
			kind: "progressStart",
			message: options?.title ?? "",
			detail: "",
			items: [],
			options,
		})
		const progress = {
			report(value) {
				if (value?.message) {
					noteProgress(value.message)
				}
			},
		}
		const token = {
			isCancellationRequested: false,
			onCancellationRequested() {
				return { dispose() {} }
			},
		}
		return task(progress, token)
	},

	createOutputChannel() {
		return { appendLine() {}, append() {}, show() {}, dispose() {} }
	},

	async showTextDocument() {
		return undefined
	},

	createStatusBarItem() {
		return { text: "", tooltip: "", command: undefined, show() {}, hide() {}, dispose() {} }
	},

	async showInputBox() {
		return undefined
	},
}

const workspace = {
	workspaceFolders: [],
	getConfiguration() {
		return {
			get() {
				return undefined
			},
			has() {
				return false
			},
			update() {
				return Promise.resolve()
			},
			inspect() {
				return undefined
			},
		}
	},
	onDidChangeConfiguration() {
		return { dispose() {} }
	},
	onDidSaveTextDocument() {
		return { dispose() {} }
	},
	onDidChangeWorkspaceFolders() {
		return { dispose() {} }
	},
	fs: {
		readFile: async () => new Uint8Array(),
		writeFile: async () => {},
		stat: async () => ({ type: 1, size: 0, mtime: 0 }),
	},
	asRelativePath: (value) => String(value),
}

const Uri = {
	file: uriOf,
	parse: (value) => uriOf(value),
	joinPath: (base, ...parts) => uriOf([base?.fsPath ?? "", ...parts].join("/")),
}

class EventEmitter {
	constructor() {
		this.listeners = []
		this.event = (listener) => {
			this.listeners.push(listener)
			return { dispose() {} }
		}
	}
	fire(value) {
		for (const listener of this.listeners) {
			listener(value)
		}
	}
	dispose() {
		this.listeners = []
	}
}

function noop() {
	return undefined
}

module.exports = {
	// ── 被真正用到的 ──
	window,
	workspace,
	Uri,
	ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
	EventEmitter,
	Disposable: class Disposable {
		constructor(fn) {
			this.dispose = fn ?? (() => {})
		}
		static from(...items) {
			return { dispose: () => items.forEach((item) => item?.dispose?.()) }
		}
	},
	CancellationTokenSource: class CancellationTokenSource {
		constructor() {
			this.token = {
				isCancellationRequested: false,
				onCancellationRequested: () => ({ dispose() {} }),
			}
		}
		cancel() {}
		dispose() {}
	},

	// ── 依赖链上可能出现、给空实现即可 ──
	commands: { registerCommand: () => ({ dispose() {} }), executeCommand: noop, getCommands: async () => [] },
	env: { openExternal: async () => true, clipboard: { writeText: async () => {}, readText: async () => "" }, appName: "stub" },
	languages: { registerCompletionItemProvider: () => ({ dispose() {} }) },
	extensions: { getExtension: noop, all: [] },
	ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
	ExtensionMode: { Production: 1, Development: 2, Test: 3 },
	ViewColumn: { One: 1, Two: 2, Active: -1 },
	StatusBarAlignment: { Left: 1, Right: 2 },
	ThemeColor: class ThemeColor {
		constructor(id) {
			this.id = id
		}
	},
	RelativePattern: class RelativePattern {
		constructor(base, pattern) {
			this.base = base
			this.pattern = pattern
		}
	},
	version: "1.84.0-stub",

	// ── 控制面 ──
	__reset() {
		state.calls = []
		state.responder = null
		state.folders = []
		workspace.workspaceFolders = []
	},
	__setWorkspaceFolders(paths) {
		state.folders = paths
		workspace.workspaceFolders = paths.map((p, index) => ({
			uri: uriOf(p),
			name: p,
			index,
		}))
	},
	__setResponder(fn) {
		state.responder = fn
	},
	__calls() {
		return state.calls
	},
}

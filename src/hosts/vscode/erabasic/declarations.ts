// ERB 声明解析：从 @function / #DIM / #DIMS / #DEFINE 提取符号及其作用域。
// 移植自 sasami/vscode-erabasic (MIT License)，https://github.com/sasami/vscode-erabasic
import { Position, Range, SymbolKind } from "vscode"

export class Declaration {
	constructor(
		public name: string,
		public kind: SymbolKind,
		public container: Declaration | undefined,
		public nameRange: Range,
		public bodyRange: Range,
	) {}

	get isGlobal(): boolean {
		return this.container === undefined
	}

	public visible(position: Position): boolean {
		return this.container === undefined || this.container.bodyRange.contains(position)
	}
}

function* iterlines(input: string): IterableIterator<[number, string]> {
	const lines = input.split(/\r?\n/)
	loop: for (let i = 0; i < lines.length; i++) {
		const text = lines[i]
		if (/^\s*(?:$|;(?![!#];))/.test(text)) {
			continue
		}
		if (/^\s*(?:;[!#];\s*)?\[SKIPSTART\]/.test(text)) {
			for (i++; i < lines.length; i++) {
				if (/^\s*(?:;[!#];\s*)?\[SKIPEND\]/.test(lines[i])) {
					continue loop
				}
			}
			break
		}
		yield [i, text]
	}
}

export function readDeclarations(input: string): Declaration[] {
	const symbols: Declaration[] = []
	let funcStart: Declaration | undefined
	let funcEndLine = 0
	let funcEndChar = 0
	for (const [line, text] of iterlines(input)) {
		{
			const match = /^\s*@([^\s\x21-\x2f\x3a-\x40\x5b-\x5e\x7b-\x7e]+)/.exec(text)
			if (match !== null) {
				if (funcStart !== undefined) {
					funcStart.bodyRange = funcStart.bodyRange.with({ end: new Position(funcEndLine, funcEndChar) })
				}
				funcStart = new Declaration(
					match[1],
					SymbolKind.Function,
					undefined,
					new Range(line, match[0].length - match[1].length, line, match[0].length),
					new Range(line, 0, line, text.length),
				)
				symbols.push(funcStart)
				continue
			}
			funcEndLine = line
			funcEndChar = text.length
		}
		{
			const match = /^\s*#(DIMS?(?:\s+[A-Z]+)*|DEFINE)\s+([^\s\x21-\x2f\x3a-\x40\x5b-\x5e\x7b-\x7e]+)/.exec(text)
			if (match !== null) {
				symbols.push(
					new Declaration(
						match[2],
						match[1].startsWith("DIM") ? SymbolKind.Variable : SymbolKind.Constant,
						funcStart,
						new Range(line, match[0].length - match[2].length, line, match[0].length),
						new Range(line, 0, line, text.length),
					),
				)
			}
		}
	}
	if (funcStart !== undefined) {
		funcStart.bodyRange = funcStart.bodyRange.with({ end: new Position(funcEndLine, funcEndChar) })
	}
	return symbols
}

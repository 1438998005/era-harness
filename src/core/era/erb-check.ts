import { analyzeErb, type BlockKind, type ErbStructure } from "@core/update/merge"

/**
 * ERB 结构体检。
 *
 * 复用 `core/update/merge.ts` 里已经在用的 `analyzeErb`（它处理 `;` 注释、字符串、
 * `#IF` 预处理块等），不重复造一份解析器。
 *
 * 只做「相对变坏」判断，不要求绝对平衡：上游原版本身就存在不配平的文件，
 * 拿绝对值卡会误伤。
 */

export function isErbLikePath(filePath: string): boolean {
	const lower = filePath.toLowerCase()
	return lower.endsWith(".erb") || lower.endsWith(".erh")
}

function blockKinds(structure: ErbStructure): BlockKind[] {
	return Object.keys(structure.blockDelta) as BlockKind[]
}

export function diffErbStructure(beforeText: string, afterText: string): string[] {
	const before = analyzeErb(beforeText)
	const after = analyzeErb(afterText)
	const issues: string[] = []

	for (const kind of blockKinds(after)) {
		const was = before.blockDelta[kind] ?? 0
		const now = after.blockDelta[kind] ?? 0
		if (was === 0 && now !== 0) {
			issues.push(`${kind} 块原本配平，现在${now > 0 ? `多出 ${now} 个开头` : `缺少 ${-now} 个结尾`}`)
		} else if (was !== 0 && Math.abs(now) > Math.abs(was)) {
			issues.push(`${kind} 块的不配平从 ${was} 扩大到 ${now}`)
		}
	}

	if (Math.abs(after.parenDelta) > Math.abs(before.parenDelta)) {
		issues.push(`半角括号不匹配加重（${before.parenDelta} → ${after.parenDelta}）`)
	}

	return issues
}

/** 把结构问题列表格式化成统一的警告段；没有问题时返回空串。 */
export function formatErbStructureWarning(issues: string[]): string {
	if (issues.length === 0) {
		return ""
	}

	return `[ERB 结构警告] 本次修改可能破坏了控制流结构：\n- ${issues.join("\n- ")}\n建议检查对应的 IF/ENDIF、FOR/NEXT、SELECTCASE/ENDSELECT、REPEAT/REND、DO/LOOP 是否配平。`
}

/** 把结构警告拼到工具结果后面；没有问题时原样返回。 */
export function appendErbStructureWarning(
	toolResult: string,
	beforeText: string | undefined,
	afterText: string | undefined,
): string {
	if (beforeText === undefined || afterText === undefined) {
		return toolResult
	}

	const warning = formatErbStructureWarning(diffErbStructure(beforeText, afterText))
	if (!warning) {
		return toolResult
	}

	return `${toolResult}\n\n${warning}`
}

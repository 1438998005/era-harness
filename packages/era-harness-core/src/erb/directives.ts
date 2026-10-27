/**
 * EraBasic 函数头容量指令（`#LOCALSIZE` / `#LOCALSSIZE` / `#LOCALFSIZE`）的扫描与丢失检测。
 *
 * 为什么单独做：这三条是**每个函数各自的局部变量元素数**，不是变量定义。
 * 每个函数各写一条属正常；模型很容易把跨函数重复出现的同一条当成「重复定义」去重。
 * 删掉不会立刻报错，但容量会静默变回 `VariableSize.csv` 的值（eratw 实测 `LOCAL` 200 /
 * `LOCALS` 100）：声明值比它大的函数会越界（引擎 Lv2 警告并停止运行），比它小的白白占内存。
 * 目标工程 `#LOCALSIZE` 10,970 处、`#LOCALSSIZE` 10,908 处 —— 这种量级的静默改动无法人工复核。
 *
 * 只做纯文本扫描：不解析表达式、不判断值是否合法；函数归属按「最近一个 @label」判定。
 * 这样即使 `#LOCALSIZE` 被写错位置（正是 `#行只能在函数声明后立刻使用` 警告的场景），
 * 也仍能归到它所在的那个函数，不会漏检。
 */

export type LocalSizeDirectiveName = '#LOCALSIZE' | '#LOCALSSIZE' | '#LOCALFSIZE';

export interface LocalSizeDirective {
	/** 所属函数标签（不含 `@`）；出现在任何 `@label` 之前时为 undefined */
	label?: string;
	/** 指令名，统一大写 */
	directive: LocalSizeDirectiveName;
	/** 原始值文本（可能为空或带行尾注释） */
	value: string;
	/** 1-based 行号，便于报错定位 */
	line: number;
}

const DIRECTIVE_RE = /^\s*#(LOCALSIZE|LOCALSSIZE|LOCALFSIZE)\b\s*(.*)$/i;
const LABEL_RE = /^\s*@([^\s(（:"]+)/;

function normalize(text: string): string[] {
	return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
}

/** 扫描全文里的容量指令，按最近一个 `@label` 归属。 */
export function scanLocalSizeDirectives(text: string): LocalSizeDirective[] {
	const result: LocalSizeDirective[] = [];
	let label: string | undefined;

	for (const [index, line] of normalize(text).entries()) {
		const labelMatch = LABEL_RE.exec(line);
		if (labelMatch) {
			label = labelMatch[1];
			continue;
		}
		const match = DIRECTIVE_RE.exec(line);
		if (!match) {
			continue;
		}
		const directive = `#${(match[1] ?? '').toUpperCase()}` as LocalSizeDirectiveName;
		result.push({
			label,
			directive,
			value: (match[2] ?? '').trim(),
			line: index + 1,
		});
	}
	return result;
}

function collectLabels(text: string): Set<string> {
	const labels = new Set<string>();
	for (const line of normalize(text)) {
		const match = LABEL_RE.exec(line);
		if (match?.[1]) {
			labels.add(match[1].toLowerCase());
		}
	}
	return labels;
}

function directiveKey(label: string, directive: LocalSizeDirectiveName): string {
	return `${label.toLowerCase()}\u0000${directive}`;
}

/**
 * 找出「函数还在、但容量指令没了」的项。
 *
 * - 整段函数被删不算：那是 `missing-label` 的职责，合并校验里另有更准确的报错；
 * - 只换位置不算：同一函数里把 `#LOCALSIZE` 从 `#DIM` 后面挪到 `@label` 正下方是**正确修法**；
 * - 值改了不算：缩容量应该改数值，不是删行。
 */
export function findLostLocalSizeDirectives(before: string, after: string): LocalSizeDirective[] {
	const beforeList = scanLocalSizeDirectives(before);
	if (beforeList.length === 0) {
		return [];
	}

	const afterList = scanLocalSizeDirectives(after);
	const afterKeys = new Set(
		afterList
			.filter((item): item is LocalSizeDirective & { label: string } => Boolean(item.label))
			.map((item) => directiveKey(item.label, item.directive)),
	);
	const afterLabels = collectLabels(after);

	const lost: LocalSizeDirective[] = [];
	const seen = new Set<string>();
	for (const item of beforeList) {
		if (!item.label) {
			continue;
		}
		// 整个函数被删：交给 missing-label，不在这里重复报
		if (!afterLabels.has(item.label.toLowerCase())) {
			continue;
		}
		const key = directiveKey(item.label, item.directive);
		if (afterKeys.has(key) || seen.has(key)) {
			continue;
		}
		seen.add(key);
		lost.push(item);
	}
	return lost;
}

/** 给写盘工具用的完整报错文本（模型能照着改）。 */
export function formatLostDirectivesError(relPath: string, lost: readonly LocalSizeDirective[]): string {
	const detail = lost.map((item) => `- @${item.label ?? "(文件头)"} ${item.directive} ${item.value}（原第 ${item.line} 行）`);
	return [
		`这次写入会删掉 ${lost.length} 条局部变量元素数声明（${relPath}）：`,
		...detail,
		"",
		"#LOCALSIZE / #LOCALSSIZE / #LOCALFSIZE 是每个函数各自的 LOCAL / LOCALS / LOCALF 数组长度，",
		"不是变量定义，也不是重复声明——每个函数各一条属正常。",
		"删掉不会报错，容量会静默变回 VariableSize.csv 的值（eratw 实测 LOCAL 200 / LOCALS 100）：",
		"声明值比它大的函数会真的越界，比它小的则会白白占内存——两种都是没人要的改动。",
		"请保留这些行（位置错了就把它们上移到 @函数名 之后），然后重试。",
	].join("\n");
}

/** 给合并校验用的紧凑列表，如 `@FOO #LOCALSIZE、@BAR #LOCALSSIZE`。 */
export function formatLostDirectivesList(lost: readonly LocalSizeDirective[]): string {
	return lost.map((item) => `@${item.label ?? "(文件头)"} ${item.directive}`).join("、");
}

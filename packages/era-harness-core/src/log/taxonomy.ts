import type { DiagnosticKind } from './types.js';

export interface Classification {
  kind: DiagnosticKind;
  identifier?: string;
  functionName?: string;
  argIndex?: number;
}

type Matcher = (message: string) => Classification | null;

const RULES: Array<{ kind: DiagnosticKind; match: Matcher }> = [
  {
    kind: 'unresolved-identifier',
    match: (msg) => {
      const m = /^无法解析的标识符"(.+)"$/.exec(msg);
      return m ? { kind: 'unresolved-identifier', identifier: m[1] } : null;
    },
  },
  {
    kind: 'variable-not-in-function',
    match: (msg) => {
      const m = /^变量"(.+)"未在此函数中定义/.exec(msg);
      return m ? { kind: 'variable-not-in-function', identifier: m[1] } : null;
    },
  },
  {
    kind: 'continue-outside-loop',
    match: (msg) => (/语法以外使用了"CONTINUE"/.test(msg) ? { kind: 'continue-outside-loop' } : null),
  },
  {
    kind: 'missing-next',
    match: (msg) => (/^缺少"FOR"对应的"NEXT"/.test(msg) ? { kind: 'missing-next' } : null),
  },
  {
    kind: 'callf-non-function',
    match: (msg) => {
      const m = /对未被标记为#FUNCTION的函数"(@?[^"]*)"/.exec(msg);
      return m ? { kind: 'callf-non-function', functionName: m[1] } : null;
    },
  },
  {
    kind: 'unparseable-line',
    match: (msg) => (/^无法解析的行$/.test(msg) ? { kind: 'unparseable-line' } : null),
  },
  {
    kind: 'hash-line-not-after-declaration',
    match: (msg) =>
      /^#行只能在函数声明后立刻使用/.test(msg) ? { kind: 'hash-line-not-after-declaration' } : null,
  },
  {
    kind: 'skipend-missing',
    match: (msg) => (/\[SKIPEND\]不存在/.test(msg) ? { kind: 'skipend-missing' } : null),
  },
  {
    kind: 'chara-array-too-many-args',
    match: (msg) => {
      const m = /角色一维数组变量"(.+)"的参数过多/.exec(msg);
      return m ? { kind: 'chara-array-too-many-args', identifier: m[1] } : null;
    },
  },
  {
    kind: 'unclosed-triple-quote',
    match: (msg) => (/没有闭合的"""/.test(msg) ? { kind: 'unclosed-triple-quote' } : null),
  },
  {
    kind: 'arg-type-mismatch',
    match: (msg) => {
      const m = /不能将"(@?[^"]*)"的第(\d+)个参数/.exec(msg);
      return m ? { kind: 'arg-type-mismatch', functionName: m[1], argIndex: Number(m[2]) } : null;
    },
  },
  {
    kind: 'unmatched-percent',
    match: (msg) => (/发现没有对应'%'的'%'/.test(msg) ? { kind: 'unmatched-percent' } : null),
  },
  {
    kind: 'text-after-command',
    match: (msg) => (/以命令开始的行在命令后有/.test(msg) ? { kind: 'text-after-command' } : null),
  },
];

/** 把引擎消息文本分类为结构化诊断类型，并抽取标识符/函数名/参数序号。 */
export function classify(message: string): Classification {
  for (const rule of RULES) {
    const hit = rule.match(message);
    if (hit) return hit;
  }
  return { kind: 'other' };
}

export interface DiagnosticSummary {
  total: number;
  byKind: Record<string, number>;
  bySeverity: Record<string, number>;
  /** 按出现次数降序的标识符排行（AI 闭环优先处理高频项） */
  byIdentifier: Array<{ identifier: string; count: number }>;
}

export function summarizeDiagnostics(
  diagnostics: Array<{ kind: string; severity: number; identifier?: string }>,
): DiagnosticSummary {
  const byKind: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const identifierCount = new Map<string, number>();
  for (const d of diagnostics) {
    byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
    bySeverity[String(d.severity)] = (bySeverity[String(d.severity)] ?? 0) + 1;
    if (d.identifier !== undefined) {
      identifierCount.set(d.identifier, (identifierCount.get(d.identifier) ?? 0) + 1);
    }
  }
  const byIdentifier = [...identifierCount.entries()]
    .map(([identifier, count]) => ({ identifier, count }))
    .sort((a, b) => b.count - a.count);
  return { total: diagnostics.length, byKind, bySeverity, byIdentifier };
}

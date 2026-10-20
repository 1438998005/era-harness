export type DiagnosticKind =
  | 'unresolved-identifier'
  | 'variable-not-in-function'
  | 'continue-outside-loop'
  | 'missing-next'
  | 'callf-non-function'
  | 'unparseable-line'
  | 'hash-line-not-after-declaration'
  | 'skipend-missing'
  | 'chara-array-too-many-args'
  | 'unclosed-triple-quote'
  | 'arg-type-mismatch'
  | 'unmatched-percent'
  | 'text-after-command'
  | 'fatal-unexpected-error'
  | 'other';

/** 引擎警告等级（来自 `警告LvN`），N 越小越严重；0 一般为提示级。 */
export type Severity = 0 | 1 | 2 | 3 | 4;

export interface Diagnostic {
  kind: DiagnosticKind;
  severity: Severity;
  /** 相对路径（保留引擎输出的反斜杠形式） */
  file: string;
  /** 行号，1 基；引擎可能输出第 0 行（如 [SKIPEND] 类） */
  line: number;
  /** 引擎原始消息文本（去掉位置前缀） */
  message: string;
  /** 从消息中抽取的标识符 / 变量名 / 数组名 */
  identifier?: string;
  /** 从消息中抽取的函数名（含 @ 前缀） */
  functionName?: string;
  /** 从消息中抽取的参数序号（1 基） */
  argIndex?: number;
  /** 诊断行之后跟随的源码片段（原样保留，可能多行） */
  sourceLines: string[];
  /** 原始诊断行 */
  raw: string;
}

export interface FatalError {
  /** 发生致命错误时报告的引擎版本串 */
  engine: string;
  /** 异常类全名，如 MinorShift.Emuera.Runtime.Utils.CodeEE */
  exceptionClass: string;
  /** 异常消息 */
  exceptionMessage: string;
  /** 其余说明行（停止通知、兼容性提示等） */
  detailLines: string[];
}

export interface SessionInfo {
  lazyIndexCount?: number;
  lazyIndexRegenerated?: boolean;
  lazyIndexUpdated?: boolean;
  modifiedFileCount?: number;
  unmodifiedFileCount?: number;
  loadSeconds?: number;
  dictLoadMs?: number;
}

export interface EngineInfo {
  flavor: 'skia' | 'unknown';
  raw: string;
  /** 引擎基线版本，如 1824 */
  base?: string;
  /** 运行时版本，如 v24 */
  runtime?: string;
  /** EM 扩展版本，如 v18 */
  em?: string;
  /** EE 扩展版本，如 v56 */
  ee?: string;
  /** Skia 版本，如 v16 / v10.1 */
  skia?: string;
}

export interface VariantInfo {
  name: string;
  version: string;
}

export interface LogSession {
  engine: EngineInfo | null;
  variant: VariantInfo | null;
  diagnostics: Diagnostic[];
  fatalError: FatalError | null;
  session: SessionInfo;
  /** 引擎固定说明行（报错指导、插件提示等） */
  headerNotes: string[];
  /** 其余非诊断正文（游戏输出等） */
  outputLines: string[];
}

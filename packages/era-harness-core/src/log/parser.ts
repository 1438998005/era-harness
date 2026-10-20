import type { Diagnostic, FatalError, LogSession, SessionInfo, VariantInfo } from './types.js';
import { parseEngineInfo } from './engine.js';
import { classify } from './taxonomy.js';

const DIAG_RE = /^警告Lv(\d+):(.+):第(\d+)行:(.*)$/;
const FATAL_RE = /^发生了预期以外的错误:(.*)$/;
const EXCEPTION_RE = /^([A-Za-z_][\w.]*):(.*)$/;
const STOP_NOTICE_RE = /Emuera停止运行/;

const ENGINE_HEADER = '# 环境信息';
const VARIANT_HEADER = '# 变体';
const LOG_HEADER = '# 日志';

const LAZY_COUNT_RE = /^已记录\s*(\d+)\s*个文件到懒加载索引表中/;
const LAZY_MISSING_RE = /未找到懒加载索引表文件/;
const LAZY_UPDATED_RE = /^已更新\s*LazyLoading\s*索引表/;
const MODIFIED_RE = /^已修改的文件：(\d+)/;
const UNMODIFIED_RE = /^未修改的文件：(\d+)/;
const LOAD_TIME_RE = /^文件读取完成。耗时：([\d.]+)\s*秒/;
const DICT_TIME_RE = /^字典加载完毕\s*用时(\d+)毫秒/;
const HEADER_NOTE_RE = /^(如果出现了错误|注意：外部插件功能已启用)/;
const VARIANT_RE = /^(.*\S)\s+([\d.]+)\s*$/;

export function parseLog(text: string): LogSession {
  // 实测日志文件带 UTF-8 BOM，会破坏首行头部匹配
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const session: LogSession = {
    engine: null,
    variant: null,
    diagnostics: [],
    fatalError: null,
    session: {},
    headerNotes: [],
    outputLines: [],
  };

  const engineIdx = lines.indexOf(ENGINE_HEADER);
  if (engineIdx >= 0) {
    const engineLine = nextNonEmpty(lines, engineIdx + 1);
    if (engineLine !== null) session.engine = parseEngineInfo(engineLine);
  }

  const variantIdx = lines.indexOf(VARIANT_HEADER);
  if (variantIdx >= 0) {
    const variantLine = nextNonEmpty(lines, variantIdx + 1);
    if (variantLine !== null) {
      const m = VARIANT_RE.exec(variantLine);
      if (m) session.variant = { name: m[1] ?? '', version: m[2] ?? '' };
    }
  }

  const logIdx = lines.indexOf(LOG_HEADER);
  let i = logIdx >= 0 ? logIdx + 1 : Math.max(engineIdx, variantIdx, -1) + 1;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;

    const diagMatch = DIAG_RE.exec(line);
    if (diagMatch) {
      const severity = Number(diagMatch[1]) as 0 | 1 | 2 | 3 | 4;
      const cls = classify(diagMatch[4] ?? '');
      const snippet: string[] = [];
      let j = i + 1;
      while (j < lines.length && !isSnippetBoundary(lines[j] ?? '')) {
        snippet.push(lines[j] as string);
        j++;
      }
      const diag: Diagnostic = {
        kind: cls.kind,
        severity,
        file: diagMatch[2] ?? '',
        line: Number(diagMatch[3]),
        message: diagMatch[4] ?? '',
        sourceLines: snippet,
        raw: line,
      };
      if (cls.identifier !== undefined) diag.identifier = cls.identifier;
      if (cls.functionName !== undefined) diag.functionName = cls.functionName;
      if (cls.argIndex !== undefined) diag.argIndex = cls.argIndex;
      session.diagnostics.push(diag);
      i = j;
      continue;
    }

    const fatalMatch = FATAL_RE.exec(line);
    if (fatalMatch) {
      const detail: string[] = [];
      let exceptionClass: string | undefined;
      let exceptionMessage: string | undefined;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j] ?? '';
        if (exceptionClass === undefined && !STOP_NOTICE_RE.test(l)) {
          const em = EXCEPTION_RE.exec(l);
          if (em) {
            exceptionClass = em[1];
            exceptionMessage = em[2];
            continue;
          }
        }
        detail.push(l);
      }
      const fatal: FatalError = {
        engine: fatalMatch[1] ?? '',
        exceptionClass: exceptionClass ?? '',
        exceptionMessage: exceptionMessage ?? '',
        detailLines: detail,
      };
      session.fatalError = fatal;
      i = j;
      continue;
    }

    let m: RegExpExecArray | null;
    if ((m = LAZY_COUNT_RE.exec(line))) session.session.lazyIndexCount = Number(m[1]);
    else if (LAZY_MISSING_RE.test(line)) session.session.lazyIndexRegenerated = true;
    else if (LAZY_UPDATED_RE.test(line)) session.session.lazyIndexUpdated = true;
    else if ((m = MODIFIED_RE.exec(line))) session.session.modifiedFileCount = Number(m[1]);
    else if ((m = UNMODIFIED_RE.exec(line))) session.session.unmodifiedFileCount = Number(m[1]);
    else if ((m = LOAD_TIME_RE.exec(line))) session.session.loadSeconds = Number(m[1]);
    else if ((m = DICT_TIME_RE.exec(line))) session.session.dictLoadMs = Number(m[1]);
    else if (HEADER_NOTE_RE.test(line)) session.headerNotes.push(line);
    else if (line.trim() !== '') session.outputLines.push(line);

    i++;
  }

  return session;
}

function isSnippetBoundary(line: string): boolean {
  if (line.trim() === '') return true;
  if (DIAG_RE.test(line)) return true;
  if (FATAL_RE.test(line)) return true;
  return (
    LAZY_COUNT_RE.test(line) ||
    LAZY_MISSING_RE.test(line) ||
    LAZY_UPDATED_RE.test(line) ||
    MODIFIED_RE.test(line) ||
    UNMODIFIED_RE.test(line) ||
    LOAD_TIME_RE.test(line) ||
    DICT_TIME_RE.test(line) ||
    STOP_NOTICE_RE.test(line) ||
    line.startsWith('※')
  );
}

function nextNonEmpty(lines: string[], from: number): string | null {
  for (let k = from; k < lines.length; k++) {
    const l = lines[k];
    if (l !== undefined && l.trim() !== '') return l;
  }
  return null;
}

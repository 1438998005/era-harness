import path from 'node:path';
import { detectEncoding } from '../profile/scan.js';
import { detectBom } from './encoding.js';
import type { EncodingKind } from '../profile/types.js';
import type { BomKind } from './types.js';

/**
 * 写回侧判据（纯函数，零 IO、零运行时依赖）。
 *
 * 判据正本＝内嵌知识条目 `interpreter-encoding-discipline`，集群上游＝shared-trae
 * `knowledge/lazyloading/encoding-discipline.md`。三条直接相关的铁律：
 * - enc-02 既有文件保持原编码、原 BOM、原行尾，不做编码互转；新建 .ERB/.ERH 一律 UTF-8 带 BOM
 * - enc-03 写后复检 BOM 有无与行尾是否与改前一致
 * - enc-08 CSV 一律带 BOM 的 UTF-8
 *
 * 分工：本模块只回答「该写成什么样」与「写完对不对」。真正把字符串变成 CP932 字节
 * 需要 iconv-lite（核心库保持零运行时依赖，⛔ 不引入），那一步在宿主侧执行。
 */

/** 行尾形态。'none'＝全文无换行；'mixed'＝CRLF 与孤立 LF/CR 混用。 */
export type EolKind = 'none' | 'lf' | 'crlf' | 'cr' | 'mixed';

/** 落盘时可选的行尾——写回必须二选一，不存在「保持混合」这一档。 */
export type WriteEol = 'lf' | 'crlf';

/** 落盘编码。UTF-16 不在可写集合里：引擎虽能读，但工具链不兼容，写回时降级 UTF-8。 */
export type WriteEncoding = 'utf8' | 'cp932';

/** 脚本扩展名（enc-02：一律 UTF-8 带 BOM） */
const SCRIPT_EXTS = new Set(['.erb', '.erh']);
/** 数据扩展名（enc-08：CSV 一律带 BOM 的 UTF-8） */
const DATA_EXTS = new Set(['.csv']);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export interface EolCounts {
  /** CRLF 对数 */
  crlf: number;
  /** 前面不是 CR 的 LF */
  lfOnly: number;
  /** 后面不是 LF 的 CR */
  crOnly: number;
}

export interface FileEncodingFacts {
  /** detectEncoding 的粗分类 */
  encoding: EncodingKind;
  /** BOM 字节序事实（UTF-16 在系统里归 unknown，靠这个字段区分 LE/BE） */
  bom: BomKind;
  eol: EolKind;
  /** 行尾计数，原文混用时据此按多数派归一 */
  eolCounts: EolCounts;
  byteLength: number;
  endsWithNewline: boolean;
}

/** 目标落盘形态。 */
export interface WriteTarget {
  encoding: WriteEncoding;
  bom: 'none' | 'utf8';
  eol: WriteEol;
}

/** 新建文件时从同目录兄弟文件采来的现状（采样在宿主侧，本模块只接受结论）。 */
export interface NewFileHints {
  /** 同目录同扩展名兄弟文件带 BOM 的比例（0..1）；null＝没有可参照的兄弟文件 */
  siblingBomRatio: number | null;
  /** 兄弟文件的行尾主流；null＝没有样本 */
  siblingEol: WriteEol | null;
}

export interface WritePlan {
  target: WriteTarget;
  /** 既有文件被换了落盘编码——enc-02 明令禁止，出现必须让人看见（reason 说明为什么） */
  encodingConverted: boolean;
  /** BOM 有无与改前不一致 */
  bomChanged: boolean;
  /** 行尾与改前不一致（含「原文混用，已按多数派归一」） */
  eolChanged: boolean;
  /** 判据说明，直接进工具结果给模型看 */
  reason: string;
}

/** 统计行尾。0x0A/0x0D 在 UTF-8 与 CP932 里都不会出现在多字节字符内部，字节级扫描安全。 */
export function countEol(buffer: Buffer): EolCounts {
  let crlf = 0;
  let lfOnly = 0;
  let crOnly = 0;
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b === 0x0a) {
      if (i > 0 && buffer[i - 1] === 0x0d) crlf++;
      else lfOnly++;
    } else if (b === 0x0d) {
      if (i + 1 >= buffer.length || buffer[i + 1] !== 0x0a) crOnly++;
    }
  }
  return { crlf, lfOnly, crOnly };
}

export function detectEol(buffer: Buffer): EolKind {
  const { crlf, lfOnly, crOnly } = countEol(buffer);
  if (crlf === 0 && lfOnly === 0 && crOnly === 0) return 'none';
  if (crlf > 0 && lfOnly === 0 && crOnly === 0) return 'crlf';
  if (lfOnly > 0 && crlf === 0 && crOnly === 0) return 'lf';
  if (crOnly > 0 && crlf === 0 && lfOnly === 0) return 'cr';
  return 'mixed';
}

/** 数 UTF-8 BOM 出现次数（Edit 工具累积会写出多个 BOM，引擎只读第一个，其后变正文）。 */
export function countBom(buffer: Buffer): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = buffer.indexOf(UTF8_BOM, from);
    if (at < 0) return count;
    count++;
    from = at + UTF8_BOM.length;
  }
}

/** 归一化行尾：先把 CRLF/孤立 CR 折成 LF，再按目标展开。 */
export function applyEol(text: string, eol: WriteEol): string {
  const lf = text.replace(/\r\n|\r/g, '\n');
  return eol === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf;
}

export function inspectFileBytes(buffer: Buffer): FileEncodingFacts {
  const eolCounts = countEol(buffer);
  return {
    encoding: detectEncoding(buffer),
    bom: detectBom(buffer),
    eol: detectEol(buffer),
    eolCounts,
    byteLength: buffer.length,
    endsWithNewline:
      buffer.length > 0 && (buffer[buffer.length - 1] === 0x0a || buffer[buffer.length - 1] === 0x0d),
  };
}

/** 纯 ASCII 缓冲区在 UTF-8 与 CP932 下字节完全相同，据此免掉一批假阳性。 */
function isAscii(buffer: Buffer): boolean {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i]! >= 0x80) return false;
  }
  return true;
}

function hasBomFact(facts: FileEncodingFacts): boolean {
  return facts.bom === 'utf8';
}

/** 严格校验 UTF-8 主体（BOM 之后的部分）：一个非法字节即判负，与引擎口径一致。 */
function strictUtf8Body(buffer: Buffer): boolean {
  const body = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? buffer.subarray(3) : buffer;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(body);
    return true;
  } catch {
    return false;
  }
}

function defaultEolFor(ext: string): WriteEol {
  // 集群口径（tools/check_encoding.py）：ERB/ERH/CSV 一律 CRLF；其它类型跟随现代默认 LF。
  return SCRIPT_EXTS.has(ext) || DATA_EXTS.has(ext) ? 'crlf' : 'lf';
}

/** 原文行尾混用时按多数派归一；孤立 CR 视作 LF（CR 单用是古早 Mac 形态，工具链不认）。 */
function majorityEol(facts: FileEncodingFacts, ext: string): { eol: WriteEol; normalized: boolean } {
  switch (facts.eol) {
    case 'crlf':
      return { eol: 'crlf', normalized: false };
    case 'lf':
      return { eol: 'lf', normalized: false };
    case 'cr':
      return { eol: 'lf', normalized: true };
    case 'mixed': {
      const { crlf, lfOnly, crOnly } = facts.eolCounts;
      return { eol: crlf >= lfOnly + crOnly ? 'crlf' : 'lf', normalized: true };
    }
    case 'none':
      // 单行文件：没有可保的行尾，按类型默认，不算「改了」
      return { eol: defaultEolFor(ext), normalized: false };
  }
}

/**
 * 既有文件的写回目标：原编码、原 BOM、原行尾，一个都不动。
 * 唯一例外是 UTF-16（encoding==='unknown'）：不在可写集合，降级 UTF-8 并显式声明。
 */
function planForExisting(before: FileEncodingFacts, ext: string): WritePlan {
  const { eol, normalized } = majorityEol(before, ext);
  const notes: string[] = [];

  let encoding: WriteEncoding = 'utf8';
  let encodingConverted = false;
  if (before.encoding === 'cp932') {
    encoding = 'cp932';
  } else if (before.encoding === 'unknown') {
    // UTF-16 不在可写集合：降级 UTF-8 属于「不得不换编码」，必须显式声明
    encodingConverted = true;
    notes.push('原文是 UTF-16 等不推荐编码，写回降级为 UTF-8（引擎虽能读，但工具链不兼容）');
  }

  const bom: 'none' | 'utf8' = hasBomFact(before) ? 'utf8' : 'none';

  if (encoding === 'cp932') notes.push('按原编码 CP932 写回（⛔ 不转 UTF-8）');
  else if (bom === 'utf8') notes.push(`按原编码 UTF-8 带 BOM 写回`);
  else notes.push(`按原编码 UTF-8 无 BOM 写回`);

  if (normalized) {
    notes.push(
      before.eol === 'cr'
        ? '原文行尾是孤立 CR，已归一为 LF'
        : `原文行尾混用（CRLF ${before.eolCounts.crlf}／LF ${before.eolCounts.lfOnly}／CR ${before.eolCounts.crOnly}），已按多数派归一为 ${eol.toUpperCase()}`,
    );
  }

  return {
    target: { encoding, bom, eol },
    encodingConverted,
    bomChanged: false,
    eolChanged: normalized,
    reason: notes.join('；'),
  };
}

/** 新建文件：脚本与 CSV 按纪律一律带 BOM；其它类型跟随兄弟文件现状。 */
function planForNew(ext: string, hints: NewFileHints): WritePlan {
  const isScript = SCRIPT_EXTS.has(ext);
  const isData = DATA_EXTS.has(ext);
  const notes: string[] = [];

  let bom: 'none' | 'utf8';
  if (isScript || isData) {
    bom = 'utf8';
    notes.push(isScript ? '新建 .ERB/.ERH 一律 UTF-8 带 BOM（Emuera 靠 BOM 判编码）' : '新建 CSV 一律带 BOM 的 UTF-8（可绕开引擎按 CP932 回显源行的缺陷）');
    if (hints.siblingBomRatio !== null && hints.siblingBomRatio < 0.5) {
      notes.push('注意：同目录兄弟文件多数不带 BOM，本次按纪律仍带 BOM');
    }
  } else if (hints.siblingBomRatio !== null) {
    bom = hints.siblingBomRatio >= 0.5 ? 'utf8' : 'none';
    notes.push(`按同目录兄弟文件现状决定 BOM（带 BOM 比例 ${Math.round(hints.siblingBomRatio * 100)}%）`);
  } else {
    bom = 'none';
    notes.push('无同类兄弟文件可参照，按 UTF-8 无 BOM 新建');
  }

  const eol = hints.siblingEol ?? defaultEolFor(ext);
  notes.push(hints.siblingEol ? `行尾跟随同目录兄弟文件（${eol.toUpperCase()}）` : `无行尾样本，按类型默认 ${eol.toUpperCase()}`);

  return {
    target: { encoding: 'utf8', bom, eol },
    encodingConverted: false,
    bomChanged: false,
    eolChanged: false,
    reason: notes.join('；'),
  };
}

/**
 * 决定「这次该写成什么样」。
 * @param before 改前的文件事实；null＝新建文件
 */
export function planSafeWrite(
  before: FileEncodingFacts | null,
  filePath: string,
  hints: NewFileHints = { siblingBomRatio: null, siblingEol: null },
): WritePlan {
  const ext = path.extname(filePath).toLowerCase();
  return before ? planForExisting(before, ext) : planForNew(ext, hints);
}

/** 当前磁盘形态是否已经符合目标（用于跳过无谓的二次写盘）。 */
export function writeTargetMatches(facts: FileEncodingFacts, target: WriteTarget): boolean {
  const encOk =
    target.encoding === 'cp932'
      ? facts.encoding === 'cp932'
      : facts.encoding === 'utf8' || facts.encoding === 'utf8Bom';
  const bomOk = hasBomFact(facts) === (target.bom === 'utf8');
  // 'none'＝单行文件，没有行尾可谈，视为符合
  const eolOk = facts.eol === 'none' || facts.eol === target.eol;
  return encOk && bomOk && eolOk;
}

export type WriteIssueCode =
  | 'bom-missing'
  | 'bom-unexpected'
  | 'bom-multiple'
  | 'eol-changed'
  | 'eol-mixed'
  | 'encoding-converted'
  | 'utf8-broken'
  | 'trailing-newline-lost';

export interface WriteIssue {
  code: WriteIssueCode;
  message: string;
}

export interface WriteVerification {
  ok: boolean;
  issues: WriteIssue[];
  facts: FileEncodingFacts;
}

/** 写后复检（enc-03）：BOM 数量、行尾、编码是否漂移、还能不能被 UTF-8 严格解出。 */
export function verifyWrite(before: FileEncodingFacts | null, target: WriteTarget, after: Buffer): WriteVerification {
  const facts = inspectFileBytes(after);
  const issues: WriteIssue[] = [];

  // 纯 ASCII 在两种编码下字节相同，此时「编码变了」是无害的假阳性
  let convertedIssue: WriteIssue | null = null;
  if (before && !isAscii(after) && (before.encoding === 'cp932') !== (facts.encoding === 'cp932')) {
    convertedIssue = {
      code: 'encoding-converted',
      message:
        before.encoding === 'cp932'
          ? '原文件是 CP932，落盘后变成 UTF-8（既有文件禁止编码互转）'
          : '原文件是 UTF-8，落盘后变成 CP932（既有文件禁止编码互转）',
    };
  }

  const bomCount = countBom(after);
  const expectedBom = target.bom === 'utf8' ? 1 : 0;
  if (bomCount > 1) {
    issues.push({
      code: 'bom-multiple',
      message: `文件里有 ${bomCount} 个 UTF-8 BOM（引擎只读第一个，其余会变成首行正文）`,
    });
  } else if (!convertedIssue) {
    // 编码已被转换时，BOM 的有无是转换的连带结果，不再单独报一次
    if (bomCount === 0 && expectedBom === 1) {
      issues.push({ code: 'bom-missing', message: '应有 UTF-8 BOM，落盘后没有' });
    } else if (bomCount === 1 && expectedBom === 0) {
      issues.push({ code: 'bom-unexpected', message: '原文件无 BOM，落盘后多出一个' });
    }
  }

  if (facts.eol === 'mixed') {
    issues.push({
      code: 'eol-mixed',
      message: `行尾混用（CRLF ${facts.eolCounts.crlf}／LF ${facts.eolCounts.lfOnly}／CR ${facts.eolCounts.crOnly}）`,
    });
  } else if (before && facts.eol !== 'none' && facts.eol !== target.eol) {
    issues.push({ code: 'eol-changed', message: `行尾应为 ${target.eol.toUpperCase()}，落盘后是 ${facts.eol.toUpperCase()}` });
  }

  if (convertedIssue) {
    issues.push(convertedIssue);
  }

  // detectEncoding 见 BOM 就直判 utf8Bom，不会去验主体 ⇒ 这里必须自己严格解一遍主体
  if (target.encoding === 'utf8' && !strictUtf8Body(after)) {
    issues.push({
      code: 'utf8-broken',
      message: '落盘字节不是合法 UTF-8，引擎会响亮报「文字コード異常」并中止加载该文件',
    });
  }

  if (before?.endsWithNewline && !facts.endsWithNewline) {
    issues.push({ code: 'trailing-newline-lost', message: '原文以换行结尾，落盘后末尾换行丢失' });
  }

  return { ok: issues.length === 0, issues, facts };
}

/** 目标形态的人话描述，用于工具结果里说明「我按什么规格写的」。 */
export function formatWriteTarget(target: WriteTarget): string {
  const enc = target.encoding === 'cp932' ? 'CP932' : 'UTF-8';
  const bom = target.bom === 'utf8' ? '带 BOM' : '无 BOM';
  return `${enc} / ${bom} / ${target.eol.toUpperCase()}`;
}

/** 复检结论的人话段落；没问题时返回空串，不要给模型制造噪音。 */
export function formatWriteVerification(verification: WriteVerification): string {
  if (verification.issues.length === 0) return '';
  const lines = verification.issues.map((i) => `- ${i.message}`);
  return `[编码写回校验] 落盘结果与判据不一致，请检查：\n${lines.join('\n')}`;
}

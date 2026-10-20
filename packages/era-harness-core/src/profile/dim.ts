import type { DimConstant, DimInfo } from './types.js';

const DIM_LINE_RE = /^#DIMS?\s+(.*)$/;
const CONST_BODY_RE = /^CONST\s+(\S+)\s*(?:=\s*(.*))?$/;

/** 解析 DIM.ERH：统计 #DIM/#DIMS 行数，抽取 #DIM CONST 常量。 */
export function parseDimFile(text: string, file: string): DimInfo {
  const constants: DimConstant[] = [];
  let dimCount = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = DIM_LINE_RE.exec(line);
    if (!m) continue;
    dimCount++;
    const body = m[1] ?? '';
    if (!/^CONST\b/.test(body)) continue;
    const cm = CONST_BODY_RE.exec(body);
    if (!cm) continue;
    const c: DimConstant = { name: cm[1] ?? '' };
    const value = (cm[2] ?? '').trim();
    if (value !== '') c.value = value;
    constants.push(c);
  }
  return { file, constants, dimCount };
}

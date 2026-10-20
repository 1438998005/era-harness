import type { AlsEntry } from './types.js';

/** 解析 .als/.csv 枚举文件：`ID,名称` 行，`;`/`#` 为注释，名称按首个逗号后全部保留。 */
export function parseAlsEntries(text: string): AlsEntry[] {
  const out: AlsEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) continue;
    const comma = line.indexOf(',');
    if (comma < 0) continue;
    const idRaw = line.slice(0, comma).trim();
    const name = line.slice(comma + 1).trim();
    if (name === '') continue;
    out.push({ id: /^\d+$/.test(idRaw) ? Number(idRaw) : null, name });
  }
  return out;
}

/**
 * 解析枚举 .csv：按逗号分列，只取前两列（ID, 名称）。
 * era 的 .csv 可能是多列数据文件（如 Item.csv 第三列起是价格），名称必须取第二列。
 */
export function parseCsvEntries(text: string): AlsEntry[] {
  const out: AlsEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) continue;
    const fields = line.split(',');
    if (fields.length < 2) continue;
    const idRaw = (fields[0] ?? '').trim();
    const name = (fields[1] ?? '').trim();
    if (name === '') continue;
    out.push({ id: /^\d+$/.test(idRaw) ? Number(idRaw) : null, name });
  }
  return out;
}

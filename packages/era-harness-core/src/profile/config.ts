import type { EmueraConfig } from './types.js';

/** 解析 emuera.config（`KEY:VALUE` 行，`;`/`#` 注释，忽略空行）。 */
export function parseEmueraConfig(text: string): EmueraConfig {
  const entries: Array<{ key: string; value: string }> = [];
  const lookup: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === '') continue;
    entries.push({ key, value });
    lookup[key.toUpperCase()] = value;
  }
  return { entries, lookup };
}

export function configGet(config: EmueraConfig | null, key: string): string | undefined {
  return config ? config.lookup[key.toUpperCase()] : undefined;
}

export function configGetBoolean(config: EmueraConfig | null, key: string): boolean | undefined {
  const v = configGet(config, key);
  if (v === undefined) return undefined;
  const u = v.toUpperCase();
  if (u === 'YES') return true;
  if (u === 'NO') return false;
  return undefined;
}

export function configGetNumber(config: EmueraConfig | null, key: string): number | undefined {
  const v = configGet(config, key);
  if (v === undefined || v === '' || !/^-?[\d.]+$/.test(v)) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

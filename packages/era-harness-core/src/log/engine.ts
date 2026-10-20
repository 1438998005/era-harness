import type { EngineInfo } from './types.js';

const ENGINE_RE = /^Emuera\.NET\s+SkiaSharp\s+(\d+)\+v(\d+)\+EMv(\d+)\+EEv(\d+)\+Skiav([\d.]+)/;

/** 解析 `Emuera.NET SkiaSharp 1824+v24+EMv18+EEv56+Skiav16` 形式的引擎版本行。 */
export function parseEngineInfo(raw: string): EngineInfo | null {
  const line = raw.trim();
  if (!line.startsWith('Emuera')) return null;
  const m = ENGINE_RE.exec(line);
  if (!m) return { flavor: 'unknown', raw: line };
  return {
    flavor: 'skia',
    raw: line,
    base: m[1],
    runtime: `v${m[2]}`,
    em: `v${m[3]}`,
    ee: `v${m[4]}`,
    skia: `v${m[5]}`,
  };
}

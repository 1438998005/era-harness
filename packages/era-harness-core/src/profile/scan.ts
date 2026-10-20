import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DirectoryInfo, EncodingKind, EncodingSample, ErbTreeScan } from './types.js';

/** 递归遍历目录，按顶层段聚合文件数/ERB 数/总字节，并收集 ERB 文件路径。 */
export async function scanErbTree(erbRoot: string): Promise<ErbTreeScan> {
  const buckets = new Map<string, { fileCount: number; erbCount: number }>();
  const files: string[] = [];
  let totalBytes = 0;

  async function walk(dir: string, top: string | null): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, top ?? e.name);
      } else if (e.isFile()) {
        const seg = top ?? '(root)';
        const b = buckets.get(seg) ?? { fileCount: 0, erbCount: 0 };
        b.fileCount++;
        buckets.set(seg, b);
        if (e.name.toUpperCase().endsWith('.ERB')) {
          b.erbCount++;
          files.push(full);
        }
        try {
          totalBytes += (await stat(full)).size;
        } catch {
          /* 文件在遍历期间消失等情况，忽略 */
        }
      }
    }
  }

  await walk(erbRoot, null);
  const directories: DirectoryInfo[] = [...buckets.entries()]
    .map(([name, b]) => ({ name, ...b }))
    .sort((a, b) => b.fileCount - a.fileCount);
  return { files, directories, totalBytes };
}

/** 递归统计目录内符合扩展名的文件数。 */
export async function countFilesByExt(dir: string, exts: readonly string[]): Promise<number> {
  let count = 0;
  async function walk(d: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && exts.some((x) => e.name.toUpperCase().endsWith(x))) count++;
    }
  }
  await walk(dir);
  return count;
}

/** 按缓冲区头判断编码：BOM → UTF-8 严格解码 → CP932 兜底。 */
export function detectEncoding(buffer: Buffer): EncodingKind {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf8Bom';
  }
  if (buffer.length >= 2 && ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff))) {
    return 'unknown'; // UTF-16，本项目未见，按未知处理
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return 'utf8';
  } catch {
    return 'cp932';
  }
}

/** 对 ERB 文件等距取样做编码探测。 */
export async function sampleErbEncodings(files: readonly string[], sampleCount: number): Promise<EncodingSample> {
  const sample: EncodingSample = { sampledFiles: 0, utf8Bom: 0, utf8: 0, cp932: 0, unknown: 0 };
  if (files.length === 0 || sampleCount <= 0) return sample;
  const step = Math.max(1, Math.floor(files.length / sampleCount));
  const picked: string[] = [];
  for (let i = 0; i < files.length && picked.length < sampleCount; i += step) {
    picked.push(files[i] as string);
  }
  for (const f of picked) {
    try {
      const buf = await readFile(f);
      const kind = detectEncoding(buf.subarray(0, 1024));
      sample[kind]++;
      sample.sampledFiles++;
    } catch {
      /* 读取失败不计入 */
    }
  }
  return sample;
}

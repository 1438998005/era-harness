/**
 * 专属知识库的磁盘布局与读写（纯 Node，不 import vscode）。
 *
 * 目录约定：`<工作区根>/.era-harness/knowledge/<slug>/`
 * - 放**工作区根**而不是游戏根：游戏在子目录时也保证落在可写范围内
 *   （工作区外的路径一律不自动批准）。
 * - 放 `.era-harness/` 而不是普通目录：更新器的 `PROTECTED_PREFIXES` 已把它排除，
 *   游戏更新永远不会覆盖知识库；同时它也是 harness 私有目录，身份判定对它豁免。
 *
 * slug 用纯 ASCII（`kb-<yyyyMMddHHmm>-<4位随机>`），中文名只存进 `kb.json` 的 `name`，
 * 避免日文/中文路径在跨工具（git、压缩包、Windows 长短路径）时编码不一致。
 */

import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { GameKbEntry, GameKbManifest } from './types.js';

/** 相对工作区根的固定前缀 */
export const KB_DIR_PARTS = ['.era-harness', 'knowledge'] as const;
/** 删除时先挪进这里，不做不可逆的 rm */
export const KB_TRASH_DIR = '.trash';
/** 索引文件名（manifest.index 缺省值） */
export const DEFAULT_INDEX_FILE = 'index.md';

const SLUG_RE = /^kb-\d{12}-[a-z0-9]{4}$/;
const MAX_NAME_CHARS = 60;

/** `<workspaceRoot>/.era-harness/knowledge` */
export function knowledgeRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, ...KB_DIR_PARTS);
}

/** `<workspaceRoot>/.era-harness/knowledge/<slug>` */
export function knowledgeBaseDir(workspaceRoot: string, slug: string): string {
  return path.join(knowledgeRoot(workspaceRoot), slug);
}

/** slug 只接受自己生成的形态：任何外部传入的 slug 都必须先过这一关（防目录穿越） */
export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** 本地时间戳 `yyyyMMddHHmm`（不用 toISOString：那是 UTC，跨时区会看着像错了一天） */
export function slugTimestamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** 生成 slug。`suffix` 由调用方给（测试注入固定值），保证同分钟内多次新建也不撞 */
export function generateSlug(now: Date, suffix: string): string {
  const clean = suffix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4).padEnd(4, '0');
  return `kb-${slugTimestamp(now)}-${clean}`;
}

/** 名称清洗：去掉换行与控制字符，限长；空名给默认值 */
export function sanitizeName(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_CHARS);
  return cleaned || '未命名知识库';
}

/** 索引骨架：给 AI 一个明确的分类骨架，避免它把所有内容塞进一个文件 */
export function buildIndexSkeleton(name: string): string {
  return [
    `# ${name}`,
    '',
    '> 本库由 AI 根据当前工程生成，**仅供参考**：与实际代码冲突时以代码为准。',
    '> 本文件是总索引，一行一条；细节在 `functions/`、`constants/`、`tables/` 下的分片里。',
    '',
    '## 函数',
    '',
    '## 常量与变量槽位',
    '',
    '## CSV 表结构',
    '',
    '## 机制与坑',
    '',
  ].join('\n');
}

/** 读 manifest；文件不存在或解析失败都返回 null（设置页据此显示「损坏」） */
export async function readManifest(dir: string): Promise<GameKbManifest | null> {
  try {
    const raw = await fs.readFile(path.join(dir, 'kb.json'), 'utf8');
    const parsed = JSON.parse(raw) as Partial<GameKbManifest>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.slug !== 'string') {
      return null;
    }
    return {
      schemaVersion: 1,
      slug: parsed.slug,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : parsed.slug,
      gameRoot: typeof parsed.gameRoot === 'string' ? parsed.gameRoot : undefined,
      gameVersion: typeof parsed.gameVersion === 'string' ? parsed.gameVersion : undefined,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      enabled: parsed.enabled !== false,
      index: typeof parsed.index === 'string' ? parsed.index : DEFAULT_INDEX_FILE,
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : undefined,
      files: Array.isArray(parsed.files) ? parsed.files.filter((f) => f && typeof f.path === 'string') : undefined,
    };
  } catch {
    return null;
  }
}

/** 写 manifest（先写临时文件再 rename：中途崩掉不会留下半个 JSON） */
export async function writeManifest(dir: string, manifest: GameKbManifest): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, 'kb.json');
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, target);
}

/** 数一数磁盘上实际有几个分片（不含 index.md 与 kb.json） */
async function countShardFiles(dir: string): Promise<number> {
  let total = 0;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === KB_TRASH_DIR) {
      continue;
    }
    try {
      const files = await fs.readdir(path.join(dir, entry.name));
      total += files.filter((f) => f.endsWith('.md')).length;
    } catch {
      // 单个子目录读不到不影响整体
    }
  }
  return total;
}

/** 列出工作区里全部知识库（按创建时间倒序：新库排前面） */
export async function listKnowledgeBases(workspaceRoot: string): Promise<GameKbEntry[]> {
  const root = knowledgeRoot(workspaceRoot);
  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: GameKbEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === KB_TRASH_DIR) {
      continue;
    }
    const dir = path.join(root, entry.name);
    const manifest = await readManifest(dir);
    const indexFile = manifest?.index ?? DEFAULT_INDEX_FILE;
    let hasIndex = false;
    try {
      await fs.access(path.join(dir, indexFile));
      hasIndex = true;
    } catch {
      hasIndex = false;
    }
    out.push({
      slug: entry.name,
      dir,
      manifest,
      broken: manifest === null,
      fileCount: await countShardFiles(dir),
      hasIndex,
    });
  }

  out.sort((a, b) => (b.manifest?.createdAt ?? '').localeCompare(a.manifest?.createdAt ?? ''));
  return out;
}

export interface CreateKnowledgeBaseOptions {
  name: string;
  now: Date;
  suffix: string;
  gameRoot?: string;
  gameVersion?: string;
}

/** 建库：目录 + kb.json + index.md 骨架。返回 manifest（slug 已生成） */
export async function createKnowledgeBase(
  workspaceRoot: string,
  options: CreateKnowledgeBaseOptions,
): Promise<GameKbManifest> {
  const slug = generateSlug(options.now, options.suffix);
  const dir = knowledgeBaseDir(workspaceRoot, slug);
  const stamp = options.now.toISOString();
  const manifest: GameKbManifest = {
    schemaVersion: 1,
    slug,
    name: sanitizeName(options.name),
    gameRoot: options.gameRoot,
    gameVersion: options.gameVersion,
    createdAt: stamp,
    updatedAt: stamp,
    enabled: true,
    index: DEFAULT_INDEX_FILE,
    files: [],
  };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, DEFAULT_INDEX_FILE), buildIndexSkeleton(manifest.name), 'utf8');
  await writeManifest(dir, manifest);
  return manifest;
}

/** 开关「载入到对话」 */
export async function setKnowledgeBaseEnabled(workspaceRoot: string, slug: string, enabled: boolean): Promise<boolean> {
  if (!isValidSlug(slug)) {
    return false;
  }
  const dir = knowledgeBaseDir(workspaceRoot, slug);
  const manifest = await readManifest(dir);
  if (!manifest) {
    return false;
  }
  await writeManifest(dir, { ...manifest, enabled });
  return true;
}

/**
 * 删除 = 挪进 `.trash/`，不做不可逆的 rm。
 *
 * 知识库是用户（和 AI）花了一次长对话换来的产物，误删一次就得重跑一遍；
 * 挪走成本几乎为零，用户想找回直接拖回来即可。
 */
export async function trashKnowledgeBase(workspaceRoot: string, slug: string, now: Date): Promise<boolean> {
  if (!isValidSlug(slug)) {
    return false;
  }
  const dir = knowledgeBaseDir(workspaceRoot, slug);
  try {
    await fs.access(dir);
  } catch {
    return false;
  }
  const trashDir = path.join(knowledgeRoot(workspaceRoot), KB_TRASH_DIR);
  await fs.mkdir(trashDir, { recursive: true });
  const target = path.join(trashDir, `${slug}-${now.getTime()}`);
  await fs.rename(dir, target);
  return true;
}

/** 读索引正文；读不到返回 null */
export async function readIndexText(entry: GameKbEntry): Promise<string | null> {
  const file = entry.manifest?.index ?? DEFAULT_INDEX_FILE;
  try {
    return await fs.readFile(path.join(entry.dir, file), 'utf8');
  } catch {
    return null;
  }
}

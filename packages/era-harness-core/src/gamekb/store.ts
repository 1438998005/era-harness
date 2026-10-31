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
import type {
  GameKbBuildMode,
  GameKbBuildState,
  GameKbBuildStatus,
  GameKbEntry,
  GameKbManifest,
  GameKbTaskKind,
} from './types.js';

/** 相对工作区根的固定前缀 */
export const KB_DIR_PARTS = ['.era-harness', 'knowledge'] as const;
/** 删除时先挪进这里，不做不可逆的 rm */
export const KB_TRASH_DIR = '.trash';
/** 索引文件名（manifest.index 缺省值） */
export const DEFAULT_INDEX_FILE = 'index.md';

const SLUG_RE = /^kb-\d{12}-[a-z0-9]{4}$/;
const MAX_NAME_CHARS = 60;
const BUILD_STATUSES: readonly GameKbBuildStatus[] = ['draft', 'building', 'ready', 'failed'];
// 枚举取值以 types.ts 为准；这里不再重复一份数组（两份必然漂移）

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

/**
 * 索引是否只是骨架：一行条目（`- xxx` / `* xxx`）都没有。
 *
 * `hasIndex` 在骨架建库时就是 true（#93 的根因之一），所以「可不可用」必须看内容，
 * 不能看文件是否存在。
 */
export function isIndexSkeleton(text: string): boolean {
  return !text.split(/\r?\n/).some((line) => /^\s*[-*]\s+\S/.test(line));
}

/**
 * 判定构建状态：manifest 明确写过就用它；旧库（无 build 字段）按「有分片或索引有条目」兼容。
 * 旧库不能因为升级后多了一个字段就被判成不可用。
 */
export function resolveBuildStatus(
  manifest: GameKbManifest | null,
  fileCount: number,
  indexText: string | null,
): GameKbBuildStatus {
  const explicit = manifest?.build?.status;
  if (explicit) {
    return explicit;
  }
  if (fileCount > 0) {
    return 'ready';
  }
  if (indexText && !isIndexSkeleton(indexText)) {
    return 'ready';
  }
  return 'draft';
}

/**
 * 归一 build 块。两件事：
 *
 * 1. **枚举校验**：不合法就丢弃（脏数据不能变成事实）；
 * 2. **3.95.0 → 3.95.1 降级**：那一版把「建库形态」与「任务形态」塞进同一个 `mode`，
 *    所以老文件里的 `mode:"incremental"` 既可能是空白建库、也可能是续写任务。
 *    按下表一次性拆开，且**只在读时归一、不主动重写盘**：
 *
 *    | 旧 mode | 旧 status | mode | taskKind |
 *    |---|---|---|---|
 *    | `blank` | — | blank | — |
 *    | `full` | — | full | full（缺省） |
 *    | `update` | — | full | update（缺省） |
 *    | `incremental` | `draft` | blank | incremental（缺省） |
 *    | `incremental` | 其他 | full | incremental（缺省） |
 *
 * 最后一行需要解释：3.95.0 的开任务也把 `mode` 写成 `incremental`，两者字面完全相同，
 * 只能靠 `status` 区分——只有 `draft` 才说明“刚建完就没动过”（= 当时选的是空白建库）；
 * 已有过任务（building/ready/failed）就按完整建库兼容（宁可猜完整，也不要把未知当空白）。
 */
function normalizeBuild(input: unknown): GameKbBuildState | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  const status = BUILD_STATUSES.includes(record.status as GameKbBuildStatus)
    ? (record.status as GameKbBuildStatus)
    : undefined;
  if (!status) {
    return undefined;
  }

  const rawMode = typeof record.mode === 'string' ? record.mode : undefined;
  const rawTaskKind = typeof record.taskKind === 'string' ? record.taskKind : undefined;

  const explicitMode: GameKbBuildMode | undefined = rawMode === 'full' || rawMode === 'blank' ? rawMode : undefined;
  const explicitTaskKind: GameKbTaskKind | undefined =
    rawTaskKind === 'full' || rawTaskKind === 'update' || rawTaskKind === 'incremental' ? rawTaskKind : undefined;

  // 旧值降级：3.95.0 的 `update` / `incremental` 是任务形态，不是建库形态。
  // `incremental` 两义，只能看 status：`draft` = 刚建完没动过（空白建库），其余按完整建库兼容。
  const legacyTaskKind: GameKbTaskKind | undefined =
    rawMode === 'update' || rawMode === 'incremental' ? rawMode : undefined;
  const legacyMode: GameKbBuildMode | undefined = legacyTaskKind
    ? rawMode === 'incremental' && status === 'draft'
      ? 'blank'
      : 'full'
    : undefined;
  const mode: GameKbBuildMode | undefined = explicitMode ?? legacyMode;
  const taskKind: GameKbTaskKind | undefined = explicitTaskKind ?? legacyTaskKind;

  return {
    status,
    ...(mode ? { mode } : {}),
    ...(taskKind ? { taskKind } : {}),
    ...(typeof record.taskId === 'string' && record.taskId ? { taskId: record.taskId } : {}),
    ...(typeof record.startedAt === 'string' ? { startedAt: record.startedAt } : {}),
    ...(typeof record.finishedAt === 'string' ? { finishedAt: record.finishedAt } : {}),
    ...(typeof record.error === 'string' && record.error ? { error: record.error } : {}),
  };
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
      build: normalizeBuild(parsed.build),
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

/**
 * 只更新 build 状态（读 → 合并 → 原子写回）。
 *
 * 构建状态必须每次落盘：它要跨「窗口重载 / 任务被替换 / 扩展重启」存活，
 * 不能只活在内存或聊天里（#93）。
 */
export async function updateKnowledgeBaseBuild(
  dir: string,
  patch: Partial<GameKbBuildState>,
): Promise<boolean> {
  const manifest = await readManifest(dir);
  if (!manifest) {
    return false;
  }
  const status = patch.status ?? manifest.build?.status;
  if (!status) {
    return false;
  }
  const build: GameKbBuildState = {
    ...manifest.build,
    ...patch,
    status,
  };
  await writeManifest(dir, { ...manifest, build });
  return true;
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
    const fileCount = await countShardFiles(dir);
    let indexText: string | null = null;
    try {
      indexText = await fs.readFile(path.join(dir, indexFile), 'utf8');
    } catch {
      indexText = null;
    }
    out.push({
      slug: entry.name,
      dir,
      manifest,
      broken: manifest === null,
      fileCount,
      hasIndex: indexText !== null,
      buildStatus: resolveBuildStatus(manifest, fileCount, indexText),
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
  /** 建库形态：full = 开对话整库构建；blank = 只建空骨架（之后续写） */
  mode?: GameKbBuildMode;
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
    build: {
      status: options.mode === 'blank' ? 'draft' : 'building',
      mode: options.mode ?? 'full',
      startedAt: stamp,
    },
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

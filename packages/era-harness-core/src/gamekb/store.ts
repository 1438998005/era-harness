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

import { randomUUID } from 'node:crypto';
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
  GameKbUiState,
} from './types.js';

/**
 * 原子写的临时文件名：带 pid + 随机数（#120）。
 *
 * 旧写法固定 `<target>.tmp`，两个写者并发时 A 写一半、B 截断写完并 rename，
 * A 的 rename 落空（Windows 直接 ENOENT/EPERM，POSIX 下 fd 仍指向已改名 inode），
 * 落盘的可能是半截 JSON。唯一名让每个写者有自己的 tmp，rename 原子性才成立。
 */
function tmpNameFor(target: string): string {
  return `${target}.${process.pid}.${randomUUID()}.tmp`;
}

const RENAME_RETRIES = 3;

/**
 * rename 小退避重试（#120 的 Windows 侧）。
 *
 * tmp 名唯一化之后，「两个写者 rename 到同一目标」仍可能瞬时 EPERM——
 * 目标刚落盘就被杀软扫描 / 另一个 rename 在替换，句柄被短暂占用。
 * 这类失败不产生坏文件但会让写盘方报错，退避重试几次即可；非占用类错误照常抛出。
 */
async function renameWithRetry(from: string, to: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RENAME_RETRIES; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') {
        await cleanupTmp(from);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  // #130：重试耗尽也没成，tmp 留在库里就是惰性垃圾——尽力清掉，清不掉不影响主错误
  await cleanupTmp(from);
  throw lastError;
}

/** rename 失败后把 tmp 删掉（尽力而为；失败静默，主错误优先） */
async function cleanupTmp(tmp: string): Promise<void> {
  try {
    await fs.unlink(tmp);
  } catch {
    // 清不掉就算了
  }
}

/** 相对工作区根的固定前缀 */
export const KB_DIR_PARTS = ['.era-harness', 'knowledge'] as const;
/** 删除时先挪进这里，不做不可逆的 rm */
export const KB_TRASH_DIR = '.trash';
/** 索引文件名（manifest.index 缺省值） */
export const DEFAULT_INDEX_FILE = 'index.md';
/**
 * 构建状态的**事实源**（宿主独占）。
 *
 * 为什么不放在 `kb.json` 里：模型写盘是「整篇覆盖」，按 `KB_JSON_SCHEMA` 重写一次
 * 就会把 `build` 整块抹掉（或反过来自己写个 `ready` 把半成品洗成可用库）。
 * `kb.json` 里仍保留一份 `build` 镜像只为兼容旧版本读取，**读盘一律以本文件为准**。
 */
export const BUILD_STATE_FILE = 'build.json';

/**
 * 纯 UI 状态（宿主独占）。
 *
 * `enabled` 从 `kb.json` 搬出来：那个文件是模型可整篇重写的，而用户点开关走的是
 * 「读 → 合并 → 写回」，两边并发必互相覆盖（#115，与 #106 同源）。
 * `kb.json` 里仍留一份镜像，兼容旧版本读取。
 */
export const UI_STATE_FILE = 'ui.json';

const SLUG_RE = /^kb-\d{12}-[a-z0-9]{4}$/;
/**
 * 索引文件名白名单：只接受知识库目录内的**单层** `.md` 文件。
 *
 * `index` 字段住在模型可写的 `kb.json` 里，原来只判「是字符串」就直接 `path.join` 读盘，
 * 于是 `"../../../.ssh/id_rsa"` 能被读出来拼进系统提示词（#110）。这里按白名单收敛。
 */
const INDEX_FILE_RE = /^[A-Za-z0-9_-]+\.md$/;
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

/** 把 `manifest.index` 收敛成安全值；不合法一律回落默认（#110） */
export function safeIndexFile(raw: unknown): string {
  return typeof raw === 'string' && INDEX_FILE_RE.test(raw) ? raw : DEFAULT_INDEX_FILE;
}

/**
 * 索引文件的实际绝对路径。
 *
 * 白名单之外再做一次 `path.relative` 兜底——万一将来白名单被放宽，也不会让
 * `path.join` 把 `..` 带出知识库目录。所有读索引正文的地方都必须走这里。
 */
export function resolveIndexPath(dir: string, index: string | undefined): string {
  const root = path.resolve(dir);
  const abs = path.resolve(root, safeIndexFile(index));
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return path.join(root, DEFAULT_INDEX_FILE);
  }
  return abs;
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
 * 索引是否只是骨架：除标题、空行、引用块、分隔线之外，没有任何正文。
 *
 * 判据不能只看「有没有 `- ` 列表项」——模型完全可能用表格或有序列表写索引，
 * 那样会被误判成骨架，进而把有内容的库当成零产出（见 `resolveBuildStatus`）。
 *
 * `hasIndex` 在骨架建库时就是 true（#93 的根因之一），所以「可不可用」必须看内容，
 * 不能看文件是否存在。
 */
export function isIndexSkeleton(text: string): boolean {
  return !text.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return false; // 空行
    }
    if (trimmed.startsWith('#')) {
      return false; // 标题
    }
    if (trimmed.startsWith('>')) {
      return false; // 引用块（骨架里的说明文字）
    }
    if (/^-{3,}$/.test(trimmed)) {
      return false; // 分隔线
    }
    if (/^[-*+]\s*$/.test(trimmed)) {
      return false; // 空列表项
    }
    return true;
  });
}

/**
 * 判定构建状态：manifest 明确写过就用它；旧库（无 build 字段）按「有分片或索引有条目」兼容。
 * 旧库不能因为升级后多了一个字段就被判成不可用。
 *
 * ⚠️ `ready` 必须**先取证**：模型喊一声 `attempt_completion` 不代表真写了东西。
 * 零产出（没有分片、索引还是骨架）说明「跑完了但什么都没留下」，降级成 `failed`——
 * 用 `failed` 而不是 `draft`，因为 `draft` 是「刚建完还没跑」，这里是「跑过但白跑」。
 */
export function resolveBuildStatus(
  manifest: GameKbManifest | null,
  fileCount: number,
  indexText: string | null,
): GameKbBuildStatus {
  const explicit = manifest?.build?.status;
  if (explicit === 'ready' && fileCount === 0 && (!indexText || isIndexSkeleton(indexText))) {
    return 'failed';
  }
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

/**
 * 读构建状态 sidecar。不存在 / 解析失败 / 枚举不合法都返回 `undefined`，
 * 由调用方回退到 `kb.json.build`（存量库）或按内容推断。
 */
export async function readBuildState(dir: string): Promise<GameKbBuildState | undefined> {
  try {
    const raw = await fs.readFile(path.join(dir, BUILD_STATE_FILE), 'utf8');
    return normalizeBuild(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/** 写构建状态 sidecar（先写临时文件再 rename，同 `writeManifest` 的原子性） */
export async function writeBuildState(dir: string, build: GameKbBuildState): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, BUILD_STATE_FILE);
  const tmp = tmpNameFor(target);
  await fs.writeFile(tmp, `${JSON.stringify(build, null, 2)}\n`, 'utf8');
  await renameWithRetry(tmp, target);
}

/**
 * 读纯 UI 状态 sidecar。不存在 / 解析失败返回 `undefined`，
 * 由调用方回退到 `kb.json.enabled`（存量库）。
 */
export async function readUiState(dir: string): Promise<GameKbUiState | undefined> {
  try {
    const raw = await fs.readFile(path.join(dir, UI_STATE_FILE), 'utf8');
    const parsed = JSON.parse(raw) as Partial<GameKbUiState>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.enabled !== 'boolean') {
      return undefined;
    }
    return { enabled: parsed.enabled };
  } catch {
    return undefined;
  }
}

/** 写纯 UI 状态 sidecar（tmp + rename） */
export async function writeUiState(dir: string, ui: GameKbUiState): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, UI_STATE_FILE);
  const tmp = tmpNameFor(target);
  await fs.writeFile(tmp, `${JSON.stringify(ui, null, 2)}\n`, 'utf8');
  await renameWithRetry(tmp, target);
}

/**
 * 按目录串行化的写队列（#103）。
 *
 * `updateKnowledgeBaseBuild` 是「读 → 合并 → 写」，两个写者并发时后写会覆盖前写；
 * 典型现场是用户点「停止」与 `attempt_completion` 几乎同时到达，`failed` / `ready`
 * 谁赢变成抛硬币，注入门禁也就跟着不稳定。
 */
const buildWriteQueues = new Map<string, Promise<unknown>>();

function queueBuildWrite<T>(dir: string, task: () => Promise<T>): Promise<T> {
  const key = path.resolve(dir);
  const previous = buildWriteQueues.get(key) ?? Promise.resolve();
  // 用 then(task, task)：前一个写失败也要继续跑，否则一次异常会卡死整条链
  const next = previous.then(task, task);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  buildWriteQueues.set(key, tail);
  void tail.then(() => {
    // 只有自己仍是链尾时才清理，避免误删后加入的写操作
    if (buildWriteQueues.get(key) === tail) {
      buildWriteQueues.delete(key);
    }
  });
  return next;
}

/** 读 manifest；文件不存在或解析失败都返回 null（设置页据此显示「损坏」） */
export async function readManifest(dir: string): Promise<GameKbManifest | null> {
  try {
    const raw = await fs.readFile(path.join(dir, 'kb.json'), 'utf8');
    const parsed = JSON.parse(raw) as Partial<GameKbManifest>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.slug !== 'string') {
      return null;
    }
    // #132：slug 只做**防穿越**校验（含分隔符 / `..` / 绝对路径即视为损坏），
    // 不做全格式校验——存量库的 slug 不一定长成 `kb-*`，全格式会误伤。
    // 当前没有调用方拿 manifest.slug 拼路径，但这是潜伏点，防在读取层最稳。
    if (/[/\\]/.test(parsed.slug) || parsed.slug.includes('..') || path.isAbsolute(parsed.slug)) {
      return null;
    }
    // 事实源是 ui.json；`kb.json.enabled` 只在没有 sidecar 的存量库里兜底（#115）。
    // #128：存量「关着」的库要在第一次读取时回填 ui.json——否则迁移窗口里模型按
    // schema 整篇重写 kb.json（schema 里没有 enabled 字段），关闭状态会被翻转成开。
    const uiState = await readUiState(dir);
    if (!uiState && parsed.enabled === false) {
      try {
        await writeUiState(dir, { enabled: false });
      } catch {
        // 回填失败不影响本次读取，下次读取会再试
      }
    }
    // build 的事实源是 sidecar；`kb.json.build` 只在没有 sidecar 的存量库里兜底
    const sidecar = await readBuildState(dir);
    return {
      schemaVersion: 1,
      slug: parsed.slug,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : parsed.slug,
      gameRoot: typeof parsed.gameRoot === 'string' ? parsed.gameRoot : undefined,
      gameVersion: typeof parsed.gameVersion === 'string' ? parsed.gameVersion : undefined,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      enabled: uiState?.enabled ?? (parsed.enabled !== false),
      index: safeIndexFile(parsed.index),
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : undefined,
      files: Array.isArray(parsed.files) ? parsed.files.filter((f) => f && typeof f.path === 'string') : undefined,
      build: sidecar ?? normalizeBuild(parsed.build),
    };
  } catch {
    return null;
  }
}

/**
 * 写 manifest（先写临时文件再 rename：中途崩掉不会留下半个 JSON）。
 *
 * `build` 仍写进 `kb.json`：旧版本（3.95.1 及以前）只认这个字段，保留镜像不会让它们
 * 读到一个没有构建状态的库。同时镜像一份到 sidecar，保证「第一次写完就有事实源」。
 */
export async function writeManifest(dir: string, manifest: GameKbManifest): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, 'kb.json');
  const tmp = tmpNameFor(target);
  await fs.writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await renameWithRetry(tmp, target);
  if (manifest.build) {
    await writeBuildState(dir, manifest.build);
  }
}

/**
 * 只更新 build 状态。⚠️ **只写 sidecar，绝不重写 `kb.json`**。
 *
 * 以前这里是「读 kb.json → 合并 → 写回」：模型正在用 `write_to_file` 整篇写同一个文件，
 * 两边并发就会互相覆盖——宿主这一次写回会把模型刚写的 `files` / `counts` 抹掉，
 * 模型下一次整篇重写又会把 `build` 抹掉。状态搬进 sidecar 之后，这条冲突从根上消失。
 *
 * 构建状态必须每次落盘：它要跨「窗口重载 / 任务被替换 / 扩展重启」存活（#93）。
 */
export async function updateKnowledgeBaseBuild(
  dir: string,
  patch: Partial<GameKbBuildState>,
): Promise<boolean> {
  return queueBuildWrite(dir, async () => {
    // kb.json 只用来给「没有 sidecar 的存量库」兜底；它读不出来时**不能直接放弃**：
    // 模型完全可能把它写成非法 JSON（提示词就是让它改这个文件），那样 build.json 会永久停在
    // `building`，界面卡在「构建中」且没有任何报错冒出来，连「标记为失败」自救按钮都写不进去（#119）。
    const manifest = await readManifest(dir);
    const current = manifest?.build ?? (await readBuildState(dir));
    if (!manifest && !current && patch.status !== 'building') {
      // 目录和 sidecar 都不存在，又只想写一个终态——没有对象可更新
      return false;
    }
    const status = patch.status ?? current?.status;
    if (!status) {
      return false;
    }
    // 过期写入丢弃：任务已被替换后，旧任务迟到的终态不能盖掉新任务的状态。
    // `building` 永远接受——那是新任务开工，taskId 本来就和存量不同。
    if (patch.status !== 'building' && patch.taskId && current?.taskId && patch.taskId !== current.taskId) {
      return false;
    }
    const build: GameKbBuildState = {
      ...current,
      ...patch,
      status,
    };
    await writeBuildState(dir, build);
    return true;
  });
}

export interface FinalizeBuildOptions {
  /** 收尾的任务号；用于和 sidecar 里的 taskId 比对，丢弃迟到写入 */
  taskId?: string;
  /** 有值就直接判失败（调用方已经知道出错原因） */
  error?: string;
}

/**
 * 建库任务收尾：**先取证再定状态**（#96）。
 *
 * 之前是「没传 error 就当成功」，于是模型喊一声 `attempt_completion`、一个分片都没写，
 * 库也会变 `ready` 并被注入后续对话。这里改成看磁盘：零产出 → `failed`。
 */
export async function finalizeKnowledgeBaseBuild(
  dir: string,
  options: FinalizeBuildOptions = {},
): Promise<GameKbBuildStatus | null> {
  const manifest = await readManifest(dir);
  const buildState = await readBuildState(dir);
  // #127：kb.json 损坏时不能直接放弃——build.json 还在就照常收尾（与 #119 的
  // updateKnowledgeBaseBuild 同一口径），否则「正常完成」这条路径会把 build.json
  // 永久卡在 building。两边都没有才是真的无对象可收尾。
  if (!manifest && !buildState) {
    return null;
  }
  const finishedAt = new Date().toISOString();
  const taskIdPatch = options.taskId ? { taskId: options.taskId } : {};

  if (options.error) {
    await updateKnowledgeBaseBuild(dir, {
      status: 'failed',
      finishedAt,
      error: options.error,
      ...taskIdPatch,
    });
    return 'failed';
  }

  const fileCount = await countShardFiles(dir);
  let indexText: string | null = null;
  try {
    // manifest 可能为 null（kb.json 损坏、只有 build.json 的库）：resolveIndexPath
    // 对 undefined 回落到默认 index.md
    indexText = await fs.readFile(resolveIndexPath(dir, manifest?.index), 'utf8');
  } catch {
    indexText = null;
  }

  const produced = fileCount > 0 || Boolean(indexText && !isIndexSkeleton(indexText));
  if (!produced) {
    await updateKnowledgeBaseBuild(dir, {
      status: 'failed',
      finishedAt,
      error: '构建结束但没有任何产出（模型可能提前收尾）',
      ...taskIdPatch,
    });
    return 'failed';
  }

  await updateKnowledgeBaseBuild(dir, {
    status: 'ready',
    finishedAt,
    error: undefined,
    ...taskIdPatch,
  });
  return 'ready';
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
    const fileCount = await countShardFiles(dir);
    let indexText: string | null = null;
    try {
      indexText = await fs.readFile(resolveIndexPath(dir, manifest?.index), 'utf8');
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
  // 开关的事实源：建库即写，之后 readManifest 优先读它（#115）
  await writeUiState(dir, { enabled: true });
  return manifest;
}

/** 开关「载入到对话」——只写 `ui.json`，绝不重写 `kb.json`（模型可能正在整篇写它） */
export async function setKnowledgeBaseEnabled(workspaceRoot: string, slug: string, enabled: boolean): Promise<boolean> {
  if (!isValidSlug(slug)) {
    return false;
  }
  const dir = knowledgeBaseDir(workspaceRoot, slug);
  const manifest = await readManifest(dir);
  if (!manifest) {
    return false;
  }
  await writeUiState(dir, { enabled });
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
  try {
    return await fs.readFile(resolveIndexPath(entry.dir, entry.manifest?.index), 'utf8');
  } catch {
    return null;
  }
}

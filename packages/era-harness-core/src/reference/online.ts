/**
 * 指令知识库的「双线并轨」取数：**在线优先，本地兜底**，外加一条**在线发现**。
 *
 * 三条通道，职责不同：
 * 1. **索引（名字 / 签名 / 摘要）永远用内置快照**。关键词检索不可能为了查一个词去下载
 *    300 多个页面；而且离线环境（用户的真实场景）必须能照常工作。
 * 2. **正文优先取在线**（只对页面级条目）。命中一条指令时只需要 **1 个** HTTP 请求，
 *    拿到的新版整页**整体替换**本地页，不做字段级合并 —— 避免「一半新一半旧」。
 * 3. **发现**：本地完全没有的名字，用上游 MkDocs 的 `search_index.json` 定位页面再取。
 *    这是「库里没有 = 不存在」这个死角的唯一出口。
 *
 * ⚠ 规格页切段条目（`localOnly`）**不参与在线刷新**：整页替换会把切开的 20 多段
 * 并回一整页，再被 `MAX_BODY_CHARS` 截断 —— 那是行为回退，不是「更新」。
 *
 * ⚠ 已知环境限制：Node 的 `fetch` 用自带 CA 包，遇到公司代理 / 杀软中间人证书会
 * `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`。这里不吞掉它，而是翻成可读诊断交给调用方展示。
 */

import { parseReferencePage } from './parse.js';
import { parseSpecPage } from './spec-parse.js';
import type { ReferenceEntry } from './types.js';

/** 上游仓库的 raw 根（不含 `docs/`） */
export const DEFAULT_REFERENCE_BASE =
  'https://raw.githubusercontent.com/qirchen421/emuera.sk.doc/feature/tutorial-restructure';

/** 上游文档站的 MkDocs 搜索索引（**日文站**，用于「发现」而非内容来源） */
export const UPSTREAM_INDEX_URL = 'https://qirchen421.github.io/emuera.sk.doc/search/search_index.json';

/** 在线开关：`auto` 尝试在线，`off` 完全不出网 */
export type OnlineMode = 'auto' | 'off';

export interface ReferenceSourceOptions {
  /** 默认 `auto` */
  mode?: OnlineMode;
  /** 覆盖上游 raw 根，用于自建镜像或换分支 */
  baseUrl?: string;
  /** 单页请求超时，默认 6000ms */
  timeoutMs?: number;
}

/** 取到的是哪一份 */
export type ReferenceOrigin = 'online' | 'local' | 'discovered';

export interface ResolvedReference {
  entry: ReferenceEntry;
  origin: ReferenceOrigin;
  /** 给模型看的一句话来源说明 */
  sourceNote: string;
  /** 在线失败并已回退本地时的原因（**调用方应展示**，否则用户永远不知道在线没通） */
  fallbackReason?: string;
}

/** 页面文件名只允许这些字符（历史形态：Reference 的扁平 id） */
const SAFE_ID_RE = /^[A-Za-z0-9_.-]+$/;
/** 页面路径只允许 `docs/<目录>/<名字>.zh.md`，且不许出现 `..` */
const SAFE_PATH_RE = /^docs\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*\.zh\.md$/;

/** 失败记忆：一段时间内不再重试，避免每次调用都白等一个超时 */
const FAILURE_TTL_MS = 3 * 60 * 1000;
const recentFailures = new Map<string, number>();

/** 网络级失败的 scope：命中后整站冷却，因为再怎么换页面也一样连不上 */
const NETWORK_SCOPE = '*';

function failureKey(scope: string, baseUrl: string): string {
  return `${baseUrl}|${scope}`;
}

function markFailure(scope: string, baseUrl: string): void {
  recentFailures.set(failureKey(scope, baseUrl), Date.now());
}

function isRecentlyFailed(scope: string, baseUrl: string): boolean {
  const key = failureKey(scope, baseUrl);
  const at = recentFailures.get(key);
  if (at === undefined) {
    return false;
  }
  if (Date.now() - at > FAILURE_TTL_MS) {
    recentFailures.delete(key);
    return false;
  }
  return true;
}

/** 测试与长会话用：清掉失败记忆 */
export function resetOnlineFailureCache(): void {
  recentFailures.clear();
  indexCache = undefined;
  pageCache.clear();
}

/** 网络级错误码：一旦出现，换页面也没意义 */
const NETWORK_LEVEL_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

function errorCode(error: unknown): string | undefined {
  const candidate = error as { code?: string; cause?: { code?: string }; name?: string } | undefined;
  return candidate?.cause?.code ?? candidate?.code;
}

/** 把底层网络错误翻成模型和用户都能读懂的一句话 */
export function describeNetworkError(error: unknown): string {
  const code = errorCode(error);
  if (code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' || code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    return (
      '在线知识库不可用：Node 不信任上游证书链（常见于公司代理 / 杀毒软件中间人）。' +
      '可设 NODE_EXTRA_CA_CERTS 指向根证书后重试；本次使用内置离线快照。'
    );
  }
  if (code === 'CERT_HAS_EXPIRED') {
    return '在线知识库不可用：上游证书已过期。本次使用内置离线快照。';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return '在线知识库不可用：域名解析失败（可能没联网）。本次使用内置离线快照。';
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ABORT_ERR') {
    return '在线知识库不可用：请求超时。本次使用内置离线快照。';
  }
  return error instanceof Error ? error.message : String(error);
}

interface FetchOutcome {
  text?: string;
  error?: string;
  code?: string;
}

async function fetchText(url: string, timeoutMs: number): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'era-harness' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { error: `HTTP ${res.status}`, code: `HTTP ${res.status}` };
    }
    return { text: await res.text() };
  } catch (error) {
    return { error: describeNetworkError(error), code: errorCode(error) };
  }
}

/**
 * 由条目拼出 raw URL。
 *
 * - 传**条目**：优先用 `sourcePath`（`docs/Emuera/function.zh.md`）—— 规格页/教程页
 *   靠它才能拼对目录；`id` 里的 `#` 绝不进 URL（会被当 fragment 截断）。
 * - 传**字符串**：保留历史语义（Reference 扁平 id + `docs/Reference/<id>.zh.md`），
 *   并继续拒绝 `/` 与 `..`，避免旧调用方被放宽成路径穿越。
 */
export function referencePageUrl(
  target: string | Pick<ReferenceEntry, 'id' | 'sourcePath'>,
  baseUrl: string = DEFAULT_REFERENCE_BASE,
): string | undefined {
  const base = baseUrl.replace(/\/+$/, '');

  if (typeof target === 'string') {
    if (!SAFE_ID_RE.test(target)) {
      return undefined;
    }
    return `${base}/docs/Reference/${target}.zh.md`;
  }

  const sourcePath = target.sourcePath;
  if (sourcePath) {
    if (!SAFE_PATH_RE.test(sourcePath) || sourcePath.includes('..')) {
      return undefined;
    }
    return `${base}/${sourcePath}`;
  }
  if (!SAFE_ID_RE.test(target.id)) {
    return undefined;
  }
  return `${base}/docs/Reference/${target.id}.zh.md`;
}

/**
 * 拉取单页并解析。
 *
 * 返回 `{ error }` 表示**取不到**（404 / 超时 / 网络不可用），调用方应回退本地。
 * 这里永不抛错：知识库的可用性不应因为网络问题变成工具报错。
 */
export async function fetchRemoteReference(
  target: string | Pick<ReferenceEntry, 'id' | 'sourcePath'>,
  options: ReferenceSourceOptions = {},
): Promise<{ entry: ReferenceEntry } | { error: string }> {
  const baseUrl = options.baseUrl ?? DEFAULT_REFERENCE_BASE;
  const url = referencePageUrl(target, baseUrl);
  if (!url) {
    return { error: `页面 id 不合法：${typeof target === 'string' ? target : target.id}` };
  }

  const scope = typeof target === 'string' ? target : (target.sourcePath ?? target.id);
  if (isRecentlyFailed(NETWORK_SCOPE, baseUrl) || isRecentlyFailed(scope, baseUrl)) {
    return { error: '近期已连接失败，本次直接使用本地快照' };
  }

  const outcome = await fetchText(url, options.timeoutMs ?? 6000);
  if (outcome.text === undefined) {
    if (outcome.code && NETWORK_LEVEL_CODES.has(outcome.code)) {
      markFailure(NETWORK_SCOPE, baseUrl);
    } else {
      markFailure(scope, baseUrl);
    }
    return { error: outcome.error ?? '未知错误' };
  }

  const id = typeof target === 'string' ? target : target.id;
  try {
    return { entry: { ...parseReferencePage(id, outcome.text), sourcePath: typeof target === 'string' ? undefined : target.sourcePath } };
  } catch (parseError) {
    // 页面能取到但解析不了：说明上游格式变了，不是网络故障。
    // 不能记入失败冷却，否则 3 分钟内所有页面都会被迫走本地。
    return {
      error: `页面解析失败（上游格式可能已变）：${parseError instanceof Error ? parseError.message : String(parseError)}`,
    };
  }
}

/**
 * 解析一条指令：先定位本地条目，再按需用在线版本整页替换。
 *
 * `localOnly`（规格页切段）直接返回本地：整页替换会毁掉切段。
 */
export async function resolveReferenceOnline(
  localEntry: ReferenceEntry,
  snapshotSha: string,
  options: ReferenceSourceOptions = {},
): Promise<ResolvedReference> {
  const localNote = `内置快照（${snapshotSha.slice(0, 8)}）`;
  const mode = options.mode ?? 'auto';

  if (mode === 'off') {
    return { entry: localEntry, origin: 'local', sourceNote: localNote };
  }

  if (localEntry.localOnly) {
    return {
      entry: localEntry,
      origin: 'local',
      sourceNote: `${localNote} · 规格页按小节取自快照，不随线上刷新`,
    };
  }

  const remote = await fetchRemoteReference(localEntry, options);
  if ('entry' in remote) {
    return {
      entry: remote.entry,
      origin: 'online',
      sourceNote: `在线上游（${referencePageUrl(localEntry, options.baseUrl ?? DEFAULT_REFERENCE_BASE)}）`,
    };
  }
  return {
    entry: localEntry,
    origin: 'local',
    sourceNote: localNote,
    fallbackReason: remote.error,
  };
}

// ---------------------------------------------------------------------------
// 在线发现：本地没有的名字，去上游找那一页
// ---------------------------------------------------------------------------

/** 索引体积上限：正常约 1 MB，超过这个数说明拉到了别的东西 */
const INDEX_MAX_BYTES = 4 * 1024 * 1024;
/** 索引缓存时长 */
const INDEX_TTL_MS = 6 * 60 * 60 * 1000;
/** 发现时最多看几个候选页面 */
const MAX_CANDIDATE_PAGES = 2;
/** 页面级缓存条数 */
const PAGE_CACHE_LIMIT = 16;
/** 允许发现的目录（其余如 Changelog / i18n 不进知识库） */
const DISCOVER_DIRS = new Set(['Reference', 'Emuera', 'tutorial', 'manual', 'eramaker', 'EMEE', 'Skia']);

interface IndexDoc {
  location: string;
  title: string;
  text: string;
}

interface IndexCache {
  at: number;
  docs: IndexDoc[];
}

let indexCache: IndexCache | undefined;
const pageCache = new Map<string, ReferenceEntry[]>();

/** 查询归一化：`#LOCALSIZE` → `LOCALSIZE`，`PRINTFORMS(V)` → `PRINTFORMS` */
export function normalizeReferenceQuery(query: string): string {
  return query
    .trim()
    .replace(/^[#@]/, '')
    .replace(/^\[/, '')
    .replace(/[[\]()（）].*$/, '')
    .toUpperCase();
}

/** 名字归一化，与 `normalizeReferenceQuery` 同一套规则，用于比较 */
function normalizeName(name: string): string {
  return normalizeReferenceQuery(name);
}

async function loadUpstreamIndex(
  options: ReferenceSourceOptions,
): Promise<IndexDoc[] | { error: string }> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) {
    return indexCache.docs;
  }

  const outcome = await fetchText(UPSTREAM_INDEX_URL, Math.max(options.timeoutMs ?? 6000, 8000));
  if (outcome.text === undefined) {
    return { error: outcome.error ?? '索引拉取失败' };
  }
  if (outcome.text.length > INDEX_MAX_BYTES) {
    return { error: `索引体积异常（${outcome.text.length} 字节），已放弃` };
  }

  try {
    const parsed = JSON.parse(outcome.text) as { docs?: IndexDoc[] };
    const docs = Array.isArray(parsed.docs) ? parsed.docs : [];
    indexCache = { at: Date.now(), docs };
    return docs;
  } catch (error) {
    return { error: `索引解析失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

/** `Emuera/function.html#localsize-localssize` → `Emuera/function` */
export function slugFromIndexLocation(location: string): string | undefined {
  const withoutAnchor = location.split('#')[0] ?? '';
  const withoutLang = withoutAnchor.replace(/^(zh|ja|en)\//, '');
  const slug = withoutLang.replace(/\.html$/, '');
  if (!slug) {
    return undefined;
  }
  const dir = slug.split('/')[0] ?? '';
  if (!DISCOVER_DIRS.has(dir)) {
    return undefined;
  }
  return slug;
}

/** 把上游页面解析成条目（与 `build-reference.ts` 的规则保持一致） */
function parseUpstreamPage(slug: string, text: string): ReferenceEntry[] {
  const sourcePath = `docs/${slug}.zh.md`;
  if (slug.startsWith('Emuera/')) {
    return parseSpecPage(slug, sourcePath, text);
  }
  if (slug.startsWith('Reference/')) {
    const id = slug.slice('Reference/'.length);
    return [{ ...parseReferencePage(id, text), id, sourcePath }];
  }
  const base = slug.split('/').pop() ?? slug;
  const parsed = parseReferencePage(base, text);
  const names = parsed.names.filter((name) => name !== base.toUpperCase());
  return [
    { ...parsed, id: slug, sourcePath, names: names.length > 0 ? names : parsed.names },
  ];
}

async function loadUpstreamPage(
  slug: string,
  options: ReferenceSourceOptions,
): Promise<ReferenceEntry[] | { error: string }> {
  const cached = pageCache.get(slug);
  if (cached) {
    return cached;
  }
  const baseUrl = options.baseUrl ?? DEFAULT_REFERENCE_BASE;
  const outcome = await fetchText(`${baseUrl}/docs/${slug}.zh.md`, options.timeoutMs ?? 6000);
  if (outcome.text === undefined) {
    return { error: outcome.error ?? '页面拉取失败' };
  }
  const entries = parseUpstreamPage(slug, outcome.text);
  if (pageCache.size >= PAGE_CACHE_LIMIT) {
    const oldest = pageCache.keys().next().value;
    if (oldest !== undefined) {
      pageCache.delete(oldest);
    }
  }
  pageCache.set(slug, entries);
  return entries;
}

/**
 * 在线发现：库里没有的名字，用上游搜索索引定位页面再取回。
 *
 * **能力边界（写进工具描述，不藏着）**：上游索引是**日文站**，
 * `text` 字段为日文。所以：
 * - 拉丁指令名（`#LOCALSIZE`、`PRINTFORM`）发现可靠；
 * - 中文关键词（「局部变量容量」）命中率低，这种查询应走本地中文快照。
 */
export async function discoverReference(
  query: string,
  options: ReferenceSourceOptions = {},
): Promise<{ entries: ReferenceEntry[]; slug: string } | { error: string }> {
  if ((options.mode ?? 'auto') === 'off') {
    return { error: '在线模式已关闭' };
  }
  const token = normalizeReferenceQuery(query);
  if (!token) {
    return { error: '查询词为空' };
  }

  const baseUrl = options.baseUrl ?? DEFAULT_REFERENCE_BASE;
  if (isRecentlyFailed(NETWORK_SCOPE, baseUrl)) {
    return { error: '近期已连接失败，本次不尝试在线发现' };
  }

  const index = await loadUpstreamIndex(options);
  if (!Array.isArray(index)) {
    return index;
  }

  // 打分：标题命中 > 正文命中；同分取路径短的（更可能是「主页」而非零散提及）
  const scored: { slug: string; score: number; location: string }[] = [];
  for (const doc of index) {
    const slug = slugFromIndexLocation(doc.location ?? '');
    if (!slug) {
      continue;
    }
    const title = (doc.title ?? '').toUpperCase();
    const text = (doc.text ?? '').toUpperCase();
    let score = 0;
    if (title.includes(token)) {
      score = 3;
    } else if (text.includes(token)) {
      score = 1;
    }
    if (score > 0) {
      scored.push({ slug, score, location: doc.location });
    }
  }
  if (scored.length === 0) {
    return { error: `上游索引里没有「${query}」` };
  }
  scored.sort((a, b) => b.score - a.score || a.location.length - b.location.length);

  const candidates: string[] = [];
  for (const item of scored) {
    if (!candidates.includes(item.slug)) {
      candidates.push(item.slug);
    }
    if (candidates.length >= MAX_CANDIDATE_PAGES) {
      break;
    }
  }

  let lastError: string | undefined;
  for (const slug of candidates) {
    const page = await loadUpstreamPage(slug, options);
    if (!Array.isArray(page)) {
      lastError = page.error;
      continue;
    }
    const matched = page.filter((entry) =>
      entry.names.some((name) => normalizeName(name) === token),
    );
    if (matched.length > 0) {
      return { entries: matched, slug };
    }
    // 名字对不上但页面命中了：整页返回，至少让模型看到上下文
    if (page.length > 0) {
      return { entries: page.slice(0, 1), slug };
    }
  }

  return { error: lastError ?? `上游页面里没找到「${query}」` };
}

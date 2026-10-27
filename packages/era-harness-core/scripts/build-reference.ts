/**
 * 把 emuera.sk.doc 的 Reference 页面抓下来，生成本地指令知识库数据。
 *
 * 用法（在 `era harness/` 目录下）：
 *   npm run build:reference                          # 抓取 → 解析 → 写 src/reference/data/
 *   npm run build:reference -- --offline             # 只用缓存，不联网（改解析器时用）
 *   npm run build:reference -- --local <repo 路径>    # 从本地集群文档仓读（本地正本，⛔ 不联网）
 *
 * 两个来源：
 *   - **本地正本**＝集群的 `emuera.em.doc-1` 检出（`feature/tutorial-restructure`，
 *     受三语同步与 CJK 锚点治理）。加 `--local` 走这条：直接从 `docs/Reference/*.zh.md`
 *     读，版本标识取该检出的 `git rev-parse HEAD`，因此生成的数据可溯源到具体 commit。
 *   - **GitHub raw**＝在线兜底，本机没有该检出时用（默认路径）。
 *
 * 为什么是「生成 TS」而不是「运行时读 JSON」：
 *   数据要被**两处**同时消费——核心库的 MCP server 与插件的 esbuild 打包。
 *   JSON 需要额外的文件拷贝与路径解析（dev / 装机 / 多根工作区各不相同），
 *   TS 常量则由 tsc 与 esbuild 直接内联，零运行时路径问题。
 *
 * 许可：上游是 CC BY-NC 4.0。生成的文件顶部带来源与许可声明，
 * 与代码的 Apache-2.0 分开管理（见 NOTICE-emuera-sk-doc.md）。
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseReferencePage } from '../src/reference/parse.js';
import { parseSpecPage } from '../src/reference/spec-parse.js';
import type { ReferenceEntry } from '../src/reference/types.js';

const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, '..');

const REPO = 'qirchen421/emuera.sk.doc';
const DEFAULT_BRANCH = 'feature/tutorial-restructure';

/**
 * 抓取范围（只收中文页）。
 *
 * - `docs/Reference` —— API 指令页，一页一条（历史范围，312 页）
 * - `docs/Emuera`   —— 语法/规格页，按 `###` 切段（`#LOCALSIZE` 只在这里有）
 * - `docs/tutorial` —— 教程页，一页一条
 *
 * 为什么必须收 Emuera：`#LOCALSIZE` / `#DIM` / `#FUNCTION` 这类函数头指令的语义
 * 只写在规格页里，Reference 全是 API 函数。少了这一层，模型查容量指令永远查不到。
 */
const SOURCE_DIRS = ['docs/Reference', 'docs/Emuera', 'docs/tutorial'] as const;

/** 需要按 `###` 切段的目录：一页塞几十个小节，整页入库会被正文上限截断 */
const SPEC_DIRS = new Set<string>(['docs/Emuera']);

/** 总索引页 / 变更日志 / 站点首页：不是某条指令的说明 */
const SKIP_BASENAMES = new Set(['README.zh.md', 'CHANGELOG.zh.md', 'index.zh.md']);

/** 每个数据分片装多少条，控制单文件体积便于 review */
const CHUNK_SIZE = 40;

interface Options {
  branch: string;
  offline: boolean;
  /** 本地集群文档仓路径（本地正本）；给了就完全不走网络 */
  local?: string;
  cacheDir: string;
  outDir: string;
  concurrency: number;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    branch: DEFAULT_BRANCH,
    offline: false,
    cacheDir: path.join(PKG_ROOT, '.cache', 'reference'),
    outDir: path.join(PKG_ROOT, 'src', 'reference', 'data'),
    concurrency: 6,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--offline') {
      options.offline = true;
    } else if (arg === '--local' && next) {
      options.local = next;
      i++;
    } else if (arg === '--branch' && next) {
      options.branch = next;
      i++;
    } else if (arg === '--cache' && next) {
      options.cacheDir = path.resolve(next);
      i++;
    } else if (arg === '--out' && next) {
      options.outDir = path.resolve(next);
      i++;
    } else if (arg === '--concurrency' && next) {
      options.concurrency = Math.max(1, Number.parseInt(next, 10) || 1);
      i++;
    }
  }
  return options;
}

const USER_AGENT = 'era-harness-reference-builder';

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Node 的 TLS 信任链失败（企业代理 / 杀软中间人的典型症状） */
const TLS_TRUST_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
]);

function tlsTrustCode(error: unknown): string | undefined {
  const candidate = error as { code?: string; cause?: { code?: string } } | undefined;
  const code = candidate?.cause?.code ?? candidate?.code;
  return typeof code === 'string' && TLS_TRUST_CODES.has(code) ? code : undefined;
}

/**
 * 用 curl 兜底取文本。
 *
 * 为什么需要：Node 用自带的 CA 包，遇到公司代理 / 杀软的中间人证书会直接
 * `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`；curl 走系统证书库，同一台机器上能通。
 * 没有这条兜底，本机 `npm run build:reference` 根本跑不起来。
 */
async function curlText(url: string): Promise<string> {
  const { stdout } = await execFileAsync('curl', ['-sSL', '--max-time', '40', url], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

/** 带退避重试的 GET；GitHub raw 在并发下会零星返回 5xx */
async function fetchText(url: string, tries = 5): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
      if (res.ok) {
        return await res.text();
      }
      lastError = new Error(`${url} -> HTTP ${res.status}`);
      // 4xx 除了 429 重试也没用
      if (res.status < 500 && res.status !== 429) {
        throw lastError;
      }
    } catch (error) {
      const tls = tlsTrustCode(error);
      if (tls) {
        console.error(`⚠️ Node 证书校验失败（${tls}），改用 curl 取：${url}`);
        return await curlText(url);
      }
      lastError = error;
    }
    await sleep(600 * (attempt + 1));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

function rawUrl(branchOrSha: string, repoPath: string): string {
  const encoded = repoPath.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${REPO}/${branchOrSha}/${encoded}`;
}

/** 该仓库内路径是否在抓取范围内 */
function isSourcePath(repoPath: string): boolean {
  return SOURCE_DIRS.some((dir) => repoPath.startsWith(`${dir}/`)) && repoPath.endsWith('.zh.md');
}

/**
 * 页面 slug —— 条目 id 的页面部分。
 *
 * `docs/Reference/PRINT.zh.md` → `PRINT`（**剥掉 Reference 前缀**：
 * 312 条历史 id 保持原样，下游断言与已发布数据零改动）
 * `docs/Emuera/function.zh.md` → `Emuera/function`
 * `docs/tutorial/x.zh.md` → `tutorial/x`
 */
function pageSlug(repoPath: string): string {
  return repoPath.replace(/\.zh\.md$/, '').replace(/^docs\/Reference\//, '').replace(/^docs\//, '');
}

/** 缓存文件名：slug 可能含 `/`，直接当路径会写到不存在的子目录（ENOENT） */
function cacheKey(repoPath: string): string {
  return repoPath.replace(/[/\\]/g, '__');
}

/** 该页面是否要按 `###` 切段 */
function isSpecPath(repoPath: string): boolean {
  return SPEC_DIRS.has(repoPath.split('/').slice(0, 2).join('/'));
}

interface TreeResponse {
  tree: { path: string; type: string; size?: number }[];
  truncated?: boolean;
}

/** 在指定目录里跑 git，拿不到就抛（本地正本必须能给出 commit，否则内嵌数据无法溯源） */
async function gitIn(dir: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return stdout.trim();
}

/**
 * 把 `--local` 给的路径规整到 `docs/` 根。
 * 两种给法都收：仓库根（自动拼 `docs`）或直接指到 `docs` 目录本身。
 */
async function resolveDocsRoot(input: string): Promise<string> {
  const base = path.resolve(input);
  const candidates = [path.join(base, 'docs'), base];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (!stat.isDirectory()) {
        continue;
      }
      // 以 Reference 目录作为锚点：它是历史范围，任何可用检出都该有
      const anchor = await fs.stat(path.join(candidate, 'Reference'));
      if (anchor.isDirectory()) {
        return candidate;
      }
    } catch {
      /* 换下一个候选 */
    }
  }
  throw new Error(
    `--local 找不到 docs 目录：${base}\n` +
      `期望是 emuera.em.doc-1 的检出根（会自动拼 docs）或直接指到该 docs 目录。`,
  );
}

/**
 * 读本地检出的全部中文页面（三个目录）。
 * 返回的 `path` 是仓库内相对路径（`docs/Emuera/function.zh.md`），slug 由它派生。
 */
async function loadLocalPages(docsRoot: string): Promise<{ path: string; text: string }[]> {
  const result: { path: string; text: string }[] = [];

  for (const dir of SOURCE_DIRS) {
    const abs = path.join(docsRoot, dir.replace(/^docs\//, ''));
    let names: string[];
    try {
      names = (await fs.readdir(abs, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.zh.md') && !SKIP_BASENAMES.has(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      console.error(`⚠️ 跳过不存在的目录：${abs}`);
      continue;
    }
    for (const name of names) {
      result.push({
        path: `${dir}/${name}`,
        text: await fs.readFile(path.join(abs, name), 'utf8'),
      });
    }
    console.error(`  ${dir}: ${names.length} 页`);
  }

  if (result.length === 0) {
    throw new Error(`--local 目录里没有 *.zh.md：${docsRoot}`);
  }

  console.error(`本地页面 ${result.length} 个（来自 ${docsRoot}）`);
  return result;
}

interface LocalSource {
  sha: string;
  repoRoot: string;
  branch: string | undefined;
}

/** 本地来源的版本标识＝该检出的 HEAD；顺带回分支名用于核对是否站在约定分支上 */
async function resolveLocalSource(referenceDir: string): Promise<LocalSource> {
  let repoRoot: string;
  try {
    repoRoot = await gitIn(referenceDir, ['rev-parse', '--show-toplevel']);
  } catch {
    throw new Error(
      `--local 指向的目录不在 git 工作树内，无法记录版本：${referenceDir}\n` +
        `本地正本必须能给出 commit sha，否则内嵌数据的来源无从追溯。`,
    );
  }
  const sha = await gitIn(repoRoot, ['rev-parse', 'HEAD']);
  let branch: string | undefined;
  try {
    branch = await gitIn(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    branch = undefined;
  }
  return { sha, repoRoot, branch };
}

/** 解析出版本标识：优先用 commit sha，离线时读上次写入的 meta */
async function resolveSourceRef(options: Options): Promise<string> {
  if (options.offline) {
    const meta = await readMeta(options.outDir);
    if (meta?.sha) {
      return meta.sha;
    }
    throw new Error('--offline 需要已生成过的数据（读不到 src/reference/data/index.ts 里的 sha）');
  }
  const commit = await fetchJson<{ sha: string }>(
    `https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(options.branch)}`,
  );
  return commit.sha;
}

interface SourceMeta {
  sha: string;
  fetchedAt: string;
  entryCount: number;
}

async function readMeta(outDir: string): Promise<SourceMeta | undefined> {
  try {
    const raw = await fs.readFile(path.join(outDir, 'meta.json'), 'utf8');
    return JSON.parse(raw) as SourceMeta;
  } catch {
    return undefined;
  }
}

/**
 * 取仓库目录树。
 *
 * 在线取到后落盘，`--offline` 直接读缓存 —— 否则「离线」模式仍然要打一次
 * api.github.com，在证书被拦的机器上等于没法用。
 */
async function loadTree(options: Options, sha: string): Promise<TreeResponse> {
  const cachePath = path.join(options.cacheDir, `tree-${sha.slice(0, 12)}.json`);

  if (options.offline) {
    try {
      return JSON.parse(await fs.readFile(cachePath, 'utf8')) as TreeResponse;
    } catch {
      throw new Error(
        `--offline 需要已缓存的目录树，但没找到：${cachePath}\n` +
          `先联网跑一次（或从别处拷贝该文件）再重试。`,
      );
    }
  }

  const tree = await fetchJson<TreeResponse>(
    `https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`,
  );
  await fs.mkdir(options.cacheDir, { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(tree), 'utf8');
  return tree;
}

/** 下载（或从缓存读）全部中文页面 */
async function loadPages(options: Options, sha: string): Promise<{ path: string; text: string }[]> {
  const cacheDir = path.join(options.cacheDir, sha.slice(0, 12));
  await fs.mkdir(cacheDir, { recursive: true });

  const tree = await loadTree(options, sha);
  const pages = tree.tree
    .filter((node) => node.type === 'blob')
    .filter((node) => isSourcePath(node.path))
    .filter((node) => !SKIP_BASENAMES.has(path.posix.basename(node.path)))
    .map((node) => ({ path: node.path }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const result: { path: string; text: string }[] = [];
  let cursor = 0;
  let fromCache = 0;
  let downloaded = 0;

  const worker = async (): Promise<void> => {
    while (cursor < pages.length) {
      const page = pages[cursor++];
      if (!page) {
        continue;
      }
      const cachePath = path.join(cacheDir, cacheKey(page.path));
      let text: string | undefined;
      try {
        text = await fs.readFile(cachePath, 'utf8');
        fromCache++;
      } catch {
        text = undefined;
      }
      if (text === undefined) {
        text = await fetchText(rawUrl(sha, page.path));
        await fs.writeFile(cachePath, text, 'utf8');
        downloaded++;
      }
      result.push({ path: page.path, text });
    }
  };

  if (!options.offline) {
    await Promise.all(Array.from({ length: options.concurrency }, worker));
  } else {
    // 离线：只认缓存里已有的
    for (const page of pages) {
      try {
        const text = await fs.readFile(path.join(cacheDir, cacheKey(page.path)), 'utf8');
        result.push({ path: page.path, text });
        fromCache++;
      } catch {
        // 缓存缺页就跳过，由调用方比较数量后决定是否报错
      }
    }
  }

  console.error(`页面 ${pages.length} 个：缓存命中 ${fromCache}，新下载 ${downloaded}`);
  result.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

function renderDataModule(partIndex: number, entries: readonly ReferenceEntry[], sha: string): string {
  const constant = `ENTRIES_PART_${String(partIndex).padStart(2, '0')}`;
  return `// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/${REPO}  ${SOURCE_DIRS.join('、')}/*.zh.md
// 上游版本：${sha}
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ${constant}: readonly ReferenceEntry[] = ${JSON.stringify(entries, null, 2)};
`;
}

function renderIndexModule(partCount: number, meta: SourceMeta, totalNames: number): string {
  const imports = Array.from({ length: partCount }, (_, i) => {
    const constant = `ENTRIES_PART_${String(i + 1).padStart(2, '0')}`;
    return `import { ${constant} } from './part-${String(i + 1).padStart(2, '0')}.js';`;
  }).join('\n');

  const spreads = Array.from({ length: partCount }, (_, i) => {
    const constant = `ENTRIES_PART_${String(i + 1).padStart(2, '0')}`;
    return `\t...${constant},`;
  }).join('\n');

  return `// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
import type { ReferenceEntry } from '../types.js';
${imports}

/** 上游版本（commit sha），改数据后必须一并更新 */
export const REFERENCE_SOURCE_SHA = '${meta.sha}';

/** 抓取时间（ISO） */
export const REFERENCE_FETCHED_AT = '${meta.fetchedAt}';

/** 全部指令条目，按 id 排序 */
export const REFERENCE_ENTRIES: readonly ReferenceEntry[] = [
${spreads}
];

/** 条目数（Reference 页 + Emuera 规格页切段 + tutorial 页） */
export const REFERENCE_ENTRY_COUNT = ${meta.entryCount};

/** 可检索的名字总数（一个页可能覆盖多个名字，如 SETCOLOR / RESETCOLOR） */
export const REFERENCE_NAME_COUNT = ${totalNames};
`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  let sha: string;
  let pages: { path: string; text: string }[];
  if (options.local) {
    const docsRoot = await resolveDocsRoot(options.local);
    const source = await resolveLocalSource(docsRoot);
    sha = source.sha;
    if (source.branch && source.branch !== options.branch) {
      console.error(
        `⚠️ 本地检出在分支 ${source.branch}，与默认分支 ${options.branch} 不一致` +
          `（要按别的分支生成请显式加 --branch 确认）`,
      );
    }
    console.error(`来源：本地正本 ${source.repoRoot}`);
    console.error(`上游版本：${sha}（分支 ${source.branch ?? '(未知)'}）`);
    pages = await loadLocalPages(docsRoot);
  } else {
    sha = await resolveSourceRef(options);
    console.error(`来源：GitHub raw（在线兜底）`);
    console.error(`上游版本：${sha}`);
    pages = await loadPages(options, sha);
  }

  if (pages.length === 0) {
    throw new Error('没拿到任何页面：本地模式检查 --local 路径，在线模式检查网络或 --offline 缓存');
  }

  const entries: ReferenceEntry[] = [];
  for (const page of pages) {
    const slug = pageSlug(page.path);

    // 规格页：一页切多段，正文按小节走，避免撞上正文上限
    if (isSpecPath(page.path)) {
      entries.push(...parseSpecPage(slug, page.path, page.text));
      continue;
    }

    // Reference：一页一条，id 仍是文件名主干（历史形态，零改动）
    if (page.path.startsWith('docs/Reference/')) {
      entries.push({ ...parseReferencePage(slug, page.text), sourcePath: page.path });
      continue;
    }

    // tutorial：slug 带目录前缀，但 parseReferencePage 会把 id 当名字塞进 names，
    // 直接用 slug 会造出 `TUTORIAL/XXX` 这种伪指令名。用文件名主干解析后再改 id。
    const base = path.posix.basename(page.path, '.zh.md');
    const parsed = parseReferencePage(base, page.text);
    const names = parsed.names.filter((name) => name !== base.toUpperCase());
    entries.push({
      ...parsed,
      id: slug,
      sourcePath: page.path,
      names: names.length > 0 ? names : parsed.names,
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  const withTable = entries.filter((entry) => entry.signatures.length > 0).length;
  const withSummary = entries.filter((entry) => entry.summary.length > 0).length;
  const splitEntries = entries.filter((entry) => entry.pageId !== undefined).length;
  // 可检索名字要**去重**：同名会跨多页出现（如 PRINT 也出现在 PRINTC/PRINTN 页）
  const uniqueNames = new Set<string>();
  for (const entry of entries) {
    for (const name of entry.names) {
      uniqueNames.add(name);
    }
  }
  const totalNames = uniqueNames.size;
  const bodyBytes = entries.reduce((sum, entry) => sum + Buffer.byteLength(entry.body, 'utf8'), 0);

  await fs.mkdir(options.outDir, { recursive: true });

  // 清掉上一次的分片，避免条目变少时留下孤儿文件
  for (const name of await fs.readdir(options.outDir)) {
    if (/^part-\d+\.ts$/.test(name) || name === 'index.ts') {
      await fs.rm(path.join(options.outDir, name), { force: true });
    }
  }

  const partCount = Math.ceil(entries.length / CHUNK_SIZE);
  for (let i = 0; i < partCount; i++) {
    const chunk = entries.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const name = `part-${String(i + 1).padStart(2, '0')}.ts`;
    await fs.writeFile(path.join(options.outDir, name), renderDataModule(i + 1, chunk, sha), 'utf8');
  }

  const meta: SourceMeta = { sha, fetchedAt: new Date().toISOString(), entryCount: entries.length };
  await fs.writeFile(
    path.join(options.outDir, 'index.ts'),
    renderIndexModule(partCount, meta, totalNames),
    'utf8',
  );
  await fs.writeFile(path.join(options.outDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  const byDir = new Map<string, number>();
  for (const entry of entries) {
    const dir = entry.sourcePath?.split('/')[1] ?? '(未知)';
    byDir.set(dir, (byDir.get(dir) ?? 0) + 1);
  }

  console.log(
    [
      `条目 ${entries.length}（规格页切段 ${splitEntries}，有签名表 ${withTable}，有摘要 ${withSummary}）`,
      `来源分布：${[...byDir].map(([dir, count]) => `${dir} ${count}`).join('，')}`,
      `可检索名字 ${totalNames}`,
      `正文合计 ${(bodyBytes / 1024).toFixed(0)} KB`,
      `分片 ${partCount} 个 → ${path.relative(PKG_ROOT, options.outDir)}`,
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

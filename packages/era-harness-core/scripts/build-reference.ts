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
import type { ReferenceEntry } from '../src/reference/types.js';

const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, '..');

const REPO = 'qirchen421/emuera.sk.doc';
const DEFAULT_BRANCH = 'feature/tutorial-restructure';
const REFERENCE_DIR = 'docs/Reference';
const /** 总索引页：列出全部指令，不是某条指令的说明 */ SKIP_FILES = new Set(['README.zh.md']);

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
 * 把 `--local` 给的路径规整到 Reference 目录。
 * 两种给法都收：仓库根（自动拼 `docs/Reference`）或直接指到 Reference 目录本身。
 */
async function resolveReferenceDir(input: string): Promise<string> {
  const base = path.resolve(input);
  const candidates = [path.join(base, REFERENCE_DIR), base];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      /* 换下一个候选 */
    }
  }
  throw new Error(
    `--local 找不到 Reference 目录：${base}\n` +
      `期望是 emuera.em.doc-1 的检出根（会自动拼 ${REFERENCE_DIR}）或直接指到该目录。`,
  );
}

/** 读本地检出的全部中文页面；README.zh.md 是总索引页，跳过 */
async function loadLocalPages(referenceDir: string): Promise<{ id: string; text: string }[]> {
  const names = (await fs.readdir(referenceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.zh.md') && !SKIP_FILES.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (names.length === 0) {
    throw new Error(`--local 目录里没有 *.zh.md：${referenceDir}`);
  }

  const result: { id: string; text: string }[] = [];
  for (const name of names) {
    const text = await fs.readFile(path.join(referenceDir, name), 'utf8');
    result.push({ id: path.basename(name, '.zh.md'), text });
  }
  console.error(`本地页面 ${result.length} 个（来自 ${referenceDir}）`);
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

/** 下载（或从缓存读）全部 Reference 页面 */
async function loadPages(options: Options, sha: string): Promise<{ id: string; text: string }[]> {
  const cacheDir = path.join(options.cacheDir, sha.slice(0, 12));
  await fs.mkdir(cacheDir, { recursive: true });

  const tree = await fetchJson<TreeResponse>(
    `https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`,
  );
  const pages = tree.tree
    .filter((node) => node.type === 'blob')
    .filter((node) => node.path.startsWith(`${REFERENCE_DIR}/`) && node.path.endsWith('.zh.md'))
    .map((node) => ({ path: node.path, id: path.posix.basename(node.path, '.zh.md') }))
    .filter((page) => !SKIP_FILES.has(`${page.id}.zh.md`))
    .sort((a, b) => a.id.localeCompare(b.id));

  const result: { id: string; text: string }[] = [];
  let cursor = 0;
  let fromCache = 0;
  let downloaded = 0;

  const worker = async (): Promise<void> => {
    while (cursor < pages.length) {
      const page = pages[cursor++];
      if (!page) {
        continue;
      }
      const cachePath = path.join(cacheDir, `${page.id}.md`);
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
      result.push({ id: page.id, text });
    }
  };

  if (!options.offline) {
    await Promise.all(Array.from({ length: options.concurrency }, worker));
  } else {
    // 离线：只认缓存里已有的
    for (const page of pages) {
      try {
        const text = await fs.readFile(path.join(cacheDir, `${page.id}.md`), 'utf8');
        result.push({ id: page.id, text });
        fromCache++;
      } catch {
        // 缓存缺页就跳过，由调用方比较数量后决定是否报错
      }
    }
  }

  console.error(`页面 ${pages.length} 个：缓存命中 ${fromCache}，新下载 ${downloaded}`);
  result.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

function renderDataModule(partIndex: number, entries: readonly ReferenceEntry[], sha: string): string {
  const constant = `ENTRIES_PART_${String(partIndex).padStart(2, '0')}`;
  return `// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/${REPO}  ${REFERENCE_DIR}/*.zh.md
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

/** 全部指令条目，按页面文件名排序 */
export const REFERENCE_ENTRIES: readonly ReferenceEntry[] = [
${spreads}
];

/** 条目数（≈ 上游 Reference 页数） */
export const REFERENCE_ENTRY_COUNT = ${meta.entryCount};

/** 可检索的名字总数（一个页可能覆盖多个名字，如 SETCOLOR / RESETCOLOR） */
export const REFERENCE_NAME_COUNT = ${totalNames};
`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  let sha: string;
  let pages: { id: string; text: string }[];
  if (options.local) {
    const referenceDir = await resolveReferenceDir(options.local);
    const source = await resolveLocalSource(referenceDir);
    sha = source.sha;
    if (source.branch && source.branch !== options.branch) {
      console.error(
        `⚠️ 本地检出在分支 ${source.branch}，与默认分支 ${options.branch} 不一致` +
          `（要按别的分支生成请显式加 --branch 确认）`,
      );
    }
    console.error(`来源：本地正本 ${source.repoRoot}`);
    console.error(`上游版本：${sha}（分支 ${source.branch ?? '(未知)'}）`);
    pages = await loadLocalPages(referenceDir);
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
    entries.push(parseReferencePage(page.id, page.text));
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  const withTable = entries.filter((entry) => entry.signatures.length > 0).length;
  const withSummary = entries.filter((entry) => entry.summary.length > 0).length;
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

  console.log(
    [
      `条目 ${entries.length}（有签名表 ${withTable}，有摘要 ${withSummary}）`,
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

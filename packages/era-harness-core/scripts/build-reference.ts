/**
 * 把 emuera.sk.doc 的 Reference 页面抓下来，生成本地指令知识库数据。
 *
 * 用法（在 `era harness/` 目录下）：
 *   npm run build:reference                 # 抓取 → 解析 → 写 src/reference/data/
 *   npm run build:reference -- --offline    # 只用缓存，不联网（改解析器时用）
 *
 * 为什么是「生成 TS」而不是「运行时读 JSON」：
 *   数据要被**两处**同时消费——核心库的 MCP server 与插件的 esbuild 打包。
 *   JSON 需要额外的文件拷贝与路径解析（dev / 装机 / 多根工作区各不相同），
 *   TS 常量则由 tsc 与 esbuild 直接内联，零运行时路径问题。
 *
 * 许可：上游是 CC BY-NC 4.0。生成的文件顶部带来源与许可声明，
 * 与代码的 Apache-2.0 分开管理（见 NOTICE-emuera-sk-doc.md）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseReferencePage } from '../src/reference/parse.js';
import type { ReferenceEntry } from '../src/reference/types.js';

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
  const sha = await resolveSourceRef(options);
  console.error(`上游版本：${sha}`);

  const pages = await loadPages(options, sha);
  if (pages.length === 0) {
    throw new Error('没抓到任何页面，检查网络或 --offline 缓存');
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

/**
 * 指令知识库的检索与排版。
 *
 * 只做**纯函数 + 内存数据**，不碰文件系统：数据由 `./data/index.ts` 静态内联，
 * 这样插件（esbuild 打包）与 MCP server（tsx 直跑）能用同一份实现。
 */
import type { ReferenceEntry, ReferenceHit, ReferenceSignature } from './types.js';

/** 单条正文的输出上限：避免一条指令把上下文吃掉 */
const MAX_BODY_CHARS = 4000;

/** 检索结果里每条摘要的最大长度 */
const MAX_SUMMARY_CHARS = 160;

function normalizeName(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * 去掉指令名的前缀/括号记号。
 *
 * 库里存的是 `#LOCALSIZE`、`@EVENTLOAD`、`[SKIPSTART]`，而模型和用户几乎总是写成
 * `LOCALSIZE` / `EVENTLOAD` / `SKIPSTART`。不做这一层归一，查 `LOCALSIZE` 会直接落空，
 * 模型就退回训练记忆去猜 —— 这正是容量指令被误删的起点。
 */
function stripSigil(name: string): string {
  return name.replace(/^[#@]/, '').replace(/^\[/, '').replace(/\]$/, '');
}

/** id 的末段：`Emuera/function#LOCALSIZE` → `LOCALSIZE`；`PRINT` → `PRINT` */
function idTail(id: string): string {
  const tail = id.split(/[#/]/).pop();
  return (tail ?? id).toUpperCase();
}

/** 同页标识：切段条目共用一个 `pageId`，搜索时用来限制同页霸榜 */
function pageKey(entry: ReferenceEntry): string {
  return entry.pageId ?? entry.sourcePath ?? entry.id;
}

/** 全部可检索名字（去重、排序），用于告诉模型「库里有什么」 */
export function listReferenceNames(entries: readonly ReferenceEntry[]): string[] {
  const names = new Set<string>();
  for (const entry of entries) {
    for (const name of entry.names) {
      names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * 按名字精确查。
 *
 * 同名可能出现在多页（如 `PRINT` 既是 PRINT 页的主名，也被 PRINTC/PRINTN 页引用），
 * 所以优先返回**id 末段与名字相同**的那条，其次返回第一个覆盖该名字的条目。
 *
 * 第二轮是「去记号」匹配：`LOCALSIZE` 能查到 `#LOCALSIZE`，`EVENTLOAD` 能查到 `@EVENTLOAD`。
 */
export function findReference(
  entries: readonly ReferenceEntry[],
  name: string,
): { entry: ReferenceEntry; name: string } | undefined {
  const target = normalizeName(name);
  if (!target) {
    return undefined;
  }

  const owners = entries.filter((entry) => entry.names.includes(target));
  if (owners.length > 0) {
    const exact = owners.find((entry) => idTail(entry.id) === target);
    return { entry: exact ?? owners[0]!, name: target };
  }

  const bare = stripSigil(target);
  if (!bare) {
    return undefined;
  }
  const relaxed: { entry: ReferenceEntry; name: string }[] = [];
  for (const entry of entries) {
    for (const candidate of entry.names) {
      if (stripSigil(candidate) === bare) {
        relaxed.push({ entry, name: candidate });
        break;
      }
    }
  }
  if (relaxed.length === 0) {
    return undefined;
  }
  const exact = relaxed.find((item) => idTail(item.entry.id) === bare);
  return exact ?? relaxed[0]!;
}

/** 找出所有覆盖某个名字的条目（含同名多页） */
export function findAllReferences(entries: readonly ReferenceEntry[], name: string): ReferenceEntry[] {
  const target = normalizeName(name);
  return entries.filter((entry) => entry.names.includes(target));
}

function makeSnippet(body: string, needle: string): string | undefined {
  const index = body.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) {
    return undefined;
  }
  const start = Math.max(0, index - 40);
  const end = Math.min(body.length, index + needle.length + 60);
  const piece = body
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim();
  return `${start > 0 ? '…' : ''}${piece}${end < body.length ? '…' : ''}`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  let count = 0;
  let index = 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  while ((index = lowerHay.indexOf(lowerNeedle, index)) !== -1) {
    count++;
    index += lowerNeedle.length;
    if (count >= 20) {
      break;
    }
  }
  return count;
}

/**
 * 关键词检索。
 *
 * 打分优先级：名字精确 > 名字前缀 > 名字包含 > 标题包含 > 正文包含。
 * 名字命中时分数远高于正文，保证「查 PRINT」不会先给一堆例子里提到 PRINT 的页面。
 */
export function searchReference(
  entries: readonly ReferenceEntry[],
  query: string,
  limit = 8,
): ReferenceHit[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const upper = trimmed.toUpperCase();
  const best = new Map<string, ReferenceHit>();

  const consider = (entry: ReferenceEntry, hit: ReferenceHit): void => {
    const previous = best.get(entry.id);
    if (!previous || hit.score > previous.score) {
      best.set(entry.id, hit);
    }
  };

  for (const entry of entries) {
    // 1) 名字
    for (const name of entry.names) {
      if (name === upper) {
        consider(entry, { entry, field: 'name', score: 1000 });
      } else if (name.startsWith(upper)) {
        consider(entry, { entry, field: 'name', score: 800 - Math.min(100, name.length - upper.length) });
      } else if (name.includes(upper)) {
        consider(entry, { entry, field: 'name', score: 600 });
      }
    }
    // 2) 标题
    if (entry.title.toUpperCase().includes(upper)) {
      consider(entry, { entry, field: 'title', score: 400 });
    }
    // 3) 正文
    const occurrences = countOccurrences(entry.body, trimmed);
    if (occurrences > 0) {
      consider(entry, {
        entry,
        field: 'body',
        score: 200 + occurrences,
        snippet: makeSnippet(entry.body, trimmed),
      });
    }
  }

  const sorted = [...best.values()].sort(
    (a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id),
  );

  // 同页最多 2 条：规格页一页切成几十段，不限制的话搜 `function` 会被整页小节霸榜
  const perPage = new Map<string, number>();
  const limited: ReferenceHit[] = [];
  const cap = Math.max(1, limit);
  for (const hit of sorted) {
    const key = pageKey(hit.entry);
    const used = perPage.get(key) ?? 0;
    if (used >= 2) {
      continue;
    }
    perPage.set(key, used + 1);
    limited.push(hit);
    if (limited.length >= cap) {
      break;
    }
  }
  return limited;
}

/** 把一条签名排成一行 */
function formatSignature(signature: ReferenceSignature): string {
  const params = signature.params && signature.params !== '无' ? signature.params : '';
  const returns = signature.returns && signature.returns !== '无' ? signature.returns : '';
  const engines = signature.engines.length > 0 ? `  [${signature.engines.join('/')}]` : '';
  const head = `${signature.name}(${params})${returns ? ` → ${returns}` : ''}`;
  const overloads = signature.overloads.map((item) => `\n  ↳ (${item})`).join('');
  return `- ${head}${engines}${overloads}`;
}

/** 单条指令的完整排版（工具返回给模型的就是这个） */
export function formatReferenceEntry(entry: ReferenceEntry): string {
  const lines: string[] = [];
  const primary = entry.names[0] ?? entry.id;
  // 标题里已经写了名字就不再重复；`Emuera/function#LOCALSIZE` 这种路径式 id 不该出现在正文
  const needsLabel = primary.length > 0 && !entry.title.toUpperCase().includes(primary.toUpperCase());
  lines.push(`# ${entry.title}${needsLabel ? `（${primary}）` : ''}`);
  if (entry.names.length > 0) {
    lines.push(`覆盖名字：${entry.names.join('、')}`);
  }
  if (entry.signatures.length > 0) {
    lines.push('', '## 签名', ...entry.signatures.map(formatSignature));
  }
  if (entry.summary) {
    lines.push('', `> ${entry.summary.slice(0, MAX_SUMMARY_CHARS)}`);
  }
  lines.push('', '## 说明', entry.body.length > MAX_BODY_CHARS ? `${entry.body.slice(0, MAX_BODY_CHARS)}\n\n（说明过长已截断，共 ${entry.body.length} 字符）` : entry.body);
  return lines.join('\n');
}

/** 检索结果的列表排版 */
export function formatReferenceHits(hits: readonly ReferenceHit[], query: string): string {
  if (hits.length === 0) {
    return (
      `指令库里没有找到与「${query}」相关的条目。\n` +
      '可以：① 换更短的关键词或英文原名（如 LOCALSIZE 而不是「局部容量」）；' +
      '② 用 mode=names 先看库里有什么；③ 直接用 web_fetch 读上游规格页 ' +
      'https://qirchen421.github.io/emuera.sk.doc/zh/index.html 。'
    );
  }
  const lines = hits.map((hit) => {
    const names = hit.entry.names.slice(0, 6).join('、');
    const label = hit.entry.names[0] ?? hit.entry.id;
    const where = hit.field === 'body' ? '正文' : hit.field === 'name' ? '名字' : '标题';
    const snippet = hit.snippet ? `\n    ${hit.snippet}` : '';
    return `- [${label}] ${hit.entry.title}（${where}命中）\n    名字：${names}${snippet}`;
  });
  return `找到 ${hits.length} 条：\n${lines.join('\n')}\n\n用 mode=lookup + name=<名字> 取完整说明。`;
}

/**
 * emuera.sk.doc **规格页**（`docs/Emuera/*.zh.md`）的切段解析器。
 *
 * 与 `parse.ts` 的分工：
 * - `parse.ts` 解 Reference API 页：一页一条，靠「签名表」抽名字。
 * - 本文件解规格页：一页里塞了几十个 `###` 小节，一条 entry 装不下
 *   （`docs/Emuera/function.zh.md` 只有 11 KB，却含 26 个标题，
 *   而 `#LOCALSIZE` 的说明在第 193 行 —— 整页入库必被正文上限截掉）。
 *
 * 上游标题形态（实测）：
 *
 *   ### `#LOCALSIZE <常量表达式>`,`#LOCALSSIZE <常量表达式>`
 *   ### `#DIM`
 *   ### `@EVENTLOAD`
 *   ### `[SKIPSTART]`～`[SKIPEND]`
 *   ### 参数省略与兼容设置 {#arg-omission}   ← 带锚点、无指令名
 *   ### 格式                                  ← 无指令名，是上一节的子标题
 *
 * 所以三个坑必须处理：
 * 1. **一个标题挂多条指令**（逗号分隔、各带 `<占位符>`）；
 * 2. **无名字的 `###`** 要并入上一节，不能单独成条；
 * 3. **代码围栏里的 `#DIM`** 不是标题，必须靠围栏状态排除。
 */
import { extractSummary, normalizeBody } from './parse.js';
import type { ReferenceEntry } from './types.js';

/** `#LOCALSIZE` / `#DIM` 这类预处理器 */
const HASH_RE = /^#[A-Z][A-Z0-9_]*$/;
/** `@EVENTLOAD` 这类系统函数 */
const AT_RE = /^@[A-Z][A-Z0-9_]*$/;
/** `[SKIPSTART]` 这类表示特殊块的行 */
const BLOCK_RE = /^\[[A-Z][A-Z0-9_]*\]$/;

/** `##` 分组标题 / `###`、`####` 小节标题（Emuera 页两种层级混用） */
const HEADING_RE = /^(#{2,4})\s+(.*)$/;
/** 行尾锚点 `{#arg-omission}` */
const ANCHOR_RE = /\s*\{#[^}]*\}\s*$/;
/** 反引号包裹的名字 */
const BACKTICK_RE = /`([^`]+)`/g;
/** `<code>` 包裹的名字（个别页用 HTML 而非反引号） */
const CODE_TAG_RE = /<code>([\s\S]*?)<\/code>/g;
/** 占位符起点：`<常量表达式>`、`（int）`、`(S)` */
const PLACEHOLDER_RE = /[<（(].*$/;
/** 名字之间的分隔符 */
const NAME_SEP_RE = /[,，、]/;

export interface SpecSection {
  /** 原始标题文本（已去锚点，未去反引号） */
  heading: string;
  /** 本节正文（含被并入的无名子标题） */
  body: string;
  /** 所属 `##` 分组名，用于排错与可读性 */
  group: string;
}

/** 去掉 frontmatter（`parse.ts` 里的同名函数未导出，这里独立实现以免动它） */
function stripFrontMatter(markdown: string): string {
  if (!markdown.startsWith('---')) {
    return markdown;
  }
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) {
    return markdown;
  }
  const after = markdown.indexOf('\n', end + 1);
  return after === -1 ? '' : markdown.slice(after + 1);
}

/**
 * 指令名 → id 末段。
 *
 * `#` 是 id 里「页面/小节」的分隔符，不能重复出现（`Emuera/function##LOCALSIZE` 读起来是错的）；
 * 方括号同理会让 id 变形。所以末段只留纯标识符：
 * `#LOCALSIZE` → `LOCALSIZE`、`@EVENTLOAD` → `EVENTLOAD`、`[SKIPSTART]` → `SKIPSTART`。
 * 完整指令名仍保留在 `names` 里，检索不受影响。
 */
function idSegment(name: string): string {
  if (name.startsWith('#')) {
    return name.slice(1);
  }
  if (name.startsWith('@')) {
    return name.slice(1);
  }
  if (name.startsWith('[') && name.endsWith(']')) {
    return name.slice(1, -1);
  }
  return name;
}

/** 取 H1 作为页面标题 */
export function specPageTitle(markdown: string): string | undefined {
  const match = /^#\s+(\S.*)$/m.exec(stripFrontMatter(markdown));
  return match?.[1]?.trim();
}

/**
 * 从标题里抽出指令名。
 *
 * `` `#LOCALSIZE <常量表达式>`,`#LOCALSSIZE <常量表达式>` `` → `['#LOCALSIZE', '#LOCALSSIZE']`
 * `参数省略与兼容设置 {#arg-omission}` → `[]`
 *
 * 兜底：`variables.zh.md` 里有一批**裸大写**的变量名标题（`#### LOCAL`、`#### LOCALS`，
 * 没加反引号）。反引号里抽不到名字时，若整条标题就是一个全大写标识符，也认。
 * 中文标题（`### 核心概念区分`）与带占位符的标题（`#### （用户定义的私有变量）`）
 * 在这一步会被自然排除。
 */
export function extractDirectiveNames(heading: string): string[] {
  const cleaned = heading.replace(ANCHOR_RE, '').trim();
  const spans: string[] = [];
  for (const match of cleaned.matchAll(BACKTICK_RE)) {
    spans.push(match[1] ?? '');
  }
  if (spans.length === 0) {
    for (const match of cleaned.matchAll(CODE_TAG_RE)) {
      spans.push(match[1] ?? '');
    }
  }

  const names: string[] = [];
  for (const span of spans) {
    for (const piece of span.split(NAME_SEP_RE)) {
      // 先去占位符再大写：占位符可能是全角括号，必须在 uppercase 之前切掉
      const token = piece.replace(PLACEHOLDER_RE, '').trim().toUpperCase();
      if (!token) {
        continue;
      }
      if (!HASH_RE.test(token) && !AT_RE.test(token) && !BLOCK_RE.test(token)) {
        continue;
      }
      if (!names.includes(token)) {
        names.push(token);
      }
    }
  }

  if (names.length === 0) {
    const bare = cleaned.replace(/`/g, '').replace(PLACEHOLDER_RE, '').trim().toUpperCase();
    if (/^[A-Z][A-Z0-9_]{1,}$/.test(bare)) {
      names.push(bare);
    }
  }

  return names;
}

/**
 * 按 `##` / `###` 切段。`##` 只作分组（关闭当前段），`####` 留在段内。
 *
 * 围栏状态内的 `###` 不当标题 —— 上游示例代码里大量出现 `#DIM`，
 * 若只按行首 `#` 判断会切出一堆假小节。
 */
export function splitSections(markdown: string): SpecSection[] {
  const lines = stripFrontMatter(markdown.replace(/\r\n/g, '\n')).split('\n');
  const sections: SpecSection[] = [];

  let group = '';
  /** `##` 下、首个 `###` 之前的正文，挂到该组第一个小节前面 */
  let groupLead = '';
  let current: SpecSection | undefined;
  let inFence = false;

  const flush = (): void => {
    if (current) {
      sections.push(current);
      current = undefined;
    }
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      if (current) {
        current.body += `${line}\n`;
      } else {
        groupLead += `${line}\n`;
      }
      continue;
    }

    if (!inFence) {
      const match = HEADING_RE.exec(line);
      if (match) {
        const level = (match[1] ?? '').length;
        const text = (match[2] ?? '').replace(ANCHOR_RE, '').trim();
        if (level === 2) {
          flush();
          group = text;
          groupLead = '';
          continue;
        }
        // level >= 3：`###` 与 `####` 都当小节边界（Emuera 页两种层级混用）
        flush();
        current = { heading: text, body: groupLead, group };
        groupLead = '';
        continue;
      }
    }

    if (current) {
      current.body += `${line}\n`;
    } else {
      groupLead += `${line}\n`;
    }
  }
  flush();

  return sections;
}

/**
 * 解析一个规格页，切成若干条目。
 *
 * 每条 entry 的 `id` 是 `<slug>#<首个名字>`，`pageId` 指回页面；
 * 正文是**该小节**的正文（不是整页），因此不会撞上 `MAX_BODY_CHARS`。
 *
 * @param slug 页面 slug，如 `Emuera/function`
 * @param sourcePath 上游仓库内相对路径，如 `docs/Emuera/function.zh.md`
 */
export function parseSpecPage(
  slug: string,
  sourcePath: string,
  markdown: string,
): ReferenceEntry[] {
  const pageTitle = specPageTitle(markdown) ?? slug;
  const sections = splitSections(markdown);

  const entries: ReferenceEntry[] = [];
  const usedIds = new Set<string>();
  let pending: { names: string[]; title: string; body: string } | undefined;
  /** 第一个具名小节之前的无主内容：不能丢，挂到下一个具名小节前面 */
  let orphan = '';

  const flush = (): void => {
    if (!pending) {
      return;
    }
    const body = normalizeBody(pending.body);
    let id = `${slug}#${idSegment(pending.names[0] ?? '')}`;
    if (usedIds.has(id)) {
      let suffix = 2;
      while (usedIds.has(`${id}~${suffix}`)) {
        suffix++;
      }
      id = `${id}~${suffix}`;
    }
    usedIds.add(id);
    entries.push({
      id,
      pageId: slug,
      sourcePath,
      localOnly: true,
      title: pending.title,
      names: pending.names,
      signatures: [],
      // 有些小节正文全是表格（variables 页的 ARG / GLOBAL 等），抽不到首段时用标题兜底
      summary: extractSummary(body) || pending.title,
      body,
    });
    pending = undefined;
  };

  for (const section of sections) {
    const names = extractDirectiveNames(section.heading);
    const headingText = section.heading.replace(/`/g, '').trim();

    if (names.length === 0) {
      // 无名小节（「格式」「参数初始值」这类）是上一节的补充说明，并入而不单独成条
      const chunk = headingText ? `\n### ${headingText}\n\n${section.body}` : section.body;
      if (pending) {
        pending.body += chunk;
      } else {
        orphan += chunk;
      }
      continue;
    }

    flush();
    pending = { names, title: headingText, body: orphan + section.body };
    orphan = '';
  }
  flush();

  if (entries.length > 0) {
    return entries;
  }

  // 整页一个指令名都没抽到（如纯概念页）：退回单条页面级条目，
  // 名字取 H1 里能识别的指令名，抽不到就留空 —— 至少正文能按标题检索到。
  const body = normalizeBody(stripFrontMatter(markdown));
  return [
    {
      id: slug,
      sourcePath,
      title: pageTitle,
      names: extractDirectiveNames(`\`${pageTitle}\``),
      signatures: [],
      summary: extractSummary(body) || pageTitle,
      body,
    },
  ];
}

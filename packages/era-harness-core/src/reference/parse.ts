/**
 * emuera.sk.doc Reference 页面解析器。
 *
 * 上游是 MkDocs Material 站点的源文件，形态比较规整：
 *
 *   ---
 *   hide:
 *     - toc
 *   ---
 *
 *   # SETCOLOR, RESETCOLOR
 *
 *   | 函数名 | 参数 | 返回值 |
 *   | :--- | :--- | :----- |
 *   | ![](../assets/images/IconEmuera.webp)[`SETCOLOR`](./SETCOLOR.zh.md) | `int`, `int`, `int` | 无 |
 *   |                                                                      | `int`                | 无 |
 *
 *   !!! info "API"
 *       ``` { #language-erbapi }
 *       SETCOLOR R, G, B
 *       ```
 *       将文字颜色更改为指定颜色……
 *
 * 但**不保证**规整：缩进混用 Tab 与空格、admonition 可嵌套、表格用空名字单元格续写重载、
 * 个别页面用 `<code>` 而不是反引号。因此这里只做保守解析：
 * - 结构化只取「标题 + 签名表」这两样机器能可靠识别的东西；
 * - 其余正文**原样保留**，只做去噪（图标 / 内部链接 / 围栏属性）与空白归一。
 *
 * 这样即使上游改版，最坏情况也只是少了结构化字段，正文不会丢。
 */
import type { EngineOrigin, ReferenceEntry, ReferenceSignature } from './types.js';

/** 上游用图标表示「哪个引擎引入/改写了这条指令」 */
const ICON_ENGINE: Record<string, EngineOrigin> = {
  iconeramaker: 'eramaker',
  iconemuera: 'emuera',
  iconem: 'em',
  iconee: 'ee',
  icondotnet: 'net',
  iconsk: 'skia',
  iconetc: 'etc',
};

/** 正文里把图标换成方括号标记，保留「这句是哪个引擎的特性」这一信息 */
const ICON_LABEL: Record<EngineOrigin, string> = {
  eramaker: '[eramaker]',
  emuera: '[Emuera]',
  em: '[EM]',
  ee: '[EE]',
  net: '[.NET]',
  skia: '[Skia]',
  etc: '[etc]',
};

const ICON_RE = /!\[\]\([^)]*Icon([A-Za-z]+)\.webp\)/g;
const FENCE_ATTR_RE = /^(\s*)```+\s*\{\s*#language-([A-Za-z0-9_-]+)[^}]*\}\s*$/;
const FENCE_TITLE_RE = /^(\s*)```+\s*title="([^"]*)"\s*$/;
const INTERNAL_LINK_RE = /\[([^\]]*)\]\(\.?\/?[A-Za-z0-9_.-]+\.zh\.md\)/g;
const CODE_TAG_RE = /<code>([\s\S]*?)<\/code>/g;

/** 把一行表格拆成单元格：尊重 `\|` 转义与反引号包裹 */
export function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let inCode = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i] ?? '';
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (ch === '`') {
      inCode = !inCode;
      current += ch;
      continue;
    }
    if (ch === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

/** 从单元格里抽出图标对应的引擎（按出现顺序去重） */
export function extractEngines(cell: string): EngineOrigin[] {
  const found: EngineOrigin[] = [];
  for (const match of cell.matchAll(ICON_RE)) {
    const key = `icon${(match[1] ?? '').toLowerCase()}`;
    const engine = ICON_ENGINE[key];
    if (engine && !found.includes(engine)) {
      found.push(engine);
    }
  }
  return found;
}

/**
 * 从名字单元格里抽出命令名。
 *
 * 单元格形态有 ``[`SETCOLOR`](./SETCOLOR.zh.md)``、``[<code>PRINT(\|V\|S\|FORM\|FORMS)…</code>](…)``，
 * 后者是「签名模式」而不是单个名字，所以只取开头那段标识符；
 * 还有 `(S)IF` 这种把两个名字写进一个标记的，先剥掉括号前缀。
 */
export function extractName(cell: string): string | undefined {
  const code = /<code>([\s\S]*?)<\/code>/.exec(cell)?.[1] ?? /`([^`]+)`/.exec(cell)?.[1];
  const source = (code ?? cell).replace(/\\\|/g, '|').replace(/^[ \t]*\([^)]*\)/, '');
  const match = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)/.exec(source);
  return match?.[1]?.toUpperCase();
}

/** 从 erbapi 代码块推断本页还覆盖哪些名字（签名块首行的首个标识符） */
function namesFromApiBlock(body: string): string[] {
  const names: string[] = [];
  const lines = body.split('\n');
  let inside = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!inside) {
      if (/^```+\s*\{\s*#language-erbapi/.test(line)) {
        inside = true;
      }
      continue;
    }
    if (line.startsWith('```')) {
      inside = false;
      continue;
    }
    if (!line) {
      continue;
    }

    const tokens = line.split(/\s+/);
    // 去掉 `a.` / `b.` 这类重载编号
    if (/^[a-z]\.$/.test(tokens[0] ?? '')) {
      tokens.shift();
    }
    // 去掉返回类型
    if (/^(int|string|float|double|bool|void)$/.test(tokens[0] ?? '')) {
      tokens.shift();
    }
    const head = (tokens[0] ?? '').replace(/[(（].*$/, '');
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(head)) {
      names.push(head.toUpperCase());
    }
  }
  return names;
}

/** 去掉 frontmatter，返回正文 */
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

/** 正文去噪：图标 → 方括号标记，内部链接 → 纯名字，围栏属性 → 语言标记 */
export function normalizeBody(text: string): string {
  const out: string[] = [];

  for (const rawLine of text.split('\n')) {
    let line = rawLine
      .replace(ICON_RE, (whole, kind: string) => ICON_LABEL[ICON_ENGINE[`icon${kind.toLowerCase()}`] ?? 'etc'] ?? '')
      .replace(CODE_TAG_RE, '`$1`')
      .replace(INTERNAL_LINK_RE, '$1');

    const fenceAttr = FENCE_ATTR_RE.exec(line);
    if (fenceAttr) {
      line = `${fenceAttr[1] ?? ''}\`\`\`erb`;
    } else {
      const fenceTitle = FENCE_TITLE_RE.exec(line);
      if (fenceTitle) {
        line = `${fenceTitle[1] ?? ''}\`\`\`text`;
      }
    }

    out.push(line.replace(/[ \t]+$/, ''));
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 取首段正文作为摘要（跳过标题、表格、admonition 标记与代码块） */
export function extractSummary(body: string): string {
  let inFence = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !line) {
      continue;
    }
    if (/^[#|>!-]/.test(line) || /^\*\s/.test(line)) {
      continue;
    }
    const plain = line
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      .trim();
    if (plain.length >= 6) {
      return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
    }
  }
  return '';
}

/** 解析签名表；表格不存在或格式异常时返回空数组 */
export function parseSignatureTable(
  lines: readonly string[],
  /** 名字单元格抽不出名字时的兑底（用页面文件名主干，如 GETMEMORYUSAGE） */
  fallbackName?: string,
): {
  signatures: ReferenceSignature[];
  tableStart: number;
  tableEnd: number;
} {
  const headerIndex = lines.findIndex((line) => /^\|\s*(函数名|Function)\s*\|/i.test(line));
  if (headerIndex === -1) {
    return { signatures: [], tableStart: -1, tableEnd: -1 };
  }

  const signatures: ReferenceSignature[] = [];
  let index = headerIndex + 1;
  // 跳过 | :--- | 分隔行与表头
  if ((lines[index] ?? '').trim().startsWith('|')) {
    index++;
  }

  for (; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (!line.trim().startsWith('|')) {
      break;
    }
    const cells = splitTableRow(line);
    const params = cells[1] ?? '';
    const returns = cells[2] ?? '';
    let name = extractName(cells[0] ?? '');

    if (!name) {
      const previous = signatures[signatures.length - 1];
      if (previous) {
        // 空名字单元格 = 同一名字的重载，挂到上一条
        if (params && params !== '无') {
          previous.overloads.push(params);
        }
        continue;
      }
      // 首行就没名字（上游有个别页写成空代码块），退回文件名主干
      name = fallbackName;
      if (!name) {
        continue;
      }
    }
    signatures.push({
      name,
      params,
      returns,
      engines: extractEngines(cells[0] ?? ''),
      overloads: [],
    });
  }

  return { signatures, tableStart: headerIndex, tableEnd: index };
}

/**
 * 解析一个 Reference 页面。
 *
 * @param id 页面文件名主干（已去掉 `.zh.md`）
 */
export function parseReferencePage(id: string, markdown: string): ReferenceEntry {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const stripped = stripFrontMatter(normalized);
  const lines = stripped.split('\n');

  const titleIndex = lines.findIndex((line) => /^#\s+\S/.test(line));
  const title = titleIndex === -1 ? id : (lines[titleIndex] ?? '').replace(/^#\s+/, '').trim();

  const { signatures, tableStart, tableEnd } = parseSignatureTable(lines, id.toUpperCase());

  // 正文 = 标题之后、去掉签名表
  const bodyParts: string[] = [];
  if (tableStart === -1) {
    bodyParts.push(...lines.slice(titleIndex === -1 ? 0 : titleIndex + 1));
  } else {
    bodyParts.push(...lines.slice(titleIndex === -1 ? 0 : titleIndex + 1, tableStart));
    bodyParts.push(...lines.slice(tableEnd));
  }
  // 注意：别名必须在 normalizeBody **之前**提取 —— 归一化会把围栏上的
  // `{ #language-erbapi }` 改写成 ```erb，之后就认不出了。
  const apiNames = namesFromApiBlock(bodyParts.join('\n'));
  const body = normalizeBody(bodyParts.join('\n'));

  // 名字 = 表格里的名字 + 签名块推断 + 标题里的纯大写词
  const names: string[] = [];
  for (const signature of signatures) {
    if (!names.includes(signature.name)) {
      names.push(signature.name);
    }
  }
  for (const name of apiNames) {
    if (!names.includes(name)) {
      names.push(name);
    }
  }
  for (const token of title.split(/[,，、/\s]+/)) {
    const word = token.trim().replace(/系$/, '');
    if (/^[A-Z][A-Z0-9_]{1,}$/.test(word) && !names.includes(word)) {
      names.push(word);
    }
  }
  // 页面主干本身也是一个名字（如 DT_ROW 这种「分组页」，表格里只有 DT_ROW_ADD 等成员）
  const idUpper = id.toUpperCase();
  if (!names.includes(idUpper)) {
    names.push(idUpper);
  }

  return {
    id,
    title,
    names,
    signatures,
    summary: extractSummary(body),
    body,
  };
}

/**
 * 把「已启用」的知识库索引拼成系统提示里的一个小节。
 *
 * 三个刻意的取舍：
 * 1. **只注入索引，不注入分片**：一个游戏几千个函数，全量进提示词会直接把上下文吃光；
 *    索引一行一条，够模型判断「要不要深入」，细节让它 `read_file`。
 * 2. **措辞必须是「参考，不是铁律」**：库是 AI 生成的，会有错、会过期。写成铁律
 *    等于把模型的错误固化成规则（这正是现有 `era_domain` 铁律小节要避免的）。
 * 3. **限量**：单库 2500 字符、总量 6000 字符，超了截断并明确告诉模型「去读全文」。
 */

/** 单库索引上限（字符） */
export const MAX_INDEX_CHARS_PER_KB = 2500;
/** 全部知识库合计上限（字符） */
export const MAX_TOTAL_CHARS = 6000;

export interface KnowledgeBaseSectionItem {
  /** 库名（用户起的） */
  name: string;
  /** 目录名，用于拼相对路径 */
  slug: string;
  /** index.md 正文 */
  index: string;
  /** 上次更新时间（ISO 串或空） */
  updatedAt?: string;
  /** 建库时记录的游戏版本 */
  gameVersion?: string;
  /** 本次运行时探测到的游戏版本 */
  currentGameVersion?: string;
  /** 条目统计，如 { function: 12, constant: 8 } */
  counts?: Record<string, number>;
}

function formatCounts(counts: Record<string, number> | undefined): string {
  if (!counts) {
    return '';
  }
  const labels: Record<string, string> = { function: '函数', constant: '常量', table: '表', other: '其他' };
  const parts = Object.entries(counts)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .map(([kind, n]) => `${labels[kind] ?? kind} ${n}`);
  return parts.length > 0 ? parts.join(' / ') : '';
}

function truncate(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, limit), truncated: true };
}

/**
 * 生成小节。没有可用条目时返回空串（调用方据此不追加任何内容，普通项目零影响）。
 */
export function buildKnowledgeBaseSection(items: readonly KnowledgeBaseSectionItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const head = [
    '====',
    '## 专属知识库（参考，不是铁律）',
    '',
    '以下索引由 AI 根据本工程生成、可由用户随时重建。**它不是权威结论**：',
    '- 与你读到的代码冲突时，**以代码为准**，不要拿库里的说法去覆盖实际代码。',
    '- 发现不符：在回复里指出差异，并提示用户到「设置 → 专属知识库」点「更新」；⛔ 不要自行改写库文件。',
    '- 需要细节时用 read_file 读分片文件（索引里每条都带出处路径）。',
  ];

  const blocks: string[] = [];
  let used = 0;

  for (const item of items) {
    const counts = formatCounts(item.counts);
    const meta = [
      `### ${item.name}（\`${item.slug}\`）`,
      `- 索引文件：\`.era-harness/knowledge/${item.slug}/index.md\``,
      item.updatedAt ? `- 更新时间：${item.updatedAt}` : '',
      item.gameVersion
        ? `- 建库时的游戏版本：${item.gameVersion}${
            item.currentGameVersion && item.currentGameVersion !== item.gameVersion
              ? `（当前探测到 ${item.currentGameVersion}，⚠️ 库可能已过期）`
              : ''
          }`
        : '',
      counts ? `- 条目：${counts}` : '',
      '',
    ].filter((line) => line !== '');

    const remaining = MAX_TOTAL_CHARS - used;
    if (remaining <= 200) {
      blocks.push('（还有知识库因长度上限未展开，用 read_file 直接读对应 index.md。）');
      break;
    }

    const cap = Math.min(MAX_INDEX_CHARS_PER_KB, remaining - 200);
    const { text, truncated } = truncate(item.index.trim(), Math.max(cap, 200));
    used += text.length;

    blocks.push(
      [
        ...meta,
        '```markdown',
        text,
        '```',
        truncated ? '（索引过长已截断，用 read_file 读 `index.md` 全文。）' : '',
      ]
        .filter((line) => line !== '')
        .join('\n'),
    );
  }

  return [...head, '', ...blocks, '===='].join('\n');
}

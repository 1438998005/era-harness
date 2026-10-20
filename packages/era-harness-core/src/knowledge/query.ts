import type { KnowledgeEntry, KnowledgeHit, KnowledgeRule } from './types.js';

/** 字段权重：id 精确 > title > tags > summary > body */
const FIELD_WEIGHT = { id: 100, title: 60, tags: 50, summary: 30, body: 10 } as const;

function scoreEntry(entry: KnowledgeEntry, query: string): KnowledgeHit | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const terms = q.split(/\s+/).filter(Boolean);
  let best: KnowledgeHit | null = null;

  const consider = (field: KnowledgeHit['field'], haystack: string, snippet?: string) => {
    let score = 0;
    for (const term of terms) {
      if (haystack.toLowerCase().includes(term)) score += FIELD_WEIGHT[field];
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, field, score, snippet };
    }
  };

  consider('id', entry.id);
  consider('title', entry.title);
  consider('tags', entry.tags.join(' '));
  consider('summary', entry.summary);
  consider('body', entry.body);
  return best;
}

/** 关键词检索（可离线）。多词为 AND-of-any：任一词命中即计分，词越多分越高。 */
export function searchKnowledge(entries: KnowledgeEntry[], query: string, limit = 8): KnowledgeHit[] {
  return entries
    .map((entry) => scoreEntry(entry, query))
    .filter((hit): hit is KnowledgeHit => hit !== null)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, Math.max(1, limit));
}

/** 按 id 精确查（大小写不敏感） */
export function findKnowledge(entries: KnowledgeEntry[], id: string): KnowledgeEntry | undefined {
  const q = id.trim().toLowerCase();
  return entries.find((entry) => entry.id.toLowerCase() === q);
}

/** 供提示层注入：取某条目的铁律（不存在时返回空数组） */
export function knowledgeRulesFor(entries: KnowledgeEntry[], id: string): KnowledgeRule[] {
  return findKnowledge(entries, id)?.rules ?? [];
}

/** 目录：全部条目的 id/title/summary（检索无命中时的兜底展示） */
export function listKnowledgeSummaries(
  entries: KnowledgeEntry[],
): Array<{ id: string; title: string; domain: string; summary: string }> {
  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    domain: entry.domain,
    summary: entry.summary,
  }));
}

/** 单条目完整 markdown（MCP lookup_knowledge 的输出） */
export function formatKnowledgeEntry(entry: KnowledgeEntry): string {
  const rules = entry.rules.map((rule) => `- **${rule.id}** ${rule.text}`).join('\n');
  const pitfalls = entry.pitfalls
    .map((p) => `- 症状：${p.symptom}\n  根因：${p.cause}\n  修法：${p.fix}`)
    .join('\n');
  return [
    `# ${entry.title}`,
    '',
    `> ${entry.summary}`,
    '',
    '## 铁律',
    rules,
    '',
    '## 反模式（症状 → 根因 → 修法）',
    pitfalls,
    '',
    entry.body,
    '',
    '---',
    `来源：${entry.source.upstream}（快照 ${entry.source.snapshotAt}${entry.source.sha ? `，正本 ${entry.source.sha}` : ''}）`,
  ].join('\n');
}

/** 检索命中列表的 markdown（MCP search_knowledge 的输出） */
export function formatKnowledgeHits(hits: KnowledgeHit[], query: string): string {
  if (hits.length === 0) return `（未命中「${query}」）`;
  return hits
    .map((hit) => `- **${hit.entry.title}**（\`${hit.entry.id}\`，命中 ${hit.field}）——${hit.entry.summary}`)
    .join('\n');
}

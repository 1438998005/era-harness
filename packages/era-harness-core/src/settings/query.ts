import type { SettingHit, SettingRecord } from './types.js';

/** 字段权重：key 精确 > title > summary > whenOff > category */
const FIELD_WEIGHT = { key: 100, title: 60, summary: 30, whenOff: 20, category: 15 } as const;

/** 去掉常见包装，让「这个开关」之类的话也能落到检索上 */
function terms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^["'`]|["'`]$/g, ''))
    .filter(Boolean);
}

function scoreSetting(record: SettingRecord, query: string): SettingHit | null {
  const words = terms(query);
  if (words.length === 0) return null;
  let best: SettingHit | null = null;

  const consider = (field: SettingHit['field'], haystack: string) => {
    const lower = haystack.toLowerCase();
    let score = 0;
    for (const word of words) if (lower.includes(word)) score += FIELD_WEIGHT[field];
    if (score > 0 && (!best || score > best.score)) best = { record, field, score };
  };

  consider('key', record.key);
  consider('title', record.title);
  consider('summary', record.summary);
  if (record.whenOff) consider('whenOff', record.whenOff);
  consider('category', record.category);
  return best;
}

/**
 * 按 key 精确查（大小写不敏感）。
 *
 * 支持**后缀模糊**：使用者往往只说 `autoTakeover` 而不是
 * `eraHarness.erabasic.autoTakeover`；feature 的 key 本身就是短名，
 * 所以只在完整键没有精确命中时才退到后缀匹配，且要求后缀唯一。
 */
export function findSetting(catalog: readonly SettingRecord[], key: string): SettingRecord | undefined {
  const q = key.trim().toLowerCase();
  if (!q) return undefined;
  const exact = catalog.find((record) => record.key.toLowerCase() === q);
  if (exact) return exact;

  const suffixMatches = catalog.filter(
    (record) =>
      record.key.toLowerCase().endsWith(`.${q}`) ||
      // 允许把点换成中划线/下划线写（`era_harness.erabasic.auto_takeover`）
      record.key.toLowerCase().replace(/[._-]/g, '').endsWith(q.replace(/[._-]/g, '')),
  );
  return suffixMatches.length === 1 ? suffixMatches[0] : undefined;
}

/** 关键词检索（可离线）。多词为 OR 计分：命中词越多分越高。 */
export function searchSettings(catalog: readonly SettingRecord[], query: string, limit = 8): SettingHit[] {
  return catalog
    .map((record) => scoreSetting(record, query))
    .filter((hit): hit is SettingHit => hit !== null)
    .sort((a, b) => b.score - a.score || a.record.key.localeCompare(b.record.key))
    .slice(0, Math.max(1, limit));
}

export interface SettingCategoryGroup {
  category: string;
  title: string;
  items: Array<{ key: string; title: string; summary: string }>;
}

/** 分组目录（`key` 为空时给模型的兜底展示） */
export function listSettingSummaries(
  catalog: readonly SettingRecord[],
  categories: ReadonlyArray<{ id: string; title: string }>,
): SettingCategoryGroup[] {
  const order = new Map(categories.map((category, index) => [category.id, index]));
  const groups = new Map<string, SettingCategoryGroup>();

  for (const record of catalog) {
    const title = categories.find((category) => category.id === record.category)?.title ?? record.category;
    let group = groups.get(record.category);
    if (!group) {
      group = { category: record.category, title, items: [] };
      groups.set(record.category, group);
    }
    group.items.push({ key: record.key, title: record.title, summary: record.summary });
  }

  return [...groups.values()].sort(
    (a, b) =>
      (order.get(a.category) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.category) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * 单条设置的 markdown（MCP `setting_help` / 原生工具的 key 分支输出）。
 *
 * 刻意不写「推荐开启/关闭」——目录里没有这个信息，`whenOff` 只陈述后果。
 */
export function formatSetting(record: SettingRecord): string {
  const lines: string[] = [`# ${record.title}`, '', `> ${record.summary}`, '', `- **键**：\`${record.key}\``];

  lines.push(`- **分组**：${record.category}`);
  lines.push(
    `- **默认值**：${
      record.defaultValue ??
      (record.valueType?.startsWith('object') ? '（对象，默认值见各子项）' : '（源码里未声明）')
    }`,
  );
  if (record.valueType) lines.push(`- **取值**：${record.valueType}`);
  lines.push(`- **存放位置**：${record.storage}`);
  if (record.whenOff) lines.push(`- **关闭后会怎样**：${record.whenOff}`);
  if (record.related && record.related.length > 0) lines.push(`- **相关设置**：${record.related.join('、')}`);

  lines.push('');
  lines.push(
    record.source === 'vscode-config'
      ? '来源：VS Code 设置项（`package.json` → `contributes.configuration`）'
      : '来源：设置页的「功能」开关（`FeatureToggle` 数组）',
  );
  return lines.join('\n');
}

/** 未收录项的说明（`key` 不在目录里但确实存在时，别装作没有） */
export function formatUncovered(key: string, reason: string): string {
  return [
    `# ${key}`,
    '',
    '这一项**没有**进内置设置目录，原因：',
    '',
    `> ${reason}`,
    '',
    '要回答它具体做什么，只能读源码或直接看设置页，⛔ 不要凭印象猜。',
  ].join('\n');
}

/** 检索命中列表的 markdown */
export function formatSettingHits(hits: SettingHit[], query: string): string {
  if (hits.length === 0) return `（未命中「${query}」）`;
  return hits
    .map((hit) => `- **${hit.record.title}**（\`${hit.record.key}\`，命中 ${hit.field}）——${hit.record.summary}`)
    .join('\n');
}

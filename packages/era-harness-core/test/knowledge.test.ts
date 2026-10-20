import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWLEDGE_ENTRIES,
  KNOWLEDGE_ENTRY_COUNT,
  KNOWLEDGE_SNAPSHOT_AT,
} from '../src/knowledge/data/index.js';
import {
  findKnowledge,
  formatKnowledgeEntry,
  formatKnowledgeHits,
  knowledgeRulesFor,
  listKnowledgeSummaries,
  searchKnowledge,
} from '../src/knowledge/query.js';
import type { KnowledgeEntry } from '../src/knowledge/types.js';

test('条目登记：数量与唯一 id', () => {
  assert.equal(KNOWLEDGE_ENTRY_COUNT, 7);
  const ids = KNOWLEDGE_ENTRIES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'id 必须唯一');
});

test('条目结构：必填字段、rule id 唯一、source 完整', () => {
  for (const entry of KNOWLEDGE_ENTRIES) {
    assert.ok(entry.id && /^[a-z0-9-]+$/.test(entry.id), `id 须为 kebab-case: ${entry.id}`);
    assert.ok(entry.title.length > 0);
    assert.ok(entry.summary.length > 0);
    assert.ok(entry.tags.length >= 3, `${entry.id} tags 过少`);
    assert.ok(entry.rules.length >= 1, `${entry.id} 至少一条铁律`);
    assert.ok(entry.pitfalls.length >= 1, `${entry.id} 至少一个反模式`);
    assert.ok(entry.body.length > 100, `${entry.id} body 过短`);
    const ruleIds = entry.rules.map((rule) => rule.id);
    assert.equal(new Set(ruleIds).size, ruleIds.length, `${entry.id} rule id 须唯一`);
    assert.match(entry.source.snapshotAt, /^\d{4}-\d{2}-\d{2}$/, `${entry.id} snapshotAt 格式`);
    assert.ok(entry.source.upstream.length > 0, `${entry.id} 必须有溯源`);
  }
});

test('快照日期不早于任何条目 snapshotAt', () => {
  for (const entry of KNOWLEDGE_ENTRIES) {
    assert.ok(entry.source.snapshotAt <= KNOWLEDGE_SNAPSHOT_AT, `${entry.id} 快照日期晚于总表`);
  }
});

test('searchKnowledge：编码条目可被中英关键词命中', () => {
  for (const query of ['BOM', 'CP932', '乱码', 'encoding']) {
    const hits = searchKnowledge(KNOWLEDGE_ENTRIES, query);
    assert.ok(hits.length > 0, `「${query}」应命中`);
    assert.equal(hits[0]?.entry.id, 'interpreter-encoding-discipline', `「${query}」首条应为编码纪律`);
  }
});

test('searchKnowledge：闸门与口上条目各自可命中', () => {
  assert.equal(searchKnowledge(KNOWLEDGE_ENTRIES, 'RAND')[0]?.entry.id, 'update-merge-gates');
  assert.equal(searchKnowledge(KNOWLEDGE_ENTRIES, '口上')[0]?.entry.id, 'kojo-structure-contracts');
  assert.equal(searchKnowledge(KNOWLEDGE_ENTRIES, 'M_KOJO')[0]?.entry.id, 'kojo-structure-contracts');
});

test('searchKnowledge：工程结构与主流程条目可命中（T3 第二批）', () => {
  for (const query of ['VariableSize', 'NOW_VERSION', '槽位', 'AutoConst', '容量']) {
    assert.equal(
      searchKnowledge(KNOWLEDGE_ENTRIES, query)[0]?.entry.id,
      'project-structure-discipline',
      `「${query}」首条应为工程结构纪律`,
    );
  }
  for (const query of ['DOTRAIN', 'SOURCE_CHECK', 'TURN_RESET', '时序', 'PREVCOM']) {
    assert.equal(
      searchKnowledge(KNOWLEDGE_ENTRIES, query)[0]?.entry.id,
      'main-flow-pipeline',
      `「${query}」首条应为主流程管线`,
    );
  }
});

test('searchKnowledge：OBJ 数据框架条目可命中（T3 第三批）', () => {
  for (const query of ['O_DATA', 'GETMETH_STR', 'TEMP_STOCK', 'CLASS_NUM', 'NAME2ID']) {
    assert.equal(
      searchKnowledge(KNOWLEDGE_ENTRIES, query)[0]?.entry.id,
      'obj-qol-conventions',
      `「${query}」首条应为 OBJ 约定`,
    );
  }
  const obj = findKnowledge(KNOWLEDGE_ENTRIES, 'obj-qol-conventions');
  assert.equal(obj?.domain, 'project');
  assert.equal(obj?.rules.length, 10);
  // 结构纪律与 OBJ 约定在「衣物」这类共用词上都要能被检索到（谁在前都可接受，但不能双双漏掉）
  const clothes = searchKnowledge(KNOWLEDGE_ENTRIES, '衣物').map((hit) => hit.entry.id);
  assert.ok(clothes.includes('project-structure-discipline'), '「衣物」应命中结构纪律');
  assert.ok(clothes.includes('obj-qol-conventions'), '「衣物」应命中 OBJ 约定');
});

test('新增条目：域与规则量（结构纪律 8 条、主流程 9 条）', () => {
  const structure = findKnowledge(KNOWLEDGE_ENTRIES, 'project-structure-discipline');
  const flow = findKnowledge(KNOWLEDGE_ENTRIES, 'main-flow-pipeline');
  assert.equal(structure?.domain, 'project');
  assert.equal(flow?.domain, 'gameflow');
  assert.equal(structure?.rules.length, 8);
  assert.equal(flow?.rules.length, 9);
  assert.ok(knowledgeRulesFor(KNOWLEDGE_ENTRIES, 'main-flow-pipeline').length === 9);
  // 铁律短句要能直接进系统提示：不能带行号/绝对路径这类工程状态证据
  for (const entry of [structure, flow]) {
    for (const rule of entry?.rules ?? []) {
      assert.doesNotMatch(rule.text, /[Ll]ine\s?\d|#L\d/, `${entry?.id} 铁律含行号证据`);
      assert.doesNotMatch(rule.text, /[A-Za-z]:\\/, `${entry?.id} 铁律含绝对路径`);
    }
  }
});

/**
 * 检索排序锁：每个在册条目配若干「只该由它首条命中」的检索词。
 *
 * 为什么要有这张表：档位是「只进检索」的条目全靠关键词命中被模型看见，
 * 新增条目带来近义 tag 就可能把老条目的主关键词抢走——四关与计数断言都不查这个，
 * 只有「主关键词仍归原主」能被机械锁住。新增条目必须同时补锁（下面有覆盖断言兜着）。
 */
const RANKING_LOCKS: Array<{ query: string; entryId: string }> = [
  { query: 'BOM', entryId: 'interpreter-encoding-discipline' },
  { query: 'CP932', entryId: 'interpreter-encoding-discipline' },
  { query: 'RAND', entryId: 'update-merge-gates' },
  { query: 'G8', entryId: 'update-merge-gates' },
  { query: 'M_KOJO', entryId: 'kojo-structure-contracts' },
  { query: 'NOW_VERSION', entryId: 'project-structure-discipline' },
  { query: 'VariableSize', entryId: 'project-structure-discipline' },
  { query: 'SELECTCOM', entryId: 'main-flow-pipeline' },
  { query: 'O_DATA', entryId: 'obj-qol-conventions' },
  { query: 'GETMETH_STR', entryId: 'obj-qol-conventions' },
  { query: 'UPDATE_MAIN', entryId: 'version-up-and-save-migration' },
  { query: 'modding_version', entryId: 'version-up-and-save-migration' },
  { query: '存档迁移', entryId: 'version-up-and-save-migration' },
  { query: 'bump', entryId: 'version-up-and-save-migration' },
  { query: '静默失声', entryId: 'version-up-and-save-migration' },
  { query: 'idx0', entryId: 'version-up-and-save-migration' },
];

test('searchKnowledge：排序锁全部命中归属条目（新增条目不得抢走老条目的主关键词）', () => {
  for (const { query, entryId } of RANKING_LOCKS) {
    assert.equal(searchKnowledge(KNOWLEDGE_ENTRIES, query)[0]?.entry.id, entryId, `「${query}」首条应为 ${entryId}`);
  }
  const locked = new Set(RANKING_LOCKS.map((lock) => lock.entryId));
  for (const entry of KNOWLEDGE_ENTRIES) {
    assert.ok(locked.has(entry.id), `${entry.id} 没有排序锁——新增条目要顺手补一对主关键词`);
  }
});

test('tags 体检：每条要有独占检索抓手，且一个 tag 最多两个条目共用', () => {
  const owners = new Map<string, string[]>();
  for (const entry of KNOWLEDGE_ENTRIES) {
    for (const tag of entry.tags) {
      owners.set(tag, [...(owners.get(tag) ?? []), entry.id]);
    }
  }
  for (const [tag, list] of owners) {
    assert.ok(list.length <= 2, `tag「${tag}」被 ${list.length} 个条目共用（${list.join('、')}），检索会互相稀释`);
  }
  for (const entry of KNOWLEDGE_ENTRIES) {
    const mine = entry.tags.filter((tag) => (owners.get(tag) ?? []).length === 1).length;
    assert.ok(mine >= 8, `${entry.id} 只剩 ${mine} 个独占 tag，抓不到它就等于没内嵌`);
  }
});

test('版本升级与存档迁移条目：域、规则数与铁律纪律', () => {
  const entry = findKnowledge(KNOWLEDGE_ENTRIES, 'version-up-and-save-migration');
  assert.equal(entry?.domain, 'update');
  assert.equal(entry?.rules.length, 8);
  for (const rule of entry?.rules ?? []) {
    assert.doesNotMatch(rule.text, /[Ll]ine\s?\d|#L\d/, '铁律含行号证据');
    assert.doesNotMatch(rule.text, /[A-Za-z]:\\/, '铁律含绝对路径');
    assert.doesNotMatch(rule.text, /\.ERB/, '铁律含工程文件名证据');
  }
});

test('findKnowledge / knowledgeRulesFor：id 精确查与规则提取', () => {
  const entry = findKnowledge(KNOWLEDGE_ENTRIES, 'update-merge-gates');
  assert.ok(entry);
  assert.equal(entry?.domain, 'update');
  assert.equal(findKnowledge(KNOWLEDGE_ENTRIES, 'no-such-entry'), undefined);
  const rules = knowledgeRulesFor(KNOWLEDGE_ENTRIES, 'interpreter-encoding-discipline');
  assert.ok(rules.length >= 5);
  assert.ok(rules.every((rule) => rule.text.length > 0));
  assert.deepEqual(knowledgeRulesFor(KNOWLEDGE_ENTRIES, 'missing'), []);
});

test('formatKnowledgeEntry：输出含铁律/反模式/溯源三段', () => {
  const entry = KNOWLEDGE_ENTRIES[0] as KnowledgeEntry;
  const md = formatKnowledgeEntry(entry);
  assert.ok(md.includes('## 铁律'));
  assert.ok(md.includes('## 反模式'));
  assert.ok(md.includes(`来源：${entry.source.upstream}`));
  assert.ok(md.includes(`快照 ${entry.source.snapshotAt}`));
});

test('formatKnowledgeHits / listKnowledgeSummaries', () => {
  const hits = searchKnowledge(KNOWLEDGE_ENTRIES, '编码', 3);
  assert.ok(formatKnowledgeHits(hits, '编码').includes('解释器编码纪律'));
  assert.ok(formatKnowledgeHits([], '编码').includes('未命中'));
  const list = listKnowledgeSummaries(KNOWLEDGE_ENTRIES);
  assert.equal(list.length, KNOWLEDGE_ENTRY_COUNT);
  assert.deepEqual(
    list.map((item) => item.id).sort(),
    KNOWLEDGE_ENTRIES.map((entry) => entry.id).sort(),
  );
});

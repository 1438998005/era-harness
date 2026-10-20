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
  assert.equal(KNOWLEDGE_ENTRY_COUNT, 3);
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

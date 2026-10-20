import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_CATALOG, SETTINGS_CATEGORIES, SETTINGS_SNAPSHOT_AT, UNCOVERED_SETTINGS } from '../src/settings/data/index.js';
import { SETTING_KEY_ALIASES, SETTING_OVERRIDES } from '../src/settings/data/overrides.js';
import {
  findSetting,
  formatSetting,
  formatSettingHits,
  formatUncovered,
  listSettingSummaries,
  searchSettings,
} from '../src/settings/query.js';

// ─────────────────────────────────────────────────────────────
// 目录本身
// ─────────────────────────────────────────────────────────────

test('目录非空，key 唯一', () => {
  assert.ok(SETTINGS_CATALOG.length >= 10, `目录只有 ${SETTINGS_CATALOG.length} 项，生成器可能失效了`);
  const keys = SETTINGS_CATALOG.map((record) => record.key);
  assert.equal(new Set(keys).size, keys.length, 'key 必须唯一');
});

test('每条记录都有可展示的标题与说明', () => {
  for (const record of SETTINGS_CATALOG) {
    assert.ok(record.title.length > 0, `${record.key} 缺 title`);
    assert.ok(record.summary.length > 0, `${record.key} 缺 summary`);
    assert.ok(record.category.length > 0, `${record.key} 缺 category`);
    assert.ok(record.storage.length > 0, `${record.key} 缺 storage`);
    assert.ok(
      record.storage.startsWith('state-key:') ||
        record.storage.startsWith('nested:') ||
        record.storage.startsWith('vscode-config:'),
      `${record.key} 的 storage 命名不合规：${record.storage}`,
    );
  }
});

test('source 与 storage 前缀一致', () => {
  for (const record of SETTINGS_CATALOG) {
    if (record.source === 'feature-toggle') {
      assert.match(record.storage, /^(state-key|nested):/, `${record.key} 来自开关但不是 state-key/nested`);
    } else if (record.source === 'vscode-config') {
      assert.ok(record.storage.startsWith('vscode-config:'), `${record.key} 来自 VS Code 配置但前缀不对`);
    }
  }
});

test('分组全部在 SETTINGS_CATEGORIES 里登记', () => {
  const known = new Set(SETTINGS_CATEGORIES.map((category) => category.id));
  for (const record of SETTINGS_CATALOG) {
    assert.ok(known.has(record.category), `${record.key} 的分组 ${record.category} 没有展示名`);
  }
});

test('快照日期格式合法', () => {
  assert.match(SETTINGS_SNAPSHOT_AT, /^\d{4}-\d{2}-\d{2}$/);
});

test('检查点开关在目录里，且说明里带「回滚」这类可判读的后果', () => {
  const checkpoints = findSetting(SETTINGS_CATALOG, 'checkpoints');
  assert.ok(checkpoints, 'checkpoints 应被收录（设置页最典型的开关之一）');
  assert.equal(checkpoints?.source, 'feature-toggle');
  assert.ok(checkpoints?.whenOff && checkpoints.whenOff.length > 0, 'checkpoints 必须写清关闭后果');
});

// ─────────────────────────────────────────────────────────────
// 手写层与目录的一致性（防残留、防重复登记）
// ─────────────────────────────────────────────────────────────

test('overrides 里的键都存在于目录（防手写残留）', () => {
  const keys = new Set(SETTINGS_CATALOG.map((record) => record.key));
  const orphans = Object.keys(SETTING_OVERRIDES).filter((key) => !keys.has(key));
  assert.deepEqual(orphans, [], `overrides 里有目录中不存在的键：${orphans.join(', ')}`);
});

test('UNCOVERED 的键不得同时出现在目录里（防两边都登记）', () => {
  const keys = new Set(SETTINGS_CATALOG.map((record) => record.key));
  const duplicated = Object.keys(UNCOVERED_SETTINGS).filter((key) => keys.has(key));
  assert.deepEqual(duplicated, [], `这些键既在目录又在未收录清单：${duplicated.join(', ')}`);
});

test('UNCOVERED 的每条都给得出原因', () => {
  for (const [key, reason] of Object.entries(UNCOVERED_SETTINGS)) {
    assert.ok(reason.trim().length > 0, `${key} 的白名单说明不能为空`);
  }
});

test('SETTING_KEY_ALIASES 的目标键都在目录里（防别名指向已删设置）', () => {
  const keys = new Set(SETTINGS_CATALOG.map((record) => record.key));
  for (const [protoField, settingKey] of Object.entries(SETTING_KEY_ALIASES)) {
    assert.ok(keys.has(settingKey), `别名 ${protoField} → ${settingKey} 指向了不存在的设置`);
  }
});

// ─────────────────────────────────────────────────────────────
// 检索
// ─────────────────────────────────────────────────────────────

test('findSetting：精确命中', () => {
  assert.equal(findSetting(SETTINGS_CATALOG, 'yolo')?.key, 'yolo');
  assert.equal(findSetting(SETTINGS_CATALOG, 'YOLO')?.key, 'yolo', '大小写不敏感');
  assert.equal(findSetting(SETTINGS_CATALOG, 'eraHarness.erabasic.autoTakeover')?.source, 'vscode-config');
});

test('findSetting：后缀模糊命中（使用者很少写出完整键）', () => {
  assert.equal(findSetting(SETTINGS_CATALOG, 'autoTakeover')?.key, 'eraHarness.erabasic.autoTakeover');
  assert.equal(findSetting(SETTINGS_CATALOG, 'era_harness.erabasic.auto_takeover')?.key, 'eraHarness.erabasic.autoTakeover');
});

test('findSetting：查不到时返回 undefined，不猜', () => {
  assert.equal(findSetting(SETTINGS_CATALOG, 'no-such-setting'), undefined);
  assert.equal(findSetting(SETTINGS_CATALOG, '   '), undefined);
});

test('searchSettings：中文关键词能命中', () => {
  const hits = searchSettings(SETTINGS_CATALOG, '检查点');
  assert.ok(hits.length > 0, '「检查点」应至少命中一项');
  assert.ok(
    hits.some((hit) => hit.record.key === 'checkpoints'),
    `「检查点」没命中 checkpoints，实际命中：${hits.map((hit) => hit.record.key).join(', ')}`,
  );
});

test('searchSettings：英文与 key 前缀都能命中，且按分数降序', () => {
  const hits = searchSettings(SETTINGS_CATALOG, 'subagent');
  assert.ok(hits.length > 0);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1]!.score >= hits[i]!.score, '结果须按分数降序');
  }
});

test('searchSettings：无命中返回空数组，limit 生效', () => {
  assert.deepEqual(searchSettings(SETTINGS_CATALOG, 'zzzz-不存在的词'), []);
  assert.ok(searchSettings(SETTINGS_CATALOG, 'e', 2).length <= 2);
});

// ─────────────────────────────────────────────────────────────
// 渲染
// ─────────────────────────────────────────────────────────────

test('formatSetting：有 whenOff 时输出「关闭后会怎样」段', () => {
  const checkpoints = findSetting(SETTINGS_CATALOG, 'checkpoints');
  assert.ok(checkpoints);
  const text = formatSetting(checkpoints);
  assert.match(text, /关闭后会怎样/);
  assert.match(text, /`checkpoints`/);
  assert.match(text, /默认值/);
});

test('formatSetting：没有 whenOff 时不编造这一段', () => {
  const withoutWhenOff = SETTINGS_CATALOG.find((record) => record.whenOff === undefined);
  if (!withoutWhenOff) return; // 全写了 whenOff 也不该失败
  assert.doesNotMatch(formatSetting(withoutWhenOff), /关闭后会怎样/);
});

test('formatSetting：未声明的默认值如实标注', () => {
  const noDefault = SETTINGS_CATALOG.find((record) => record.defaultValue === undefined);
  if (!noDefault) return;
  assert.match(formatSetting(noDefault), /未声明/);
});

test('listSettingSummaries：分组有序且条目齐全', () => {
  const groups = listSettingSummaries(SETTINGS_CATALOG, SETTINGS_CATEGORIES);
  assert.ok(groups.length > 0);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  assert.equal(total, SETTINGS_CATALOG.length, '分组后条目数必须与目录一致');
  const order = new Map(SETTINGS_CATEGORIES.map((category, index) => [category.id, index]));
  for (let i = 1; i < groups.length; i++) {
    assert.ok(
      (order.get(groups[i - 1]!.category) ?? 99) <= (order.get(groups[i]!.category) ?? 99),
      '分组须按 SETTINGS_CATEGORIES 的顺序',
    );
  }
});

test('formatSettingHits / formatUncovered：空命中与未收录都给明确说法', () => {
  assert.match(formatSettingHits([], '检查点'), /未命中/);
  const [key, reason] = Object.entries(UNCOVERED_SETTINGS)[0]!;
  const text = formatUncovered(key, reason);
  assert.ok(text.includes(key));
  assert.ok(text.includes(reason));
});

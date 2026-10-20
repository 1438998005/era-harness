/**
 * 设置目录的组装点：生成物 → 手写覆盖 → 稳定排序。
 *
 * 三层职责不混：
 *   - `*.generated.ts`：只放机器能抽到的事实（名字、默认值、存储位置）；
 *   - `overrides.ts`  ：只手写人才能判断的东西（关掉会怎样、和谁联动、为什么没收录）；
 *   - 本文件          ：合并 + 排序 + 暴露常量，不含任何知识内容。
 */
import type { SettingRecord } from '../types.js';
import { AUTO_APPROVAL_SETTINGS } from './auto-approval.generated.js';
import { FEATURE_SETTINGS } from './features.generated.js';
import { SETTING_OVERRIDES, UNCOVERED_SETTINGS } from './overrides.js';
import { VSCODE_CONFIG_SETTINGS } from './vscode-config.generated.js';

export { SETTING_KEY_ALIASES, UNCOVERED_SETTINGS } from './overrides.js';

/** 分组的展示名与顺序（顺序即 `listSettingSummaries` 的输出顺序） */
export const SETTINGS_CATEGORIES: ReadonlyArray<{ id: string; title: string }> = [
  { id: 'agent', title: '智能体' },
  { id: 'editor', title: '编辑器' },
  { id: 'experimental', title: '实验' },
  { id: 'advanced', title: '高级' },
  { id: 'erabasic', title: 'erabasic（VS Code 设置）' },
  { id: 'auto-approve', title: '自动批准' },
];

/**
 * 口径日期：生成物本身不带时间戳（否则 `--check` 每天都判过期），
 * 这里是**手写补充层**最后一次对着设置页核对内容的日期。
 */
export const SETTINGS_SNAPSHOT_AT = '2026-10-21';

const CATEGORY_ORDER = new Map(SETTINGS_CATEGORIES.map((category, index) => [category.id, index]));

/** 合并生成物与手写覆盖 */
function merge(generated: readonly SettingRecord[]): SettingRecord[] {
  return generated.map((record) => {
    const override = SETTING_OVERRIDES[record.key];
    if (!override) return record;
    // 覆盖优先，但不要用 undefined 覆盖既有值
    const merged: SettingRecord = { ...record };
    if (override.title !== undefined) merged.title = override.title;
    if (override.summary !== undefined) merged.summary = override.summary;
    if (override.whenOff !== undefined) merged.whenOff = override.whenOff;
    if (override.related !== undefined) merged.related = override.related;
    return merged;
  });
}

const ALL_RECORDS = merge([...FEATURE_SETTINGS, ...VSCODE_CONFIG_SETTINGS, ...AUTO_APPROVAL_SETTINGS]);

/** 全量目录：按分组顺序、组内按生成顺序（保持源码里的排列，不做字母排序） */
export const SETTINGS_CATALOG: readonly SettingRecord[] = ALL_RECORDS.map((record, index) => ({ record, index }))
  .sort((a, b) => {
    const ao = CATEGORY_ORDER.get(a.record.category) ?? Number.MAX_SAFE_INTEGER;
    const bo = CATEGORY_ORDER.get(b.record.category) ?? Number.MAX_SAFE_INTEGER;
    return ao === bo ? a.index - b.index : ao - bo;
  })
  .map((entry) => entry.record);

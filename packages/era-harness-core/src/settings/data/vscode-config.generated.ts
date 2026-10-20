// ⛔ 本文件由 packages/era-harness-core/scripts/build-settings-catalog.ts 生成，不要手改。
// 重新生成：cd packages/era-harness-core && npm run build:settings
// 来源：package.json 的 contributes.configuration.properties
import type { SettingRecord } from '../types.js';

export const VSCODE_CONFIG_SETTINGS: SettingRecord[] = [
  {
    key: 'eraHarness.erabasic.autoTakeover',
    title: 'autoTakeover',
    summary: '未安装 erabasic 时，是否由 era harness 接管 .erb/.erh（写入 files.associations 并启用高亮/补全/跳转）。关闭后仅保留内置方法数据，不修改文件关联。',
    valueType: 'boolean',
    category: 'erabasic',
    storage: 'vscode-config:eraHarness.erabasic.autoTakeover',
    source: 'vscode-config',
  },
];

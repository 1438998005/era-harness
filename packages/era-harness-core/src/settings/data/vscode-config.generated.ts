// ⛔ 本文件由 packages/era-harness-core/scripts/build-settings-catalog.ts 生成，不要手改。
// 重新生成：cd packages/era-harness-core && npm run build:settings
// 来源：package.json 的 contributes.configuration.properties
import type { SettingRecord } from '../types.js';

export const VSCODE_CONFIG_SETTINGS: SettingRecord[] = [
  {
    key: 'eraHarness.erabasic.autoTakeover',
    title: 'autoTakeover',
    summary: '是否由 era harness 提供 .erb/.erh 的 EraBasic 补全/跳转/符号（语法高亮由本扩展的语言声明提供，禁用扩展即自动归还 Ruby，不写你的设置）。关闭后只保留内置方法数据。「让位给 sasami.erabasic」是一条单独的命令，不在这里控制。',
    valueType: 'boolean',
    category: 'erabasic',
    storage: 'vscode-config:eraHarness.erabasic.autoTakeover',
    source: 'vscode-config',
  },
];

// ⛔ 本文件由 packages/era-harness-core/scripts/build-settings-catalog.ts 生成，不要手改。
// 重新生成：cd packages/era-harness-core && npm run build:settings
// 来源：package.json 的 contributes.configuration.properties
import type { SettingRecord } from '../types.js';

export const VSCODE_CONFIG_SETTINGS: SettingRecord[] = [
  {
    key: 'eraHarness.erabasic.languageOwner',
    title: 'languageOwner',
    summary: '`.erb/.erh` 的语法归属。era：由 era harness 的语言声明提供，禁用/卸载即归还 Ruby；sasami：交给 sasami.erabasic（会写入用户级 files.associations）。如果同时装了 sasami.erabasic、想让它的高亮生效，就选 sasami；不确定时保持 era。',
    valueType: '"era" | "sasami"',
    category: 'erabasic',
    storage: 'vscode-config:eraHarness.erabasic.languageOwner',
    source: 'vscode-config',
  },
  {
    key: 'eraHarness.erabasic.autoTakeover',
    title: 'autoTakeover',
    summary: '是否由 era harness 提供 .erb/.erh 的 EraBasic 补全/跳转/符号。关闭后只保留内置方法数据。语法高亮由「EraBasic 语言归属」（eraHarness.erabasic.languageOwner）控制，不在这里。',
    valueType: 'boolean',
    category: 'erabasic',
    storage: 'vscode-config:eraHarness.erabasic.autoTakeover',
    source: 'vscode-config',
  },
];

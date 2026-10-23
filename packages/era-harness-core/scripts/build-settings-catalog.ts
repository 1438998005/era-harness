/**
 * 把「插件自身可设置项」从源码抽取成内嵌目录（`src/settings/data/*.generated.ts`）。
 *
 * 用法（在 `packages/era-harness-core/` 目录下）：
 *   npm run build:settings              # 抽取 → 写 data/
 *   npm run build:settings -- --check   # 只校验生成物是否与源码一致（gate 用），不一致 exit 1
 *
 * 为什么是「生成 TS」而不是运行时读源码：
 *   数据要被两处同时消费——核心库的 MCP server 与插件的 esbuild 打包。运行时去读
 *   `webview-ui/**` 的 TSX 在装机后并不存在（那是 webview 的源码，不进扩展产物），
 *   而 TS 常量由 tsc 与 esbuild 直接内联，零运行时路径问题。
 *
 * 四个来源与它们各自能提供什么：
 *   1. `webview-ui/.../FeatureSettingsSection.tsx` 的 4 个 `FeatureToggle[]` —— id/label/description/stateKey/settingKey；
 *   2. `webview-ui/src/locales/zh-CN/settings.json`  —— 中文 label/description（经 `featureTranslations` 的显式映射，
 *      因为 `show-feature-tips → featureTips`、`yolo → yoloMode` 这类不规则命名靠 camelCase 推不出来）；
 *   3. `src/shared/storage/state-keys.ts`            —— 默认值 / 类型（`default: false as boolean`）；
 *   4. `package.json` 的 `contributes.configuration` —— VS Code 设置项。
 *
 * ⛔ 抽取失败必须显式报错，不许产出空目录（静默抽到 0 项＝模型答「没有这个设置」，比报错更坏）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { SettingRecord } from '../src/settings/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, '..');
const REPO = path.resolve(CORE, '..', '..');

const FEATURE_SECTION = path.join(
  REPO,
  'webview-ui',
  'src',
  'components',
  'settings',
  'sections',
  'FeatureSettingsSection.tsx',
);
const LOCALE_ZH = path.join(REPO, 'webview-ui', 'src', 'locales', 'zh-CN', 'settings.json');
const STATE_KEYS = path.join(REPO, 'src', 'shared', 'storage', 'state-keys.ts');
const AUTO_APPROVAL = path.join(REPO, 'src', 'shared', 'AutoApprovalSettings.ts');
const PACKAGE_JSON = path.join(REPO, 'package.json');

const OUT_FEATURES = path.join(CORE, 'src', 'settings', 'data', 'features.generated.ts');
const OUT_VSCODE = path.join(CORE, 'src', 'settings', 'data', 'vscode-config.generated.ts');
const OUT_AUTO_APPROVAL = path.join(CORE, 'src', 'settings', 'data', 'auto-approval.generated.ts');

/** 4 个数组名 → 目录分组（顺序即输出顺序，保证生成物稳定） */
const ARRAY_CATEGORIES: Array<[string, string]> = [
  ['agentFeatures', 'agent'],
  ['editorFeatures', 'editor'],
  ['experimentalFeatures', 'experimental'],
  ['advancedFeatures', 'advanced'],
];

/** 抽取到的最少条数：低于它就认为解析器失效，⛔ 静默产出空目录 */
const MIN_FEATURE_COUNT = 10;
/** 自动批准的动作子开关下限（eraTW 改造版现有 9 个；少一个就是解析器坏了） */
const MIN_AUTO_APPROVAL_ACTIONS = 8;

// ─────────────────────────────────────────────────────────────
// 扫描工具：必须跳过字符串字面量，否则 description 里的括号会打乱配平
// ─────────────────────────────────────────────────────────────

/** 从 `openIndex`（指向 open 字符）扫到与之配平的 close，返回 [start, end]（含两端） */
function scanBalanced(src: string, openIndex: number, open: string, close: string): [number, number] | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return [openIndex, i];
    }
  }
  return null;
}

/** 把一段 `{...} {...}` 文本按顶层对象切分 */
function splitTopLevelObjects(body: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '{') {
      const span = scanBalanced(body, i, '{', '}');
      if (!span) break;
      out.push(body.slice(span[0], span[1] + 1));
      i = span[1] + 1;
      continue;
    }
    i++;
  }
  return out;
}

/** 取对象字面量里的字符串字段（允许 `:` 与 `"` 之间换行） */
function pickField(obj: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const m = re.exec(obj);
  return m?.[1];
}

// ─────────────────────────────────────────────────────────────
// 抽取器 1：FeatureToggle 数组
// ─────────────────────────────────────────────────────────────

interface RawFeature {
  id: string;
  label: string;
  description: string;
  stateKey: string;
  settingKey: string;
  nestedKey?: string;
  category: string;
}

function extractFeatureArray(src: string, arrayName: string, category: string): RawFeature[] {
  const head = new RegExp(`const\\s+${arrayName}\\s*:\\s*FeatureToggle\\[\\]\\s*=\\s*\\[`).exec(src);
  if (!head) return [];
  const openIndex = head.index + head[0].length - 1;
  const span = scanBalanced(src, openIndex, '[', ']');
  if (!span) return [];
  const body = src.slice(span[0] + 1, span[1]);

  const features: RawFeature[] = [];
  for (const obj of splitTopLevelObjects(body)) {
    const id = pickField(obj, 'id');
    const label = pickField(obj, 'label');
    const description = pickField(obj, 'description');
    const stateKey = pickField(obj, 'stateKey');
    const settingKey = pickField(obj, 'settingKey');
    if (!id || !label || !description || !stateKey || !settingKey) {
      throw new Error(`[build-settings-catalog] ${arrayName} 里的开关缺字段：${obj.slice(0, 120)}`);
    }
    features.push({ id, label, description, stateKey, settingKey, nestedKey: pickField(obj, 'nestedKey'), category });
  }
  return features;
}

// ─────────────────────────────────────────────────────────────
// 抽取器 2：featureTranslations 的 id → i18n 键映射
// ─────────────────────────────────────────────────────────────

function parseFeatureTranslations(src: string): Map<string, { labelKey: string; descKey: string }> {
  const map = new Map<string, { labelKey: string; descKey: string }>();
  const head = /const\s+featureTranslations[^=]*=\s*\{/.exec(src);
  if (!head) return map;
  const openIndex = head.index + head[0].length - 1;
  const span = scanBalanced(src, openIndex, '{', '}');
  if (!span) return map;

  const body = src.slice(span[0] + 1, span[1]);
  const entryRe = /(?:"([A-Za-z0-9_-]+)"|([A-Za-z0-9_-]+))\s*:\s*\{([\s\S]*?)\}/g;
  for (let m = entryRe.exec(body); m !== null; m = entryRe.exec(body)) {
    const id = m[1] ?? m[2];
    const keys = [...m[3].matchAll(/t\(\s*"featureSettings\.(\w+)"\s*\)/g)].map((k) => k[1]);
    if (keys.length >= 2) map.set(id, { labelKey: keys[0], descKey: keys[1] });
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// 抽取器 3：state-keys.ts 的默认值 / 类型
// ─────────────────────────────────────────────────────────────

interface StateKeyMeta {
  defaultValue?: string;
  valueType?: string;
}

function parseStateKeys(src: string): Map<string, StateKeyMeta> {
  const map = new Map<string, StateKeyMeta>();
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const head = /^\t([A-Za-z_]\w*)\s*:\s*\{/.exec(lines[i]);
    if (!head) continue;
    const name = head[1];
    // 往下最多找 4 行，取 `default: <字面量> as <类型>`
    const window = lines.slice(i, i + 5).join('\n');
    const m = /default:\s*([^,\n]+?)\s+as\s+([A-Za-z_][\w<>[\]| ]*)/.exec(window);
    if (!m) continue;
    const literal = m[1].trim();
    const valueType = m[2].trim();
    // 只收真正能在源码里看见的字面量；导入常量（如 DEFAULT_AUTO_APPROVAL_SETTINGS）不猜
    const scalar = /^(true|false|null|-?\d+(?:\.\d+)?)$/.test(literal) || /^(['"]).*\1$/.test(literal);
    map.set(name, scalar ? { defaultValue: literal, valueType } : { valueType });
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// 抽取器 4：package.json 的 VS Code 配置项
// ─────────────────────────────────────────────────────────────

interface VscodeConfigBlock {
  title?: string;
  properties: Record<string, { type?: string; default?: unknown; description?: string; enum?: unknown[] }>;
}

/**
 * 抽 VS Code 配置项。
 *
 * 同时回报 `skipped`：**只写 `markdownDescription` 不写 `description` 的配置项会被这里静默丢掉**，
 * 而 `--check` 只看「生成物是否过期」，发现不了这种漏项。所以跳过清单必须显式暴露给调用方，
 * 让门禁能判红——否则"设置自述"会漏讲一个用户真能改的开关。
 */
function extractVscodeConfig(pkg: {
  contributes?: { configuration?: VscodeConfigBlock | VscodeConfigBlock[] };
}): { records: Array<{ key: string; title: string; summary: string; valueType: string; category: string }>; skipped: string[] } {
  const raw = pkg.contributes?.configuration;
  if (!raw) return { records: [], skipped: [] };
  const blocks = Array.isArray(raw) ? raw : [raw];
  const out: Array<{ key: string; title: string; summary: string; valueType: string; category: string }> = [];
  const skipped: string[] = [];
  for (const block of blocks) {
    for (const [key, schema] of Object.entries(block.properties ?? {})) {
      const description = schema.description?.trim();
      if (!description) {
        skipped.push(key);
        continue;
      }
      const enumHint = Array.isArray(schema.enum) ? schema.enum.map((v) => JSON.stringify(v)).join(' | ') : undefined;
      out.push({
        key,
        title: key.split('.').pop() ?? key,
        summary: description,
        valueType: enumHint ?? schema.type ?? 'unknown',
        category: 'erabasic',
      });
    }
  }
  return { records: out, skipped };
}

// ─────────────────────────────────────────────────────────────
// 抽取器 5：自动批准的 action 子开关（`AutoApprovalSettings.ts`）
//
// 为什么不按 Spec 字面的「顶层 enabled / maxRequests / enableNotifications / actions」：
// 代码里 `enabled` / `maxRequests` / `favorites` 都标了 **Legacy field**
// （恒为 true / 功能已移除），把它们当用户开关讲就是给错知识。
// 真正活着的开关是 `actions` 下的 9 个子项与 `enableNotifications`，那就抽这些。
// ─────────────────────────────────────────────────────────────

interface AutoApprovalAction {
  name: string;
  optional: boolean;
  comment?: string;
  defaultValue?: string;
}

interface AutoApprovalFacts {
  actions: AutoApprovalAction[];
  enableNotifications?: { comment?: string; defaultValue?: string };
}

function extractAutoApproval(src: string): AutoApprovalFacts {
  const iface = /export interface AutoApprovalSettings \{([\s\S]*?)\n\}/.exec(src)?.[1];
  if (!iface) throw new Error('[build-settings-catalog] 找不到 interface AutoApprovalSettings');

  // `actions` 块：字段一格 tab，子项两格 tab，块以单 tab 的 `}` 收尾
  const actionsBlock = /^\tactions:\s*\{([\s\S]*?)^\t\}/m.exec(iface)?.[1];
  if (!actionsBlock) throw new Error('[build-settings-catalog] 找不到 AutoApprovalSettings.actions 块');

  const defaultsBlock =
    /export const DEFAULT_AUTO_APPROVAL_SETTINGS[^=]*=\s*\{[\s\S]*?^\tactions:\s*\{([\s\S]*?)^\t\},/m.exec(src)?.[1] ?? '';

  const defaultOf = (name: string): string | undefined => {
    const m = new RegExp(`^\\t\\t${name}\\??:\\s*(true|false)\\s*,?`, 'm').exec(defaultsBlock);
    return m?.[1];
  };

  const actions: AutoApprovalAction[] = [];
  for (const line of actionsBlock.split(/\r?\n/)) {
    const m = /^\t\t(\w+)(\?)?:\s*boolean?\s*(?:\/\/\s*(.*))?$/.exec(line.trimEnd());
    if (!m) continue;
    const name = m[1] as string;
    actions.push({
      name,
      optional: m[2] === '?',
      ...(m[3] ? { comment: m[3].trim() } : {}),
      ...(defaultOf(name) !== undefined ? { defaultValue: defaultOf(name) } : {}),
    });
  }

  const notificationsLine = /^\tenableNotifications:\s*boolean\s*(?:\/\/\s*(.*))?$/m.exec(iface);
  const notificationsDefault = /^\tenableNotifications:\s*(true|false)\s*,?/m.exec(src)?.[1];

  return {
    actions,
    ...(notificationsLine
      ? {
          enableNotifications: {
            ...(notificationsLine[1] ? { comment: notificationsLine[1].trim() } : {}),
            ...(notificationsDefault !== undefined ? { defaultValue: notificationsDefault } : {}),
          },
        }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────
// 渲染
// ─────────────────────────────────────────────────────────────

function q(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')}'`;
}

function renderRecords(varName: string, records: SettingRecord[], headerLines: string[]): string {
  const lines: string[] = [
    '// ⛔ 本文件由 packages/era-harness-core/scripts/build-settings-catalog.ts 生成，不要手改。',
    '// 重新生成：cd packages/era-harness-core && npm run build:settings',
    ...headerLines.map((line) => `// ${line}`),
    "import type { SettingRecord } from '../types.js';",
    '',
    `export const ${varName}: SettingRecord[] = [`,
  ];
  for (const record of records) {
    lines.push('  {');
    lines.push(`    key: ${q(record.key)},`);
    lines.push(`    title: ${q(record.title)},`);
    lines.push(`    summary: ${q(record.summary)},`);
    if (record.defaultValue !== undefined) lines.push(`    defaultValue: ${q(record.defaultValue)},`);
    if (record.valueType !== undefined) lines.push(`    valueType: ${q(record.valueType)},`);
    lines.push(`    category: ${q(record.category)},`);
    lines.push(`    storage: ${q(record.storage)},`);
    lines.push(`    source: ${q(record.source)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');

  const [sectionSrc, localeSrc, stateSrc, pkgSrc, autoApprovalSrc] = await Promise.all([
    fs.readFile(FEATURE_SECTION, 'utf8'),
    fs.readFile(LOCALE_ZH, 'utf8'),
    fs.readFile(STATE_KEYS, 'utf8'),
    fs.readFile(PACKAGE_JSON, 'utf8'),
    fs.readFile(AUTO_APPROVAL, 'utf8'),
  ]);

  const translations = parseFeatureTranslations(sectionSrc);
  if (translations.size === 0) {
    throw new Error('[build-settings-catalog] 没解析到 featureTranslations —— 布局变了，请先修解析器再生成');
  }

  const zhFeature: Record<string, string> = (JSON.parse(localeSrc) as { featureSettings?: Record<string, string> })
    .featureSettings ?? {};
  const stateKeys = parseStateKeys(stateSrc);

  const featureRecords: SettingRecord[] = [];
  for (const [arrayName, category] of ARRAY_CATEGORIES) {
    for (const feature of extractFeatureArray(sectionSrc, arrayName, category)) {
      const tr = translations.get(feature.id);
      const meta = stateKeys.get(feature.stateKey);
      featureRecords.push({
        key: feature.id,
        title: (tr ? zhFeature[tr.labelKey] : undefined) ?? feature.label,
        summary: (tr ? zhFeature[tr.descKey] : undefined) ?? feature.description,
        ...(meta?.defaultValue !== undefined ? { defaultValue: meta.defaultValue } : {}),
        ...(meta?.valueType !== undefined ? { valueType: meta.valueType } : {}),
        category: feature.category,
        storage: feature.nestedKey
          ? `nested:${feature.settingKey}.${feature.nestedKey}`
          : `state-key:${feature.stateKey}`,
        source: 'feature-toggle',
      });
    }
  }

  if (featureRecords.length < MIN_FEATURE_COUNT) {
    throw new Error(
      `[build-settings-catalog] 只抽到 ${featureRecords.length} 个开关（下限 ${MIN_FEATURE_COUNT}）。` +
        '解析器可能已失效——请修 scripts/build-settings-catalog.ts，⛔ 不要放行空目录。',
    );
  }

  const vscodeExtract = extractVscodeConfig(JSON.parse(pkgSrc));
  const vscodeRecords: SettingRecord[] = vscodeExtract.records.map((item) => ({
    key: item.key,
    title: item.title,
    summary: item.summary,
    ...(item.valueType && item.valueType !== 'unknown' ? { valueType: item.valueType } : {}),
    category: item.category,
    storage: `vscode-config:${item.key}`,
    source: 'vscode-config',
  }));

  const autoFacts = extractAutoApproval(autoApprovalSrc);
  if (autoFacts.actions.length < MIN_AUTO_APPROVAL_ACTIONS) {
    throw new Error(
      `[build-settings-catalog] 自动批准只抽到 ${autoFacts.actions.length} 个动作（下限 ${MIN_AUTO_APPROVAL_ACTIONS}）。` +
        '解析器可能已失效——请修 scripts/build-settings-catalog.ts。',
    );
  }
  const autoRecords: SettingRecord[] = [
    {
      // 容器本身也是使用者会问的（“自动批准怎么配”），它的 storage 就是那个 state key
      key: 'autoApprovalSettings',
      title: 'autoApprovalSettings',
      summary: '',
      valueType: 'object',
      category: 'auto-approve',
      storage: 'state-key:autoApprovalSettings',
      source: 'state-key',
    },
    ...autoFacts.actions.map<SettingRecord>((action) => ({
      key: `autoApprovalSettings.actions.${action.name}`,
      title: action.name,
      summary: action.comment ?? '',
      ...(action.defaultValue !== undefined ? { defaultValue: action.defaultValue } : {}),
      valueType: action.optional ? 'boolean（可选，未设时继承默认）' : 'boolean',
      category: 'auto-approve',
      storage: `nested:autoApprovalSettings.actions.${action.name}`,
      source: 'state-key',
    })),
  ];
  if (autoFacts.enableNotifications) {
    autoRecords.push({
      key: 'autoApprovalSettings.enableNotifications',
      title: 'enableNotifications',
      summary: autoFacts.enableNotifications.comment ?? '',
      ...(autoFacts.enableNotifications.defaultValue !== undefined
        ? { defaultValue: autoFacts.enableNotifications.defaultValue }
        : {}),
      valueType: 'boolean',
      category: 'auto-approve',
      storage: 'nested:autoApprovalSettings.enableNotifications',
      source: 'state-key',
    });
  }

  const featuresText = renderRecords('FEATURE_SETTINGS', featureRecords, [
    '来源：webview-ui/src/components/settings/sections/FeatureSettingsSection.tsx 的 FeatureToggle 数组',
    '      + webview-ui/src/locales/zh-CN/settings.json 的 featureSettings.*',
    '      + src/shared/storage/state-keys.ts 的默认值',
  ]);
  const vscodeText = renderRecords('VSCODE_CONFIG_SETTINGS', vscodeRecords, [
    '来源：package.json 的 contributes.configuration.properties',
  ]);
  const autoText = renderRecords('AUTO_APPROVAL_SETTINGS', autoRecords, [
    '来源：src/shared/AutoApprovalSettings.ts 的 interface + DEFAULT_AUTO_APPROVAL_SETTINGS',
    '      ⛔ 不收录 enabled / maxRequests / favorites：代码里标了 Legacy field（恒为 true / 功能已移除）',
  ]);

  if (checkOnly) {
    const stale: string[] = [];
    for (const [file, text] of [
      [OUT_FEATURES, featuresText],
      [OUT_VSCODE, vscodeText],
      [OUT_AUTO_APPROVAL, autoText],
    ] as const) {
      const current = await fs.readFile(file, 'utf8').catch(() => null);
      if (current === null || current.replace(/\r\n/g, '\n') !== text) stale.push(path.relative(REPO, file));
    }
    if (stale.length > 0) {
      console.error('[build-settings-catalog] 生成物与源码不一致：');
      for (const file of stale) console.error(`  - ${file}`);
      console.error('  改了 FeatureSettingsSection / locales / state-keys / AutoApprovalSettings / package.json 之后必须重跑：');
      console.error('  cd packages/era-harness-core && npm run build:settings');
      process.exit(1);
    }
    if (vscodeExtract.skipped.length > 0) {
      console.error('[build-settings-catalog] 有配置项没写 description，被静默排除出目录：');
      for (const key of vscodeExtract.skipped) console.error(`  - ${key}`);
      console.error('  这些开关用户真能改，「设置自述」却不会讲到它们。请补 description（⛔ 不要为了过检而删配置）。');
      process.exit(1);
    }
    console.log(
      `[build-settings-catalog] OK：${featureRecords.length} 个开关 + ${vscodeRecords.length} 个 VS Code 配置项 + ${autoRecords.length} 个自动批准项，生成物是最新的`,
    );
    return;
  }

  await fs.mkdir(path.dirname(OUT_FEATURES), { recursive: true });
  await fs.writeFile(OUT_FEATURES, featuresText, 'utf8');
  await fs.writeFile(OUT_VSCODE, vscodeText, 'utf8');
  await fs.writeFile(OUT_AUTO_APPROVAL, autoText, 'utf8');
  console.log(
    `[build-settings-catalog] 已写入 ${featureRecords.length} 个开关 + ${vscodeRecords.length} 个 VS Code 配置项 + ${autoRecords.length} 个自动批准项：`,
  );
  console.log(`  - ${path.relative(REPO, OUT_FEATURES)}`);
  console.log(`  - ${path.relative(REPO, OUT_VSCODE)}`);
  console.log(`  - ${path.relative(REPO, OUT_AUTO_APPROVAL)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

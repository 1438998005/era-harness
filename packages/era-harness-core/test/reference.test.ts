import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEngines,
  extractName,
  normalizeBody,
  parseReferencePage,
  parseSignatureTable,
  splitTableRow,
} from '../src/reference/parse.js';
import {
  findAllReferences,
  findReference,
  formatReferenceEntry,
  formatReferenceHits,
  listReferenceNames,
  searchReference,
} from '../src/reference/query.js';
import {
  REFERENCE_ENTRIES,
  REFERENCE_ENTRY_COUNT,
  REFERENCE_FETCHED_AT,
  REFERENCE_NAME_COUNT,
  REFERENCE_SOURCE_SHA,
} from '../src/reference/data/index.js';
import { fetchRemoteReference, referencePageUrl, resolveReferenceOnline } from '../src/reference/online.js';

// —— 合成 fixture：形似上游页面，但命令名是虚构的（不含上游正文）——
const FIXTURE = [
  '---',
  'hide:',
  '  - toc',
  '---',
  '',
  '# FOOCOLOR, RESETFOO',
  '',
  '| 函数名 | 参数 | 返回值 |',
  '| :--- | :--- | :----- |',
  '| ![](../assets/images/IconEmuera.webp)[`FOOCOLOR`](./FOOCOLOR.zh.md) | `int`, `int`, `int` | 无 |',
  '|  | `int` | 无 |',
  '| ![](../assets/images/IconSK.webp)[`RESETFOO`](./FOOCOLOR.zh.md) | 无 | 无 |',
  '',
  '!!! info "API"',
  '',
  '    ```  { #language-erbapi }',
  'FOOCOLOR R, G, B',
  'FOOBAR R, G, B, A',
  '    ```',
  '    这是 FOOCOLOR 的说明。详见 [`BAR`](./BAR.zh.md)。',
  '',
  '!!! hint "提示"',
  '',
  '    仅支持命令形式。',
  '',
  '### 相关项目',
  '- [BAR](BAR.zh.md)',
].join('\n');

test('splitTableRow: 尊重 \\| 转义与反引号包裹', () => {
  assert.deepEqual(splitTableRow('| a | b | c |'), ['a', 'b', 'c']);
  // 上游用 `PRINT(\\|V\\|S)` 这种写法把竖线塞进单元格
  assert.deepEqual(splitTableRow('| `A(\\|B\\|C)` | `int` | 无 |'), ['`A(|B|C)`', '`int`', '无']);
  // 反引号内的裸竖线也不切分
  assert.deepEqual(splitTableRow('| `A|B` | x |'), ['`A|B`', 'x']);
  // 空单元格（重载续行）保留为 ''
  assert.deepEqual(splitTableRow('|  | `int` | 无 |'), ['', '`int`', '无']);
});

test('extractName: 从名字单元格抽名字', () => {
  assert.equal(extractName('[`SETCOLOR`](./SETCOLOR.zh.md)'), 'SETCOLOR');
  // <code> 里是签名模式而不是单个名字，只取开头标识符
  assert.equal(extractName('[<code>PRINT(\\|V\\|S\\|FORM)</code>](./PRINT.zh.md)'), 'PRINT');
  // 上游把 IF / SIF 写成一个标记
  assert.equal(extractName('[`(S)IF`](./IF.zh.md)'), 'IF');
  // 空代码块 → 抽不出名字，交给调用方兜底
  assert.equal(extractName('[``](./GETMEMORYUSAGE.zh.md)'), undefined);
});

test('extractEngines: 图标 → 引擎来源', () => {
  assert.deepEqual(
    extractEngines('![](../assets/images/Iconeramaker.webp)![](../assets/images/Icondotnet.webp)[`X`]'),
    ['eramaker', 'net'],
  );
  // 重复图标只记一次
  assert.deepEqual(
    extractEngines('![](../assets/images/IconSK.webp)![](../assets/images/IconSK.webp)'),
    ['skia'],
  );
  assert.deepEqual(extractEngines('无图标'), []);
});

test('normalizeBody: 图标→标记、内部链接→纯名字、围栏属性→语言', () => {
  const body = normalizeBody(
    [
      '    ```  { #language-erbapi }',
      'FOOBAR 1',
      '    ```',
      '    ![](../assets/images/IconSK.webp) 这是 Skia 的扩展。',
      '    参见 [`BAZ`](./BAZ.zh.md) 与 [QUX](QUX.zh.md)。',
      '    ``` title="输出结果"',
      'ok',
      '    ```',
    ].join('\n'),
  );

  assert.ok(body.includes('```erb'));
  assert.ok(!body.includes('#language-erbapi'));
  assert.ok(body.includes('[Skia] 这是 Skia 的扩展。'));
  assert.ok(body.includes('`BAZ`'));
  assert.ok(body.includes('QUX'));
  assert.ok(!body.includes('.zh.md'));
  assert.ok(body.includes('```text'));
});

test('parseReferencePage: 标题 / 签名 / 重载 / 引擎 / 摘要 / 正文', () => {
  const entry = parseReferencePage('FOOCOLOR', FIXTURE);

  assert.equal(entry.title, 'FOOCOLOR, RESETFOO');
  assert.equal(entry.id, 'FOOCOLOR');

  assert.equal(entry.signatures.length, 2);
  const first = entry.signatures[0]!;
  assert.equal(first.name, 'FOOCOLOR');
  assert.equal(first.params, '`int`, `int`, `int`');
  assert.equal(first.returns, '无');
  assert.deepEqual(first.engines, ['emuera']);
  // 空名字单元格是重载，不是新条目
  assert.deepEqual(first.overloads, ['`int`']);

  assert.equal(entry.signatures[1]!.name, 'RESETFOO');
  assert.deepEqual(entry.signatures[1]!.engines, ['skia']);

  // 名字 = 表格名 + erbapi 签名块里的名字
  assert.ok(entry.names.includes('FOOCOLOR'));
  assert.ok(entry.names.includes('RESETFOO'));
  assert.ok(entry.names.includes('FOOBAR'));
  // 同名只出现一次
  assert.equal(entry.names.filter((name) => name === 'FOOCOLOR').length, 1);

  assert.ok(entry.summary.startsWith('这是 FOOCOLOR 的说明'));
  // 正文不含 frontmatter / 标题 / 签名表
  assert.ok(!entry.body.includes('hide:'));
  assert.ok(!entry.body.includes('# FOOCOLOR'));
  assert.ok(!entry.body.includes('| 函数名 |'));
  assert.ok(entry.body.includes('!!! hint'));
});

test('parseReferencePage: 没有签名表也不丢正文', () => {
  const entry = parseReferencePage('NOBAR', ['# NOBAR', '', '这里只有正文。'].join('\n'));
  assert.deepEqual(entry.signatures, []);
  assert.deepEqual(entry.names, ['NOBAR']);
  assert.ok(entry.body.includes('这里只有正文。'));
});

test('parseSignatureTable: 名字为空时用文件名兜底', () => {
  const lines = [
    '| 函数名 | 参数 | 返回值 |',
    '| :--- | :--- | :--- |',
    '| [``](./GETMEMORYUSAGE.zh.md) | `void` | `int` |',
  ];
  const { signatures } = parseSignatureTable(lines, 'GETMEMORYUSAGE');
  assert.equal(signatures.length, 1);
  assert.equal(signatures[0]!.name, 'GETMEMORYUSAGE');
  assert.equal(signatures[0]!.returns, '`int`');
});

// —— 真实数据的完整性 ——

test('内置数据: 条目数与名字数自洽', () => {
  assert.equal(REFERENCE_ENTRIES.length, REFERENCE_ENTRY_COUNT);
  assert.equal(listReferenceNames(REFERENCE_ENTRIES).length, REFERENCE_NAME_COUNT);
  assert.match(REFERENCE_SOURCE_SHA, /^[0-9a-f]{40}$/);
  assert.ok(REFERENCE_FETCHED_AT.length > 0);
});

test('内置数据: 每条都有 id / 名字 / 签名表 / 摘要且 id 唯一', () => {
  const ids = new Set<string>();
  const broken: string[] = [];
  for (const entry of REFERENCE_ENTRIES) {
    if (ids.has(entry.id)) {
      broken.push(`${entry.id}(id 重复)`);
    }
    ids.add(entry.id);
    if (entry.names.length === 0) {
      broken.push(`${entry.id}(无名字)`);
    }
    if (entry.signatures.length === 0) {
      broken.push(`${entry.id}(无签名表)`);
    }
    if (!entry.summary) {
      broken.push(`${entry.id}(无摘要)`);
    }
  }
  assert.deepEqual(broken, []);
});

test('内置数据: 分组页覆盖到成员名，且能查到主名', () => {
  // PRINT 页覆盖 PRINTV / PRINTS 等变体
  const print = findReference(REFERENCE_ENTRIES, 'PRINTV');
  assert.ok(print);
  assert.equal(print!.entry.id, 'PRINT');

  // DT_ROW 是分组页：表格里只有 DT_ROW_ADD 等成员，页名本身也要能查到
  const dt = findReference(REFERENCE_ENTRIES, 'DT_ROW');
  assert.ok(dt);
  assert.equal(dt!.entry.id, 'DT_ROW');

  // 大小写不敏感
  assert.equal(findReference(REFERENCE_ENTRIES, 'setcolor')?.entry.id, 'SETCOLOR');
});

test('内置数据: 同名多页时优先返回页名相同的那页', () => {
  const owners = findAllReferences(REFERENCE_ENTRIES, 'PRINT');
  assert.ok(owners.length >= 1);
  assert.equal(findReference(REFERENCE_ENTRIES, 'PRINT')?.entry.id, 'PRINT');
});

test('searchReference: 名字命中优先于正文命中', () => {
  const hits = searchReference(REFERENCE_ENTRIES, 'PRINT', 5);
  assert.ok(hits.length > 0);
  assert.equal(hits[0]!.entry.id, 'PRINT');
  assert.equal(hits[0]!.field, 'name');
  // 分数单调不增
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1]!.score >= hits[i]!.score);
  }
});

test('searchReference: 中文关键词能命中正文', () => {
  const hits = searchReference(REFERENCE_ENTRIES, '颜色', 8);
  assert.ok(hits.length > 0);
  assert.ok(hits.some((hit) => hit.entry.id === 'SETCOLOR'));
  const bodyHit = hits.find((hit) => hit.entry.id === 'SETCOLOR');
  assert.ok(bodyHit?.snippet);
});

test('searchReference: 查不到时返回空数组而不是抛错', () => {
  assert.deepEqual(searchReference(REFERENCE_ENTRIES, 'zzz_not_a_command_zzz', 5), []);
  assert.deepEqual(searchReference(REFERENCE_ENTRIES, '   ', 5), []);
  assert.ok(formatReferenceHits([], 'x').includes('没有找到'));
});

test('formatReferenceEntry: 含签名、引擎与正文', () => {
  const entry = parseReferencePage('FOOCOLOR', FIXTURE);
  const text = formatReferenceEntry(entry);
  assert.ok(text.includes('## 签名'));
  assert.ok(text.includes('FOOCOLOR(`int`, `int`, `int`)'));
  assert.ok(text.includes('[emuera]'));
  assert.ok(text.includes('↳ (`int`)'));
  assert.ok(text.includes('## 说明'));
});

// —— 双线并轨：在线优先 / 本地兜底 ——

test('referencePageUrl: 只接受安全 id', () => {
  assert.ok(referencePageUrl('SETCOLOR')?.endsWith('/docs/Reference/SETCOLOR.zh.md'));
  assert.ok(referencePageUrl('DT_ROW', 'https://mirror.example/x/')?.startsWith('https://mirror.example/x/docs/'));
  assert.equal(referencePageUrl('../etc/passwd'), undefined);
  assert.equal(referencePageUrl('A/B'), undefined);
  assert.equal(referencePageUrl(''), undefined);
});

test('fetchRemoteReference: 非法 id 直接返回错误，不出网', async () => {
  const result = await fetchRemoteReference('../secret');
  assert.ok('error' in result);
});

test('resolveReferenceOnline: mode=off 只走本地快照', async () => {
  const entry = REFERENCE_ENTRIES[0]!;
  const resolved = await resolveReferenceOnline(entry, REFERENCE_SOURCE_SHA, { mode: 'off' });
  assert.equal(resolved.origin, 'local');
  assert.equal(resolved.entry.id, entry.id);
  assert.equal(resolved.fallbackReason, undefined);
  assert.ok(resolved.sourceNote.includes('内置快照'));
});

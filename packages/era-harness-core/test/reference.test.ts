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
import {
  DEFAULT_REFERENCE_BASE,
  discoverReference,
  fetchRemoteReference,
  referencePageUrl,
  resetOnlineFailureCache,
  resolveReferenceOnline,
} from '../src/reference/online.js';

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

test('内置数据: id 唯一、都有摘要与 sourcePath；Reference 页必须有签名表', () => {
  const ids = new Set<string>();
  const broken: string[] = [];
  for (const entry of REFERENCE_ENTRIES) {
    if (ids.has(entry.id)) {
      broken.push(`${entry.id}(id 重复)`);
    }
    ids.add(entry.id);
    if (!entry.summary) {
      broken.push(`${entry.id}(无摘要)`);
    }
    if (!entry.sourcePath) {
      broken.push(`${entry.id}(缺 sourcePath，在线取数会拼错目录)`);
    }
    // Reference 是 API 页，签名表是它的结构化产物；
    // Emuera 规格页与 tutorial 页本来就没有签名表，不能一并要求
    if (entry.sourcePath?.startsWith('docs/Reference/') && entry.signatures.length === 0) {
      broken.push(`${entry.id}(Reference 页缺签名表)`);
    }
  }
  assert.deepEqual(broken, []);
});

test('内置数据: 旧 Reference id 保持扁平形态（312 条零回归）', () => {
  const referenceEntries = REFERENCE_ENTRIES.filter((entry) =>
    entry.sourcePath?.startsWith('docs/Reference/'),
  );
  assert.equal(referenceEntries.length, 312);
  for (const entry of referenceEntries) {
    assert.ok(!entry.id.includes('/'), `${entry.id} 不该带目录前缀`);
    assert.equal(entry.pageId, undefined, `${entry.id} 不该有 pageId`);
  }
});

test('内置数据: 函数头指令与规格页已入库（#LOCALSIZE 是这次的根因）', () => {
  const localsize = findReference(REFERENCE_ENTRIES, '#LOCALSIZE');
  assert.ok(localsize, '#LOCALSIZE 必须能查到');
  assert.equal(localsize!.entry.id, 'Emuera/function#LOCALSIZE');
  assert.deepEqual(localsize!.entry.names, ['#LOCALSIZE', '#LOCALSSIZE']);
  assert.equal(localsize!.entry.pageId, 'Emuera/function');
  assert.equal(localsize!.entry.localOnly, true, '切段条目必须 localOnly');
  assert.match(localsize!.entry.body, /大于0的整数/);
  assert.match(localsize!.entry.body, /每个函数单独指定/);
  assert.match(localsize!.entry.body, /VariableSize\.csv/);

  // 模型通常不带 `#` 写，去记号匹配必须成立
  assert.equal(findReference(REFERENCE_ENTRIES, 'LOCALSIZE')?.entry.id, 'Emuera/function#LOCALSIZE');
  assert.equal(findReference(REFERENCE_ENTRIES, 'EVENTLOAD')?.entry.id, 'Emuera/function#EVENTLOAD');

  for (const name of ['#DIM', '#DIMS', '#FUNCTION', '#FUNCTIONS', '#ONLY', '@EVENTLOAD', '[SKIPSTART]']) {
    assert.ok(findReference(REFERENCE_ENTRIES, name), `${name} 应能查到`);
  }
  assert.ok(searchReference(REFERENCE_ENTRIES, 'LOCALSIZE', 5).length > 0);
});

test('内置数据: 规格页按小节切段，同一页不霸榜', () => {
  const split = REFERENCE_ENTRIES.filter((entry) => entry.pageId !== undefined);
  assert.ok(split.length >= 40, `切段条目过少：${split.length}`);
  for (const entry of split) {
    assert.ok(entry.id.startsWith(`${entry.pageId}#`), `${entry.id} 与 pageId ${entry.pageId} 不一致`);
    assert.equal(entry.localOnly, true);
  }

  const hits = searchReference(REFERENCE_ENTRIES, '函数', 8);
  const perPage = new Map<string, number>();
  for (const hit of hits) {
    const key = hit.entry.pageId ?? hit.entry.id;
    perPage.set(key, (perPage.get(key) ?? 0) + 1);
  }
  for (const [key, count] of perPage) {
    assert.ok(count <= 2, `${key} 一页占了 ${count} 个检索位`);
  }
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

test('referencePageUrl: 条目形态按 sourcePath 拼目录，`#` 不进 URL', () => {
  const url = referencePageUrl({
    id: 'Emuera/function#LOCALSIZE',
    sourcePath: 'docs/Emuera/function.zh.md',
  });
  assert.equal(url, `${DEFAULT_REFERENCE_BASE}/docs/Emuera/function.zh.md`);
  assert.ok(!url!.includes('#'));

  // 路径穿越与非法路径仍要挡住
  assert.equal(referencePageUrl({ id: 'x', sourcePath: 'docs/../../etc/passwd.zh.md' }), undefined);
  assert.equal(referencePageUrl({ id: 'x', sourcePath: 'etc/passwd.zh.md' }), undefined);
  assert.equal(referencePageUrl({ id: 'x', sourcePath: '/abs/path.zh.md' }), undefined);

  // 没有 sourcePath 的旧条目回退历史形态
  assert.ok(referencePageUrl({ id: 'SETCOLOR' })?.endsWith('/docs/Reference/SETCOLOR.zh.md'));
});

test('resolveReferenceOnline: localOnly 条目不触网（切段不能被整页替换）', async () => {
  const entry = findReference(REFERENCE_ENTRIES, '#LOCALSIZE')!.entry;
  const resolved = await resolveReferenceOnline(entry, REFERENCE_SOURCE_SHA);
  assert.equal(resolved.origin, 'local');
  assert.equal(resolved.entry.id, entry.id);
  assert.match(resolved.sourceNote, /不随线上刷新/);
  assert.equal(resolved.fallbackReason, undefined);
});

test('fetchRemoteReference: 单页失败不污染其它页（失败记忆按页面）', async () => {
  const original = globalThis.fetch;
  resetOnlineFailureCache();
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('Emuera/broken')) {
      return new Response('boom', { status: 500 });
    }
    return new Response('# OK\n\n正文。\n', { status: 200 });
  }) as typeof fetch;

  try {
    const broken = await fetchRemoteReference({
      id: 'Emuera/broken#X',
      sourcePath: 'docs/Emuera/broken.zh.md',
    });
    assert.ok('error' in broken);
    // 500 是页面级失败，不应让同域其它页面直接短路
    const ok = await fetchRemoteReference({
      id: 'Emuera/function#Y',
      sourcePath: 'docs/Emuera/function.zh.md',
    });
    assert.ok('entry' in ok, '另一页应照常取回');
    assert.equal(calls.filter((url) => url.includes('Emuera/function')).length, 1);
  } finally {
    globalThis.fetch = original;
    resetOnlineFailureCache();
  }
});

test('discoverReference: 用上游索引定位缺失页并解析出指令', async () => {
  const original = globalThis.fetch;
  resetOnlineFailureCache();
  const index = {
    docs: [
      {
        location: 'Emuera/function.html#localsize-localssize',
        title: '<code>#LOCALSIZE</code>',
        text: '为每个函数单独指定元素数量的预处理器。',
      },
    ],
  };
  const page = '## 定义\n\n### `#LOCALSIZE <常量表达式>`,`#LOCALSSIZE <常量表达式>`\n\n为每个函数单独指定`LOCAL`和`LOCALS`元素数量的预处理器。\n';

  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes('search_index.json')) {
      return new Response(JSON.stringify(index), { status: 200 });
    }
    if (url.endsWith('/docs/Emuera/function.zh.md')) {
      return new Response(page, { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  try {
    const found = await discoverReference('#LOCALSIZE');
    assert.ok(!('error' in found), 'error' in found ? found.error : '');
    assert.equal(found.slug, 'Emuera/function');
    assert.equal(found.entries[0]?.names[0], '#LOCALSIZE');
    assert.match(found.entries[0]?.body ?? '', /每个函数单独指定/);
  } finally {
    globalThis.fetch = original;
    resetOnlineFailureCache();
  }
});

test('discoverReference: mode=off 时不出网', async () => {
  resetOnlineFailureCache();
  const result = await discoverReference('#LOCALSIZE', { mode: 'off' });
  assert.ok('error' in result);
});

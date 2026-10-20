import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseLog } from '../src/log/parser.js';
import { classify, summarizeDiagnostics } from '../src/log/taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadFixture(name: string): Promise<string> {
  return readFile(path.join(__dirname, 'fixtures', name), 'utf8');
}

test('warnings fixture: engine / variant / diagnostics / session', async () => {
  const s = parseLog(await loadFixture('warnings-v16.log'));

  assert.equal(s.engine?.flavor, 'skia');
  assert.equal(s.engine?.base, '1824');
  assert.equal(s.engine?.em, 'v18');
  assert.equal(s.engine?.ee, 'v56');
  assert.equal(s.engine?.skia, 'v16');

  assert.equal(s.variant?.name, 'eraThe World【画蛇添足版】');
  assert.equal(s.variant?.version, '0.00');

  assert.equal(s.diagnostics.length, 8);
  assert.equal(s.fatalError, null);

  assert.equal(s.session.lazyIndexCount, 2262);
  assert.equal(s.session.modifiedFileCount, 16);
  assert.equal(s.session.loadSeconds, 1.95);
  assert.equal(s.session.dictLoadMs, 35);
  assert.equal(s.headerNotes.length, 2);
});

test('warnings fixture: unresolved identifier extraction + snippet', async () => {
  const s = parseLog(await loadFixture('warnings-v16.log'));
  const d = s.diagnostics.find((x) => x.identifier === '兒童人数');
  assert.ok(d);
  assert.equal(d.kind, 'unresolved-identifier');
  assert.equal(d.severity, 2);
  assert.equal(d.file, '口上・メッセージ関連\\個人口上\\053 Tewi [てゐ]\\因幡帝海外版\\M_KOJO_K53_functions.ERB');
  assert.equal(d.line, 196);
  assert.equal(d.sourceLines.length, 1);
  assert.match(d.sourceLines[0] ?? '', /^FOR LOCAL, 1, MIN\(CFLAG:53:兒童人数\+1,MAXCHILD\)$/);
});

test('warnings fixture: structural kinds and severities', async () => {
  const s = parseLog(await loadFixture('warnings-v16.log'));
  const kinds = s.diagnostics.map((d) => d.kind);
  assert.ok(kinds.includes('continue-outside-loop'));
  assert.ok(kinds.includes('missing-next'));
  assert.ok(kinds.includes('unparseable-line'));
  assert.ok(kinds.includes('text-after-command'));
  assert.ok(kinds.includes('chara-array-too-many-args'));
  assert.ok(kinds.includes('hash-line-not-after-declaration'));

  const lv1 = s.diagnostics.filter((d) => d.severity === 1);
  assert.equal(lv1.length, 1);
  assert.equal(lv1[0]?.kind, 'hash-line-not-after-declaration');

  const chara = s.diagnostics.find((d) => d.kind === 'chara-array-too-many-args');
  assert.equal(chara?.identifier, 'CHILD_SEX');
});

test('warnings fixture: summarize', async () => {
  const s = parseLog(await loadFixture('warnings-v16.log'));
  const sum = summarizeDiagnostics(s.diagnostics);
  assert.equal(sum.total, 8);
  assert.equal(sum.byKind['unresolved-identifier'], 2);
  assert.equal(sum.bySeverity['2'], 7);
  assert.equal(sum.bySeverity['1'], 1);
  assert.equal(sum.byIdentifier.length, 3);
  for (const entry of sum.byIdentifier) assert.equal(entry.count, 1);
});

test('fatal fixture: fatal error block', async () => {
  const s = parseLog(await loadFixture('fatal-error.log'));
  assert.equal(s.engine?.skia, 'v10.1');
  assert.equal(s.diagnostics.length, 1);

  assert.ok(s.fatalError);
  assert.equal(
    s.fatalError.engine,
    'Emuera.NET SkiaSharp 1824+v24+EMv18+EEv56+Skiav10.1',
  );
  assert.equal(s.fatalError.exceptionClass, 'MinorShift.Emuera.Runtime.Utils.CodeEE');
  assert.match(s.fatalError.exceptionMessage, /行连接结束符号/);
  assert.ok(s.fatalError.detailLines.some((l) => l.includes('Emuera停止运行')));
});

test('first-run fixture: lazy index rebuild, no diagnostics', async () => {
  const s = parseLog(await loadFixture('first-run.log'));
  assert.equal(s.diagnostics.length, 0);
  assert.equal(s.fatalError, null);
  assert.equal(s.session.lazyIndexRegenerated, true);
  assert.equal(s.session.lazyIndexCount, 2198);
  assert.equal(s.session.unmodifiedFileCount, 1);
  assert.equal(s.session.lazyIndexUpdated, true);
});

test('inline: multi-line snippet + line 0 + missing variant header', () => {
  const text = [
    '# 环境信息',
    'Emuera.NET SkiaSharp 1824+v24+EMv18+EEv56+Skiav16',
    '',
    '# 日志',
    '警告Lv1:口上\\テスト.ERB:第0行:[SKIPEND]不存在',
    '警告Lv2:口上\\テスト.ERB:第42行:无法解析的行',
    '  line one',
    '  line two',
    '已修改的文件：1',
  ].join('\n');
  const s = parseLog(text);
  assert.equal(s.variant, null);
  assert.equal(s.diagnostics.length, 2);

  const skipend = s.diagnostics[0];
  assert.equal(skipend?.kind, 'skipend-missing');
  assert.equal(skipend?.line, 0);
  assert.equal(skipend?.sourceLines.length, 0);

  const multi = s.diagnostics[1];
  assert.deepEqual(multi?.sourceLines, ['  line one', '  line two']);
  assert.equal(s.session.modifiedFileCount, 1);
});

test('inline: CRLF input parses identically', () => {
  const text = [
    '# 环境信息',
    'Emuera.NET SkiaSharp 1824+v24+EMv18+EEv56+Skiav16',
    '',
    '# 日志',
    '警告Lv2:a.ERB:第7行:无法解析的标识符"x"',
    'x = 1',
  ].join('\r\n');
  const s = parseLog(text);
  assert.equal(s.diagnostics.length, 1);
  assert.equal(s.diagnostics[0]?.identifier, 'x');
  assert.equal(s.diagnostics[0]?.line, 7);
  assert.deepEqual(s.diagnostics[0]?.sourceLines, ['x = 1']);
});

test('inline: UTF-8 BOM is stripped so header parsing works', () => {
  const text = [
    '# 环境信息',
    'Emuera.NET SkiaSharp 1824+v24+EMv18+EEv56+Skiav16',
    '',
    '# 变体',
    'eraThe World【画蛇添足版】 0.00',
    '',
    '# 日志',
    '警告Lv2:a.ERB:第7行:无法解析的标识符"x"',
    'x = 1',
  ].join('\n');
  const s = parseLog(`\uFEFF${text}`);
  assert.equal(s.engine?.skia, 'v16');
  assert.equal(s.variant?.name, 'eraThe World【画蛇添足版】');
  assert.equal(s.diagnostics.length, 1);
});

test('inline: empty / garbage input does not crash', () => {
  const s = parseLog('');
  assert.equal(s.diagnostics.length, 0);
  assert.equal(s.engine, null);
  const s2 = parseLog('完全不是日志的内容\n另一行');
  assert.equal(s2.diagnostics.length, 0);
  assert.equal(s2.outputLines.length, 2);
});

test('classify: unit rules', () => {
  assert.deepEqual(classify('无法解析的标识符"肉棒"'), {
    kind: 'unresolved-identifier',
    identifier: '肉棒',
  });
  assert.deepEqual(classify('变量"絶頂回数"未在此函数中定义'), {
    kind: 'variable-not-in-function',
    identifier: '絶頂回数',
  });
  assert.deepEqual(classify('对未被标记为#FUNCTION的函数"@CALMME"使用了CALLF系列的命令进行调用'), {
    kind: 'callf-non-function',
    functionName: '@CALMME',
  });
  assert.deepEqual(classify('不能将"@PRINT_DIALOGUE"的第3个参数从字符串型转换为整型'), {
    kind: 'arg-type-mismatch',
    functionName: '@PRINT_DIALOGUE',
    argIndex: 3,
  });
  assert.deepEqual(classify('没有闭合的"""'), { kind: 'unclosed-triple-quote' });
  assert.deepEqual(classify("发现没有对应'%'的'%'"), { kind: 'unmatched-percent' });
  assert.equal(classify('某种没见过的新警告').kind, 'other');
});

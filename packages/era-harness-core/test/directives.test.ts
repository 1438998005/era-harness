import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findLostLocalSizeDirectives,
  formatLostDirectivesError,
  formatLostDirectivesList,
  scanLocalSizeDirectives,
} from '../src/erb/directives.js';

const BASE = [
  '@FOO(A)',
  '#LOCALSIZE 100',
  '#LOCALSSIZE 10',
  '#DIM DYNAMIC A',
  '\tRETURN',
  '',
  '@BAR',
  '#LOCALSIZE 1',
  '#LOCALFSIZE 2',
  '\tRETURN',
].join('\n');

test('扫描：按 @label 归属，指令名大小写归一', () => {
  const found = scanLocalSizeDirectives(BASE);
  assert.equal(found.length, 4);
  assert.deepEqual(
    found.map((item) => [item.label, item.directive, item.value, item.line]),
    [
      ['FOO', '#LOCALSIZE', '100', 2],
      ['FOO', '#LOCALSSIZE', '10', 3],
      ['BAR', '#LOCALSIZE', '1', 8],
      ['BAR', '#LOCALFSIZE', '2', 9],
    ],
  );

  const lower = scanLocalSizeDirectives('@X\n#localsize 3\n');
  assert.equal(lower[0]?.directive, '#LOCALSIZE');
});

test('丢失：删掉某函数的 #LOCALSIZE 会被命中', () => {
  const after = BASE.replace('#LOCALSIZE 100\n', '');
  const lost = findLostLocalSizeDirectives(BASE, after);
  assert.equal(lost.length, 1);
  assert.equal(lost[0]?.label, 'FOO');
  assert.equal(lost[0]?.directive, '#LOCALSIZE');
  assert.equal(lost[0]?.line, 2);
});

test('丢失：同一函数内换位置不算丢失（位置错了应该上移，不是删）', () => {
  const moved = [
    '@FOO(A)',
    '#LOCALSIZE 100',
    '#LOCALSSIZE 10',
    '#DIM DYNAMIC A',
    '\tRETURN',
    '',
    '@BAR',
    '#LOCALSIZE 1',
    '#LOCALFSIZE 2',
    '\tRETURN',
  ].join('\n');
  // 把 #LOCALSIZE 从第 2 行挪到 #DIM 之后
  const after = [
    '@FOO(A)',
    '#DIM DYNAMIC A',
    '#LOCALSIZE 100',
    '#LOCALSSIZE 10',
    '\tRETURN',
    '',
    '@BAR',
    '#LOCALSIZE 1',
    '#LOCALFSIZE 2',
    '\tRETURN',
  ].join('\n');
  assert.equal(moved, BASE);
  assert.deepEqual(findLostLocalSizeDirectives(BASE, after), []);
});

test('丢失：整段函数被删不报容量丢失（交给 missing-label）', () => {
  const after = ['@FOO(A)', '#LOCALSIZE 100', '#LOCALSSIZE 10', '#DIM DYNAMIC A', '\tRETURN'].join('\n');
  assert.deepEqual(findLostLocalSizeDirectives(BASE, after), []);
});

test('丢失：只改数值不算丢失', () => {
  const after = BASE.replace('#LOCALSIZE 100', '#LOCALSIZE 5');
  assert.deepEqual(findLostLocalSizeDirectives(BASE, after), []);
});

test('丢失：大小写变化不算丢失', () => {
  const after = BASE.replace('@FOO(A)', '@foo(A)');
  assert.deepEqual(findLostLocalSizeDirectives(BASE, after), []);
});

test('丢失：多处删除按函数去重并保留原行号', () => {
  const after = BASE.replace('#LOCALSIZE 100\n', '').replace('#LOCALSIZE 1\n', '');
  const lost = findLostLocalSizeDirectives(BASE, after);
  assert.equal(lost.length, 2);
  assert.deepEqual(
    lost.map((item) => `${item.label}:${item.directive}:${item.line}`),
    ['FOO:#LOCALSIZE:2', 'BAR:#LOCALSIZE:8'],
  );
});

test('报错文本：点名函数、指令与修法', () => {
  const lost = findLostLocalSizeDirectives(BASE, BASE.replace('#LOCALSIZE 100\n', ''));
  const text = formatLostDirectivesError('ERB/口上/X.ERB', lost);
  assert.ok(text.includes('ERB/口上/X.ERB'));
  assert.ok(text.includes('@FOO #LOCALSIZE 100'));
  assert.ok(text.includes('不是变量定义'));
  assert.ok(text.includes('上移到 @函数名 之后'));
  assert.equal(formatLostDirectivesList(lost), '@FOO #LOCALSIZE');
});

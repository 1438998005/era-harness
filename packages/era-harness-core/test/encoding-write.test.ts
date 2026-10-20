import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEol,
  countBom,
  countEol,
  detectEol,
  formatWriteTarget,
  formatWriteVerification,
  inspectFileBytes,
  planSafeWrite,
  verifyWrite,
  writeTargetMatches,
} from '../src/encoding/write.js';

// —— 合成 fixture（程序化生成，无任何游戏文本）——
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const CP932_TEST = Buffer.from([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]); // テスト
const CP932_A = Buffer.from([0x88, 0x9f]); // 亜（高位双字节，非法 UTF-8）

// —— 行尾 ——

test('countEol / detectEol: 四种形态与空文件', () => {
  assert.deepEqual(countEol(Buffer.from('a\r\nb\r\n', 'utf8')), { crlf: 2, lfOnly: 0, crOnly: 0 });
  assert.equal(detectEol(Buffer.from('a\r\nb\r\n', 'utf8')), 'crlf');

  assert.deepEqual(countEol(Buffer.from('a\nb\n', 'utf8')), { crlf: 0, lfOnly: 2, crOnly: 0 });
  assert.equal(detectEol(Buffer.from('a\nb\n', 'utf8')), 'lf');

  assert.deepEqual(countEol(Buffer.from('a\rb\r', 'utf8')), { crlf: 0, lfOnly: 0, crOnly: 2 });
  assert.equal(detectEol(Buffer.from('a\rb\r', 'utf8')), 'cr');

  assert.equal(detectEol(Buffer.from('a\r\nb\n', 'utf8')), 'mixed');
  assert.equal(detectEol(Buffer.from('abc', 'utf8')), 'none');
  assert.equal(detectEol(Buffer.alloc(0)), 'none');
});

test('detectEol: CP932 多字节字符里不会出现伪换行（0x0A/0x0D 不在双字节内部）', () => {
  assert.equal(detectEol(CP932_TEST), 'none');
  assert.deepEqual(countEol(CP932_TEST), { crlf: 0, lfOnly: 0, crOnly: 0 });
});

test('applyEol: CRLF↔LF 双向归一，孤立 CR 一并折掉', () => {
  assert.equal(applyEol('a\r\nb\n', 'lf'), 'a\nb\n');
  assert.equal(applyEol('a\nb\n', 'crlf'), 'a\r\nb\r\n');
  assert.equal(applyEol('a\rb', 'crlf'), 'a\r\nb');
  assert.equal(applyEol('a\r\nb\r\n', 'crlf'), 'a\r\nb\r\n'); // 幂等
});

// —— BOM 计数 ——

test('countBom: 0 / 1 / 累积多个', () => {
  assert.equal(countBom(Buffer.from('abc', 'utf8')), 0);
  assert.equal(countBom(Buffer.concat([BOM, Buffer.from('abc', 'utf8')])), 1);
  assert.equal(countBom(Buffer.concat([BOM, BOM, Buffer.from('abc', 'utf8')])), 2);
  assert.equal(countBom(Buffer.alloc(0)), 0);
});

// —— 事实探测 ——

test('inspectFileBytes: UTF-8 BOM + CRLF + 末尾换行', () => {
  const f = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\nb\r\n', 'utf8')]));
  assert.equal(f.encoding, 'utf8Bom');
  assert.equal(f.bom, 'utf8');
  assert.equal(f.eol, 'crlf');
  assert.equal(f.endsWithNewline, true);
  assert.equal(f.eolCounts.crlf, 2);
});

test('inspectFileBytes: CP932 无 BOM', () => {
  const f = inspectFileBytes(Buffer.concat([CP932_TEST, Buffer.from('\r\n', 'utf8')]));
  assert.equal(f.encoding, 'cp932');
  assert.equal(f.bom, 'none');
  assert.equal(f.eol, 'crlf');
});

// —— 写回计划：既有文件 ——

test('planSafeWrite: 既有 UTF-8 BOM 文件保持原样（编码/BOM/行尾全不动）', () => {
  const before = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  const plan = planSafeWrite(before, 'X.ERB');
  assert.deepEqual(plan.target, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' });
  assert.equal(plan.encodingConverted, false);
  assert.equal(plan.bomChanged, false);
  assert.equal(plan.eolChanged, false);
});

test('planSafeWrite: 既有 UTF-8 无 BOM 文件不擅自补 BOM', () => {
  const before = inspectFileBytes(Buffer.from('a\n', 'utf8'));
  const plan = planSafeWrite(before, 'X.ERB');
  assert.deepEqual(plan.target, { encoding: 'utf8', bom: 'none', eol: 'lf' });
});

test('planSafeWrite: 既有 CP932 文件按 CP932 写回（⛔ 不转 UTF-8）', () => {
  const before = inspectFileBytes(Buffer.concat([CP932_TEST, Buffer.from('\r\n', 'utf8')]));
  const plan = planSafeWrite(before, 'X.ERB');
  assert.deepEqual(plan.target, { encoding: 'cp932', bom: 'none', eol: 'crlf' });
  assert.equal(plan.encodingConverted, false);
  assert.ok(plan.reason.includes('CP932'));
});

test('planSafeWrite: UTF-16 既有文件降级 UTF-8 并显式声明', () => {
  const before = inspectFileBytes(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a\r\n', 'utf16le')]));
  const plan = planSafeWrite(before, 'X.ERB');
  assert.equal(plan.target.encoding, 'utf8');
  assert.equal(plan.encodingConverted, true);
  assert.ok(plan.reason.includes('UTF-16'));
});

test('planSafeWrite: 原文行尾混用时按多数派归一并标记', () => {
  const before = inspectFileBytes(Buffer.from('a\r\nb\r\nc\n', 'utf8')); // CRLF×2 / LF×1
  assert.equal(before.eol, 'mixed');
  const plan = planSafeWrite(before, 'X.ERB');
  assert.equal(plan.target.eol, 'crlf');
  assert.equal(plan.eolChanged, true);
  assert.ok(plan.reason.includes('多数派'));

  const lfHeavy = inspectFileBytes(Buffer.from('a\r\nb\nc\n', 'utf8')); // CRLF×1 / LF×2
  assert.equal(planSafeWrite(lfHeavy, 'X.ERB').target.eol, 'lf');
});

test('planSafeWrite: 孤立 CR 归一为 LF 并标记', () => {
  const before = inspectFileBytes(Buffer.from('a\rb\r', 'utf8'));
  const plan = planSafeWrite(before, 'X.ERB');
  assert.equal(plan.target.eol, 'lf');
  assert.equal(plan.eolChanged, true);
});

test('planSafeWrite: 单行文件没有行尾可保，按类型默认且不标记改动', () => {
  const before = inspectFileBytes(Buffer.from('ONLY-ONE-LINE', 'utf8'));
  assert.equal(before.eol, 'none');
  const plan = planSafeWrite(before, 'X.ERB');
  assert.equal(plan.target.eol, 'crlf');
  assert.equal(plan.eolChanged, false);
});

// —— 写回计划：新建文件 ——

test('planSafeWrite: 新建 .ERB 一律 UTF-8 带 BOM + CRLF', () => {
  const plan = planSafeWrite(null, 'ERB/K1.ERB');
  assert.deepEqual(plan.target, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' });
  assert.ok(plan.reason.includes('BOM'));
});

test('planSafeWrite: 新建 .CSV 带 BOM（绕开引擎按 CP932 回显源行的缺陷）', () => {
  const plan = planSafeWrite(null, 'CSV/Item.csv');
  assert.deepEqual(plan.target, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' });
  assert.ok(plan.reason.includes('BOM'));
});

test('planSafeWrite: 新建脚本时兄弟文件多数不带 BOM 也会被提示，但仍按纪律带 BOM', () => {
  const plan = planSafeWrite(null, 'ERB/K1.ERB', { siblingBomRatio: 0, siblingEol: 'lf' });
  assert.equal(plan.target.bom, 'utf8', '纪律优先于兄弟文件现状');
  assert.equal(plan.target.eol, 'lf', '行尾没有纪律要求，跟随兄弟文件');
  assert.ok(plan.reason.includes('兄弟文件多数不带 BOM'));
});

test('planSafeWrite: 新建非脚本文件跟随兄弟文件（BOM 与行尾都看现状）', () => {
  const plan = planSafeWrite(null, 'notes.txt', { siblingBomRatio: 1, siblingEol: 'lf' });
  assert.deepEqual(plan.target, { encoding: 'utf8', bom: 'utf8', eol: 'lf' });

  const plain = planSafeWrite(null, 'notes.txt', { siblingBomRatio: 0.2, siblingEol: null });
  assert.deepEqual(plain.target, { encoding: 'utf8', bom: 'none', eol: 'lf' });
});

test('planSafeWrite: 新建无样本文件不凭空加 BOM', () => {
  const plan = planSafeWrite(null, 'notes.txt');
  assert.deepEqual(plan.target, { encoding: 'utf8', bom: 'none', eol: 'lf' });
});

// —— 目标匹配（用于跳过无谓的二次写盘）——

test('writeTargetMatches: 已符合目标时不重写', () => {
  const facts = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  assert.equal(writeTargetMatches(facts, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' }), true);
  assert.equal(writeTargetMatches(facts, { encoding: 'utf8', bom: 'none', eol: 'crlf' }), false);
  assert.equal(writeTargetMatches(facts, { encoding: 'utf8', bom: 'utf8', eol: 'lf' }), false);
});

test('writeTargetMatches: 单行文件的 eol=none 视为符合（没有行尾可修）', () => {
  const facts = inspectFileBytes(Buffer.from('ONLY', 'utf8'));
  assert.equal(facts.eol, 'none');
  assert.equal(writeTargetMatches(facts, { encoding: 'utf8', bom: 'none', eol: 'crlf' }), true);
});

// —— 写后复检 ——

test('verifyWrite: 完全符合时 ok', () => {
  const before = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  const after = Buffer.concat([BOM, Buffer.from('a\r\nb\r\n', 'utf8')]);
  const v = verifyWrite(before, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' }, after);
  assert.equal(v.ok, true);
  assert.deepEqual(v.issues, []);
  assert.equal(formatWriteVerification(v), '');
});

test('verifyWrite: 丢 BOM / 多 BOM / 凭空多 BOM 都能报', () => {
  const before = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  const target = { encoding: 'utf8', bom: 'utf8', eol: 'crlf' } as const;

  const lost = verifyWrite(before, target, Buffer.from('a\r\n', 'utf8'));
  assert.equal(lost.ok, false);
  assert.ok(lost.issues.some((i) => i.code === 'bom-missing'));

  const doubled = verifyWrite(before, target, Buffer.concat([BOM, BOM, Buffer.from('a\r\n', 'utf8')]));
  assert.ok(doubled.issues.some((i) => i.code === 'bom-multiple'));

  const unexpected = verifyWrite(
    inspectFileBytes(Buffer.from('a\r\n', 'utf8')),
    { encoding: 'utf8', bom: 'none', eol: 'crlf' },
    Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]),
  );
  assert.ok(unexpected.issues.some((i) => i.code === 'bom-unexpected'));
});

test('verifyWrite: CP932 被写成 UTF-8 ⇒ encoding-converted', () => {
  const before = inspectFileBytes(Buffer.concat([CP932_TEST, Buffer.from('\r\n', 'utf8')]));
  const after = Buffer.from('テスト\r\n', 'utf8');
  const v = verifyWrite(before, { encoding: 'cp932', bom: 'none', eol: 'crlf' }, after);
  assert.equal(v.ok, false);
  const issue = v.issues.find((i) => i.code === 'encoding-converted');
  assert.ok(issue);
  assert.ok(issue?.message.includes('禁止编码互转'));
});

test('verifyWrite: 纯 ASCII 内容不做编码漂移误报（两种编码字节相同）', () => {
  const before = inspectFileBytes(Buffer.concat([CP932_A, Buffer.from('\r\n', 'utf8')]));
  assert.equal(before.encoding, 'cp932');
  const after = Buffer.from('ASCII ONLY\r\n', 'utf8');
  const v = verifyWrite(before, { encoding: 'cp932', bom: 'none', eol: 'crlf' }, after);
  assert.ok(!v.issues.some((i) => i.code === 'encoding-converted'), '纯 ASCII 不该报编码漂移');
});

test('verifyWrite: 目标 UTF-8 但落盘字节不是合法 UTF-8 ⇒ utf8-broken', () => {
  const before = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  const after = Buffer.concat([BOM, CP932_A, Buffer.from('\r\n', 'utf8')]);
  const v = verifyWrite(before, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' }, after);
  assert.ok(v.issues.some((i) => i.code === 'utf8-broken'));
  assert.ok(formatWriteVerification(v).includes('文字コード異常'));
});

test('verifyWrite: 行尾漂移与混用', () => {
  const before = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  const drifted = verifyWrite(
    before,
    { encoding: 'utf8', bom: 'utf8', eol: 'crlf' },
    Buffer.concat([BOM, Buffer.from('a\nb\n', 'utf8')]),
  );
  assert.ok(drifted.issues.some((i) => i.code === 'eol-changed'));

  const mixed = verifyWrite(
    before,
    { encoding: 'utf8', bom: 'utf8', eol: 'crlf' },
    Buffer.concat([BOM, Buffer.from('a\r\nb\n', 'utf8')]),
  );
  assert.ok(mixed.issues.some((i) => i.code === 'eol-mixed'));
});

test('verifyWrite: 末尾换行丢失', () => {
  const before = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  const v = verifyWrite(before, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' }, Buffer.concat([BOM, Buffer.from('a', 'utf8')]));
  assert.ok(v.issues.some((i) => i.code === 'trailing-newline-lost'));
});

test('verifyWrite: 新建文件（before=null）只查绝对判据，不产生假的「改动」告警', () => {
  const v = verifyWrite(null, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' }, Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  assert.equal(v.ok, true);
});

test('formatWriteVerification / formatWriteTarget: 输出人话', () => {
  assert.equal(formatWriteTarget({ encoding: 'cp932', bom: 'none', eol: 'crlf' }), 'CP932 / 无 BOM / CRLF');
  assert.equal(formatWriteTarget({ encoding: 'utf8', bom: 'utf8', eol: 'lf' }), 'UTF-8 / 带 BOM / LF');

  const before = inspectFileBytes(Buffer.concat([BOM, Buffer.from('a\r\n', 'utf8')]));
  const v = verifyWrite(before, { encoding: 'utf8', bom: 'utf8', eol: 'crlf' }, Buffer.from('a\r\n', 'utf8'));
  const text = formatWriteVerification(v);
  assert.ok(text.startsWith('[编码写回校验]'));
  assert.ok(text.includes('- 应有 UTF-8 BOM'));
});

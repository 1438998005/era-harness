import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { decodeToUtf8, detectBom, readTextFile } from '../src/encoding/encoding.js';

// —— 合成 fixture（程序化生成，无任何游戏文本）——
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const CP932_HELLO = Buffer.from([0x82, 0xa8, 0x82, 0xcd, 0x82, 0xe6, 0x82, 0xa4]); // おはよう
const CP932_TEST = Buffer.from([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]); // テスト
const CP932_A = Buffer.from([0x88, 0x9f]); // 亜（高位双字节，非法 UTF-8）

test('detectBom: none / utf8 / utf16le / utf16be', () => {
  assert.equal(detectBom(Buffer.from('abc', 'utf8')), 'none');
  assert.equal(detectBom(Buffer.concat([UTF8_BOM, Buffer.from('abc', 'utf8')])), 'utf8');
  assert.equal(detectBom(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('abc', 'utf16le')])), 'utf16le');
  assert.equal(detectBom(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('abc', 'utf16le').swap16()])), 'utf16be');
});

test('detectBom: 短缓冲区不误判', () => {
  assert.equal(detectBom(Buffer.from([0xef])), 'none'); // 不足 3 字节
  assert.equal(detectBom(Buffer.from([0xef, 0xbb])), 'none');
  assert.equal(detectBom(Buffer.from([0xff])), 'none'); // 单字节
  assert.equal(detectBom(Buffer.from([0xff, 0xfe])), 'utf16le'); // 仅 BOM 本身也认
  assert.equal(detectBom(Buffer.alloc(0)), 'none');
});

test('decode: UTF-8 无 BOM', () => {
  const r = decodeToUtf8(Buffer.from('PRINTFORML TEST\n', 'utf8'));
  assert.equal(r.text, 'PRINTFORML TEST\n');
  assert.equal(r.encoding, 'utf8');
  assert.equal(r.bom, 'none');
  assert.equal(r.byteLength, Buffer.byteLength('PRINTFORML TEST\n', 'utf8'));
  assert.equal(r.lossy, false);
});

test('decode: UTF-8 BOM 剥离', () => {
  const r = decodeToUtf8(Buffer.concat([UTF8_BOM, Buffer.from('# LOG START\n', 'utf8')]));
  assert.equal(r.text, '# LOG START\n');
  assert.ok(!r.text.startsWith('\uFEFF'));
  assert.equal(r.encoding, 'utf8Bom');
  assert.equal(r.bom, 'utf8');
  assert.equal(r.lossy, false);
});

test('decode: CRLF 原样保留（不改写换行，行号保真）', () => {
  const r = decodeToUtf8(Buffer.concat([UTF8_BOM, Buffer.from('LINE1\r\nLINE2\r\n', 'utf8')]));
  assert.equal(r.text, 'LINE1\r\nLINE2\r\n');
});

test('decode: CP932 无 BOM → 日文文本', () => {
  const r = decodeToUtf8(Buffer.concat([CP932_TEST, CP932_HELLO]));
  assert.equal(r.text, 'テストおはよう');
  assert.equal(r.encoding, 'cp932');
  assert.equal(r.bom, 'none');
  assert.equal(r.lossy, false);
});

test('decode: CP932 与 ASCII 混排（ERB 常见形态）', () => {
  const r = decodeToUtf8(Buffer.concat([Buffer.from('@EVENT_K1\n', 'utf8'), CP932_TEST, Buffer.from('\nRETURN\n', 'utf8')]));
  assert.equal(r.text, '@EVENT_K1\nテスト\nRETURN\n');
  assert.equal(r.encoding, 'cp932');
  assert.equal(r.lossy, false);
});

test('decode: UTF-16LE BOM', () => {
  const r = decodeToUtf8(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('おはよう', 'utf16le')]));
  assert.equal(r.text, 'おはよう');
  assert.equal(r.encoding, 'unknown'); // detectEncoding 把它归入 unknown，bom 字段给细粒度事实
  assert.equal(r.bom, 'utf16le');
  assert.equal(r.lossy, false);
});

test('decode: UTF-16BE BOM（swap16 路径）', () => {
  const be = Buffer.from('テスト', 'utf16le');
  const beCopy = Buffer.from(be);
  beCopy.swap16();
  const r = decodeToUtf8(Buffer.concat([Buffer.from([0xfe, 0xff]), beCopy]));
  assert.equal(r.text, 'テスト');
  assert.equal(r.bom, 'utf16be');
  assert.equal(r.lossy, false);
});

test('decode: 空缓冲区', () => {
  const r = decodeToUtf8(Buffer.alloc(0));
  assert.equal(r.text, '');
  assert.equal(r.encoding, 'utf8');
  assert.equal(r.bom, 'none');
  assert.equal(r.byteLength, 0);
  assert.equal(r.lossy, false);
});

test('decode: UTF-8 BOM + 非法 UTF-8 主体 → lossy', () => {
  const r = decodeToUtf8(Buffer.concat([UTF8_BOM, CP932_A]));
  assert.equal(r.encoding, 'utf8Bom');
  assert.equal(r.bom, 'utf8');
  assert.equal(r.lossy, true);
  assert.ok(r.text.includes('\uFFFD'));
});

test('decode: 不完整 CP932 双字节 → lossy 兜底', () => {
  const r = decodeToUtf8(Buffer.from([0x81]));
  assert.equal(r.encoding, 'cp932');
  assert.equal(r.lossy, true);
  assert.ok(r.text.includes('\uFFFD'));
});

let tmpRoot: string;

before(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'era-harness-encoding-'));
});

after(async () => {
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

test('readTextFile: 多编码文件往返（utf8Bom / utf8 / cp932 / utf16le）', async () => {
  const w = async (name: string, buf: Buffer): Promise<string> => {
    const full = path.join(tmpRoot, name);
    await writeFile(full, buf);
    return full;
  };

  const bomPath = await w('a-bom.log', Buffer.concat([UTF8_BOM, Buffer.from('# LOG START\r\n', 'utf8')]));
  const utf8Path = await w('b-utf8.erb', Buffer.from('@SYSTEM_INIT\nRETURN\n', 'utf8'));
  const cp932Path = await w('c-cp932.erb', Buffer.concat([CP932_TEST, Buffer.from('\n', 'utf8')]));
  const u16Path = await w('d-utf16le.log', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('# LOG START\n', 'utf16le')]));

  const a = await readTextFile(bomPath);
  assert.equal(a.path, bomPath);
  assert.equal(a.text, '# LOG START\r\n');
  assert.equal(a.encoding, 'utf8Bom');
  assert.equal(a.lossy, false);

  const b = await readTextFile(utf8Path);
  assert.equal(b.text, '@SYSTEM_INIT\nRETURN\n');
  assert.equal(b.encoding, 'utf8');

  const c = await readTextFile(cp932Path);
  assert.equal(c.text, 'テスト\n');
  assert.equal(c.encoding, 'cp932');
  assert.equal(c.lossy, false);

  const d = await readTextFile(u16Path);
  assert.equal(d.text, '# LOG START\n');
  assert.equal(d.bom, 'utf16le');
});

test('readTextFile: 文件不存在照常抛错（不吞 IO 错误）', async () => {
  await assert.rejects(() => readTextFile(path.join(tmpRoot, 'no-such-file.erb')), /ENOENT|no such file/);
});

test('readTextFile: maxBytes 未超过时 truncated=false，内容完整', async () => {
  const full = path.join(tmpRoot, 'e-small.log');
  const buf = Buffer.from('LINE1\nLINE2\n', 'utf8');
  await writeFile(full, buf);

  const r = await readTextFile(full, { maxBytes: 1024 });
  assert.equal(r.text, 'LINE1\nLINE2\n');
  assert.equal(r.truncated, false);
  assert.equal(r.totalBytes, buf.length);
  assert.equal(r.byteLength, buf.length);
});

test('readTextFile: maxBytes 超出时只读开头，并在整行边界截断', async () => {
  // 每行 6 字节（'LINE00' + '\n'）；限 10 字节 → 只能保留第一整行
  const full = path.join(tmpRoot, 'f-big.log');
  const lines = Array.from({ length: 50 }, (_, i) => `LINE${String(i).padStart(2, '0')}\n`);
  const buf = Buffer.from(lines.join(''), 'utf8');
  await writeFile(full, buf);

  const r = await readTextFile(full, { maxBytes: 10 });
  assert.equal(r.truncated, true);
  assert.equal(r.totalBytes, buf.length);
  assert.ok(r.text.startsWith('LINE00\n'));
  assert.ok(!r.text.includes('LINE01'), '截断后不应包含第二行');
  assert.ok(r.text.includes('已截断'), '必须明确标注已截断');
});

test('readTextFile: maxBytes 下 CP932 不会因截断断在双字节上而乱码', async () => {
  // 'テスト\n' = 6 字节 CP932 + 换行；再跟一整行
  const full = path.join(tmpRoot, 'g-cp932.log');
  const buf = Buffer.concat([CP932_TEST, Buffer.from('\n', 'utf8'), CP932_HELLO, Buffer.from('\n', 'utf8')]);
  await writeFile(full, buf);

  // 限 7 字节：正好能放下第一整行；截断点落在第二行的双字节字符中间
  const r = await readTextFile(full, { maxBytes: 7 });
  assert.equal(r.encoding, 'cp932');
  assert.ok(r.text.startsWith('テスト\n'), `开头应完整解出：${r.text}`);
  assert.equal(r.truncated, true);
});

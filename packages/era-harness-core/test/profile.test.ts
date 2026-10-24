import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { profileProject } from '../src/profile/profiler.js';
import { parseEmueraConfig, configGet, configGetBoolean, configGetNumber } from '../src/profile/config.js';
import { parseDimFile } from '../src/profile/dim.js';
import { parseAlsEntries, parseCsvEntries } from '../src/profile/csv.js';
import { detectEncoding, sampleErbEncodings } from '../src/profile/scan.js';

let projectRoot: string;

/** 在临时目录合成一个最小 eratw 工程（全部为脱敏合成内容，无任何游戏文本）。 */
before(async () => {
  projectRoot = await mkdtemp(path.join(tmpdir(), 'era-harness-profile-'));
  const w = async (rel: string, content: string | Buffer): Promise<void> => {
    const full = path.join(projectRoot, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  };

  await w(
    'emuera.config',
    [
      '; 注释行',
      'IGNORE CASE:YES',
      'USELAZYLOADING:YES',
      'ALLOW DEBUG COMMANDS:YES',
      'USE ERD:YES',
      'USE _RENAME.CSV FILE:YES',
      'MINIMUM WARNING LEVEL:0',
      'SEARCH SUBFOLDERS:YES',
      'FONT NAME:黑体',
      'TEXT EDITOR COMMAND LINE ARGUMENTS:',
      'STRING OF REPLACING NEW LINE CODE INSIDE CONTINUATION:" "',
      '',
    ].join('\n'),
  );
  await w('lazyloading.cfg', '口上・メッセージ関連\\個人口上\n');
  await w('Emuera_skiaV16_x64.exe', Buffer.alloc(0));

  await w(
    'ERB/DIM.ERH',
    [
      ';注释',
      '#DIM CONST NOW_VERSION = 20261013',
      '#DIMS CONST eraTW_Version = "4.981"',
      '#DIMS CONST eraTW_SubVersion = @"画蛇添足版CH{NOW_VERSION}"',
      '#DIM SAVEDATA modding_version',
      '#DIM CONST REQUIRED_TRUST_恋慕 = 700',
      ';#DIM CONST コメントアウト = 1',
      '',
    ].join('\n'),
  );
  await w('ERB/DIM_als.ERH', '#DIM CONST ALS_ONLY = 1\n');
  await w('ERB/SYSTEM.ERB', '@SYSTEM_INIT\nRETURN\n');
  await w('ERB/COMMON.ERB', '\uFEFF@COMMON_FUNC\nPRINTFORML 测试\n');
  await w('ERB/口上・メッセージ関連/KOJO_MESSAGE.ERB', '@KOJO_DISPATCH\nRETURN\n');
  await w(
    'ERB/口上・メッセージ関連/個人口上/001 Reimu [霊夢]/M_KOJO_K1_events.ERB',
    Buffer.from([0x88, 0x9f, 0x82, 0xb1, 0x0a]), // CP932 字节，非法 UTF-8
  );
  await w('ERB/口上・メッセージ関連/個人口上/002 Marisa [魔理沙]/M_KOJO_K2_events.ERB', '@EVENT_K2\nRETURN\n');
  await w('ERB/魔改内容/qol/weather.ERB', '@QOL_WEATHER\nRETURN\n');

  await w('CSV/CFLAG.als', '1,既成事実\n;(BIT 0=キス)\n2,好感度\n3,異常経験\n');
  await w('CSV/CFLAG.csv', '1,既成事实\n2,好感度\n3,异常经验\n');
  await w('CSV/Talent.csv', '1,素质\n2,妊娠\n');
  await w('CSV/_Rename.csv', '1,ignored\n');
  await w('CSV/VariableSize.csv', ';仅注释\n');
  await w('CSV/Chara/Chara1 Reimu [霊夢].csv', '1,x\n');
  await w('CSV/Chara/Chara2 Marisa [魔理沙].csv', '1,x\n');
});

after(async () => {
  if (projectRoot) await rm(projectRoot, { recursive: true, force: true });
});

test('config: parse and typed getters', () => {
  const c = parseEmueraConfig(
    ['; comment', 'USELAZYLOADING:YES', 'MAKE AUTOSAVES:NO', 'FONT SIZE:18', 'EMPTY VALUE:', 'NO COLON LINE', ''].join('\n'),
  );
  assert.equal(c.entries.length, 4);
  assert.equal(configGetBoolean(c, 'uselazyloading'), true); // 大小写不敏感
  assert.equal(configGetBoolean(c, 'MAKE AUTOSAVES'), false);
  assert.equal(configGetNumber(c, 'FONT SIZE'), 18);
  assert.equal(configGet(c, 'EMPTY VALUE'), '');
  assert.equal(configGet(c, 'NO COLON LINE'), undefined);
});

test('dim: constants extraction', () => {
  const d = parseDimFile(
    [
      ';注释',
      '#DIM CONST NOW_VERSION = 20261013',
      '#DIMS CONST eraTW_Version = "4.981"',
      '#DIM SAVEDATA modding_version',
      ';#DIM CONST コメントアウト = 1',
      '',
    ].join('\n'),
    'DIM.ERH',
  );
  assert.equal(d.dimCount, 3); // 两 CONST + 一 SAVEDATA
  assert.deepEqual(
    d.constants.map((c) => c.name),
    ['NOW_VERSION', 'eraTW_Version'],
  );
  assert.equal(d.constants[0]?.value, '20261013');
  assert.equal(d.constants[1]?.value, '"4.981"');
});

test('als: entry parsing', () => {
  const entries = parseAlsEntries('1,既成事実\n;(BIT 0=キス)\n2,好感度\n无逗号行\n3,异常,经验\n');
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { id: 1, name: '既成事実' });
  assert.equal(entries[2]?.name, '异常,经验'); // 名称可含逗号
});

test('csv: multi-column enum files take first two fields only', () => {
  const entries = parseCsvEntries('1,跳蛋,3000,\n2,按摩棒,9000,\n1,处女,;(1= 処女)\n;comment\n');
  assert.deepEqual(
    entries.map((e) => e.name),
    ['跳蛋', '按摩棒', '处女'],
  );
  assert.equal(entries[0]?.id, 1);
});

test('encoding: detection', () => {
  assert.equal(detectEncoding(Buffer.from('\uFEFFabc', 'utf8')), 'utf8Bom');
  assert.equal(detectEncoding(Buffer.from('abc', 'utf8')), 'utf8');
  assert.equal(detectEncoding(Buffer.from([0x88, 0x9f, 0x82, 0xb1])), 'cp932');
  assert.equal(detectEncoding(Buffer.from([0xff, 0xfe, 0x41])), 'unknown');
});

test('profile: full extraction on synthetic project', async () => {
  const p = await profileProject(projectRoot);

  assert.equal(p.engine.exeFiles.length, 1);
  assert.match(p.engine.exeFiles[0] ?? '', /Emuera_skiaV16_x64\.exe/);
  assert.equal(p.engine.configFound, true);
  assert.deepEqual(p.engine.lazyLoadingEntries, ['口上・メッセージ関連\\個人口上']);

  assert.equal(p.variant?.nowVersion, '20261013');
  assert.equal(p.variant?.eraVersion, '4.981'); // 引号已剥离
  assert.equal(p.variant?.subVersion, '画蛇添足版CH{NOW_VERSION}');

  assert.equal(p.scale.erbFileCount, 6);
  assert.equal(p.scale.csvFileCount, 6); // CFLAG.csv/Talent.csv/_Rename.csv/VariableSize.csv + Chara×2
  assert.ok(p.scale.totalBytes > 0);

  const koujoDir = p.directories.find((d) => d.name === '口上・メッセージ関連');
  assert.equal(koujoDir?.erbCount, 3);
  assert.equal(koujoDir?.fileCount, 3);
  assert.ok(p.directories.some((d) => d.name === '(root)' && d.erbCount === 2));
  assert.ok(p.directories.some((d) => d.name === '魔改内容' && d.erbCount === 1));

  const cflag = p.variableFamilies.find((f) => f.name === 'CFLAG');
  assert.equal(cflag?.alsEnumCount, 3);
  assert.equal(cflag?.csvEnumCount, 3);
  assert.deepEqual(cflag?.sampleNames, ['既成事实', '好感度', '异常经验']);
  assert.ok(p.variableFamilies.some((f) => f.name === 'TALENT' && f.csvEnumCount === 2));
  assert.ok(!p.variableFamilies.some((f) => f.name === '_RENAME' || f.name === 'VARIABLESIZE'));

  assert.equal(p.characters.charaCsvCount, 2);
  assert.equal(p.koujo.present, true);
  assert.equal(p.koujo.personalDirCount, 2);
  assert.equal(p.modding.moddingDirPresent, true);

  assert.equal(p.encoding.sampledFiles, 6);
  assert.equal(p.encoding.utf8Bom, 1);
  assert.equal(p.encoding.cp932, 1);
  assert.equal(p.encoding.utf8, 4);

  const hints = p.hints.join('\n');
  assert.match(hints, /懒加载已开启/);
  assert.match(hints, /调试指令已允许/);
  assert.match(hints, /ERD 命名生效/);
  assert.match(hints, /_Rename\/_Replace 生效/);
  assert.match(hints, /最低警告等级 0/);
  assert.match(hints, /口上系统存在/);
  assert.match(hints, /魔改内容目录存在/);
  assert.match(hints, /简繁双语命名并存/);
  assert.match(hints, /CP932 文件/);

  assert.ok(!Number.isNaN(Date.parse(p.profiledAt)));
});

test('profile: missing root throws', async () => {
  await assert.rejects(() => profileProject(path.join(projectRoot, 'no-such-dir')), /项目根目录不存在/);
});

test('profile: empty project degrades gracefully', async () => {
  const empty = await mkdtemp(path.join(tmpdir(), 'era-harness-empty-'));
  try {
    const p = await profileProject(empty);
    assert.equal(p.engine.exeFiles.length, 0);
    assert.equal(p.engine.configFound, false);
    assert.equal(p.config, null);
    assert.equal(p.variant, null);
    assert.equal(p.scale.erbFileCount, 0);
    assert.equal(p.koujo.present, false);
    assert.equal(p.encoding.sampledFiles, 0);
  } finally {
    await rm(empty, { recursive: true, force: true });
  }
});

const realRoot = process.env.ERA_PROJECT_PATH;
test(
  'integration: real eratw project (needs ERA_PROJECT_PATH env)',
  { skip: realRoot === undefined },
  async () => {
    const p = await profileProject(realRoot as string);
    assert.match(p.variant?.nowVersion ?? '', /^\d{8}$/);
    assert.ok(p.scale.erbFileCount > 1000, `erbFileCount=${p.scale.erbFileCount}`);
    assert.ok(p.koujo.present);
    assert.ok(p.characters.charaCsvCount > 100, `charaCsvCount=${p.characters.charaCsvCount}`);
    assert.ok(p.variableFamilies.length > 5);
    assert.ok(p.hints.length > 3);
    assert.ok(p.encoding.sampledFiles > 0);
  },
);

// ── C1：画像读取走编码安全通道（CP932 / BOM）────────────────────────────

test('profile: CP932 编码的 CSV 解码为正常文本（不是 U+FFFD 乱码）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'era-harness-cp932-'));
  try {
    // CP932 字节的「あいう」+ ASCII（合成内容，非游戏文本）
    const nameBytes = Buffer.from([0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4]);
    const expectedName = new TextDecoder('windows-31j').decode(nameBytes);
    assert.ok(!expectedName.includes('\uFFFD'), 'fixture 字节必须是合法 CP932');
    await mkdir(path.join(root, 'CSV'), { recursive: true });
    await writeFile(
      path.join(root, 'CSV', 'TFLAG.csv'),
      Buffer.concat([Buffer.from('1,'), nameBytes, Buffer.from('\n2,GOOUT\n')]),
    );
    const p = await profileProject(root);
    const family = p.variableFamilies.find((f) => f.name === 'TFLAG');
    assert.ok(family, '应识别出 TFLAG 家族');
    assert.deepEqual(family.sampleNames, [expectedName, 'GOOUT']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('profile: UTF-8 BOM 被剥离，首字段不被污染', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'era-harness-bom-'));
  try {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    await writeFile(
      path.join(root, 'lazyloading.cfg'),
      Buffer.concat([bom, Buffer.from('口上・メッセージ関連\\個人口上\n', 'utf8')]),
    );
    await writeFile(
      path.join(root, 'emuera.config'),
      Buffer.concat([bom, Buffer.from('USELAZYLOADING:YES\n', 'utf8')]),
    );
    const p = await profileProject(root);
    // 旧实现首元素会带 \uFEFF 前缀
    assert.deepEqual(p.engine.lazyLoadingEntries, ['口上・メッセージ関連\\個人口上']);
    // 旧实现首条 key 会带 \uFEFF，查不到
    assert.equal(p.config?.entries[0]?.key, 'USELAZYLOADING');
    assert.equal(configGetBoolean(p.config, 'uselazyloading'), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ── C2：编码采样的截断点必须落在整行边界 ────────────────────────────────

test('encoding: 采样截断退到整行边界，合法 UTF-8 不再被误判为 CP932', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'era-harness-sample-'));
  try {
    const erbDir = path.join(root, 'ERB');
    await mkdir(erbDir, { recursive: true });
    // 前 1020 字节是 340 行 ASCII 整行，随后 10 字节「あああ\n」：
    // 旧实现切在第 1024 字节（「あ」中间）→ 残字节让 fatal UTF-8 校验失败 → 误判 cp932
    const lines = Buffer.from('ab\n'.repeat(340), 'utf8');
    const tail = Buffer.from('あああ\n', 'utf8');
    assert.equal(lines.length, 1020);
    await writeFile(path.join(erbDir, 'TRUNC.ERB'), Buffer.concat([lines, tail]));
    // 小文件整读分支：CP932 字节（含换行）仍应判 cp932
    await writeFile(path.join(erbDir, 'SMALL.ERB'), Buffer.from([0x88, 0x9f, 0x82, 0xb1, 0x0a]));

    const sample = await sampleErbEncodings(
      [path.join(erbDir, 'TRUNC.ERB'), path.join(erbDir, 'SMALL.ERB')],
      10,
    );
    assert.equal(sample.sampledFiles, 2);
    assert.equal(sample.utf8, 1, '截断退行边界后应正确判为 utf8');
    assert.equal(sample.cp932, 1);
    assert.equal(sample.utf8Bom, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('encoding: 超长单行文件（1KB 内无换行）不崩、有判定', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'era-harness-longline-'));
  try {
    const erbDir = path.join(root, 'ERB');
    await mkdir(erbDir, { recursive: true });
    await writeFile(path.join(erbDir, 'LONGLINE.ERB'), Buffer.from('x'.repeat(2048), 'utf8'));
    const sample = await sampleErbEncodings([path.join(erbDir, 'LONGLINE.ERB')], 5);
    assert.equal(sample.sampledFiles, 1);
    assert.equal(sample.utf8, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

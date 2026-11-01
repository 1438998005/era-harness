/**
 * #110：`kb.json` 的 `index` 字段是**模型可写**的，原来只判「是字符串」就
 * `path.join(dir, index)` 读盘，于是 `"../../../.ssh/id_rsa"` 能被读出来拼进系统提示词。
 *
 * 这里锁两件事：
 * 1. `readManifest` 把非法 `index` 收敛成默认值（白名单）；
 * 2. `readIndexText` 即使拿到脏值也读不到库目录之外（`path.relative` 兜底）。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_INDEX_FILE,
  type GameKbEntry,
  type GameKbManifest,
  knowledgeBaseDir,
  readIndexText,
  readManifest,
  resolveIndexPath,
  safeIndexFile,
} from '../src/gamekb/index.js';

const NOW = new Date(2026, 9, 31, 12, 0, 0);

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'era-gamekb-index-guard-'));
  try {
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

/** 手搓一个库目录 + 指定 index 的 kb.json（模拟模型把 index 写脏） */
async function makeKbWithIndex(root: string, index: unknown): Promise<string> {
  const dir = knowledgeBaseDir(root, 'kb-202610311200-aaaa');
  await fs.mkdir(dir, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    slug: 'kb-202610311200-aaaa',
    name: '测试库',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    enabled: true,
    index,
  };
  await fs.writeFile(path.join(dir, 'kb.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(dir, DEFAULT_INDEX_FILE), '# 真索引\n', 'utf8');
  return dir;
}

function entryOf(dir: string, manifest: GameKbManifest | null): GameKbEntry {
  return { slug: 'kb-202610311200-aaaa', dir, manifest, broken: manifest === null, fileCount: 0, hasIndex: true, buildStatus: 'ready' };
}

test('#110 safeIndexFile：只放行单层 .md，其余一律回落默认', () => {
  assert.equal(safeIndexFile('notes.md'), 'notes.md');
  assert.equal(safeIndexFile('index.md'), 'index.md');
  assert.equal(safeIndexFile('a_b-1.md'), 'a_b-1.md');

  for (const bad of [
    '../../../.ssh/id_rsa',
    '../../x.md',
    '..\\x.md',
    '/etc/passwd',
    'C:/Users/x/secret.md',
    'a/b.md',
    'functions/combat.md',
    'index.md.exe',
    '.md',
    '',
    42,
    null,
    undefined,
  ]) {
    assert.equal(safeIndexFile(bad), DEFAULT_INDEX_FILE, `必须回落默认值：${String(bad)}`);
  }
});

test('#110 readManifest：脏 index 收敛成默认值', async () => {
  await withTempDir(async (root) => {
    const dir = await makeKbWithIndex(root, '../../../.ssh/id_rsa');
    const manifest = await readManifest(dir);
    assert.equal(manifest?.index, DEFAULT_INDEX_FILE, '非法 index 不能原样带出来');
  });
});

test('#110 readIndexText：即使 manifest 里塞了脏 index，也读不到库目录外', async () => {
  await withTempDir(async (root) => {
    // 在库目录外放一个「机密文件」，路径用 ../secret.md 就能到达
    await fs.writeFile(path.join(root, 'secret.md'), '# 机密\n不该出现在提示词里\n', 'utf8');
    const dir = await makeKbWithIndex(root, '../../secret.md');

    const manifest = await readManifest(dir);
    const text = await readIndexText(entryOf(dir, manifest));
    assert.equal(text, '# 真索引\n', '必须读库内的 index.md，而不是被 index 字段带出去');

    // 直接构造一个绕过 readManifest 的脏 manifest，验证 readIndexText 自己的兜底
    const dirty = { ...(manifest as GameKbManifest), index: '../../secret.md' };
    const leaked = await readIndexText(entryOf(dir, dirty));
    assert.equal(leaked, '# 真索引\n', 'readIndexText 必须自己有兜底，不能只依赖 readManifest');
    assert.ok(!String(leaked).includes('机密'), '机密内容绝不能进返回值');
  });
});

test('#110 resolveIndexPath：合法值走原路径，非法值落回默认且始终在库目录内', async () => {
  await withTempDir(async (root) => {
    const dir = await makeKbWithIndex(root, 'notes.md');
    await fs.writeFile(path.join(dir, 'notes.md'), '# 笔记\n', 'utf8');

    assert.equal(resolveIndexPath(dir, 'notes.md'), path.join(dir, 'notes.md'));
    for (const bad of ['../../secret.md', '/etc/passwd', 'a/b.md']) {
      const resolved = resolveIndexPath(dir, bad);
      assert.equal(resolved, path.join(dir, DEFAULT_INDEX_FILE), `必须回落：${bad}`);
      const rel = path.relative(path.resolve(dir), path.resolve(resolved));
      assert.ok(!rel.startsWith('..'), `解析结果不能跑出库目录：${bad}`);
    }
  });
});

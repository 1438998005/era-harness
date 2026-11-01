/**
 * #120：原子写的临时文件名必须唯一。
 *
 * 现场：`writeManifest` / `writeBuildState` / `writeUiState` 的 tmp 名固定为 `<target>.tmp`，
 * 不含 pid / 随机数。两个写者并发时：A 打开 tmp 写入 → B 打开同一 tmp 截断写完 →
 * B rename 成功 → A 的 rename 落空（或 POSIX 下 A 的 fd 仍指向已改名的 inode 继续写），
 * 最终落盘的可能是半截 JSON；Windows 上更常见的是第二个 rename 直接 ENOENT。
 *
 * 这里锁两件事：
 * 1. 同一目标的两次写，tmp 名互不相同、且都不是固定的 `<target>.tmp`（mock rename 捕获）；
 * 2. 并发写同一目录：全部 resolve、最终文件可解析、目录里没有 `.tmp` 残留。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BUILD_STATE_FILE,
  UI_STATE_FILE,
  readManifest,
  writeBuildState,
  writeManifest,
  writeUiState,
} from '../src/gamekb/index.js';
import type { GameKbManifest } from '../src/gamekb/types.js';

/** 与 `store.ts` 的写盘点一致；那里没有导出文件名常量 */
const KB_MANIFEST_FILE = 'kb.json';

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'era-gamekb-atomic-'));
  try {
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

const baseManifest: GameKbManifest = {
  schemaVersion: 1,
  slug: 'kb-test',
  name: '测试库',
  createdAt: '2026-10-31T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z',
  enabled: true,
  index: 'index.md',
};

test('同一目标的多次写，tmp 名互不相同且不是固定 <target>.tmp（#120）', async (t) => {
  const captured: string[] = [];
  // 只捕获不执行 rename：本测试只关心 tmp 名，不关心落盘结果
  t.mock.method(fs, 'rename', async (from: string, _to: string) => {
    captured.push(from);
  });

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'era-gamekb-atomic-'));
  try {
    await writeManifest(dir, baseManifest);
    await writeManifest(dir, { ...baseManifest, updatedAt: '2026-10-31T01:00:00.000Z' });
    await writeBuildState(dir, { status: 'building' });
    await writeBuildState(dir, { status: 'ready' });
    await writeUiState(dir, { enabled: true });
    await writeUiState(dir, { enabled: false });

    assert.equal(captured.length, 6);
    // 全部唯一
    assert.equal(new Set(captured).size, 6);
    // 没有一个是旧的固定名
    for (const fixed of [
      path.join(dir, `${KB_MANIFEST_FILE}.tmp`),
      path.join(dir, `${BUILD_STATE_FILE}.tmp`),
      path.join(dir, `${UI_STATE_FILE}.tmp`),
    ]) {
      assert.ok(!captured.includes(fixed), `不应再使用固定 tmp 名：${fixed}`);
    }
    // tmp 名都挂在目标同目录下、以 .tmp 结尾
    for (const tmp of captured) {
      assert.equal(path.dirname(tmp), dir);
      assert.ok(tmp.endsWith('.tmp'));
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('并发原子写互不干扰、无 tmp 残留（#120）', async () => {
  await withTempDir(async (dir) => {
    await Promise.all([
      writeManifest(dir, baseManifest),
      writeManifest(dir, { ...baseManifest, name: '另一个写者' }),
      writeBuildState(dir, { status: 'building' }),
      writeBuildState(dir, { status: 'ready' }),
      writeUiState(dir, { enabled: true }),
      writeUiState(dir, { enabled: false }),
    ]);

    const entries = await fs.readdir(dir);
    assert.ok(
      entries.every((e) => !e.endsWith('.tmp')),
      `不应有 tmp 残留：${entries.join(', ')}`,
    );
    const manifest = await readManifest(dir);
    assert.ok(manifest, '并发写后 kb.json 必须仍是合法 JSON');
  });
});

test('rename 永久失败后 tmp 必须被清理，不留惰性垃圾（#130）', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'era-gamekb-atomic-'));
  try {
    // rename 一律 EPERM：重试耗尽后应先清理 tmp 再抛（而非把半截文件留在库目录里）
    t.mock.method(fs, 'rename', async () => {
      const error = new Error('mock EPERM') as NodeJS.ErrnoException;
      error.code = 'EPERM';
      throw error;
    });
    await assert.rejects(writeBuildState(dir, { status: 'building' }));
    const entries = await fs.readdir(dir);
    assert.ok(entries.every((e) => !e.endsWith('.tmp')), `不应有 tmp 残留：${entries.join(', ')}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

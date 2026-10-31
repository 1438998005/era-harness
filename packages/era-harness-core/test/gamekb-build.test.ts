/**
 * #93：知识库构建状态机（核心库侧）。
 *
 * 现场：一次完整建库跑了几小时没结果，磁盘上只有 `index.md` 骨架 + `kb.json`，
 * 而后续对话依然把这份空索引当「知识库」注入 —— 模型拿着空目录瞎猜。
 *
 * 根因是**磁盘上没有「这次构建成不成」的事实**：`hasIndex` 在骨架建库时就已经是 true，
 * 所以「有没有索引」根本不能当「能不能用」。
 *
 * 这里锁三件事：
 * 1. `build.status` 只认四个枚举值（脏数据不能变成事实）；
 * 2. `resolveBuildStatus` 对旧库（无 build 字段）必须向后兼容 —— 升级不能把用户已有的库判成不可用；
 * 3. `updateKnowledgeBaseBuild` 是「读 → 合并 → 原子写回」，并发/中断都不能留下半个 JSON。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createKnowledgeBase,
  isIndexSkeleton,
  knowledgeBaseDir,
  readManifest,
  resolveBuildStatus,
  updateKnowledgeBaseBuild,
  writeManifest,
} from '../src/gamekb/index.js';
import type { GameKbManifest } from '../src/gamekb/types.js';

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'era-gamekb-build-'));
  try {
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

const NOW = new Date(2026, 9, 31, 12, 0, 0);

function manifestWith(build?: GameKbManifest['build']): GameKbManifest {
  return {
    schemaVersion: 1,
    slug: 'kb-202610311200-abcd',
    name: 'x',
    createdAt: '2026-10-31T04:00:00.000Z',
    updatedAt: '2026-10-31T04:00:00.000Z',
    enabled: true,
    index: 'index.md',
    files: [],
    ...(build ? { build } : {}),
  };
}

test('#93 建库初始状态：完整建库 → building，空白建库 → draft，都带 startedAt', async () => {
  await withTempDir(async (root) => {
    const full = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'aaaa', mode: 'full' });
    assert.equal(full.build?.status, 'building');
    assert.equal(full.build?.mode, 'full');
    assert.ok(full.build?.startedAt);

    const blank = await createKnowledgeBase(root, {
      name: 'b',
      now: new Date(2026, 9, 31, 12, 1, 0),
      suffix: 'bbbb',
      mode: 'blank',
    });
    assert.equal(blank.build?.status, 'draft');
    assert.equal(blank.build?.mode, 'blank');
  });
});

test('#93 updateKnowledgeBaseBuild 合并而非替换；没有 kb.json 返回 false', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'aaaa', mode: 'full' });
    const dir = knowledgeBaseDir(root, manifest.slug);

    assert.equal(await updateKnowledgeBaseBuild(dir, { status: 'ready', finishedAt: '2026-10-31T05:00:00.000Z' }), true);
    const ready = await readManifest(dir);
    assert.equal(ready?.build?.status, 'ready');
    assert.equal(ready?.build?.mode, 'full');
    assert.equal(ready?.build?.startedAt, manifest.build?.startedAt);

    assert.equal(await updateKnowledgeBaseBuild(dir, { status: 'failed', error: '已中断（可继续构建）' }), true);
    const failed = await readManifest(dir);
    assert.equal(failed?.build?.status, 'failed');
    assert.equal(failed?.build?.error, '已中断（可继续构建）');

    // 读不出 manifest 时不能凭空造一个：返回 false，由调用方只记日志
    assert.equal(await updateKnowledgeBaseBuild(path.join(root, 'missing'), { status: 'ready' }), false);
  });
});

test('#93 updateKnowledgeBaseBuild 原子写：只动 build.json，不留下 .tmp', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'aaaa' });
    const dir = knowledgeBaseDir(root, manifest.slug);
    await updateKnowledgeBaseBuild(dir, { status: 'ready' });

    const names = await fs.readdir(dir);
    // #96：构建事实搬进 sidecar；kb.json 不再被状态写入触碰（否则会和模型的整篇写盘互相覆盖）
    assert.deepEqual(names.sort(), ['build.json', 'index.md', 'kb.json']);
  });
});

test('#93 readManifest 丢弃非法 build 枚举（脏数据不能变成事实）', async () => {
  await withTempDir(async (root) => {
    const dir = path.join(root, 'kb');
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      path.join(dir, 'kb.json'),
      JSON.stringify({ slug: 'kb-202610311200-abcd', name: 'x', build: { status: 'half-done', mode: 'magic' } }),
      'utf8',
    );
    assert.equal((await readManifest(dir))?.build, undefined);

    await fs.writeFile(
      path.join(dir, 'kb.json'),
      JSON.stringify({ slug: 'kb-202610311200-abcd', name: 'x', build: { status: 'building', mode: 'magic' } }),
      'utf8',
    );
    const partial = await readManifest(dir);
    assert.equal(partial?.build?.status, 'building');
    assert.equal(partial?.build?.mode, undefined);
  });
});

/**
 * 3.95.1：`mode`（建库形态）与 `taskKind`（任务形态）拆分。
 *
 * 3.95.0 把两者塞进同一个 `mode`，导致“建库形态会被后续任务覆盖”。
 * 这里锁两件事：① 任务只写 taskKind，不动 mode；② 老文件读时降级。
 */
test('3.95.1 任务只写 taskKind：建库形态在整个生命周期内不变', async () => {
  await withTempDir(async (root) => {
    const blank = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'aaaa', mode: 'blank' });
    const dir = knowledgeBaseDir(root, blank.slug);

    await updateKnowledgeBaseBuild(dir, { status: 'building', taskKind: 'incremental' });
    assert.equal((await readManifest(dir))?.build?.mode, 'blank', '任务不得覆盖建库形态');

    await updateKnowledgeBaseBuild(dir, { status: 'ready' });
    const ready = await readManifest(dir);
    assert.equal(ready?.build?.mode, 'blank');
    assert.equal(ready?.build?.taskKind, 'incremental');
    assert.equal(ready?.build?.status, 'ready');
  });
});

test('3.95.1 旧 mode 降级：incremental+draft → blank，update → full，显式字段优先', async () => {
  await withTempDir(async (root) => {
    const dir = path.join(root, 'kb');
    await fs.mkdir(dir, { recursive: true });
    const write = (build: unknown) =>
      fs.writeFile(path.join(dir, 'kb.json'), JSON.stringify({ slug: 'kb-202610311200-abcd', name: 'x', build }), 'utf8');

    await write({ status: 'draft', mode: 'incremental' });
    const blank = await readManifest(dir);
    assert.equal(blank?.build?.mode, 'blank');
    assert.equal(blank?.build?.taskKind, 'incremental');

    await write({ status: 'ready', mode: 'update' });
    const updated = await readManifest(dir);
    assert.equal(updated?.build?.mode, 'full');
    assert.equal(updated?.build?.taskKind, 'update');

    // 显式 taskKind 优先于旧 mode 推断（status 不是 draft → 旧 incremental 按完整建库兼容）
    await write({ status: 'ready', mode: 'incremental', taskKind: 'update' });
    const mixed = await readManifest(dir);
    assert.equal(mixed?.build?.mode, 'full');
    assert.equal(mixed?.build?.taskKind, 'update', '显式字段优先');
  });
});

test('#93 resolveBuildStatus：显式状态优先，但 ready 要过内容校验', () => {
  // 显式状态优先（哪怕磁盘上已经有分片，半成品也不能被文件数「救活」）
  assert.equal(resolveBuildStatus(manifestWith({ status: 'failed' }), 5, '- x'), 'failed');
  assert.equal(resolveBuildStatus(manifestWith({ status: 'draft' }), 3, '- x'), 'draft');
  assert.equal(resolveBuildStatus(manifestWith({ status: 'building' }), 0, null), 'building');

  // #96：ready 必须取证——零分片 + 骨架索引说明「喊了完成但什么都没写」
  assert.equal(resolveBuildStatus(manifestWith({ status: 'ready' }), 0, null), 'failed');
  assert.equal(resolveBuildStatus(manifestWith({ status: 'ready' }), 0, '# t\n\n## 函数\n'), 'failed');
  assert.equal(resolveBuildStatus(manifestWith({ status: 'ready' }), 0, '# t\n\n- @foo — y — a.ERB:1\n'), 'ready');
  assert.equal(resolveBuildStatus(manifestWith({ status: 'ready' }), 1, null), 'ready');

  // 旧库（无 build 字段）
  assert.equal(resolveBuildStatus(manifestWith(), 1, ''), 'ready', '有分片即可用');
  assert.equal(resolveBuildStatus(manifestWith(), 0, '# t\n\n- @foo — y — a.ERB:1\n'), 'ready', '索引有条目也算');
  assert.equal(resolveBuildStatus(manifestWith(), 0, '# t\n\n## 函数\n'), 'draft', '只有骨架就是没建完');
  assert.equal(resolveBuildStatus(manifestWith(), 0, null), 'draft');

  // 坏库
  assert.equal(resolveBuildStatus(null, 0, null), 'draft');
  assert.equal(resolveBuildStatus(null, 2, '- x'), 'ready', 'manifest 丢了但磁盘有分片：先按可用处理，避免误伤');
});

test('#96 isIndexSkeleton：除标题/空行/引用/分隔线外没有任何正文', () => {
  assert.equal(isIndexSkeleton(''), true);
  assert.equal(isIndexSkeleton('# t\n\n## 函数\n\n## 机制与坑\n'), true);
  assert.equal(isIndexSkeleton('# t\n\n> 本库由 AI 生成，仅供参考\n'), true);
  assert.equal(isIndexSkeleton('# t\n\n---\n'), true);
  assert.equal(isIndexSkeleton('# t\n\n- @foo — y — a.ERB:1\n'), false);
  assert.equal(isIndexSkeleton('# t\n\n* @bar — y — b.ERB:2\n'), false);
  assert.equal(isIndexSkeleton('  - 缩进的条目也算\n'), false);
  // 表格 / 有序列表同样是正文：只认 `- ` 会把这类索引误判成骨架，进而把有内容的库当成零产出
  assert.equal(isIndexSkeleton('| 条目 | 出处 |\n|---|---|\n| @foo | a.ERB:1 |\n'), false);
  assert.equal(isIndexSkeleton('1. @foo — a.ERB:1\n'), false);
  assert.equal(isIndexSkeleton('-没有空格的破折号也算正文\n'), false);
});

test('#93 writeManifest 后 build 仍在（设置页/注入都靠它跨重启存活）', async () => {
  await withTempDir(async (root) => {
    const dir = path.join(root, 'kb');
    await fs.mkdir(dir, { recursive: true });
    await writeManifest(dir, manifestWith({ status: 'ready', mode: 'blank', finishedAt: '2026-10-31T06:00:00.000Z' }));

    const read = await readManifest(dir);
    assert.equal(read?.build?.status, 'ready');
    assert.equal(read?.build?.mode, 'blank');
    assert.equal(read?.build?.finishedAt, '2026-10-31T06:00:00.000Z');
  });
});

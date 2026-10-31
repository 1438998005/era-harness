/**
 * #96：构建状态的事实源搬进 sidecar（`build.json`）。
 *
 * 现场：`build` 原本住在 `kb.json` 里，而模型写盘是「整篇覆盖」。按 `KB_JSON_SCHEMA`
 * 重写一次（schema 里根本没有 `build`）就会把状态整块抹掉，退化成「有分片即 ready」，
 * 半成品于是在窗口重载后被注入；反过来模型也能自己写个 `status:"ready"` 把失败库洗成可用库。
 *
 * 这里锁四件事：
 * 1. 模型整篇重写 `kb.json`（不含 build）之后，状态与建库形态都还在；
 * 2. 状态写入**不再触碰** `kb.json`（否则宿主和模型会互相覆盖）；
 * 3. 存量库（只有 `kb.json.build`、没有 sidecar）读得出来，冲突时 sidecar 优先；
 * 4. 收尾必须先取证：零产出判 `failed`，不是「没报错就算成功」。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BUILD_STATE_FILE,
  createKnowledgeBase,
  finalizeKnowledgeBaseBuild,
  knowledgeBaseDir,
  readBuildState,
  readManifest,
  updateKnowledgeBaseBuild,
  writeBuildState,
  writeManifest,
} from '../src/gamekb/index.js';
import type { GameKbManifest } from '../src/gamekb/types.js';

async function withTempDir(run: (root: string) => Promise<void>): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'era-gamekb-sidecar-'));
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

test('#96 模型整篇重写 kb.json（不含 build）后，状态与建库形态都还在', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'aaaa', mode: 'full' });
    const dir = knowledgeBaseDir(root, manifest.slug);
    await fs.mkdir(path.join(dir, 'functions'), { recursive: true });
    await fs.writeFile(path.join(dir, 'functions', 'combat.md'), '- @COMBAT — 战斗 — ERB/COMBAT.ERB:12\n', 'utf8');
    assert.equal(await finalizeKnowledgeBaseBuild(dir, { taskId: 'task-1' }), 'ready');

    // 模拟模型照 KB_JSON_SCHEMA 整篇重写：11 个字段，没有 build
    const rewritten = {
      schemaVersion: 1,
      slug: manifest.slug,
      name: 'a',
      createdAt: manifest.createdAt,
      updatedAt: '2026-10-31T05:00:00.000Z',
      enabled: true,
      index: 'index.md',
      counts: { function: 1 },
      files: [{ path: 'functions/combat.md', title: '战斗' }],
    };
    await fs.writeFile(path.join(dir, 'kb.json'), JSON.stringify(rewritten, null, 2), 'utf8');

    const read = await readManifest(dir);
    assert.equal(read?.build?.status, 'ready', 'sidecar 才是事实源，kb.json 被重写不影响状态');
    assert.equal(read?.build?.mode, 'full', '建库形态不能被模型抹掉');
    assert.equal(read?.counts?.function, 1, '模型写的内容照常读得到');
  });
});

test('#96 状态写入只动 build.json，一个字节都不碰 kb.json', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'bbbb' });
    const dir = knowledgeBaseDir(root, manifest.slug);
    // 写入一段「模型刚写完」的内容，随后宿主改状态，这段内容必须原样保留
    const modelWritten = `${JSON.stringify({ ...manifest, files: [{ path: 'functions/x.md' }] }, null, 2)}\n`;
    await fs.writeFile(path.join(dir, 'kb.json'), modelWritten, 'utf8');

    await updateKnowledgeBaseBuild(dir, { status: 'ready', finishedAt: '2026-10-31T06:00:00.000Z' });

    assert.equal(await fs.readFile(path.join(dir, 'kb.json'), 'utf8'), modelWritten, 'kb.json 不应被状态写入改写');
    assert.equal((await readBuildState(dir))?.status, 'ready');
    const names = await fs.readdir(dir);
    assert.ok(names.includes(BUILD_STATE_FILE), 'sidecar 必须落盘');
    assert.ok(!names.some((n) => n.endsWith('.tmp')), '不能留下临时文件');
  });
});

test('#96 无 sidecar 的存量库：读 kb.json.build 兜底', async () => {
  await withTempDir(async (root) => {
    const dir = path.join(root, 'kb');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'kb.json'),
      JSON.stringify(manifestWith({ status: 'ready', mode: 'blank', taskKind: 'incremental' })),
      'utf8',
    );

    const read = await readManifest(dir);
    assert.equal(read?.build?.status, 'ready');
    assert.equal(read?.build?.mode, 'blank');
    assert.equal(read?.build?.taskKind, 'incremental');
  });
});

test('#96 sidecar 与 kb.json.build 冲突时，以 sidecar 为准', async () => {
  await withTempDir(async (root) => {
    const dir = path.join(root, 'kb');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'kb.json'), JSON.stringify(manifestWith({ status: 'draft' })), 'utf8');
    await writeBuildState(dir, { status: 'ready', mode: 'full' });

    const read = await readManifest(dir);
    assert.equal(read?.build?.status, 'ready');
    assert.equal(read?.build?.mode, 'full');
  });
});

test('#96 finalize：零产出 → failed，并写清原因', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'cccc', mode: 'full' });
    const dir = knowledgeBaseDir(root, manifest.slug);
    // index.md 还是 createKnowledgeBase 写的骨架，没有任何分片

    assert.equal(await finalizeKnowledgeBaseBuild(dir, { taskId: 'task-2' }), 'failed');
    const build = (await readManifest(dir))?.build;
    assert.equal(build?.status, 'failed');
    assert.match(build?.error ?? '', /没有任何产出/);
  });
});

test('#96 finalize：有分片 → ready，并清掉上一次的 error', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'dddd', mode: 'full' });
    const dir = knowledgeBaseDir(root, manifest.slug);
    await updateKnowledgeBaseBuild(dir, { status: 'failed', error: '上一次中断' });
    await fs.mkdir(path.join(dir, 'constants'), { recursive: true });
    await fs.writeFile(path.join(dir, 'constants', 'slots.md'), '- TFLAG — 时间标记\n', 'utf8');

    assert.equal(await finalizeKnowledgeBaseBuild(dir, { taskId: 'task-3' }), 'ready');
    const build = (await readManifest(dir))?.build;
    assert.equal(build?.status, 'ready');
    assert.equal(build?.error, undefined, '成功收尾要清掉旧的失败原因');
  });
});

test('#96 finalize：只有索引条目、没有分片，也算有产出', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'eeee', mode: 'blank' });
    const dir = knowledgeBaseDir(root, manifest.slug);
    await fs.writeFile(path.join(dir, 'index.md'), '# a\n\n## 函数\n\n- @FOO — 示例 — ERB/FOO.ERB:1\n', 'utf8');

    assert.equal(await finalizeKnowledgeBaseBuild(dir), 'ready');
  });
});

test('#96 finalize：调用方带 error → 直接 failed 且保留原因', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'ffff', mode: 'full' });
    const dir = knowledgeBaseDir(root, manifest.slug);
    await fs.mkdir(path.join(dir, 'functions'), { recursive: true });
    await fs.writeFile(path.join(dir, 'functions', 'x.md'), '- x\n', 'utf8');

    assert.equal(await finalizeKnowledgeBaseBuild(dir, { error: '模型调用失败' }), 'failed');
    assert.equal((await readManifest(dir))?.build?.error, '模型调用失败');
  });
});

test('#96 并发写状态：串行化后 JSON 合法，最后一次写入生效', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'gggg', mode: 'full' });
    const dir = knowledgeBaseDir(root, manifest.slug);

    await Promise.all([
      updateKnowledgeBaseBuild(dir, { status: 'failed', error: '停止' }),
      updateKnowledgeBaseBuild(dir, { status: 'ready', finishedAt: '2026-10-31T07:00:00.000Z' }),
      updateKnowledgeBaseBuild(dir, { status: 'building', taskId: 'task-9', startedAt: '2026-10-31T08:00:00.000Z' }),
    ]);

    const names = await fs.readdir(dir);
    assert.ok(!names.some((n) => n.endsWith('.tmp')), '并发写入不能留下半个 JSON');
    const raw = await fs.readFile(path.join(dir, BUILD_STATE_FILE), 'utf8');
    const parsed = JSON.parse(raw) as { status: string; taskId?: string };
    assert.equal(parsed.status, 'building', '按目录串行化，最后一次调用生效');
    assert.equal(parsed.taskId, 'task-9');
  });
});

test('#96 过期任务写入被丢弃：旧 taskId 的终态不能盖掉新任务', async () => {
  await withTempDir(async (root) => {
    const manifest = await createKnowledgeBase(root, { name: 'a', now: NOW, suffix: 'hhhh', mode: 'full' });
    const dir = knowledgeBaseDir(root, manifest.slug);

    await updateKnowledgeBaseBuild(dir, { status: 'building', taskId: 'task-new', startedAt: '2026-10-31T09:00:00.000Z' });
    await updateKnowledgeBaseBuild(dir, { status: 'ready', taskId: 'task-new', finishedAt: '2026-10-31T09:30:00.000Z' });
    // 旧任务迟到的「中断」写入
    const accepted = await updateKnowledgeBaseBuild(dir, { status: 'failed', taskId: 'task-old', error: '已中断' });

    assert.equal(accepted, false, 'taskId 失配的终态写入必须被拒绝');
    assert.equal((await readManifest(dir))?.build?.status, 'ready');
  });
});

test('#96 writeManifest 仍然镜像 sidecar（旧版本只认 kb.json 的 build）', async () => {
  await withTempDir(async (root) => {
    const dir = path.join(root, 'kb');
    await fs.mkdir(dir, { recursive: true });
    await writeManifest(dir, manifestWith({ status: 'ready', mode: 'blank' }));

    const raw = JSON.parse(await fs.readFile(path.join(dir, 'kb.json'), 'utf8')) as GameKbManifest;
    assert.equal(raw.build?.status, 'ready', 'kb.json 保留镜像，旧版本读得到');
    assert.equal((await readBuildState(dir))?.status, 'ready', 'sidecar 同步写入');
  });
});

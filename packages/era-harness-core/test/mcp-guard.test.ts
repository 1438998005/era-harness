import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  ALLOWED_ROOTS_ENV,
  assertPathAllowed,
  isInsideAllowedRoot,
  parseAllowedRoots,
} from '../src/mcp/guard.js';

test('未配置 ERA_HARNESS_MCP_ROOTS 时不限制任何路径', () => {
  assert.deepEqual(parseAllowedRoots(undefined), []);
  assert.deepEqual(parseAllowedRoots(''), []);
  assert.equal(isInsideAllowedRoot('/etc/passwd', []), true);
});

test('多个根可用分号或逗号分隔，引号与空白会被清掉', () => {
  const roots = parseAllowedRoots(' "D:/games" ; E:/backup , /srv/era ');
  assert.deepEqual(roots, [path.resolve('D:/games'), path.resolve('E:/backup'), path.resolve('/srv/era')]);
});

test('根之内（含根本身）放行，根之外拒绝', () => {
  const root = path.resolve('/tmp/era-root');
  assert.equal(isInsideAllowedRoot(path.join(root, 'ERB', 'A.ERB'), [root]), true);
  assert.equal(isInsideAllowedRoot(root, [root]), true);
  assert.equal(isInsideAllowedRoot(path.resolve('/tmp/other/A.ERB'), [root]), false);
});

test('前缀相同但不同目录不得误放行（game vs game-backup）', () => {
  const root = path.resolve('/tmp/game');
  assert.equal(isInsideAllowedRoot(path.resolve('/tmp/game-backup/A.ERB'), [root]), false);
});

test('越界时抛错，错误信息里带出环境变量名与目标路径', () => {
  const root = path.resolve('/tmp/era-root');
  const outside = path.resolve('/tmp/outside/A.ERB');
  assert.throws(
    () => assertPathAllowed(outside, [root]),
    (err: unknown) => err instanceof Error && err.message.includes(ALLOWED_ROOTS_ENV) && err.message.includes(outside),
  );
  assert.equal(assertPathAllowed(path.join(root, 'A.ERB'), [root]), path.join(root, 'A.ERB'));
});

test('相对路径按进程工作目录解析后再比较', () => {
  const root = process.cwd();
  assert.equal(isInsideAllowedRoot('some/relative/file.ERB', [root]), true);
});

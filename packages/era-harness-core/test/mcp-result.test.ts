import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RESULT_STRING_CHARS, jsonResult } from '../src/mcp/result.js';

function parse(result: { content: { type: 'text'; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

test('#67 正常结果原样返回，不加多余字段', () => {
  const payload = parse(jsonResult({ ok: true, text: 'short' }));
  assert.deepEqual(payload, { ok: true, text: 'short' });
});

test('#67 超长字符串被截断，并标 resultTruncated', () => {
  const huge = 'a'.repeat(MAX_RESULT_STRING_CHARS + 5_000);
  const payload = parse(jsonResult({ text: huge, meta: { encoding: 'utf8' } }));
  assert.equal(payload.resultTruncated, true);
  assert.equal(typeof payload.text, 'string');
  assert.ok((payload.text as string).length < huge.length);
  assert.match(payload.text as string, /已截断：原文 \d+ 字符/);
  // 其余字段不受影响（结构保留）
  assert.deepEqual(payload.meta, { encoding: 'utf8' });
});

test('#67 嵌套数组里的超长字符串同样截断', () => {
  // 取 2 倍上限：截断串（上限 + 提示语）才明确短于原文
  const huge = 'b'.repeat(MAX_RESULT_STRING_CHARS * 2);
  const payload = parse(jsonResult({ diagnostics: [{ message: huge }] }));
  assert.equal(payload.resultTruncated, true);
  const first = (payload.diagnostics as { message: string }[])[0]!;
  assert.ok(first.message.length < huge.length);
  assert.match(first.message, /已截断/);
});

test('#67 顶层数组不崩（挂不了标记就原样返回）', () => {
  const result = jsonResult(['ok', 1]);
  assert.deepEqual(JSON.parse(result.content[0]!.text), ['ok', 1]);
});

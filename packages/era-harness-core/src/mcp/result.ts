/**
 * MCP 工具响应的兜底截断（#67）。
 *
 * 主防线是 `readTextFile` 的 `maxBytes`（按行边界切，不切坏多字节字符）；
 * 这里只兜住「其它路径产出的超长字符串」（例如整页 markdown、异常大的诊断数组），
 * 避免一次工具调用把模型上下文撑爆。
 *
 * 截断时**保留 JSON 结构**（只切字符串值），并在顶层补 `resultTruncated: true`，
 * 让模型知道「这份结果不完整」，而不是把截断当成真实内容。
 */
export const MAX_RESULT_STRING_CHARS = 200_000;

interface TruncateState {
  truncated: boolean;
}

function capLongStrings(value: unknown, state: TruncateState): unknown {
  if (typeof value === 'string') {
    if (value.length <= MAX_RESULT_STRING_CHARS) return value;
    state.truncated = true;
    return `${value.slice(0, MAX_RESULT_STRING_CHARS)}\n[已截断：原文 ${value.length} 字符，只返回前 ${MAX_RESULT_STRING_CHARS} 字符]`;
  }
  if (Array.isArray(value)) return value.map((item) => capLongStrings(item, state));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = capLongStrings(item, state);
    return out;
  }
  return value;
}

/** 把任意工具结果包成 MCP 的 text content；超长字符串就地截断并标注。 */
export function jsonResult(data: unknown): { content: { type: 'text'; text: string }[] } {
  const state: TruncateState = { truncated: false };
  const capped = capLongStrings(data, state);
  // 顶层不是对象（数组/标量）时挂不了标记，保持原样返回
  const payload =
    state.truncated && capped && typeof capped === 'object' && !Array.isArray(capped)
      ? { ...(capped as Record<string, unknown>), resultTruncated: true }
      : capped;
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

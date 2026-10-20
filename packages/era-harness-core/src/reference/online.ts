/**
 * 指令知识库的「双线并轨」取数：**在线优先，本地兜底**。
 *
 * 为什么不是「在线优先」一刀切：
 * - **索引（名字 / 签名 / 摘要）永远用内置快照**。关键词检索不可能为了查一个词去下载
 *   312 个页面；而且离线环境（用户的真实场景）必须能照常工作。
 * - **正文优先取在线**。命中一条指令时只需要 **1 个** HTTP 请求，
 *   拿到的新版整页**整体替换**本地页，不做字段级合并 —— 避免出现「一半新一半旧」的冲突。
 *
 * 所以同一时刻只会有一个来源，返回结果里带 `origin` 明确标注，不做混编。
 */

import { parseReferencePage } from './parse.js';
import type { ReferenceEntry } from './types.js';

/** 上游仓库的 raw 根（不含 `docs/Reference`） */
export const DEFAULT_REFERENCE_BASE =
  'https://raw.githubusercontent.com/qirchen421/emuera.sk.doc/feature/tutorial-restructure';

/** 在线开关：`auto` 尝试在线，`off` 完全不出网 */
export type OnlineMode = 'auto' | 'off';

export interface ReferenceSourceOptions {
  /** 默认 `auto` */
  mode?: OnlineMode;
  /** 覆盖上游 raw 根，用于自建镜像或换分支 */
  baseUrl?: string;
  /** 单页请求超时，默认 6000ms */
  timeoutMs?: number;
}

/** 取到的是哪一份 */
export type ReferenceOrigin = 'online' | 'local';

export interface ResolvedReference {
  entry: ReferenceEntry;
  origin: ReferenceOrigin;
  /** 给模型看的一句话来源说明 */
  sourceNote: string;
  /** 在线失败并已回退本地时的原因 */
  fallbackReason?: string;
}

/** 页面文件名只允许这些字符，避免把用户输入拼进路径 */
const SAFE_ID_RE = /^[A-Za-z0-9_.-]+$/;

/** 失败记忆：一段时间内不再重试，避免每次调用都白等一个超时 */
const FAILURE_TTL_MS = 3 * 60 * 1000;
const recentFailures = new Map<string, number>();

function failureKey(baseUrl: string): string {
  return baseUrl;
}

function isRecentlyFailed(baseUrl: string): boolean {
  const at = recentFailures.get(failureKey(baseUrl));
  if (at === undefined) {
    return false;
  }
  if (Date.now() - at > FAILURE_TTL_MS) {
    recentFailures.delete(failureKey(baseUrl));
    return false;
  }
  return true;
}

/** 测试与长会话用：清掉失败记忆 */
export function resetOnlineFailureCache(): void {
  recentFailures.clear();
}

/** 由页面 id 拼出 raw URL */
export function referencePageUrl(id: string, baseUrl: string = DEFAULT_REFERENCE_BASE): string | undefined {
  if (!SAFE_ID_RE.test(id)) {
    return undefined;
  }
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/docs/Reference/${id}.zh.md`;
}

/**
 * 拉取单页并解析。
 *
 * 返回 `undefined` 表示**取不到**（404 / 超时 / 网络不可用），调用方应回退本地。
 * 这里永不抛错：知识库的可用性不应因为网络问题变成工具报错。
 */
export async function fetchRemoteReference(
  id: string,
  options: ReferenceSourceOptions = {},
): Promise<{ entry: ReferenceEntry } | { error: string }> {
  const baseUrl = options.baseUrl ?? DEFAULT_REFERENCE_BASE;
  const url = referencePageUrl(id, baseUrl);
  if (!url) {
    return { error: `页面 id 不合法：${id}` };
  }
  if (isRecentlyFailed(baseUrl)) {
    return { error: '近期已连接失败，本次直接使用本地快照' };
  }

  const timeoutMs = options.timeoutMs ?? 6000;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'era-harness' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      if (res.status >= 500) {
        recentFailures.set(failureKey(baseUrl), Date.now());
      }
      return { error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    try {
      return { entry: parseReferencePage(id, text) };
    } catch (parseError) {
      // 页面能取到但解析不了：说明上游格式变了，不是网络故障。
      // 不能记入失败冷却，否则 3 分钟内所有页面都会被迫走本地。
      return {
        error: `页面解析失败（上游格式可能已变）：${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }
  } catch (error) {
    recentFailures.set(failureKey(baseUrl), Date.now());
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 解析一条指令：先定位本地条目拿到**页面 id**（名字 → 页面的映射以快照为准），
 * 再按需用在线版本整页替换。
 */
export async function resolveReferenceOnline(
  localEntry: ReferenceEntry,
  snapshotSha: string,
  options: ReferenceSourceOptions = {},
): Promise<ResolvedReference> {
  const mode = options.mode ?? 'auto';
  if (mode === 'off') {
    return {
      entry: localEntry,
      origin: 'local',
      sourceNote: `内置快照（${snapshotSha.slice(0, 8)}）`,
    };
  }

  const remote = await fetchRemoteReference(localEntry.id, options);
  if ('entry' in remote) {
    return {
      entry: remote.entry,
      origin: 'online',
      sourceNote: `在线上游（${referencePageUrl(localEntry.id, options.baseUrl ?? DEFAULT_REFERENCE_BASE)}）`,
    };
  }
  return {
    entry: localEntry,
    origin: 'local',
    sourceNote: `内置快照（${snapshotSha.slice(0, 8)}）`,
    fallbackReason: remote.error,
  };
}

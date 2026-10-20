#!/usr/bin/env node
/**
 * era harness MCP server（stdio 传输）。
 *
 * 暴露七个只读工具：
 *   - parse_emuera_log  日志 → 结构化诊断
 *   - profile_project   工程画像
 *   - read_erb_file     编码安全读取（UTF-8 BOM / CP932 自动探测转 UTF-8）
 *   - lookup_reference  Emuera 指令手册单条查询（在线优先，本地快照兜底）
 *   - search_reference  指令手册关键词检索（永远走内置索引，可离线）
 *   - lookup_knowledge  内嵌纪律/机制知识单条查询（编码纪律 / 合并闸门 / 口上契约）
 *   - search_knowledge  内嵌知识关键词检索（可离线）
 *
 * 依赖纪律见 `知识库/06-决策记录.md` D14：核心库（src/index.ts）保持零运行时依赖，
 * @modelcontextprotocol/sdk 只被本入口引用。
 *
 * 注意：stdio 传输下严禁向 stdout 打印（会污染 JSON-RPC 协议），调试信息走 stderr。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { parseLog } from '../log/parser.js';
import { profileProject } from '../profile/profiler.js';
import { readTextFile } from '../encoding/encoding.js';
import {
  REFERENCE_ENTRIES,
  REFERENCE_ENTRY_COUNT,
  REFERENCE_FETCHED_AT,
  REFERENCE_SOURCE_SHA,
  findReference,
  formatReferenceEntry,
  formatReferenceHits,
  listReferenceNames,
  resolveReferenceOnline,
  searchReference,
} from '../reference/index.js';
import type { OnlineMode, ReferenceSourceOptions } from '../reference/index.js';
import {
  KNOWLEDGE_ENTRIES,
  KNOWLEDGE_ENTRY_COUNT,
  KNOWLEDGE_SNAPSHOT_AT,
  findKnowledge,
  formatKnowledgeEntry,
  formatKnowledgeHits,
  listKnowledgeSummaries,
  searchKnowledge,
} from '../knowledge/index.js';
import { ALLOWED_ROOTS_ENV, assertPathAllowed, parseAllowedRoots } from './guard.js';

const server = new McpServer({ name: 'era-harness', version: '0.1.0' });

/** 可选的范围限定：设了 ERA_HARNESS_MCP_ROOTS 就只放行其内的路径，否则不限制 */
const allowedRoots = parseAllowedRoots(process.env[ALLOWED_ROOTS_ENV]);

/**
 * 指令库的在线开关：
 * - `ERA_HARNESS_REFERENCE_ONLINE=off` 完全不出网，只用内置快照
 * - `ERA_HARNESS_REFERENCE_BASE` 覆盖上游 raw 根（自建镜像 / 换分支 / 内网代理）
 */
function referenceSourceOptions(useOnline: boolean | undefined): ReferenceSourceOptions {
  const mode = (process.env.ERA_HARNESS_REFERENCE_ONLINE ?? 'auto').trim().toLowerCase() as OnlineMode;
  return {
    mode: useOnline === false || mode === 'off' ? 'off' : 'auto',
    baseUrl: process.env.ERA_HARNESS_REFERENCE_BASE?.trim() || undefined,
  };
}

function jsonResult(data: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

server.registerTool(
  'parse_emuera_log',
  {
    title: '解析 Emuera 日志',
    description:
      '读取 Emuera 引擎日志（UTF-8 BOM 自动剥离），返回结构化结果：引擎与变体信息、逐条诊断（分类/严重级/文件/行号/源码片段）、fatal 错误块、会话统计。日志路径为空时报错。',
    inputSchema: {
      path: z.string().describe('日志文件路径，如 emuera.log 或 YYYYMMDD-HHMMSS.log'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ path: logPath }) => {
    const { text } = await readTextFile(assertPathAllowed(logPath, allowedRoots));
    return jsonResult(parseLog(text));
  },
);

server.registerTool(
  'profile_project',
  {
    title: '提取工程画像',
    description:
      '扫描 eratw 工程根目录，返回 ProjectProfile：引擎 exe/config/懒加载、版本变体、ERB/CSV 规模、变量家族、角色与口上结构、编码统计、harness 提示。只读，任何缺失降级为空值。',
    inputSchema: {
      path: z.string().describe('工程根目录路径（含 emuera.config 与 ERB/ 的目录）'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ path: root }) => {
    return jsonResult(await profileProject(assertPathAllowed(root, allowedRoots)));
  },
);

server.registerTool(
  'read_erb_file',
  {
    title: '编码安全读取文件',
    description:
      '读取 ERB/CSV/日志等工程文件并统一转为 UTF-8 文本：自动探测 UTF-8 BOM / UTF-8 / CP932，剥离 BOM，CRLF 原样保留（行号保真）。返回文本 + encoding/bom/lossy/byteLength 元信息；lossy=true 表示有不可解码字节被替换符替代。',
    inputSchema: {
      path: z.string().describe('文件绝对路径'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ path: filePath }) => {
    const r = await readTextFile(assertPathAllowed(filePath, allowedRoots));
    return jsonResult({
      path: r.path,
      encoding: r.encoding,
      bom: r.bom,
      lossy: r.lossy,
      byteLength: r.byteLength,
      text: r.text,
    });
  },
);

server.registerTool(
  'lookup_reference',
  {
    title: '查 Emuera 指令手册',
    description: `按名字（如 SETCOLOR / PRINTFORMS / DT_ROW_ADD）查一条 Emuera 指令的完整说明：签名、参数、返回值、引入引擎、语义细节与示例。默认**先取上游在线版本**（只请求这一页，1 个请求），取不到才用内置快照（${REFERENCE_ENTRY_COUNT} 条，快照对应上游 ${REFERENCE_SOURCE_SHA.slice(0, 8)}）。两端不会混用：返回的 origin 说明本次用的是哪一份。写 EraBasic 前不确定某条指令的参数顺序或哪个引擎才有，就先查这里。`,
    inputSchema: {
      name: z.string().describe('指令名，大小写不敏感。可带括号，如 PRINTFORMS、DT_ROW_ADD'),
      online: z.boolean().optional().describe('false = 只用内置快照，完全不出网。默认 true（在线优先）'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  async ({ name, online }) => {
    const found = findReference(REFERENCE_ENTRIES, name);
    if (!found) {
      const suggestions = searchReference(REFERENCE_ENTRIES, name, 5)
        .flatMap((hit) => hit.entry.names.slice(0, 1));
      return jsonResult({
        error: `指令库里没有名为 ${name} 的条目`,
        didYouMean: suggestions,
        hint: '用 search_reference 按关键词检索，或省略 query 获取全部指令名',
      });
    }
    const resolved = await resolveReferenceOnline(
      found.entry,
      REFERENCE_SOURCE_SHA,
      referenceSourceOptions(online),
    );
    return jsonResult({
      name: found.name,
      pageId: resolved.entry.id,
      origin: resolved.origin,
      source: resolved.sourceNote,
      fallbackReason: resolved.fallbackReason,
      markdown: formatReferenceEntry(resolved.entry),
    });
  },
);

server.registerTool(
  'search_reference',
  {
    title: '检索 Emuera 指令手册',
    description:
      '在内置指令索引（名字 / 标题 / 正文关键词）里检索 Emuera 指令，返回命中条目与上下文片段，可离线使用。省略 query 时返回全部可检索的指令名（约 700 个）。检索结果只给概要，取完整说明用 lookup_reference。',
    inputSchema: {
      query: z.string().optional().describe('关键词，如 颜色、PRINT、背景音乐、存档'),
      limit: z.number().int().min(1).max(50).optional().describe('返回条数，默认 8'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ query, limit }) => {
    const library = {
      entries: REFERENCE_ENTRY_COUNT,
      snapshotSha: REFERENCE_SOURCE_SHA,
      fetchedAt: REFERENCE_FETCHED_AT,
      license: 'CC BY-NC 4.0 (emuera.sk.doc)',
    };
    if (!query || !query.trim()) {
      return jsonResult({ library, names: listReferenceNames(REFERENCE_ENTRIES) });
    }
    const hits = searchReference(REFERENCE_ENTRIES, query, limit ?? 8);
    return jsonResult({
      library,
      query,
      hits: hits.map((hit) => ({
        pageId: hit.entry.id,
        title: hit.entry.title,
        names: hit.entry.names,
        matchedIn: hit.field,
        snippet: hit.snippet,
      })),
      markdown: formatReferenceHits(hits, query),
    });
  },
);

server.registerTool(
  'lookup_knowledge',
  {
    title: '查内嵌知识条目',
    description: `按 id 取一条纪律/机制知识的完整内容：铁律、反模式（症状→根因→修法）与完整说明。内置 ${KNOWLEDGE_ENTRY_COUNT} 条（快照 ${KNOWLEDGE_SNAPSHOT_AT}）：解释器编码纪律、导入合并闸门 G1–G8、口上结构契约。涉及文件编码、更新合并、口上命名/分发的问题先查这里。`,
    inputSchema: {
      id: z
        .string()
        .describe(
          '条目 id：interpreter-encoding-discipline / update-merge-gates / kojo-structure-contracts',
        ),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ id }) => {
    const entry = findKnowledge(KNOWLEDGE_ENTRIES, id);
    if (!entry) {
      return jsonResult({
        error: `知识库没有 id 为 ${id} 的条目`,
        available: listKnowledgeSummaries(KNOWLEDGE_ENTRIES),
        hint: '用 search_knowledge 按关键词检索',
      });
    }
    return jsonResult({
      id: entry.id,
      title: entry.title,
      snapshotAt: entry.source.snapshotAt,
      markdown: formatKnowledgeEntry(entry),
    });
  },
);

server.registerTool(
  'search_knowledge',
  {
    title: '检索内嵌知识库',
    description:
      '在内嵌纪律/机制知识（铁律、反模式、正文）里关键词检索，返回命中条目与摘要，可离线。省略 query 时返回全部条目的目录。检索只给概要，取完整内容用 lookup_knowledge。',
    inputSchema: {
      query: z.string().optional().describe('关键词，如 BOM、乱码、RAND、口上、合并'),
      limit: z.number().int().min(1).max(20).optional().describe('返回条数，默认 5'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ query, limit }) => {
    const library = { entries: KNOWLEDGE_ENTRY_COUNT, snapshotAt: KNOWLEDGE_SNAPSHOT_AT };
    if (!query || !query.trim()) {
      return jsonResult({ library, catalog: listKnowledgeSummaries(KNOWLEDGE_ENTRIES) });
    }
    const hits = searchKnowledge(KNOWLEDGE_ENTRIES, query, limit ?? 5);
    return jsonResult({
      library,
      query,
      hits: hits.map((hit) => ({
        id: hit.entry.id,
        title: hit.entry.title,
        matchedIn: hit.field,
        summary: hit.entry.summary,
      })),
      markdown: formatKnowledgeHits(hits, query),
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
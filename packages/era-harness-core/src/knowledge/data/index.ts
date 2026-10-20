import type { KnowledgeEntry } from '../types.js';
import { encodingDisciplineEntry } from './encoding-discipline.js';
import { kojoStructureContractsEntry } from './kojo-structure-contracts.js';
import { mainFlowPipelineEntry } from './main-flow-pipeline.js';
import { projectStructureDisciplineEntry } from './project-structure-discipline.js';
import { updateMergeGatesEntry } from './update-merge-gates.js';

/**
 * 内嵌知识条目总表。
 *
 * 新增条目：在 data/ 建文件并 export 一个 KnowledgeEntry，在此数组登记，
 * 然后补 test/knowledge.test.ts 的计数期望。每条必须在 NOTICE-knowledge-sources.md 有来源行。
 */
export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  encodingDisciplineEntry,
  updateMergeGatesEntry,
  kojoStructureContractsEntry,
  projectStructureDisciplineEntry,
  mainFlowPipelineEntry,
];

/** 条目数（测试与 MCP 描述用） */
export const KNOWLEDGE_ENTRY_COUNT = KNOWLEDGE_ENTRIES.length;

/** 本批快照日期（取各条目 snapshotAt 的最大值；新增条目时同步） */
export const KNOWLEDGE_SNAPSHOT_AT = '2026-10-21';

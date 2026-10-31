/**
 * 专属知识库（game knowledge base）。
 *
 * 与 `knowledge/` 的区别：
 * - `knowledge/` 是**随包分发的纪律与机制知识**（跨工程稳定的铁律短句）；
 * - `gamekb/` 是**按工程生成的游戏本体语义索引**（函数/常量/表结构），
 *   内容不进 vsix，由 AI 在对话里读当前工作区生成，随游戏版本重建。
 *
 * 扩展侧只做三件事：列目录、开关、开一场建库/更新对话；以及把索引注入提示词。
 */

export {
  buildCreatePrompt,
  buildIncrementPrompt,
  buildUpdatePrompt,
  type KnowledgeBaseIncrementScope,
  type KnowledgeBasePromptContext,
} from './prompt.js';
export {
  buildKnowledgeBaseSection,
  MAX_INDEX_CHARS_PER_KB,
  MAX_TOTAL_CHARS,
  type KnowledgeBaseSectionItem,
} from './section.js';
export {
  buildIndexSkeleton,
  createKnowledgeBase,
  DEFAULT_INDEX_FILE,
  generateSlug,
  isIndexSkeleton,
  isValidSlug,
  KB_DIR_PARTS,
  KB_TRASH_DIR,
  knowledgeBaseDir,
  knowledgeRoot,
  listKnowledgeBases,
  readIndexText,
  readManifest,
  resolveBuildStatus,
  sanitizeName,
  setKnowledgeBaseEnabled,
  slugTimestamp,
  trashKnowledgeBase,
  updateKnowledgeBaseBuild,
  writeManifest,
  type CreateKnowledgeBaseOptions,
} from './store.js';
export type {
  GameKbBuildMode,
  GameKbBuildState,
  GameKbBuildStatus,
  GameKbEntry,
  GameKbFileRef,
  GameKbKind,
  GameKbManifest,
  GameKbTaskKind,
} from './types.js';

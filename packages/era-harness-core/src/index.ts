export { parseLog } from './log/parser.js';
export { classify, summarizeDiagnostics } from './log/taxonomy.js';
export type { DiagnosticSummary } from './log/taxonomy.js';
export { parseEngineInfo } from './log/engine.js';
export {
  REFERENCE_ENTRIES,
  REFERENCE_ENTRY_COUNT,
  REFERENCE_FETCHED_AT,
  REFERENCE_NAME_COUNT,
  REFERENCE_SOURCE_SHA,
  findAllReferences,
  findReference,
  formatReferenceEntry,
  formatReferenceHits,
  listReferenceNames,
  parseReferencePage,
  resolveReferenceOnline,
  searchReference,
} from './reference/index.js';
export type {
  EngineOrigin,
  OnlineMode,
  ReferenceEntry,
  ReferenceHit,
  ReferenceOrigin,
  ReferenceSignature,
  ReferenceSourceOptions,
  ResolvedReference,
} from './reference/index.js';
export {
  KNOWLEDGE_ENTRIES,
  KNOWLEDGE_ENTRY_COUNT,
  KNOWLEDGE_SNAPSHOT_AT,
  findKnowledge,
  formatKnowledgeEntry,
  formatKnowledgeHits,
  knowledgeRulesFor,
  listKnowledgeSummaries,
  searchKnowledge,
} from './knowledge/index.js';
export type {
  KnowledgeDomain,
  KnowledgeEntry,
  KnowledgeHit,
  KnowledgePitfall,
  KnowledgeRule,
  KnowledgeSource,
} from './knowledge/index.js';
export { profileProject } from './profile/profiler.js';
export type { ProfileOptions } from './profile/profiler.js';
export { configGet, configGetBoolean, configGetNumber, parseEmueraConfig } from './profile/config.js';
export { parseAlsEntries, parseCsvEntries } from './profile/csv.js';
export { parseDimFile } from './profile/dim.js';
export { detectEncoding, sampleErbEncodings, scanErbTree } from './profile/scan.js';
export { detectBom, decodeToUtf8, readTextFile } from './encoding/encoding.js';
export {
  applyEol,
  countBom,
  countEol,
  detectEol,
  formatWriteTarget,
  formatWriteVerification,
  inspectFileBytes,
  planSafeWrite,
  verifyWrite,
  writeTargetMatches,
} from './encoding/write.js';
export type {
  EolCounts,
  EolKind,
  FileEncodingFacts,
  NewFileHints,
  WriteEncoding,
  WriteEol,
  WriteIssue,
  WriteIssueCode,
  WritePlan,
  WriteTarget,
  WriteVerification,
} from './encoding/write.js';
export type {
  DiagnosticKind,
  EngineInfo,
  FatalError,
  LogSession,
  SessionInfo,
  Severity,
  VariantInfo,
} from './log/types.js';
export type {
  BomKind,
  DecodedText,
  ReadTextOptions,
  ReadTextResult,
} from './encoding/types.js';
export type {
  ConfigEntry,
  DimConstant,
  DimInfo,
  DirectoryInfo,
  EmueraConfig,
  EncodingSample,
  ProjectProfile,
  VariableFamily,
} from './profile/types.js';

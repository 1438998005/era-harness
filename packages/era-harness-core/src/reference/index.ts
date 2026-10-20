export {
  REFERENCE_ENTRIES,
  REFERENCE_ENTRY_COUNT,
  REFERENCE_FETCHED_AT,
  REFERENCE_NAME_COUNT,
  REFERENCE_SOURCE_SHA,
} from './data/index.js';
export {
  extractEngines,
  extractName,
  extractSummary,
  normalizeBody,
  parseReferencePage,
  parseSignatureTable,
  splitTableRow,
} from './parse.js';
export {
  DEFAULT_REFERENCE_BASE,
  fetchRemoteReference,
  referencePageUrl,
  resetOnlineFailureCache,
  resolveReferenceOnline,
} from './online.js';
export type {
  OnlineMode,
  ReferenceOrigin,
  ReferenceSourceOptions,
  ResolvedReference,
} from './online.js';
export {
  findAllReferences,
  findReference,
  formatReferenceEntry,
  formatReferenceHits,
  listReferenceNames,
  searchReference,
} from './query.js';
export type { EngineOrigin, ReferenceEntry, ReferenceHit, ReferenceSignature } from './types.js';

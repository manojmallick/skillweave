// MEMORY primitive (v1.3.0) — public surface.

export { MemoryStore, MemoryScopeError } from "./store.js";
export type { MemoryStoreOptions } from "./store.js";
export { isStale, DEFAULT_MAX_AGE_MS } from "./decay.js";
export { failurePatterns, recommend } from "./learn.js";
export type {
  FailurePattern,
  MemoryKind,
  MemoryRecord,
  MemoryStats,
  RecallOptions,
} from "./types.js";

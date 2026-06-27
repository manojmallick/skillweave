// MEMORY primitive (v1.3.0) — persistent, adaptive knowledge on `.context/`.
// Pipelines learn from past executions: record outcomes and failures, recall
// them across sessions (with decay), and surface failure patterns.

/** What a memory record captures. */
export type MemoryKind = "outcome" | "failure";

/**
 * One persisted memory record. Back-compatible with the records the
 * `memory-update` skill already writes (which lack `kind` — read as "outcome").
 */
export interface MemoryRecord {
  ts: string;
  pipeline: string;
  kind?: MemoryKind;
  /** Optional last-write-wins key for concurrent-write safety. */
  key?: string;
  skill?: string;
  judge_score?: number;
  passed?: boolean;
  /** Failure reason (for `kind: "failure"`). */
  reason?: string;
  data?: Record<string, unknown>;
}

/** A recurring failure, grouped by skill + reason. */
export interface FailurePattern {
  skill: string;
  reason: string;
  count: number;
}

/** Aggregate learning over one pipeline's history. */
export interface MemoryStats {
  pipeline: string;
  runs: number;
  avg_score: number | null;
  pass_rate: number | null;
  failures: number;
  patterns: FailurePattern[];
}

export interface RecallOptions {
  pipeline?: string;
  skill?: string;
  kind?: MemoryKind;
  /** Include records older than the staleness threshold (default false). */
  includeStale?: boolean;
}

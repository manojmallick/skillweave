// SkillWeave — core primitive types
// SKILL · PIPELINE · STATE · ASSERTION

import type { ExecutorSpec } from "./providers/types.js";

export type ExecutionClass = "deterministic" | "probabilistic" | "tool";

/** Confidence band a probabilistic output is routed into. */
export type ConfidenceBand = "high" | "review" | "low";

/** A single parsed unit of content (output of parse-input). */
export interface ContentBlock {
  id: string;
  type: "heading" | "paragraph" | "list_item" | "code";
  text: string;
}

/** Coverage assessment (output of validate-coverage). */
export interface Coverage {
  score: number; // 0.0 – 1.0
  sufficient: boolean;
  reasons: string[];
}

/** A content block selected as important, with its confidence (extract-highlights). */
export interface Highlight {
  block_id: string;
  text: string;
  confidence: number; // 0.0 – 1.0
}

/** Groundedness verdict (output of boundary-judge). */
export interface JudgeVerdict {
  score: number; // 0.0 – 1.0
  passed: boolean;
  confidence: number; // 0.0 – 1.0
  failure_reason: string | null;
  source: "anthropic" | "gemini" | "openai" | "ollama" | "heuristic";
}

/** Memory write summary (output of memory-update). */
export interface MemorySummary {
  records_total: number;
  avg_score_prior: number | null;
  avg_score_now: number;
  improved: boolean | null;
  path: string;
}

/**
 * STATE — the typed shared object threaded between skills.
 * Fields are written only by their owning skill. `_meta` is framework-managed.
 */
export interface State {
  raw_input?: string;
  content_blocks?: ContentBlock[];
  coverage?: Coverage;
  highlights?: Highlight[];
  judge?: JudgeVerdict;
  memory?: MemorySummary;
  _meta: {
    pipeline: string;
    run_id: string;
    inject?: "none" | "coverage" | "lowconf" | "hallucination" | "persistent";
    checkpoints: string[];
  };
}

/** Result of one assertion run by base-assert. */
export interface AssertionResult {
  statement: string;
  ok: boolean;
  detail?: string;
}

/** A semantic assertion declared by a skill and run by base-assert. */
export interface Assertion {
  statement: string;
  check: (state: State) => AssertionResult;
}

/** A worked input/output example a probabilistic skill is anchored against. */
export interface GoldenAnchor {
  input: unknown;
  output: unknown;
}

/** Negative context handed to a skill when it is re-invoked after a failure. */
export interface RetryContext {
  /** 1-based number of the attempt that just failed. */
  attempt: number;
  /** Summary of the output that failed. */
  previous_summary: string;
  /** Why the previous attempt failed (assertion / low confidence / judge). */
  failure_reason: string;
}

/** Outcome a skill hands back to the orchestrator. */
export interface SkillResult {
  /** Partial STATE this skill is permitted to write. */
  writes: Partial<State>;
  /** One-line human summary for the execution report. */
  summary: string;
  /** USD cost of this skill execution. */
  cost: number;
  /** Confidence for probabilistic skills (0.0 – 1.0) — drives confidence routing. */
  confidence?: number;
  /** Output the orchestrator should auto-judge for groundedness (probabilistic skills). */
  judge_blocks?: ContentBlock[];
}

/** SKILL — a single focused unit of work with a declared contract. */
export interface Skill {
  name: string;
  execution_class: ExecutionClass;
  does: string;
  does_not: string;
  /** STATE fields this skill is allowed to read. */
  state_read: (keyof State)[];
  /** STATE fields this skill is allowed to write. */
  state_write: (keyof State)[];
  /** Semantic assertions run by base-assert after this skill. */
  assertions: Assertion[];
  /** Judge pass threshold for this skill's probabilistic boundary. */
  confidence_threshold?: number;
  /** Retry budget for probabilistic skills (default 2); deterministic skills get 0. */
  retries?: number;
  /** Worked examples fed to the judge at this skill's boundary. */
  golden_anchors?: GoldenAnchor[];
  /** Executes the skill. `retry` carries negative context on a re-invocation. */
  run: (state: State, retry?: RetryContext) => Promise<SkillResult>;
}

/** PIPELINE — an ordered list of skills with shared state. */
export interface Pipeline {
  name: string;
  version: string;
  domain: string;
  steps: Skill[];
  /** Optional provider executor (primary + fallback) for this pipeline. */
  executor?: ExecutorSpec;
}

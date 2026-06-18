// SkillWeave v0.1.0 — core primitive types
// SKILL · PIPELINE · STATE · ASSERTION (the 4 prototype primitives)

export type ExecutionClass = "deterministic" | "probabilistic" | "tool";

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

/** Groundedness verdict (output of boundary-judge). */
export interface JudgeVerdict {
  score: number; // 0.0 – 1.0
  passed: boolean;
  confidence: number; // 0.0 – 1.0
  failure_reason: string | null;
  source: "anthropic" | "gemini" | "openai" | "heuristic";
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
  judge?: JudgeVerdict;
  memory?: MemorySummary;
  _meta: {
    pipeline: string;
    run_id: string;
    inject?: "none" | "hallucination" | "coverage";
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

/** Outcome a skill hands back to the orchestrator. */
export interface SkillResult {
  /** Partial STATE this skill is permitted to write. */
  writes: Partial<State>;
  /** One-line human summary for the execution report. */
  summary: string;
  /** USD cost of this skill execution. */
  cost: number;
  /** Confidence for probabilistic skills (0.0 – 1.0). */
  confidence?: number;
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
  confidence_threshold?: number;
  run: (state: State) => Promise<SkillResult>;
}

/** PIPELINE — an ordered list of skills with shared state. */
export interface Pipeline {
  name: string;
  version: string;
  domain: string;
  steps: Skill[];
}

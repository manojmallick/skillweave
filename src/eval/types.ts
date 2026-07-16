// Behavioral eval harness (v2.3.0) — run a pipeline over task cases × trials and
// grade the outcomes. Complements gradeSkill (which grades a skill's *contract*)
// by grading actual *behaviour*: a per-case pass-rate against a CI threshold.

import type { Pipeline, State } from "../types.js";

/** A finished run handed to graders: the orchestrator outcome + final STATE. */
export interface RunSnapshot {
  status: "success" | "halted";
  state: State;
  haltedAt?: string;
}

/** One grader's verdict on a run. */
export interface GraderResult {
  score: number; // 0..1
  passed: boolean;
  detail?: string;
}

/** A grader scores a single run. */
export type Grader = (snap: RunSnapshot) => GraderResult;

/** A grader with its weight in the trial's combined score (default 1). */
export interface WeightedGrader {
  grader: Grader;
  weight?: number;
  label?: string;
}

/** One task case: an input and the graders its runs must satisfy. */
export interface EvalCase {
  name: string;
  input: string;
  graders: WeightedGrader[];
}

/** An eval: a pipeline evaluated over cases, each run `trials` times. */
export interface EvalSpec {
  name: string;
  pipeline: Pipeline;
  cases: EvalCase[];
  /** Runs per case (default 5). */
  trials?: number;
  /** Minimum per-case pass-rate for the case (and eval) to pass (default 1.0). */
  threshold?: number;
}

/** Aggregate result for one case. */
export interface CaseReport {
  name: string;
  trials: number;
  passed: number; // trials that passed
  passRate: number; // passed / trials
  avgScore: number; // mean weighted score across trials
  ok: boolean; // passRate >= threshold
}

/** Aggregate result for the whole eval. */
export interface EvalReport {
  name: string;
  trials: number;
  threshold: number;
  cases: CaseReport[];
  passRate: number; // mean case pass-rate
  ok: boolean; // every case ok
}

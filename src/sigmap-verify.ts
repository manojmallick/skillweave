// sigmap-verify — the programmatic entry point that lets SigMap embed SkillWeave
// as its internal execution architecture. Runs the verify pipeline
// (load-context → parse-input → validate-coverage → extract-highlights →
// memory-update) through the orchestrator and returns a structured VerifyResult,
// with no shell spawn and no CLI.

import { SigMapObserveAdapter } from "./adapters/index.js";
import type { Grade } from "./adapters/types.js";
import { judgeExecutorLabel } from "./judge.js";
import { runPipeline } from "./orchestrator.js";
import type { SecurityPolicy } from "./security/index.js";
import { extractHighlights } from "./skills/extract-highlights.js";
import { loadContext } from "./skills/load-context.js";
import { memoryUpdate } from "./skills/memory-update.js";
import { parseInput } from "./skills/parse-input.js";
import { validateCoverage } from "./skills/validate-coverage.js";
import type { Pipeline, State } from "./types.js";
import { VERSION } from "./version.js";

/** Options for an in-process verify run. */
export interface VerifyOptions {
  /** Input to verify. When omitted, `load-context` sources it from SigMap's CONTEXT. */
  input?: string;
  /** Suppress the orchestrator's execution summary. */
  quiet?: boolean;
  /** Override the security policy enforced per skill. */
  policy?: SecurityPolicy;
}

/** Structured outcome SigMap consumes from an embedded verify run. */
export interface VerifyResult {
  status: "success" | "halted";
  /** True when the chain completed and the boundary judge passed. */
  grounded: boolean;
  judge_score: number | null;
  coverage: number | null;
  highlights: number;
  halted_at?: string;
  health: { grade: Grade; score: number };
  run_id: string;
}

/** The verify pipeline as a runnable Pipeline (also mirrored in YAML). */
export function sigmapVerifyPipeline(): Pipeline {
  return {
    name: "sigmap-verify",
    version: VERSION,
    domain: "sigmap",
    steps: [loadContext, parseInput, validateCoverage, extractHighlights, memoryUpdate],
  };
}

/** Run the verify pipeline in-process and return a structured result. */
export async function runSigMapVerify(opts: VerifyOptions = {}): Promise<VerifyResult> {
  const pipeline = sigmapVerifyPipeline();
  const runId = `verify-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const state: State = {
    raw_input: opts.input,
    _meta: { pipeline: pipeline.name, run_id: runId, inject: "none", checkpoints: [] },
  };

  const observe = new SigMapObserveAdapter();
  const outcome = await runPipeline(pipeline, state, judgeExecutorLabel(), {
    quiet: opts.quiet,
    observe,
    policy: opts.policy,
  });

  const health = observe.health();
  return {
    status: outcome.status,
    grounded: outcome.status === "success" && (state.judge?.passed ?? false),
    judge_score: state.judge?.score ?? null,
    coverage: state.coverage?.score ?? null,
    highlights: state.highlights?.length ?? 0,
    ...(outcome.haltedAt ? { halted_at: outcome.haltedAt } : {}),
    health: { grade: health.grade, score: health.score },
    run_id: runId,
  };
}

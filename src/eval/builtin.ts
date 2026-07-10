// A bundled eval over the reference grounding pipeline, for `skillweave eval`.
// One grounded case that must complete + pass the judge, and a too-thin case
// that must correctly halt at validate-coverage.

import { getSkill } from "../registry.js";
import type { Pipeline } from "../types.js";
import { expectGrounded, expectHaltedAt, expectStatus, minJudgeScore } from "./graders.js";
import type { EvalSpec } from "./types.js";

const GROUNDED = `# Quarterly Engineering Update

The platform team shipped the new retrieval pipeline this quarter. Latency dropped by roughly
forty percent after moving ranking onto the graph index.

## Highlights
- Retrieval hit@5 improved from 14% to 76%
- Token usage per request fell by 39%`;

const THIN = "# Note\nok";

/** The bundled grounding eval used by `skillweave eval`. */
export function builtinEval(opts: { trials?: number; threshold?: number } = {}): EvalSpec {
  const pipeline: Pipeline = {
    name: "grounding-eval",
    version: "1.0.0",
    domain: "documents",
    steps: [getSkill("parse-input")!, getSkill("validate-coverage")!, getSkill("extract-highlights")!],
  };
  return {
    name: "grounding-eval",
    pipeline,
    ...(opts.trials != null ? { trials: opts.trials } : {}),
    ...(opts.threshold != null ? { threshold: opts.threshold } : {}),
    cases: [
      {
        name: "grounded-report",
        input: GROUNDED,
        graders: [
          { grader: expectStatus("success"), label: "completes" },
          { grader: expectGrounded(), label: "judge passes" },
          { grader: minJudgeScore(0.8), label: "judge >= 0.8" },
        ],
      },
      {
        name: "too-thin (must halt)",
        input: THIN,
        graders: [{ grader: expectHaltedAt("validate-coverage"), label: "halts on thin input" }],
      },
    ],
  };
}

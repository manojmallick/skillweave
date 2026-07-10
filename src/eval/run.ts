// runEval — run a pipeline over each case `trials` times, grade every run, and
// aggregate into per-case pass-rates + an overall CI verdict. Local-first: uses
// the same orchestrator as production, so what you eval is what you run.

import { runPipeline } from "../orchestrator.js";
import type { State } from "../types.js";
import type { CaseReport, EvalCase, EvalReport, EvalSpec, RunSnapshot } from "./types.js";

function makeState(pipeline: string, input: string, trial: number): State {
  return {
    raw_input: input,
    _meta: { pipeline, run_id: `eval-${pipeline}-${trial}`, inject: "none", checkpoints: [] },
  };
}

/** Grade one run: weighted mean score, and passed iff every grader passed. */
function grade(snap: RunSnapshot, testCase: EvalCase): { score: number; passed: boolean } {
  let weighted = 0;
  let totalWeight = 0;
  let allPassed = true;
  for (const g of testCase.graders) {
    const weight = g.weight ?? 1;
    const r = g.grader(snap);
    weighted += r.score * weight;
    totalWeight += weight;
    if (!r.passed) allPassed = false;
  }
  return { score: totalWeight ? Number((weighted / totalWeight).toFixed(4)) : 0, passed: allPassed };
}

/** Run the full eval and return the aggregate report. */
export async function runEval(spec: EvalSpec): Promise<EvalReport> {
  const trials = spec.trials ?? 5;
  const threshold = spec.threshold ?? 1;
  const cases: CaseReport[] = [];

  for (const testCase of spec.cases) {
    let passed = 0;
    let scoreSum = 0;
    for (let t = 0; t < trials; t++) {
      const state = makeState(spec.pipeline.name, testCase.input, t);
      const outcome = await runPipeline(spec.pipeline, state, "eval", { quiet: true });
      const snap: RunSnapshot = {
        status: outcome.status,
        state: outcome.state,
        ...(outcome.haltedAt ? { haltedAt: outcome.haltedAt } : {}),
      };
      const g = grade(snap, testCase);
      scoreSum += g.score;
      if (g.passed) passed++;
    }
    const passRate = Number((passed / trials).toFixed(4));
    cases.push({
      name: testCase.name,
      trials,
      passed,
      passRate,
      avgScore: Number((scoreSum / trials).toFixed(4)),
      ok: passRate >= threshold,
    });
  }

  return {
    name: spec.name,
    trials,
    threshold,
    cases,
    passRate: cases.length ? Number((cases.reduce((a, c) => a + c.passRate, 0) / cases.length).toFixed(4)) : 0,
    ok: cases.every((c) => c.ok),
  };
}

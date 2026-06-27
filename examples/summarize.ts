// summarize — a PROBABILISTIC skill that exercises the reliability layer.
// Watch the orchestrator confidence-route, auto-judge, and retry-with-negative-
// context: a low-confidence first attempt recovers on attempt 2.
//
// As a published consumer: import { ... } from "skillweave";
process.env.JUDGE_PROVIDER ??= "heuristic"; // run fully offline

import { gradeSkill, getSkill, runPipeline } from "../src/index.js";
import { summarize } from "../src/skills/summarize.js";
import type { Pipeline, State } from "../src/index.js";

console.log(`gradeSkill(summarize): ${gradeSkill(summarize).points}/9 → ${gradeSkill(summarize).tier}\n`);

const pipeline: Pipeline = {
  name: "summary",
  version: "1.0.0",
  domain: "documents",
  steps: [getSkill("parse-input")!, summarize],
};

// Two strong (figure-bearing) sentences + one weak one. The first attempt picks
// all three → confidence dips into the low band → the orchestrator retries →
// the second attempt takes the two strong ones → recovers.
const DOC = `The retrieval pipeline cut latency by forty percent across 21 repos this quarter.

Token usage per request dropped to 39% of the previous baseline overall.

Nice work.`;

const state: State = {
  raw_input: DOC,
  _meta: { pipeline: "summary", run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
};

// quiet: false → prints the execution summary so you can see the ↻ retry + recovery.
const outcome = await runPipeline(pipeline, state, "heuristic (offline)");

console.log("\n— result —");
console.log("status :", outcome.status);
console.log("judge  :", state.judge?.score);
console.log("summary:", state.summary?.sentences);

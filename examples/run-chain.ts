// run-chain — drive the document-grounding chain with the orchestrator directly.
// Shows the reliability layer: confidence routing, auto-judge, retry-with-negative-context.
//
// As a published consumer: import { ... } from "skillweave";
process.env.JUDGE_PROVIDER ??= "heuristic"; // run fully offline

import { getSkill, runPipeline } from "../src/index.js";
import type { Pipeline, State } from "../src/index.js";

const DOC = `# Quarterly Engineering Update

The platform team shipped the new retrieval pipeline this quarter. Latency dropped by
roughly forty percent after we moved ranking onto the graph index.

## Highlights
- Retrieval hit@5 improved from 14% to 76%
- Token usage per request fell by 39%`;

// Build a pipeline from the registered skills.
const pipeline: Pipeline = {
  name: "demo-chain",
  version: "1.0.0",
  domain: "documents",
  steps: ["parse-input", "validate-coverage", "extract-highlights", "memory-update"].map(
    (name) => getSkill(name)!,
  ),
};

const state: State = {
  raw_input: DOC,
  _meta: { pipeline: pipeline.name, run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
};

const outcome = await runPipeline(pipeline, state, "heuristic (offline)");

console.log("\n— result —");
console.log("status     :", outcome.status);
console.log("coverage   :", state.coverage?.score);
console.log("highlights :", state.highlights?.length);
console.log("judge score:", state.judge?.score);

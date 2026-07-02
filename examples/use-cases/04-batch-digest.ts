// USE CASE 4 — Fan out over a batch of documents, then reduce to one digest.
//
// THE TASK: you have N changelog entries from the week. Summarise each one
// independently (in parallel), then fold the per-item summaries into a single
// release digest. Also: model the build as a dependency DAG.
//
// WHY A PLAIN SKILL ISN'T ENOUGH:
//   One big "summarise all of these" prompt forces every document into a single
//   context window — slower, costlier, and items bleed into each other. You get
//   no parallelism, no per-item isolation, and no reusable composition: the
//   "loop over items and combine" logic is baked into the prompt instead of
//   being a primitive you can reuse for the next task.
//
// WHAT SKILLWEAVE ADDS — COMPOSE primitives as plain async combinators:
//   • mapPattern    — run a skill over every item (here: real summarize runs)
//   • reducePattern — fold the per-item results into one
//   • parallel      — run independent stages concurrently
//   • dagLayers     — resolve a dependency graph into parallelizable layers
//
// Run:  npx tsx examples/use-cases/04-batch-digest.ts
process.env.JUDGE_PROVIDER ??= "heuristic";

import { dagLayers, getSkill, mapPattern, parallel, reducePattern, runPipeline } from "../../src/index.js";
import { summarize } from "../../src/skills/summarize.js";
import type { Pipeline, State } from "../../src/index.js";

const ENTRIES = [
  "Retrieval latency dropped 40% after moving ranking onto the graph index. hit@5 rose from 14% to 76%.",
  "The new billing service handled 2.1M invoices with zero data loss during the cutover.",
  "Onboarding funnel completion improved to 63% after the 3-step rewrite. Thanks team.",
];

// Run the real parse → summarize pipeline over ONE entry, return its summary.
async function summariseOne(text: string): Promise<string> {
  const pipeline: Pipeline = {
    name: "digest-item",
    version: "1.0.0",
    domain: "documents",
    steps: [getSkill("parse-input")!, summarize],
  };
  const state: State = {
    raw_input: text,
    _meta: { pipeline: "digest-item", run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
  };
  await runPipeline(pipeline, state, "heuristic (offline)", { quiet: true });
  return state.summary?.sentences[0] ?? text;
}

// mapPattern: summarise every entry (these are independent skill runs).
const perItem = await mapPattern(ENTRIES, summariseOne);
console.log("per-item summaries:");
perItem.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

// reducePattern: fold them into one digest.
const digest = await reducePattern(perItem, async (acc, s) => `${acc}\n- ${s}`, "## Release digest");
console.log("\n" + digest);

// parallel: independent post-processing stages, run concurrently (barrier).
const [wordCount, itemCount] = await parallel(digest, [
  async (d: string) => d.split(/\s+/).length,
  async (d: string) => d.split("\n").filter((l) => l.startsWith("- ")).length,
]);
console.log(`\nstats (computed in parallel): ${itemCount} items, ${wordCount} words`);

// dagLayers: the same digest job expressed as a dependency graph → build order.
const layers = dagLayers([
  { id: "collect-entries" },
  { id: "summarise", depends_on: ["collect-entries"] },
  { id: "stats", depends_on: ["summarise"] },
  { id: "render-digest", depends_on: ["summarise", "stats"] },
]);
console.log("\nbuild layers (each layer runs in parallel):", JSON.stringify(layers));

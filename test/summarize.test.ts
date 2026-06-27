// summarize (probabilistic) — extractive summary that exercises the reliability
// layer (confidence routing · auto-judge · retry-with-negative-context).
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeSkill, getSkill, runPipeline } from "../src/index.js";
import { summarize } from "../src/skills/summarize.js";
import type { ContentBlock, Pipeline, State } from "../src/types.js";

function stateWith(texts: string[]): State {
  const content_blocks: ContentBlock[] = texts.map((text, i) => ({ id: `b${i}`, type: "paragraph", text }));
  return { content_blocks, _meta: { pipeline: "t", run_id: "t", inject: "none", checkpoints: [] } };
}

const STRONG = "Revenue grew 40% to $2M across 21 teams this quarter overall.";
const WEAK = "Nice work."; // short, no digit → low salience

test("summarize: grounded picks → high confidence + verbatim judge_blocks", async () => {
  const r = await summarize.run(stateWith([STRONG, "Latency fell 39% after the graph index migration overall."]));
  assert.ok((r.confidence ?? 0) >= 0.85, `confidence ${r.confidence}`);
  assert.ok((r.writes.summary?.sentences.length ?? 0) >= 1);
  // judge_blocks must be verbatim from the input (so the auto-judge sees them grounded)
  assert.ok(r.judge_blocks?.every((b) => [STRONG].includes(b.text) || b.text.includes("Latency")));
});

test("summarize: a weak pick drops confidence into the low band (triggers retry)", async () => {
  const first = await summarize.run(stateWith([STRONG, "Token usage dropped to 39% overall this period.", WEAK]));
  assert.ok((first.confidence ?? 1) < 0.65, `attempt-1 confidence ${first.confidence}`);
  // On a retry it takes fewer, stronger sentences → recovers above threshold.
  const retried = await summarize.run(
    stateWith([STRONG, "Token usage dropped to 39% overall this period.", WEAK]),
    { attempt: 1, previous_summary: "loose", failure_reason: "low confidence" },
  );
  assert.ok((retried.confidence ?? 0) >= 0.85, `retry confidence ${retried.confidence}`);
  assert.ok((retried.writes.summary?.sentences.length ?? 0) < (first.writes.summary?.sentences.length ?? 0));
});

test("summarize: low-confidence input recovers through the orchestrator", async () => {
  const pipeline: Pipeline = {
    name: "sum", version: "1", domain: "documents",
    steps: [getSkill("parse-input")!, summarize],
  };
  const DOC = `${STRONG}\n\nLatency fell 39% after the migration overall.\n\n${WEAK}`;
  const state: State = { raw_input: DOC, _meta: { pipeline: "sum", run_id: "s", inject: "none", checkpoints: [] } };
  const outcome = await runPipeline(pipeline, state, "offline", { quiet: true });
  assert.equal(outcome.status, "success"); // retried and recovered
  assert.ok((state.summary?.sentences.length ?? 0) > 0);
});

test("summarize: grades 9/9 → verified", () => {
  const report = gradeSkill(summarize);
  assert.equal(report.points, 9);
  assert.equal(report.tier, "verified");
});

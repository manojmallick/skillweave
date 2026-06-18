import assert from "node:assert/strict";
import { test } from "node:test";
import { extractHighlights } from "../src/skills/extract-highlights.js";
import { memoryUpdate } from "../src/skills/memory-update.js";
import { parseInput } from "../src/skills/parse-input.js";
import { validateCoverage } from "../src/skills/validate-coverage.js";
import type { State } from "../src/types.js";

function stateWith(inject: State["_meta"]["inject"]): State {
  return {
    raw_input: "doc",
    content_blocks: [
      { id: "h1", type: "heading", text: "Title" },
      { id: "p1", type: "paragraph", text: "plain paragraph with no metrics" },
    ],
    _meta: { pipeline: "t", run_id: "t-eh", inject, checkpoints: [] },
  };
}

test("probabilistic skill declares a golden anchor and a retry budget", () => {
  assert.equal(extractHighlights.execution_class, "probabilistic");
  assert.equal(extractHighlights.retries, 2);
  assert.ok((extractHighlights.golden_anchors?.length ?? 0) >= 1, "golden anchor declared");
});

test("deterministic skills declare no retry budget (zero overhead)", () => {
  for (const skill of [parseInput, validateCoverage, memoryUpdate]) {
    assert.equal(skill.execution_class, "deterministic");
    assert.equal(skill.retries, undefined);
  }
});

test("lowconf: a retry drops the sub-threshold pick — output improves", async () => {
  const state = stateWith("lowconf");

  const first = await extractHighlights.run(state); // no retry context
  const retried = await extractHighlights.run(state, {
    attempt: 1,
    previous_summary: first.summary,
    failure_reason: "confidence 0.60 below 0.65",
  });

  assert.equal(first.confidence, 0.6, "first attempt includes the borderline pick");
  assert.equal(retried.confidence, 0.9, "retry confidence is back in the high band");
  assert.ok(
    (retried.writes.highlights?.length ?? 0) < (first.writes.highlights?.length ?? 0),
    "retry drops the speculative highlight",
  );
});

test("hallucination: a retry drops the fabricated highlight", async () => {
  const state = stateWith("hallucination");

  const first = await extractHighlights.run(state);
  const retried = await extractHighlights.run(state, {
    attempt: 1,
    previous_summary: first.summary,
    failure_reason: "judge — ungrounded",
  });

  assert.ok(
    first.writes.highlights?.some((h) => h.block_id === "h_fabricated"),
    "first attempt fabricates a highlight",
  );
  assert.ok(
    !retried.writes.highlights?.some((h) => h.block_id === "h_fabricated"),
    "retry omits the fabricated highlight",
  );
});

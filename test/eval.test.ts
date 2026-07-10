// Behavioral eval harness (v2.3.0) — grader factories + runEval + CLI.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { cli } from "../src/cli.js";
import {
  builtinEval,
  expectGrounded,
  expectHaltedAt,
  expectState,
  expectStatus,
  minJudgeScore,
  runEval,
} from "../src/index.js";
import { getSkill } from "../src/registry.js";
import type { RunSnapshot, State } from "../src/index.js";

function snap(status: "success" | "halted", state: Partial<State> = {}, haltedAt?: string): RunSnapshot {
  return {
    status,
    state: { _meta: { pipeline: "t", run_id: "t", inject: "none", checkpoints: [] }, ...state },
    ...(haltedAt ? { haltedAt } : {}),
  };
}

// ── graders ──────────────────────────────────────────────────────────────────
test("expectStatus / expectHaltedAt", () => {
  assert.equal(expectStatus("success")(snap("success")).passed, true);
  assert.equal(expectStatus("success")(snap("halted")).passed, false);
  assert.equal(expectHaltedAt("validate-coverage")(snap("halted", {}, "validate-coverage")).passed, true);
  assert.equal(expectHaltedAt("validate-coverage")(snap("halted", {}, "parse-input")).passed, false);
});

test("expectGrounded / minJudgeScore read the judge verdict", () => {
  const judged = snap("success", { judge: { score: 0.9, passed: true, confidence: 1, failure_reason: null, source: "heuristic" } });
  assert.deepEqual(
    { p: expectGrounded()(judged).passed, s: expectGrounded()(judged).score },
    { p: true, s: 0.9 },
  );
  assert.equal(minJudgeScore(0.8)(judged).passed, true);
  assert.equal(minJudgeScore(0.95)(judged).passed, false);
});

test("expectState runs a custom predicate", () => {
  const g = expectState("has 2 blocks", (s) => (s.content_blocks?.length ?? 0) >= 2);
  assert.equal(g(snap("success", { content_blocks: [{ id: "a", type: "paragraph", text: "x" }, { id: "b", type: "paragraph", text: "y" }] })).passed, true);
  assert.equal(g(snap("success", { content_blocks: [] })).passed, false);
});

// ── runEval ──────────────────────────────────────────────────────────────────
const groundingPipeline = () => ({
  name: "g", version: "1", domain: "documents",
  steps: [getSkill("parse-input")!, getSkill("validate-coverage")!, getSkill("extract-highlights")!],
});

test("runEval: the built-in eval passes (both cases, pass-rate 1)", async () => {
  const report = await runEval(builtinEval({ trials: 2 }));
  assert.equal(report.ok, true);
  assert.equal(report.trials, 2);
  assert.ok(report.cases.every((c) => c.passRate === 1));
});

test("runEval: a failing grader drops the case (and the eval) below threshold", async () => {
  const report = await runEval({
    name: "fail",
    pipeline: groundingPipeline(),
    trials: 3,
    cases: [
      { name: "impossible", input: "# Q\n\nThe team shipped the pipeline, cutting latency forty percent across 21 repos.", graders: [{ grader: minJudgeScore(1.01) }] },
    ],
  });
  assert.equal(report.ok, false);
  assert.equal(report.cases[0]?.passRate, 0);
  assert.equal(report.cases[0]?.trials, 3);
});

test("runEval: weighted score is the weighted mean of grader scores", async () => {
  // one grader always 1.0 (weight 3), one always 0.0 (weight 1) → weighted mean 0.75
  const report = await runEval({
    name: "weighted",
    pipeline: groundingPipeline(),
    trials: 1,
    threshold: 0, // don't fail on the 0-grader; we only check the score
    cases: [
      {
        name: "w",
        input: "# Q\n\nThe team shipped the pipeline this quarter, cutting latency forty percent across 21 repos.",
        graders: [
          { grader: () => ({ score: 1, passed: true }), weight: 3 },
          { grader: () => ({ score: 0, passed: true }), weight: 1 },
        ],
      },
    ],
  });
  assert.equal(report.cases[0]?.avgScore, 0.75);
});

// ── CLI ──────────────────────────────────────────────────────────────────────
test("cli eval: exits 0 when the bundled eval passes", async () => {
  assert.equal(await cli(["eval", "--trials", "2"]), 0);
});

// Orchestrator reliability layer, driven with mock skills.
// JUDGE_PROVIDER=heuristic keeps the auto-judge offline and deterministic.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { runPipeline } from "../src/orchestrator.js";
import type { Pipeline, RetryContext, Skill, State } from "../src/types.js";

let runCounter = 0;
function newState(raw = "alpha beta gamma metrics retrieval report"): State {
  return {
    raw_input: raw,
    _meta: { pipeline: "test", run_id: `t-${++runCounter}`, inject: "none", checkpoints: [] },
  };
}

function pipe(skill: Skill): Pipeline {
  return { name: "test", version: "0", domain: "test", steps: [skill] };
}

test("retry with negative context improves a low-confidence probabilistic output", async () => {
  const calls: (RetryContext | undefined)[] = [];
  const skill: Skill = {
    name: "mock-prob",
    execution_class: "probabilistic",
    does: "",
    does_not: "",
    state_read: [],
    state_write: [],
    assertions: [],
    confidence_threshold: 0.8,
    retries: 2,
    async run(_state, retry) {
      calls.push(retry);
      const confidence = retry === undefined ? 0.5 : 0.95; // recovers once given negative context
      return { writes: {}, summary: `conf ${confidence}`, cost: 0, confidence };
    },
  };

  const outcome = await runPipeline(pipe(skill), newState(), "heuristic");

  assert.equal(outcome.status, "success");
  assert.equal(calls.length, 2, "skill re-invoked exactly once");
  assert.equal(calls[0], undefined, "first attempt carries no retry context");
  assert.ok(calls[1], "second attempt carries retry context");
  assert.match(calls[1]!.failure_reason, /confidence/);
});

test("deterministic skill has zero retry overhead — runs once and halts", async () => {
  const calls: (RetryContext | undefined)[] = [];
  const skill: Skill = {
    name: "mock-det",
    execution_class: "deterministic",
    does: "",
    does_not: "",
    state_read: [],
    state_write: [],
    retries: 2, // declared, but deterministic skills must ignore the retry budget
    assertions: [
      { statement: "always fails", check: () => ({ statement: "always fails", ok: false }) },
    ],
    async run(_state, retry) {
      calls.push(retry);
      return { writes: {}, summary: "x", cost: 0 };
    },
  };

  const outcome = await runPipeline(pipe(skill), newState(), "heuristic");

  assert.equal(outcome.status, "halted");
  assert.equal(outcome.haltedAt, "mock-det");
  assert.equal(calls.length, 1, "deterministic skill is never retried");
});

test("auto-judge catches an ungrounded probabilistic output and halts when unrecoverable", async () => {
  const skill: Skill = {
    name: "mock-ungrounded",
    execution_class: "probabilistic",
    does: "",
    does_not: "",
    state_read: [],
    state_write: [],
    assertions: [],
    confidence_threshold: 0.8,
    retries: 0,
    async run() {
      return {
        writes: {},
        summary: "fabricated",
        cost: 0,
        confidence: 0.95, // high confidence — only the judge can catch this
        judge_blocks: [{ id: "x", type: "paragraph", text: "zzz qqq fabricated nonexistent" }],
      };
    },
  };

  const outcome = await runPipeline(pipe(skill), newState(), "heuristic");

  assert.equal(outcome.status, "halted");
  assert.equal(outcome.state.judge?.passed, false);
});

test("auto-judge failure triggers retry-with-negative-context and recovers", async () => {
  const calls: (RetryContext | undefined)[] = [];
  const skill: Skill = {
    name: "mock-judge-recover",
    execution_class: "probabilistic",
    does: "",
    does_not: "",
    state_read: [],
    state_write: [],
    assertions: [],
    confidence_threshold: 0.8,
    retries: 2,
    async run(_state, retry) {
      calls.push(retry);
      const text = retry === undefined ? "zzz qqq fabricated" : "alpha beta gamma metrics";
      return {
        writes: {},
        summary: "highlights",
        cost: 0,
        confidence: 0.9,
        judge_blocks: [{ id: "x", type: "paragraph", text }],
      };
    },
  };

  const outcome = await runPipeline(pipe(skill), newState(), "heuristic");

  assert.equal(outcome.status, "success");
  assert.equal(calls.length, 2);
  assert.match(calls[1]!.failure_reason, /judge/);
  assert.equal(outcome.state.judge?.passed, true);
});

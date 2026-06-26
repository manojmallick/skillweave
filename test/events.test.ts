// EVENT primitive (v1.2.0) — bus fan-out, loader parsing, orchestrator emission.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { EventBus } from "../src/index.js";
import { loadPipeline } from "../src/pipeline-loader.js";
import { runPipeline } from "../src/orchestrator.js";
import type { Pipeline, Skill, State } from "../src/types.js";

let n = 0;
function newState(): State {
  return {
    raw_input: "alpha beta gamma",
    _meta: { pipeline: "ev", run_id: `ev-${++n}`, inject: "none", checkpoints: [] },
  };
}
function pipe(skill: Skill): Pipeline {
  return { name: "ev", version: "0", domain: "test", steps: [skill] };
}
function okSkill(): Skill {
  return {
    name: "ok", execution_class: "deterministic", does: "", does_not: "",
    state_read: [], state_write: [], capabilities: [], assertions: [],
    async run() { return { writes: {}, summary: "ok", cost: 0 }; },
  };
}

// 1. EventBus fan-out / routing / continue.
test("EventBus: fans out to every matching subscription and route", () => {
  const bus = new EventBus([
    { on: "x", emit: "warning", notify: ["trace-log", "webhook"], continue: true },
  ]);
  const r = bus.emit("x", { message: "hi" });
  assert.equal(r.routed, 2);
  assert.equal(r.stop, false);
  assert.equal(bus.log.length, 1);
  assert.equal(bus.deliveries.length, 1);
  assert.equal(bus.log[0]?.type, "warning");
});

test("EventBus: only subscriptions matching `on` fire", () => {
  const bus = new EventBus([{ on: "a", emit: "info", notify: ["trace-log"], continue: true }]);
  assert.equal(bus.emit("b").routed, 0);
  assert.equal(bus.log.length, 0);
});

test("EventBus: continue:false sets stop", () => {
  const bus = new EventBus([{ on: "fail", emit: "failure", notify: ["trace-log"], continue: false }]);
  assert.equal(bus.emit("fail").stop, true);
});

test("EventBus: a custom route handler overrides the default sink", () => {
  const seen: string[] = [];
  const bus = new EventBus(
    [{ on: "x", emit: "alert", notify: ["webhook"], continue: true }],
    { webhook: (e) => seen.push(e.message) },
  );
  bus.emit("x", { message: "delivered" });
  assert.deepEqual(seen, ["delivered"]);
  assert.equal(bus.deliveries.length, 0); // custom handler took over
});

// 2. Loader parsing.
test("loader: parses the trigger and events blocks", () => {
  const p = loadPipeline("pipelines/document-grounding.pipeline.yaml");
  assert.equal(p.trigger?.type, "manual");
  assert.equal(p.events?.length, 3);
  const failSub = p.events?.find((e) => e.on === "skill_failed");
  assert.equal(failSub?.continue, false);
  assert.deepEqual(failSub?.notify, ["trace-log", "webhook"]);
});

// 3. Orchestrator emission.
test("orchestrator: emits pipeline_succeeded to an injected bus", async () => {
  const bus = new EventBus([{ on: "pipeline_succeeded", emit: "info", notify: ["trace-log"], continue: true }]);
  const outcome = await runPipeline(pipe(okSkill()), newState(), "heuristic", { quiet: true, events: bus });
  assert.equal(outcome.status, "success");
  assert.equal(bus.log.some((e) => e.on === "pipeline_succeeded"), true);
});

test("orchestrator: emits skill_failed on a halt", async () => {
  const failing: Skill = {
    ...okSkill(),
    name: "boom",
    assertions: [{ statement: "always fails", check: () => ({ statement: "always fails", ok: false }) }],
  };
  const bus = new EventBus([{ on: "skill_failed", emit: "failure", notify: ["webhook"], continue: false }]);
  const outcome = await runPipeline(pipe(failing), newState(), "heuristic", { quiet: true, events: bus });
  assert.equal(outcome.status, "halted");
  assert.equal(bus.deliveries.some((e) => e.on === "skill_failed"), true);
});

test("orchestrator: runs unchanged when no bus is supplied", async () => {
  const outcome = await runPipeline(pipe(okSkill()), newState(), "heuristic", { quiet: true });
  assert.equal(outcome.status, "success");
});

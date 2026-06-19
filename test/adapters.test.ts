import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SigMapContextAdapter,
  SigMapCostAdapter,
  SigMapObserveAdapter,
} from "../src/adapters/index.js";

test("OBSERVE: a clean run scores 100 / grade A", () => {
  const h = new SigMapObserveAdapter({ tracesDir: "test/fixtures/traces-good" }).health();
  assert.equal(h.score, 100);
  assert.equal(h.grade, "A");
  assert.equal(h.components.runs, 1);
  assert.equal(h.components.success_rate, 1);
});

test("OBSERVE: a halted, retry-heavy run scores low / grade D", () => {
  const h = new SigMapObserveAdapter({ tracesDir: "test/fixtures/traces-bad" }).health();
  assert.ok(h.score < 60, `expected < 60, got ${h.score}`);
  assert.equal(h.grade, "D");
  assert.equal(h.components.success_rate, 0);
});

test("OBSERVE: no traces directory yields a defined zero-state", () => {
  const h = new SigMapObserveAdapter({ tracesDir: "test/fixtures/does-not-exist" }).health();
  assert.equal(h.components.runs, 0);
  assert.equal(h.grade, "D");
});

test("CONTEXT: loads query-context.md when present", () => {
  const ctx = new SigMapContextAdapter({ contextDir: "test/fixtures/ctx-present" }).load("auth");
  assert.equal(ctx.present, true);
  assert.equal(ctx.query, "auth");
  assert.match(ctx.content, /token exchange/);
  assert.ok(ctx.approx_tokens > 0);
});

test("CONTEXT: graceful no-op when absent", () => {
  const ctx = new SigMapContextAdapter({ contextDir: "test/fixtures/does-not-exist" }).load();
  assert.equal(ctx.present, false);
  assert.equal(ctx.content, "");
  assert.equal(ctx.approx_tokens, 0);
});

test("COST: routes tasks to SigMap model tiers", () => {
  const cost = new SigMapCostAdapter({ tracesDir: "test/fixtures/traces-good" });
  assert.equal(cost.routeModel("fix a typo in the README"), "fast");
  assert.equal(cost.routeModel("add a feature with tests"), "balanced");
  assert.equal(cost.routeModel("refactor the auth security model"), "powerful");
});

test("COST: totals per-run cost from the NDJSON stream", () => {
  const cost = new SigMapCostAdapter({ tracesDir: "test/fixtures/traces-good" });
  assert.equal(cost.totalCost(), 0.002);
});

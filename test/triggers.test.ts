// TRIGGER primitive (v1.2.0) — cron matcher + activation resolver.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cronMatches, shouldActivate } from "../src/index.js";

// cron — at 2026-01-05 (Monday) 09:30.
const D = new Date(2026, 0, 5, 9, 30);

test("cronMatches: wildcard matches everything", () => {
  assert.equal(cronMatches("* * * * *", D), true);
});

test("cronMatches: exact minute/hour", () => {
  assert.equal(cronMatches("30 9 * * *", D), true);
  assert.equal(cronMatches("0 9 * * *", D), false);
});

test("cronMatches: step, list, and range", () => {
  assert.equal(cronMatches("*/15 * * * *", D), true); // 30 is a multiple of 15
  assert.equal(cronMatches("0,30 9 * * *", D), true); // list includes 30
  assert.equal(cronMatches("30 8-10 * * *", D), true); // 9 in 8-10
  assert.equal(cronMatches("30 9 * * 1", D), true); // Monday = 1
  assert.equal(cronMatches("30 9 * * 0", D), false); // not Sunday
});

test("cronMatches: rejects a malformed expression", () => {
  assert.throws(() => cronMatches("* * *", D), /5 fields/);
});

// shouldActivate.
test("shouldActivate: manual always activates", () => {
  assert.equal(shouldActivate({ type: "manual" }).activate, true);
});

test("shouldActivate: cron uses the matcher against ctx.now", () => {
  assert.equal(shouldActivate({ type: "cron", cron: "30 9 * * *" }, { now: D }).activate, true);
  assert.equal(shouldActivate({ type: "cron", cron: "0 0 * * *" }, { now: D }).activate, false);
});

test("shouldActivate: webhook checks the shared secret", () => {
  const spec = { type: "webhook" as const, webhook: { secret: "s3cret" } };
  assert.equal(shouldActivate(spec, { webhook: { secret: "s3cret" } }).activate, true);
  assert.equal(shouldActivate(spec, { webhook: { secret: "wrong" } }).activate, false);
  assert.equal(shouldActivate(spec, {}).activate, false);
});

test("shouldActivate: pipeline_completion needs an upstream event", () => {
  const spec = { type: "pipeline_completion" as const };
  assert.equal(shouldActivate(spec, { event: { pipeline: "a", status: "success" } }).activate, true);
  assert.equal(shouldActivate(spec, {}).activate, false);
});

test("shouldActivate: condition and human_checkpoint gate activation", () => {
  assert.equal(shouldActivate({ type: "manual", condition: "x" }, {}).activate, false);
  assert.equal(shouldActivate({ type: "manual", condition: "x" }, { conditionMet: true }).activate, true);
  const gated = { type: "manual" as const, human_checkpoint: { reason: "review" } };
  assert.equal(shouldActivate(gated, {}).activate, false);
  assert.equal(shouldActivate(gated, { approved: true }).activate, true);
});

test("shouldActivate: external triggers are environment-fired", () => {
  assert.equal(shouldActivate({ type: "git_hook" }).activate, false);
});

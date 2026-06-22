// SigMap pipeline integration (v0.8.0) — load-context, runSigMapVerify, and the
// `verify` CLI command. JUDGE_PROVIDER=heuristic keeps the chain offline.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { cli } from "../src/cli.js";
import { runSigMapVerify } from "../src/index.js";
import { loadContext } from "../src/skills/load-context.js";
import type { State } from "../src/types.js";

const GROUNDED =
  "# Quarterly Update\n\nThe platform team shipped the new retrieval pipeline this quarter, " +
  "dropping latency by forty percent after moving ranking onto the graph index.\n\n## Highlights\n- hit@5 rose to 76%";

function newState(raw?: string): State {
  return {
    raw_input: raw,
    _meta: { pipeline: "t", run_id: "t-verify", inject: "none", checkpoints: [] },
  };
}

// 1. load-context — sources from CONTEXT, or passes through provided input.
test("load-context: sources raw_input from the SigMap CONTEXT artifact", async () => {
  const prev = process.env.SIGMAP_CONTEXT_DIR;
  process.env.SIGMAP_CONTEXT_DIR = "test/fixtures/ctx-present";
  try {
    const state = newState();
    const result = await loadContext.run(state);
    assert.match(result.writes.raw_input ?? "", /auth flow/);
  } finally {
    if (prev === undefined) delete process.env.SIGMAP_CONTEXT_DIR;
    else process.env.SIGMAP_CONTEXT_DIR = prev;
  }
});

test("load-context: passes through input that is already provided", async () => {
  const result = await loadContext.run(newState("already here"));
  assert.deepEqual(result.writes, {});
  assert.match(result.summary, /already provided/);
});

test("load-context declares the fs:read capability", () => {
  assert.deepEqual(loadContext.capabilities, ["fs:read"]);
});

// 2. runSigMapVerify — structured in-process result.
test("runSigMapVerify: grounded input returns a passed verdict", async () => {
  const result = await runSigMapVerify({ input: GROUNDED, quiet: true });
  assert.equal(result.status, "success");
  assert.equal(result.grounded, true);
  assert.ok(result.highlights > 0);
  assert.equal(typeof result.health.grade, "string");
});

test("runSigMapVerify: too-thin input halts at validate-coverage", async () => {
  const result = await runSigMapVerify({ input: "# Note\nok", quiet: true });
  assert.equal(result.status, "halted");
  assert.equal(result.grounded, false);
  assert.equal(result.halted_at, "validate-coverage");
});

// 3. CLI `verify`.
test("cli verify: exit 0 for grounded input, 1 for thin input", async () => {
  assert.equal(await cli(["verify", "--input", "test/fixtures/verify-grounded.md"]), 0);
  assert.equal(await cli(["verify", "--input", "test/fixtures/verify-thin.md"]), 1);
});

// 4. Public API surface.
test("index exports the integration surface", async () => {
  const api = await import("../src/index.js");
  for (const name of ["runSigMapVerify", "sigmapVerifyPipeline", "runPipeline", "listSkills", "DEFAULT_POLICY"]) {
    assert.ok(name in api, `index must export ${name}`);
  }
});

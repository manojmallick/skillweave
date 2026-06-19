// CLI exit-code behaviour, driven by calling cli() directly.
// JUDGE_PROVIDER=heuristic keeps `run` offline and deterministic.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { cli } from "../src/cli.js";

const GOOD = "pipelines/document-grounding.pipeline.yaml";
const BAD = "test/fixtures/unknown-skill.pipeline.yaml";

test("validate returns 0 for a valid pipeline", async () => {
  assert.equal(await cli(["validate", GOOD]), 0);
});

test("validate returns 1 for an invalid pipeline", async () => {
  assert.equal(await cli(["validate", BAD]), 1);
});

test("run executes a valid pipeline end to end (exit 0)", async () => {
  assert.equal(await cli(["run", GOOD]), 0);
});

test("run returns 1 when the pipeline fails to load", async () => {
  assert.equal(await cli(["run", BAD]), 1);
});

test("test runs a single skill in isolation (exit 0)", async () => {
  assert.equal(await cli(["test", "parse-input"]), 0);
});

test("test returns 1 for an unknown skill", async () => {
  assert.equal(await cli(["test", "no-such-skill"]), 1);
});

test("list and help return 0; unknown command returns 2", async () => {
  assert.equal(await cli(["list"]), 0);
  assert.equal(await cli([]), 0);
  assert.equal(await cli(["bogus"]), 2);
});

// Developer experience (v1.1.0) — doctor readiness report + "did you mean?".
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { cli } from "../src/cli.js";
import { closest, levenshtein, runDoctor } from "../src/index.js";

// 1. runDoctor.
test("runDoctor: reports ready on a supported Node with offline judge", () => {
  const report = runDoctor();
  assert.equal(report.ready, true);
  const node = report.checks.find((c) => c.label === "Node.js");
  assert.equal(node?.status, "ok");
});

test("runDoctor: names the offline heuristic when no API key is set", () => {
  const report = runDoctor();
  const judge = report.checks.find((c) => c.label === "Judge provider");
  assert.match(judge?.detail ?? "", /heuristic/);
});

test("runDoctor: reports the registered skill count", () => {
  const report = runDoctor();
  const skills = report.checks.find((c) => c.label === "Skills");
  assert.match(skills?.detail ?? "", /\d+ registered/);
});

// 2. suggestions.
test("levenshtein: basic edit distances", () => {
  assert.equal(levenshtein("verify", "verify"), 0);
  assert.equal(levenshtein("verfy", "verify"), 1);
  assert.equal(levenshtein("", "abc"), 3);
});

test("closest: finds a near match and rejects a far one", () => {
  const cmds = ["verify", "validate", "registry"];
  assert.equal(closest("verfy", cmds), "verify");
  assert.equal(closest("registr", cmds), "registry");
  assert.equal(closest("xyzzy", cmds), null);
});

// 3. CLI.
test("cli doctor: exits 0", async () => {
  assert.equal(await cli(["doctor"]), 0);
});

test("cli: an unknown command still exits 2", async () => {
  assert.equal(await cli(["verfy"]), 2);
});

test("cli: an unknown skill name still exits 1", async () => {
  assert.equal(await cli(["test", "parse-inpt"]), 1);
});

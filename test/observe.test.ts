// OBSERVE primitive (v2.0.0) — alerts, A/B testing, visualiser, CLI.
process.env.JUDGE_PROVIDER = "heuristic";

import assert from "node:assert/strict";
import { test } from "node:test";
import { cli } from "../src/cli.js";
import { abTest, checkAlerts, visualise } from "../src/index.js";
import { loadPipeline } from "../src/pipeline-loader.js";

// alerts.
test("checkAlerts: fires only the rules whose comparison holds", () => {
  const fired = checkAlerts(
    { pass_rate: 0.4, score: 0.9 },
    [
      { id: "lowpass", metric: "pass_rate", op: "<", threshold: 0.5, severity: "alert" },
      { id: "hiscore", metric: "score", op: ">", threshold: 0.95 },
      { id: "absent", metric: "missing", op: ">", threshold: 0 },
    ],
  );
  assert.equal(fired.length, 1);
  assert.equal(fired[0]?.id, "lowpass");
  assert.equal(fired[0]?.value, 0.4);
  assert.equal(fired[0]?.severity, "alert");
});

test("checkAlerts: defaults severity to warning", () => {
  const fired = checkAlerts({ x: 10 }, [{ id: "r", metric: "x", op: ">=", threshold: 10 }]);
  assert.equal(fired[0]?.severity, "warning");
});

// A/B.
test("abTest: higher score wins, equal is a tie", () => {
  assert.equal(abTest(0.91, 0.88).winner, "a");
  assert.equal(abTest(0.5, 0.7).winner, "b");
  assert.equal(abTest(0.8, 0.8).winner, "tie");
  assert.equal(abTest(0.91, 0.88).delta, 0.03);
});

// visualiser.
test("visualise: renders ASCII and Mermaid", () => {
  const p = loadPipeline("pipelines/document-grounding.pipeline.yaml");
  const ascii = visualise(p);
  assert.match(ascii, /parse-input.*→.*memory-update/);
  assert.match(ascii, /trigger: manual/);
  const mer = visualise(p, { format: "mermaid" });
  assert.match(mer, /flowchart TD/);
  assert.match(mer, /parse_input --> validate_coverage/);
});

test("cli visualise: exit 0 with a pipeline, 2 without", async () => {
  assert.equal(await cli(["visualise", "pipelines/document-grounding.pipeline.yaml"]), 0);
  assert.equal(await cli(["visualise"]), 2);
});

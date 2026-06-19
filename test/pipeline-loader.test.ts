import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadPipeline,
  PipelineError,
  validatePipelineDoc,
} from "../src/pipeline-loader.js";
import { getSkill } from "../src/registry.js";

const GOOD = "pipelines/document-grounding.pipeline.yaml";

test("loadPipeline resolves a valid pipeline into runnable skills", () => {
  const pipeline = loadPipeline(GOOD);
  assert.equal(pipeline.name, "document-grounding");
  assert.equal(pipeline.domain, "documents");
  assert.equal(pipeline.steps.length, 4);
  assert.deepEqual(
    pipeline.steps.map((s) => s.name),
    ["parse-input", "validate-coverage", "extract-highlights", "memory-update"],
  );
});

test("loadPipeline applies per-step overrides without mutating the registry", () => {
  const pipeline = loadPipeline("test/fixtures/override.pipeline.yaml");
  const highlights = pipeline.steps.find((s) => s.name === "extract-highlights");
  assert.equal(highlights?.retries, 5, "override applied to the loaded step");
  assert.equal(getSkill("extract-highlights")?.retries, 2, "registry skill unchanged");
});

test("loadPipeline throws PipelineError on an unknown skill", () => {
  assert.throws(
    () => loadPipeline("test/fixtures/unknown-skill.pipeline.yaml"),
    (err: unknown) => err instanceof PipelineError && /unknown skill 'does-not-exist'/.test((err as Error).message),
  );
});

test("validatePipelineDoc flags unknown skills and out-of-range thresholds", () => {
  const issues = validatePipelineDoc({
    name: "x",
    version: "1",
    domain: "d",
    pipeline: [{ skill: "nope" }, { skill: "extract-highlights", confidence_threshold: 2 }],
  });
  const errors = issues.filter((i) => i.level === "error").map((i) => i.message);
  assert.ok(errors.some((m) => /unknown skill 'nope'/.test(m)));
  assert.ok(errors.some((m) => /confidence_threshold must be a number in \[0, 1\]/.test(m)));
});

test("validatePipelineDoc flags missing top-level fields and empty pipeline", () => {
  const issues = validatePipelineDoc({ pipeline: [] });
  const errors = issues.filter((i) => i.level === "error").map((i) => i.message);
  assert.ok(errors.some((m) => /missing top-level field: name/.test(m)));
  assert.ok(errors.some((m) => /non-empty list of steps/.test(m)));
});

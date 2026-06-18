import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyConfidence } from "../src/orchestrator.js";

test("confidence routing bands: high / review / low", () => {
  assert.equal(classifyConfidence(1.0), "high");
  assert.equal(classifyConfidence(0.85), "high"); // boundary is inclusive
  assert.equal(classifyConfidence(0.84), "review");
  assert.equal(classifyConfidence(0.65), "review"); // boundary is inclusive
  assert.equal(classifyConfidence(0.64), "low");
  assert.equal(classifyConfidence(0.0), "low");
});

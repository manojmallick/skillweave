import assert from "node:assert/strict";
import { test } from "node:test";
import { checkNeutralLanguage } from "../src/providers/index.js";

test("model-neutral instructions pass", () => {
  const issues = checkNeutralLanguage(
    "Extract content blocks from the input. Output structured JSON. Do not transform data.",
  );
  assert.deepEqual(issues, []);
});

test("flags model/vendor names, thinking blocks, and context-window assumptions", () => {
  const issues = checkNeutralLanguage(
    "Use Claude thinking blocks and a 200k token context window via the GPT-4o API.",
  );
  const rules = new Set(issues.map((i) => i.rule));
  assert.ok(rules.has("vendor-or-model-name"));
  assert.ok(rules.has("thinking-or-xml-tags"));
  assert.ok(rules.has("context-window-assumption"));
});

test("flags XML/thinking tags directly", () => {
  const issues = checkNeutralLanguage("Wrap reasoning in <thinking>...</thinking> tags.");
  assert.ok(issues.some((i) => i.rule === "thinking-or-xml-tags"));
});

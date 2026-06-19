import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnthropicAdapter,
  buildAdapters,
  loadProfile,
  OllamaAdapter,
  resolveTargets,
  runWithFallback,
  type ResolvedTarget,
} from "../src/providers/index.js";

test("loadProfile reads capability models from YAML", () => {
  const models = loadProfile("anthropic");
  assert.ok(models.length >= 3);
  const opus = models.find((m) => m.id === "claude-opus-4-8");
  assert.equal(opus?.tier, "powerful");
  assert.equal(opus?.supports_structured_output, true);
  assert.equal(typeof opus?.cost_per_1k_input, "number");
});

test("supports + selectModel honor tier and capabilities", () => {
  const anthropic = new AnthropicAdapter(loadProfile("anthropic"));
  assert.equal(anthropic.supports(["structured_output"]), true);
  assert.equal(anthropic.selectModel("powerful")?.id, "claude-opus-4-8");
  assert.equal(anthropic.selectModel("fast")?.id, "claude-haiku-4-5");
  assert.equal(anthropic.selectModel()?.tier, "balanced"); // default tier

  const ollama = new OllamaAdapter(loadProfile("ollama"));
  assert.equal(ollama.supports(["structured_output"]), false);
  assert.equal(ollama.selectModel(undefined, ["structured_output"]), null);
});

test("resolveTargets resolves primary + fallback in order, filtering by requirement", () => {
  const adapters = buildAdapters();
  const targets = resolveTargets(
    { primary: "anthropic/claude-opus-4-8", fallback: ["openai", "ollama"], requires: ["structured_output"] },
    adapters,
  );
  assert.equal(targets[0]?.adapter.name, "anthropic");
  assert.equal(targets[0]?.model.id, "claude-opus-4-8");
  assert.equal(targets[1]?.adapter.name, "openai");
  // ollama has no structured-output model → excluded by the requirement
  assert.ok(!targets.some((t) => t.adapter.name === "ollama"));
});

test("runWithFallback activates the next target when the primary fails", async () => {
  const calls: string[] = [];
  const targets = [
    { adapter: { name: "p1" }, model: {} },
    { adapter: { name: "p2" }, model: {} },
  ] as unknown as ResolvedTarget[];

  const result = await runWithFallback(targets, async (t) => {
    calls.push(t.adapter.name);
    if (t.adapter.name === "p1") throw new Error("primary down");
    return `ok-from-${t.adapter.name}`;
  });

  assert.equal(result, "ok-from-p2");
  assert.deepEqual(calls, ["p1", "p2"]);
});

test("runWithFallback throws when every target fails", async () => {
  const targets = [{ adapter: { name: "p1" }, model: {} }] as unknown as ResolvedTarget[];
  await assert.rejects(() =>
    runWithFallback(targets, async () => {
      throw new Error("boom");
    }),
  );
});

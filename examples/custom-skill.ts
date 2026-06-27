// custom-skill — author a skill, grade it against the 9-point quality gate, run it
// through the orchestrator, then publish + install it from the local registry.
//
// As a published consumer: import { gradeSkill, publishSkill, ... } from "skillweave";
process.env.JUDGE_PROVIDER ??= "heuristic";

import { rmSync } from "node:fs";
import { gradeSkill, installSkill, publishSkill, runPipeline } from "../src/index.js";
import type { ContentBlock, Pipeline, Skill, State } from "../src/index.js";

// A new deterministic skill: one content block per sentence.
const sentenceSplitter: Skill = {
  name: "sentence-splitter",
  execution_class: "deterministic",
  does: "splits raw input into one content block per sentence",
  does_not: "interpret meaning, judge quality, or call an LLM",
  state_read: ["raw_input"],
  state_write: ["content_blocks"],
  output_schema: "content-block@1.1", // pins a real registry schema
  capabilities: [],
  assertions: [
    {
      statement: "at least one sentence block is produced",
      check: (s: State) => ({
        statement: "at least one sentence block is produced",
        ok: (s.content_blocks?.length ?? 0) > 0,
        detail: `${s.content_blocks?.length ?? 0} sentences`,
      }),
    },
  ],
  async run(state: State) {
    const blocks: ContentBlock[] = (state.raw_input ?? "")
      .split(/(?<=[.!?])\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ id: `s${i}`, type: "paragraph", text }));
    return { writes: { content_blocks: blocks }, summary: `split into ${blocks.length} sentences`, cost: 0 };
  },
};

// 1. Grade it against the quality gate.
const report = gradeSkill(sentenceSplitter);
console.log(`gradeSkill   : ${report.points}/${report.max} → ${report.tier}`);
for (const c of report.checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.label}`);

// 2. Run it through the orchestrator.
const pipeline: Pipeline = { name: "custom", version: "1.0.0", domain: "documents", steps: [sentenceSplitter] };
const state: State = {
  raw_input: "SkillWeave composes LLM tasks. Each skill has one job! Does it work? Yes.",
  _meta: { pipeline: "custom", run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
};
await runPipeline(pipeline, state, "heuristic (offline)", { quiet: true });
console.log("\nrun          :", state.content_blocks?.length, "blocks:", state.content_blocks?.map((b) => b.text));

// 3. Publish + install from a local registry.
const dir = ".registry-example";
rmSync(dir, { recursive: true, force: true });
const entry = publishSkill(sentenceSplitter, { dir });
console.log("\npublishSkill :", `${entry.name} — ${entry.tier} (reputation ${entry.reputation})`);
console.log("installSkill :", installSkill("sentence-splitter", { dir })?.name);
rmSync(dir, { recursive: true, force: true });

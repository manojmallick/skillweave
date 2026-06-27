// todo-flagger — a custom skill that flags content blocks containing a
// TODO / FIXME / XXX marker. Shows authoring a skill that writes a NEW STATE
// field (`flags`, added to the State type), grading it, and running it.
//
// As a published consumer: import { ... } from "skillweave";
process.env.JUDGE_PROVIDER ??= "heuristic";

import { gradeSkill, getSkill, runPipeline } from "../src/index.js";
import { todoFlagger } from "../src/skills/todo-flagger.js";
import type { Pipeline, State } from "../src/index.js";

// 1. It grades 9/9 → verified.
const report = gradeSkill(todoFlagger);
console.log(`gradeSkill: ${report.points}/${report.max} → ${report.tier}`);

// 2. Run it after parse-input (parse-input turns raw text into content blocks).
const DOC = `# Release tasks

- Cut the v2 tag
- TODO: write the migration guide
- FIXME: the retry budget is off by one
- Everything else looks fine`;

const pipeline: Pipeline = {
  name: "todo-scan",
  version: "1.0.0",
  domain: "documents",
  steps: [getSkill("parse-input")!, todoFlagger],
};
const state: State = {
  raw_input: DOC,
  _meta: { pipeline: "todo-scan", run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
};
await runPipeline(pipeline, state, "heuristic (offline)", { quiet: true });

console.log(`\nflagged ${state.flags?.length} block(s):`);
for (const f of state.flags ?? []) console.log(`  [${f.marker}] ${f.text}`);

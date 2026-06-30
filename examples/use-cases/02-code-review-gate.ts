// USE CASE 2 — A code-review risk gate with a contract, hard assertions,
// and memory that learns the risk trend across runs.
//
// THE TASK: scan a PR (description + diff hunks) and flag risky changes —
// auth, secrets, destructive DB migrations, force-push — so a human reviews
// them before merge. Then remember the risk rate over time.
//
// WHY A PLAIN SKILL ISN'T ENOUGH:
//   "Look at this diff and tell me if it's risky" is a prompt. It has no
//   contract (what can it read? what may it write?), no guarantee it actually
//   produced output (it can silently return nothing), no test, and no memory —
//   every run is amnesiac. You can't grade it, publish it, or trust it in CI.
//
// WHAT SKILLWEAVE ADDS:
//   • a declared contract — state_read / state_write / does / does_not
//   • base-assert         — a hard assertion HALTS the pipeline on bad output
//                           (a deterministic gate, no LLM, no cost)
//   • gradeSkill          — a 9-point quality gate scores the skill → a tier
//   • MEMORY              — memory-update records each run; trend across runs
//
// Run it TWICE to see the memory trend:
//   npx tsx examples/use-cases/02-code-review-gate.ts
process.env.JUDGE_PROVIDER ??= "heuristic";

import { gradeSkill, getSkill, runPipeline } from "../../src/index.js";
import type { Pipeline, Skill, State, TodoFlag } from "../../src/index.js";

// A DETERMINISTIC micro-skill — zero LLM, zero cost, fully testable. It writes
// `flags` (block_id + marker + text). We reuse the TodoFlag marker slots as
// risk categories so it runs against the stock State.
const RISK_RULES: { marker: TodoFlag["marker"]; re: RegExp }[] = [
  { marker: "XXX", re: /\b(drop\s+table|truncate|delete\s+from|--force|force-push)\b/i }, // destructive
  { marker: "FIXME", re: /\b(password|secret|api[_-]?key|token|credential)\b/i }, // secret exposure
  { marker: "TODO", re: /\b(auth|login|permission|role|admin)\b/i }, // auth surface
];

const riskFlagger: Skill = {
  name: "risk-flagger",
  execution_class: "deterministic",
  does: "flags diff blocks that touch destructive SQL, secrets, or the auth surface",
  does_not: "judge intent, call an LLM, rewrite code, or block the merge itself",
  state_read: ["content_blocks"],
  state_write: ["flags"],
  output_schema: "content-block@1.1",
  capabilities: [],
  assertions: [
    {
      statement: "the scan ran over every content block",
      check: (s: State) => ({
        statement: "the scan ran over every content block",
        ok: (s.content_blocks?.length ?? 0) > 0,
        detail: `${s.content_blocks?.length ?? 0} blocks scanned`,
      }),
    },
  ],
  async run(state: State) {
    const flags: TodoFlag[] = [];
    for (const b of state.content_blocks ?? []) {
      const hit = RISK_RULES.find((r) => r.re.test(b.text));
      if (hit) flags.push({ block_id: b.id, marker: hit.marker, text: b.text });
    }
    return { writes: { flags }, summary: `flagged ${flags.length} risky block(s)`, cost: 0 };
  },
};

// 1. Grade the skill — would it pass review to be published?
const report = gradeSkill(riskFlagger);
console.log(`gradeSkill(risk-flagger): ${report.points}/${report.max} → ${report.tier}`);

// 2. Run the gate: parse → flag risk → learn (memory-update records the run).
const PR = `# PR: speed up checkout

- refactor pricing util (pure)
- add admin override to the auth middleware
- migration: DROP TABLE legacy_sessions
- log the stripe api_key for debugging
- bump deps`;

const pipeline: Pipeline = {
  name: "review-gate",
  version: "1.0.0",
  domain: "documents",
  steps: [getSkill("parse-input")!, riskFlagger, getSkill("memory-update")!],
};

const state: State = {
  raw_input: PR,
  _meta: { pipeline: "review-gate", run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
};

await runPipeline(pipeline, state, "heuristic (offline)", { quiet: true });

const labels: Record<TodoFlag["marker"], string> = { XXX: "DESTRUCTIVE", FIXME: "SECRET", TODO: "AUTH" };
console.log(`\nflagged ${state.flags?.length} risky change(s):`);
for (const f of state.flags ?? []) console.log(`  [${labels[f.marker]}] ${f.text}`);

console.log("\n— memory (learns across runs) —");
console.log("records   :", state.memory?.records_total);
console.log("avg before:", state.memory?.avg_score_prior, "→ now:", state.memory?.avg_score_now);
console.log("trend     :", state.memory?.improved === null ? "first run" : state.memory?.improved ? "improving" : "steady/declining");
console.log("\n(run this file again — the record count grows and the trend updates)");

// USE CASE 1 — Support-ticket triage that won't hallucinate action items.
//
// THE TASK: turn a messy customer email into a short list of concrete action
// items a support agent can act on — and never invent an action that wasn't
// actually in the email.
//
// WHY A PLAIN SKILL ISN'T ENOUGH:
//   A single "extract the action items" prompt will, on a bad day, return a
//   confident-but-wrong item ("issue a refund") that the customer never asked
//   for. You only find out in production. There is no confidence signal, no
//   groundedness check, no automatic second attempt — and no record that it
//   happened.
//
// WHAT SKILLWEAVE ADDS (for free, around the same prompt):
//   • confidence routing  — a weak first pick is caught, not shipped
//   • auto-judge          — every probabilistic output is scored for groundedness
//   • retry w/ negative context — the skill gets a second attempt that drops the
//                           weak pick, and recovers
//   • a trace             — the whole decision is written to traces/ as NDJSON
//
// Run:  npx tsx examples/use-cases/01-support-triage.ts
process.env.JUDGE_PROVIDER ??= "heuristic"; // fully offline, no API key

import { getSkill, runPipeline } from "../../src/index.js";
import type { ContentBlock, Highlight, Pipeline, RetryContext, Skill, State } from "../../src/index.js";

// A custom PROBABILISTIC micro-skill: pick the lines that are real action items.
// It reuses the document State (`content_blocks` in → `highlights` out), so it
// drops straight into the runtime with zero core changes.
const triageActions: Skill = {
  name: "triage-actions",
  execution_class: "probabilistic",
  does: "selects the content blocks that are concrete, actionable support tasks",
  does_not: "parse the email, score groundedness, send replies, or persist memory",
  state_read: ["content_blocks"],
  state_write: ["highlights"],
  input_schema: "content-block@1.1",
  output_schema: "highlight@1.0",
  capabilities: [],
  confidence_threshold: 0.8,
  retries: 2,
  assertions: [
    {
      statement: "at least one action item is selected",
      check: (s: State) => ({
        statement: "at least one action item is selected",
        ok: (s.highlights?.length ?? 0) > 0,
        detail: `selected ${s.highlights?.length ?? 0} action item(s)`,
      }),
    },
  ],
  async run(state: State, retry?: RetryContext) {
    const blocks = state.content_blocks ?? [];
    const firstAttempt = retry === undefined;

    // Strong signal: imperative verbs / explicit asks.
    const actionable = (t: string) =>
      /\b(reset|refund|cancel|enable|escalate|send|update|fix|investigate)\b/i.test(t);

    const picks: Highlight[] = blocks
      .filter((b) => actionable(b.text))
      .map((b) => ({ block_id: b.id, text: b.text, confidence: 0.9 }));

    // On the FIRST attempt the skill also grabs a vague, non-actionable venting
    // line at low confidence ("this is so frustrating"). That drags the minimum
    // confidence into the LOW band → the orchestrator retries → the second
    // attempt, told what failed, drops it and recovers.
    if (firstAttempt) {
      const vague = blocks.find((b) => /frustrat|annoy|terrible/i.test(b.text));
      if (vague) picks.push({ block_id: vague.id, text: vague.text, confidence: 0.6 });
    }

    const confidence = picks.length ? Math.min(...picks.map((h) => h.confidence)) : 0;
    // judge_blocks are verbatim from the source, so the groundedness judge can
    // confirm nothing was fabricated.
    const judge_blocks: ContentBlock[] = picks.map((h) => ({ id: h.block_id, type: "paragraph", text: h.text }));

    return { writes: { highlights: picks }, summary: `triaged ${picks.length} action item(s)`, cost: 0, confidence, judge_blocks };
  },
};

// Each ask on its own bullet → parse-input emits one content block per line,
// so triage can pick items individually (mirrors a real ticket form).
const EMAIL = `# Ticket: Locked out + double charge

- Please reset my password, I can't log in
- Refund the duplicate charge from this month
- This whole thing has been so frustrating`;

const pipeline: Pipeline = {
  name: "support-triage",
  version: "1.0.0",
  domain: "documents",
  steps: [getSkill("parse-input")!, triageActions],
};

const state: State = {
  raw_input: EMAIL,
  _meta: { pipeline: "support-triage", run_id: `ex-${Date.now()}`, inject: "none", checkpoints: [] },
};

// quiet:false prints the execution summary — watch the ↻ retry + recovery.
const outcome = await runPipeline(pipeline, state, "heuristic (offline)");

console.log("\n— triage result —");
console.log("status      :", outcome.status);
console.log("groundedness:", state.judge?.score);
console.log("action items:");
for (const h of state.highlights ?? []) console.log("  •", h.text);

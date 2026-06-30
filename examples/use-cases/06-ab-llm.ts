// USE CASE 6 — A/B on a REAL LLM: the same task, the same model, the same
// prompt — run once as a "normal skill" (one raw call) and once transformed
// into a SkillWeave skill (confidence-routed · auto-judged · retried).
//
// This is the head-to-head the earlier examples only described. Both paths hit
// the SAME provider/model. The only difference is the runtime around the prompt.
//
// REQUIRES a provider key (otherwise it prints how to set one and exits):
//   export ANTHROPIC_API_KEY=...   # judge + extractor run on claude-opus-4-8
//   # or OPENAI_API_KEY / GEMINI_API_KEY
//
// Run:  npx tsx examples/use-cases/06-ab-llm.ts
//       npx tsx examples/use-cases/06-ab-llm.ts --trials 5   # tally over N runs
//       npx tsx examples/use-cases/06-ab-llm.ts --hard       # loose prompt + bait → contrast fires
//       npx tsx examples/use-cases/06-ab-llm.ts --hard --trials 5

import { DEFAULT_POLICY, runPipeline } from "../../src/index.js";
import { buildAdapters } from "../../src/providers/index.js";

// This skill calls the network (the LLM), so we must EXPLICITLY grant `net` —
// DEFAULT_POLICY denies it (offline-by-default). Granting it here is the
// security layer working as designed: capabilities are opt-in, per policy.
const NET_POLICY = { ...DEFAULT_POLICY, capabilities: [...DEFAULT_POLICY.capabilities, "net" as const] };
import type { CompletionRequest } from "../../src/providers/types.js";
import type { ContentBlock, Highlight, Pipeline, RetryContext, Skill, State } from "../../src/index.js";

// Counts how many times the skill's run() fires per trial → attempts-1 = retries.
let attempts = 0;

// ── The task both versions perform ───────────────────────────────────────────
// Two modes:
//   default  — a STRICT prompt; a strong model gets it right and both paths agree
//              (honest: on easy tasks the wrapper adds safety, not a different answer).
//   --hard   — a LOOSE, realistic prompt (what people actually write as a "skill")
//              over a bait email that invites invented follow-ups. The plain path
//              ships them; the SkillWeave groundedness judge flags them and the
//              retry tightens. This is where the contrast reliably fires.
const HARD = process.argv.includes("--hard");

const SYSTEM = HARD
  ? "Read this customer support email and list what we should do next."
  : "You extract action items from a customer support email. Return ONLY tasks the " +
    "customer explicitly requested. Do not infer, summarise feelings, or invent follow-ups.";

const EMAIL = HARD
  ? `Subject: ongoing issues

Hi team,
My dashboard keeps timing out whenever I export reports — can you look into it?
This is the third week running and it's really hurting us.
I'd hate to have to move to a competitor over something like this.
Hoping we can sort it out soon.`
  : `Subject: a few things

Hi — I can't log into my account, please reset my password.
Also the invoice I got last week shows the wrong company name, can you fix that?
Honestly the downtime this month has been really frustrating.
By the way, we've started evaluating Acme Corp as an alternative.
Thanks.`;

// ── Provider plumbing: pick the first configured provider, call it. ──────────
const adapters = buildAdapters();
const provider = Object.values(adapters).find((a) => a.available());

if (!provider) {
  console.log("No provider key set — this example needs a REAL LLM.\n");
  console.log("  export ANTHROPIC_API_KEY=...   # or OPENAI_API_KEY / GEMINI_API_KEY");
  console.log("  npx tsx examples/use-cases/06-ab-llm.ts\n");
  console.log("(The other use cases 01–05 run fully offline.)");
  process.exit(0);
}

// Normalize whatever a provider returns into string[] — providers differ on how
// strictly they honour a JSON array schema.
function toItems(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => (typeof x === "string" ? x : x?.text ?? JSON.stringify(x))).filter(Boolean);
  if (typeof raw === "string") return raw.split(/\n|,(?=\s*[A-Z])/).map((s) => s.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean);
  return [];
}

async function callLLM(req: CompletionRequest) {
  const res = await provider!.complete({ max_tokens: 512, ...req });
  let parsed: { items?: unknown; confidence?: number } = {};
  try {
    parsed = JSON.parse(res.text);
  } catch {
    parsed = { items: res.text };
  }
  return { items: toItems(parsed.items), confidence: parsed.confidence, cost: res.cost, model: res.model };
}

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    items: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: ["items", "confidence"],
  additionalProperties: false,
} as const;

// ════════════════════════════════════════════════════════════════════════════
// PATH A — "just a skill": one raw LLM call. Whatever it returns, you ship.
// ════════════════════════════════════════════════════════════════════════════
async function runPlain() {
  const { items, cost, model } = await callLLM({
    system: SYSTEM,
    prompt: `Email:\n${EMAIL}\n\nReturn {items, confidence}.`,
    json_schema: ITEM_SCHEMA,
  });
  return { items, cost, model };
}

// ════════════════════════════════════════════════════════════════════════════
// PATH B — the SAME prompt, transformed into a SkillWeave skill. The orchestrator
// confidence-routes it, auto-judges groundedness vs the email, and on failure
// re-invokes run() with negative context (a smarter second attempt).
// ════════════════════════════════════════════════════════════════════════════
const groundedExtractor: Skill = {
  name: "grounded-extractor",
  execution_class: "probabilistic",
  does: "extracts only the action items the customer explicitly requested",
  does_not: "infer follow-ups, summarise feelings, parse input, or score itself",
  state_read: ["raw_input"],
  state_write: ["highlights"],
  capabilities: ["net"], // it calls an LLM
  confidence_threshold: 0.8, // judge groundedness must clear this
  retries: 2,
  assertions: [
    {
      statement: "at least one action item is extracted",
      check: (s: State) => ({
        statement: "at least one action item is extracted",
        ok: (s.highlights?.length ?? 0) > 0,
        detail: `${s.highlights?.length ?? 0} item(s)`,
      }),
    },
  ],
  async run(state: State, retry?: RetryContext) {
    attempts++;
    // The ONE difference on a retry: the model is told what went wrong last time.
    const negative = retry
      ? `\n\nYour previous attempt FAILED: ${retry.failure_reason}\n` +
        `Previous output: ${retry.previous_summary}\n` +
        `Be stricter — include ONLY items explicitly requested in the email; drop anything inferred.`
      : "";

    const { items, confidence, cost } = await callLLM({
      system: SYSTEM,
      prompt: `Email:\n${state.raw_input}\n\nReturn {items, confidence}.${negative}`,
      json_schema: ITEM_SCHEMA,
    });

    const highlights: Highlight[] = items.map((text, i) => ({
      block_id: `a${i}`,
      text,
      confidence: confidence ?? 0.9,
    }));
    // The orchestrator judges these blocks for groundedness against raw_input.
    const judge_blocks: ContentBlock[] = highlights.map((h) => ({ id: h.block_id, type: "paragraph", text: h.text }));

    return {
      writes: { highlights },
      summary: `extracted ${highlights.length} item(s)`,
      cost,
      confidence: confidence ?? 0.9,
      judge_blocks,
    };
  },
};

async function runSkillWeave() {
  attempts = 0; // reset per trial
  const pipeline: Pipeline = { name: "grounded-triage", version: "1.0.0", domain: "documents", steps: [groundedExtractor] };
  const state: State = {
    raw_input: EMAIL,
    _meta: { pipeline: "grounded-triage", run_id: `ab-${Date.now()}`, inject: "none", checkpoints: [] },
  };
  const outcome = await runPipeline(pipeline, state, `${provider!.name} (live)`, { quiet: true, policy: NET_POLICY });
  return { state, outcome, retries: Math.max(0, attempts - 1) };
}

// ── Drive the A/B ────────────────────────────────────────────────────────────
const trials = Number(process.argv[process.argv.indexOf("--trials") + 1]) || 1;
console.log(`Provider: ${provider.name}   mode: ${HARD ? "hard (loose prompt + bait)" : "strict"}   trials: ${trials}\n`);

let plainShipped = 0;
let swCaught = 0; // times the runtime flagged/retried/halted instead of shipping blindly

for (let t = 1; t <= trials; t++) {
  if (trials > 1) console.log(`──── trial ${t} ────`);

  const plain = await runPlain();
  console.log("PLAIN SKILL  → ships immediately, no groundedness check:");
  for (const i of plain.items) console.log("   •", i);
  plainShipped += plain.items.length;

  const { state, outcome, retries } = await runSkillWeave();
  console.log(`\nSKILLWEAVE   → status=${outcome.status}  groundedness=${state.judge?.score ?? "n/a"}  retries=${retries}:`);
  for (const h of state.highlights ?? []) console.log("   •", h.text);
  if (retries > 0 || outcome.status !== "success") swCaught++;
  console.log("");
}

// ── The verdict ──────────────────────────────────────────────────────────────
console.log("════════════════════════════════════════════════════════════");
console.log("Same model, same prompt. The difference:");
console.log(`  • PLAIN     : returned a list every time, with NO signal of whether it was grounded.`);
console.log(`  • SKILLWEAVE: judged every output, and stepped in (flag/retry/halt) on ${swCaught}/${trials} run(s)`);
console.log(`                — over-inferred items get caught and dropped instead of shipped silently.`);
console.log("Inspect the full decision trail in ./traces/ (one NDJSON line per attempt).");

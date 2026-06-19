// SkillWeave v0.2.0 — document-grounding chain with the reliability layer.
// Proves SigMap's ask → validate → judge → learn pattern generalises to documents,
// now with confidence routing, an auto-inserted boundary judge, and
// retry-with-negative-context at the probabilistic boundary:
//   parse-input → validate-coverage → extract-highlights (judged) → memory-update
//
// Usage:
//   npm start                         run the chain on the default document
//   npm start -- --doc <path>         run on a document file
//   npm start -- --inject coverage        too-thin input → coverage assertion HALTS (deterministic)
//   npm start -- --inject lowconf         low-confidence highlight → confidence routing RETRIES → recovers
//   npm start -- --inject hallucination   ungrounded highlight → judge RETRIES → recovers
//   npm start -- --inject persistent      always-ungrounded → retries exhausted → HALTS

import { readFileSync } from "node:fs";
import { judgeExecutorLabel } from "./judge.js";
import { runPipeline } from "./orchestrator.js";
import { extractHighlights } from "./skills/extract-highlights.js";
import { memoryUpdate } from "./skills/memory-update.js";
import { parseInput } from "./skills/parse-input.js";
import { validateCoverage } from "./skills/validate-coverage.js";
import { SAMPLE_DOC, THIN_DOC } from "./sample-doc.js";
import type { Pipeline, State } from "./types.js";
import { VERSION } from "./version.js";

const INJECT_MODES = ["coverage", "lowconf", "hallucination", "persistent"] as const;

function parseArgs(argv: string[]): { doc?: string; inject: State["_meta"]["inject"] } {
  let doc: string | undefined;
  let inject: State["_meta"]["inject"] = "none";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--doc") doc = argv[++i];
    else if (argv[i] === "--inject") {
      const v = argv[++i];
      if ((INJECT_MODES as readonly string[]).includes(v ?? "")) {
        inject = v as State["_meta"]["inject"];
      } else {
        console.error(`unknown --inject value: ${v} (expected ${INJECT_MODES.join(" | ")})`);
        process.exit(2);
      }
    }
  }
  return { doc, inject };
}

const pipeline: Pipeline = {
  name: "document-grounding",
  version: VERSION,
  domain: "documents",
  steps: [parseInput, validateCoverage, extractHighlights, memoryUpdate],
};

async function main(): Promise<void> {
  const { doc, inject } = parseArgs(process.argv.slice(2));
  const raw =
    inject === "coverage" ? THIN_DOC : doc ? readFileSync(doc, "utf8") : SAMPLE_DOC;

  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const executor = judgeExecutorLabel();

  const state: State = {
    raw_input: raw,
    _meta: { pipeline: pipeline.name, run_id: runId, inject, checkpoints: [] },
  };

  const outcome = await runPipeline(pipeline, state, executor);

  if (outcome.status === "halted") {
    console.log(`Fix: address the halt at ${outcome.haltedAt}, then re-run.`);
    process.exit(1);
  }
  if (state.memory?.improved === false) {
    console.log("Note: judge score below the running average for this pipeline.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

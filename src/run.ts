// SkillWeave v0.1.0 prototype — document-grounding chain.
// Proves SigMap's ask → validate → judge → learn pattern generalises to documents:
//   parse-input → validate-coverage → boundary-judge → memory-update
//
// Usage:
//   npm start                         run the chain on the default document
//   npm start -- --doc <path>         run on a document file
//   npm start -- --inject hallucination   inject an ungrounded block (judge halts)
//   npm start -- --inject coverage        run on too-thin input (coverage halts)

import { readFileSync } from "node:fs";
import { judgeExecutorLabel } from "./judge.js";
import { runPipeline } from "./orchestrator.js";
import { boundaryJudge } from "./skills/boundary-judge.js";
import { memoryUpdate } from "./skills/memory-update.js";
import { parseInput } from "./skills/parse-input.js";
import { validateCoverage } from "./skills/validate-coverage.js";
import type { Pipeline, State } from "./types.js";

const SAMPLE_DOC = `# Quarterly Engineering Update

The platform team shipped the new retrieval pipeline this quarter. Latency
dropped by roughly forty percent after we moved ranking onto the graph index.

## Highlights
- Retrieval hit@5 improved from 14% to 76%
- Token usage per request fell by 39%
- Zero context-window overflows across the 21 monitored repositories

## Next Quarter
We will extend the adapter layer to cover document and finance domains, and
begin a public beta of the registry.`;

const THIN_DOC = "# Note\nok";

function parseArgs(argv: string[]): { doc?: string; inject: State["_meta"]["inject"] } {
  let doc: string | undefined;
  let inject: State["_meta"]["inject"] = "none";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--doc") doc = argv[++i];
    else if (argv[i] === "--inject") {
      const v = argv[++i];
      if (v === "hallucination" || v === "coverage") inject = v;
      else {
        console.error(`unknown --inject value: ${v}`);
        process.exit(2);
      }
    }
  }
  return { doc, inject };
}

const pipeline: Pipeline = {
  name: "document-grounding-prototype",
  version: "0.1.0",
  domain: "documents",
  steps: [parseInput, validateCoverage, boundaryJudge, memoryUpdate],
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

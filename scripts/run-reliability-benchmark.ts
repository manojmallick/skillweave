// Reliability benchmark — runs the document-grounding chain across a matrix of
// (document × inject-mode) scenarios and measures the reliability layer from the
// real NDJSON traces. Deterministic and offline (heuristic judge), so the numbers
// are reproducible. Pass --save to write the results into version.json.
//
//   node --import tsx scripts/run-reliability-benchmark.ts [--save]
process.env.JUDGE_PROVIDER = "heuristic";

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/orchestrator.js";
import { extractHighlights } from "../src/skills/extract-highlights.js";
import { memoryUpdate } from "../src/skills/memory-update.js";
import { parseInput } from "../src/skills/parse-input.js";
import { validateCoverage } from "../src/skills/validate-coverage.js";
import type { Pipeline, State } from "../src/types.js";
import { VERSION } from "../src/version.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const pipeline: Pipeline = {
  name: "document-grounding",
  version: VERSION,
  domain: "documents",
  steps: [parseInput, validateCoverage, extractHighlights, memoryUpdate],
};

const GROUNDED_DOCS = [
  `# Quarterly Engineering Update

The platform team shipped the new retrieval pipeline this quarter and latency
dropped by roughly 40 percent after ranking moved onto the graph index.

## Highlights

Retrieval hit@5 improved from 14% to 76% across the monitored repositories this period.
Token usage per request fell by 39% and there were zero context-window overflows.`,

  `# Release Notes for the Parser

The parser now handles 12 document formats and the extraction layer was rewritten
for clarity and speed during the most recent development cycle.

## Metrics

The suite reports 9 tests passing with 0 known regressions and a measured 35ms p99
latency across the standard benchmark corpus used by the team for releases.`,

  `# Service Status Report

Throughput reached 1200 requests per minute during the peak window observed by the
on-call engineers while the new caching layer was being exercised under load.

## Numbers

The p99 latency held at 35ms and the error rate stayed at 0.2% across 21 monitored
services, with no incidents recorded during the full reporting period this week.`,
];
const THIN_DOC = "# Note\nok";

type Mode = State["_meta"]["inject"];
interface Scenario {
  id: string;
  raw: string;
  inject: Mode;
}

const scenarios: Scenario[] = [];
GROUNDED_DOCS.forEach((raw, i) => {
  for (const inject of ["none", "lowconf", "hallucination", "persistent"] as Mode[]) {
    scenarios.push({ id: `doc${i}-${inject}`, raw, inject });
  }
});
scenarios.push({ id: "thin-coverage", raw: THIN_DOC, inject: "none" });

interface TraceRow {
  skill: string;
  class: string;
  status: string;
  attempt: number;
  judge_score: number | null;
}

function readTrace(runId: string): TraceRow[] {
  const path = join(ROOT, "traces", `${runId}.ndjson`);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as TraceRow);
}

const FABRICATION_MODES = new Set<Mode>(["hallucination", "persistent"]);

async function main() {
  let runId = 0;
  let success = 0;
  let retriedScenarios = 0;
  let recoveredScenarios = 0;
  let fabricationScenarios = 0;
  let judgeCaught = 0;
  let probAttemptsTotal = 0;
  let probScenarios = 0;
  let deterministicZeroOverhead = true;

  const rows: string[] = [];

  for (const sc of scenarios) {
    const id = `bench-${++runId}`;
    const state: State = {
      raw_input: sc.raw,
      _meta: { pipeline: pipeline.name, run_id: id, inject: sc.inject, checkpoints: [] },
    };
    const outcome = await runPipeline(pipeline, state, "heuristic", { quiet: true });
    const trace = readTrace(id);

    const probRows = trace.filter((r) => r.skill === "extract-highlights");
    const detRows = trace.filter((r) => r.class === "deterministic");
    const retried = trace.some((r) => r.status === "retry");
    const attempts = probRows.reduce((m, r) => Math.max(m, r.attempt), 0);

    if (outcome.status === "success") success++;
    if (retried) retriedScenarios++;
    if (retried && outcome.status === "success") recoveredScenarios++;
    if (probRows.length) {
      probScenarios++;
      probAttemptsTotal += attempts;
    }
    if (detRows.some((r) => r.attempt !== 1)) deterministicZeroOverhead = false;

    if (FABRICATION_MODES.has(sc.inject)) {
      fabricationScenarios++;
      const caught = probRows.some(
        (r) => r.judge_score !== null && (r.status === "retry" || r.status === "halted"),
      );
      if (caught) judgeCaught++;
    }

    rows.push(
      `  ${sc.id.padEnd(22)} ${outcome.status.padEnd(8)} attempts=${attempts || "-"} ${retried ? "(retried)" : ""}`,
    );
  }

  const total = scenarios.length;
  const pct = (n: number, d: number) => (d ? Number(((n / d) * 100).toFixed(1)) : 0);

  const metrics = {
    scenarios: total,
    success_rate_pct: pct(success, total),
    recovery_rate_pct: pct(recoveredScenarios, retriedScenarios),
    judge_catch_rate_pct: pct(judgeCaught, fabricationScenarios),
    avg_probabilistic_attempts: probScenarios
      ? Number((probAttemptsTotal / probScenarios).toFixed(2))
      : 0,
    deterministic_zero_overhead: deterministicZeroOverhead,
  };

  console.log(`\nSkillWeave reliability benchmark — v${VERSION}  (judge: heuristic, offline)`);
  console.log("─".repeat(60));
  console.log(rows.join("\n"));
  console.log("─".repeat(60));
  console.log(`scenarios                 : ${metrics.scenarios}`);
  console.log(`success rate              : ${metrics.success_rate_pct}%`);
  console.log(`recovery rate (retried)   : ${metrics.recovery_rate_pct}%  (${recoveredScenarios}/${retriedScenarios})`);
  console.log(`judge catch rate (fab.)   : ${metrics.judge_catch_rate_pct}%  (${judgeCaught}/${fabricationScenarios})`);
  console.log(`avg probabilistic attempts: ${metrics.avg_probabilistic_attempts}`);
  console.log(`deterministic zero-overhead: ${metrics.deterministic_zero_overhead}`);

  if (process.argv.includes("--save")) {
    const vpath = join(ROOT, "version.json");
    const vj = JSON.parse(readFileSync(vpath, "utf8"));
    vj.benchmark_id = "skillweave-reliability-v0.2";
    vj.benchmark_date = new Date().toISOString().slice(0, 10);
    vj.metrics = metrics;
    delete vj.notes;
    writeFileSync(vpath, JSON.stringify(vj, null, 2) + "\n");
    console.log(`\nsaved metrics → version.json`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

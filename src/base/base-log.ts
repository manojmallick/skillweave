// base-log (frozen) — writes the NDJSON trace and surfaces execution summaries.
// On success the summary is terse; on failure full detail is auto-exposed.
// NDJSON format is SigMap usage.ndjson-compatible.

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ConfidenceBand, ExecutionClass } from "../types.js";

const TRACE_DIR = "traces";

export interface TraceRow {
  pipeline: string;
  skill: string;
  class: ExecutionClass;
  duration_ms: number;
  cost: number;
  judge_score: number | null;
  confidence: number | null;
  confidence_band?: ConfidenceBand | null;
  attempt?: number;
  status: "success" | "retry" | "halted";
  summary: string;
  detail?: string[];
}

export class Tracer {
  private rows: TraceRow[] = [];
  readonly tracePath: string;

  constructor(private readonly runId: string) {
    mkdirSync(TRACE_DIR, { recursive: true });
    this.tracePath = join(TRACE_DIR, `${runId}.ndjson`);
  }

  record(row: TraceRow): void {
    this.rows.push(row);
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...row,
      detail: undefined, // detail belongs to the summary view, not the metric line
    });
    appendFileSync(this.tracePath, line + "\n");
  }

  /** Always-shown execution summary. Halted runs print full diagnostics. */
  printSummary(pipeline: string, version: string, executor: string): void {
    const halted = this.rows.find((r) => r.status === "halted");
    const line = "─".repeat(72);
    console.log(`\nSkillWeave — ${pipeline} v${version}`);
    console.log(`executor: ${executor}`);
    console.log(line);

    for (const r of this.rows) {
      const mark = r.status === "success" ? "✓" : r.status === "retry" ? "↻" : "✗";
      const cls = r.class.padEnd(13);
      const cost = `$${r.cost.toFixed(4)}`;
      const ms = `${r.duration_ms}ms`.padStart(7);
      const suffix =
        r.status === "success" && (r.attempt ?? 1) > 1 ? ` (recovered on attempt ${r.attempt})` : "";
      console.log(
        `${mark} ${r.skill.padEnd(17)} ${cls} ${(r.summary + suffix).padEnd(34)} ${ms}  ${cost}`,
      );
      if (r.judge_score !== null) {
        console.log(`  └─ judge: ${r.judge_score.toFixed(2)}`);
      }
      if (r.status === "success" && r.confidence_band === "review") {
        console.log(`  └─ flagged: confidence ${r.confidence?.toFixed(2)} in review band`);
      }
      if ((r.status === "retry" || r.status === "halted") && r.detail) {
        for (const d of r.detail) console.log(`  └─ ${d}`);
      }
    }

    console.log(line);
    const totalMs = this.rows.reduce((a, r) => a + r.duration_ms, 0);
    const totalCost = this.rows.reduce((a, r) => a + r.cost, 0);
    const retries = this.rows.filter((r) => r.status === "retry").length;
    if (halted) {
      console.log(`STATUS: HALTED at ${halted.skill}`);
      console.log(`cost so far: $${totalCost.toFixed(4)}`);
    } else {
      const retryNote = retries > 0 ? `   retries: ${retries}` : "";
      console.log(
        `STATUS: SUCCESS   total: ${totalMs}ms   cost: $${totalCost.toFixed(4)}${retryNote}`,
      );
    }
    console.log(`trace: ./${this.tracePath}\n`);
  }
}

// sigmap-observe.adapter — wraps SigMap's OBSERVE primitive. Computes a composite
// 0–100 health score (SigMap grade scale A>=90 · B>=75 · C>=60 · D<60) from the
// NDJSON metric stream SkillWeave writes (SigMap usage.ndjson-compatible), plus
// SigMap's own `.context/usage.ndjson` when present. No shell spawn.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePaths } from "./paths.js";
import type { Grade, HealthScore, ObservabilityProvider } from "./types.js";

interface Row {
  status?: string;
  judge_score?: number | null;
}

const RECENT_RUNS = 20;
const WEIGHTS = { success: 0.5, judge: 0.3, low_retry: 0.2 };

function gradeFor(score: number): Grade {
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
}

export class SigMapObserveAdapter implements ObservabilityProvider {
  private readonly tracesDir: string;
  private readonly contextDir: string;

  constructor(opts: { tracesDir?: string; contextDir?: string } = {}) {
    const p = resolvePaths(opts);
    this.tracesDir = p.tracesDir;
    this.contextDir = p.contextDir;
  }

  /** Per-run row sets: each SkillWeave trace file is one run. */
  private runs(): Row[][] {
    if (!existsSync(this.tracesDir)) return [];
    const files = readdirSync(this.tracesDir)
      .filter((f) => f.endsWith(".ndjson"))
      .map((f) => join(this.tracesDir, f))
      .sort()
      .slice(-RECENT_RUNS);

    // SigMap's own usage.ndjson, when present, counts as one additional run.
    const sigmapUsage = join(this.contextDir, "usage.ndjson");
    if (existsSync(sigmapUsage)) files.push(sigmapUsage);

    return files.map((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l) as Row;
          } catch {
            return {} as Row;
          }
        }),
    );
  }

  health(): HealthScore {
    const runs = this.runs();
    const source = this.tracesDir;
    if (runs.length === 0) {
      return {
        score: 0,
        grade: "D",
        components: { runs: 0, success_rate: 0, judge_pass_rate: 0, low_retry_rate: 1 },
        source,
      };
    }

    const successfulRuns = runs.filter((rows) => !rows.some((r) => r.status === "halted")).length;
    const allRows = runs.flat();
    const judged = allRows.filter((r) => r.judge_score != null);
    const judgePassed = judged.filter((r) => r.status === "success").length;
    const retryRows = allRows.filter((r) => r.status === "retry").length;

    const components = {
      runs: runs.length,
      success_rate: successfulRuns / runs.length,
      judge_pass_rate: judged.length ? judgePassed / judged.length : 1,
      low_retry_rate: allRows.length ? 1 - retryRows / allRows.length : 1,
    };

    const score = Math.round(
      100 *
        (WEIGHTS.success * components.success_rate +
          WEIGHTS.judge * components.judge_pass_rate +
          WEIGHTS.low_retry * components.low_retry_rate),
    );

    return { score, grade: gradeFor(score), components, source };
  }
}

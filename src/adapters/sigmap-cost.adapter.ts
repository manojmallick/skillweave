// sigmap-cost.adapter — wraps SigMap's COST primitive. Mirrors SigMap's model-tier
// routing (fast: config/typos · balanced: features/tests · powerful: arch/security)
// and reads per-run cost from the NDJSON metric stream. No shell spawn.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePaths } from "./paths.js";
import type { CostManager, ModelTier } from "./types.js";

const FAST = /\b(typo|rename|format(?:ting)?|lint|whitespace|comment|config|bump|readme|docs?)\b/i;
const POWERFUL =
  /\b(architect(?:ure)?|security|secure|migrat\w*|refactor|redesign|concurren\w*|crypto|auth\w*|performance|threat|vulnerab\w*)\b/i;

export class SigMapCostAdapter implements CostManager {
  private readonly tracesDir: string;

  constructor(opts: { tracesDir?: string } = {}) {
    this.tracesDir = resolvePaths(opts).tracesDir;
  }

  routeModel(task: string): ModelTier {
    if (POWERFUL.test(task)) return "powerful";
    if (FAST.test(task)) return "fast";
    return "balanced";
  }

  totalCost(): number {
    if (!existsSync(this.tracesDir)) return 0;
    let sum = 0;
    for (const f of readdirSync(this.tracesDir).filter((f) => f.endsWith(".ndjson"))) {
      for (const line of readFileSync(join(this.tracesDir, f), "utf8").split("\n").filter(Boolean)) {
        try {
          const r = JSON.parse(line) as { cost?: number };
          if (typeof r.cost === "number") sum += r.cost;
        } catch {
          // skip malformed line
        }
      }
    }
    return Number(sum.toFixed(6));
  }
}

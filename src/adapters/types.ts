// SigMap adapter layer — provider interfaces. The adapters wrap SigMap's local
// artifacts (the .context/ directory and the SigMap usage.ndjson-compatible
// metrics SkillWeave writes), never the sigmap CLI — no shell spawns, no rebuild.

export type ModelTier = "fast" | "balanced" | "powerful";
export type Grade = "A" | "B" | "C" | "D";

/** CONTEXT — ambient knowledge loaded from SigMap's `ask` output. */
export interface SigMapContext {
  present: boolean;
  source: string; // path read (or attempted)
  query?: string;
  content: string;
  approx_tokens: number;
}

export interface ContextProvider {
  load(query?: string): SigMapContext;
}

/** OBSERVE — composite health computed from the NDJSON metric stream. */
export interface HealthComponents {
  runs: number;
  success_rate: number; // 0..1
  judge_pass_rate: number; // 0..1
  low_retry_rate: number; // 0..1
}

export interface HealthScore {
  score: number; // 0..100
  grade: Grade; // SigMap scale: A>=90 · B>=75 · C>=60 · D<60
  components: HealthComponents;
  source: string;
}

export interface ObservabilityProvider {
  health(): HealthScore;
}

/** COST — model-tier routing and per-run cost, from SigMap's COST primitive. */
export interface CostManager {
  routeModel(task: string): ModelTier;
  totalCost(): number;
}

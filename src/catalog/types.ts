// SkillWeave skill catalog (v1.0.0) — the tiered registry of published skills.
// Distinct from the runtime resolver (src/registry.ts) and the schema store
// (schemas/registry/): this is the quality-gated, trust-tiered publish surface.

/** Trust tier a skill earns from the quality gate. */
export type Tier = "verified" | "community" | "experimental";

/** One quality-gate check and its result. */
export interface QualityCheck {
  id: string;
  label: string;
  ok: boolean;
}

/** The full quality assessment of a skill. */
export interface QualityReport {
  points: number; // checks passed (0..max)
  max: number; // total checks (9)
  checks: QualityCheck[];
  /** Tier earned, or null when the skill scores below the experimental floor. */
  tier: Tier | null;
}

/** A published skill record persisted in the registry. */
export interface RegistryEntry {
  name: string;
  version: string;
  tier: Tier;
  points: number;
  /** Quality-derived reputation, 0..100 = round(points / max * 100). */
  reputation: number;
  published_at: string;
}

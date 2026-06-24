// The 9-point quality gate — scores a skill's contract and assigns a trust tier.
// Tiers: verified (9/9) · community (6-8) · experimental (3-5) · rejected (<3).

import { checkNeutralLanguage } from "../providers/index.js";
import type { Skill } from "../types.js";
import type { QualityCheck, QualityReport, Tier } from "./types.js";

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const EXPERIMENTAL_FLOOR = 3;

/** Assign a tier from the points earned (null = below the experimental floor). */
export function tierFor(points: number, max = 9): Tier | null {
  if (points >= max) return "verified";
  if (points >= 6) return "community";
  if (points >= EXPERIMENTAL_FLOOR) return "experimental";
  return null;
}

/** Run the 9 quality checks against a skill contract. */
export function gradeSkill(skill: Skill): QualityReport {
  const isProbabilistic = skill.execution_class === "probabilistic";
  const checks: QualityCheck[] = [
    {
      id: "name",
      label: "name is kebab-case",
      ok: typeof skill.name === "string" && KEBAB.test(skill.name),
    },
    {
      id: "does",
      label: "does is a substantive description",
      ok: (skill.does?.trim().length ?? 0) >= 10,
    },
    {
      id: "does_not",
      label: "does_not declares explicit exclusions",
      ok: (skill.does_not?.trim().length ?? 0) > 0,
    },
    {
      id: "state_scope",
      label: "state read/write scope declared",
      ok: Array.isArray(skill.state_read) && Array.isArray(skill.state_write),
    },
    {
      id: "capabilities",
      label: "capabilities declared (security scope)",
      ok: Array.isArray(skill.capabilities),
    },
    {
      id: "assertions",
      label: "at least one assertion",
      ok: (skill.assertions?.length ?? 0) >= 1,
    },
    {
      id: "schema_pin",
      label: "pins an input or output schema",
      ok: Boolean(skill.input_schema || skill.output_schema),
    },
    {
      id: "neutral",
      label: "does/does_not are model-neutral",
      ok: checkNeutralLanguage(`${skill.does} ${skill.does_not}`).length === 0,
    },
    {
      id: "classification",
      label: "execution_class declared coherently",
      ok: isProbabilistic
        ? skill.confidence_threshold != null && (skill.golden_anchors?.length ?? 0) >= 1
        : (skill.retries ?? 0) === 0,
    },
  ];

  const points = checks.filter((c) => c.ok).length;
  return { points, max: checks.length, checks, tier: tierFor(points, checks.length) };
}

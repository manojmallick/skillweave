// Skill registry — maps skill names to their implementations so a pipeline YAML
// can reference skills by name. New skills register here.

import { extractHighlights } from "./skills/extract-highlights.js";
import { loadContext } from "./skills/load-context.js";
import { memoryUpdate } from "./skills/memory-update.js";
import { parseInput } from "./skills/parse-input.js";
import { validateCoverage } from "./skills/validate-coverage.js";
import type { Skill } from "./types.js";

const ALL: Skill[] = [loadContext, parseInput, validateCoverage, extractHighlights, memoryUpdate];

export const SKILLS: Record<string, Skill> = Object.fromEntries(
  ALL.map((s) => [s.name, s]),
);

export function getSkill(name: string): Skill | undefined {
  return SKILLS[name];
}

export function listSkills(): Skill[] {
  return [...ALL];
}

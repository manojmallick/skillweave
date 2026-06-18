// base-io (frozen) — STATE transport only. Never transforms data.
// Constitution: applies a skill's declared writes, enforcing the write-scope,
// then checkpoints STATE after every skill completion.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Skill, SkillResult, State } from "../types.js";

const CHECKPOINT_DIR = join("traces", "checkpoints");

/** Merge a skill's declared writes into STATE, refusing out-of-scope fields. */
export function applyWrites(state: State, skill: Skill, result: SkillResult): void {
  for (const key of Object.keys(result.writes) as (keyof State)[]) {
    if (key === "_meta") continue;
    if (!skill.state_write.includes(key)) {
      throw new Error(
        `base-io: skill "${skill.name}" attempted to write undeclared STATE field "${String(key)}"`,
      );
    }
    // @ts-expect-error — key is a validated keyof State
    state[key] = result.writes[key];
  }
}

/** Immutable STATE snapshot written after each skill. */
export function checkpoint(state: State, skillName: string, index: number): string {
  mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const file = join(
    CHECKPOINT_DIR,
    `${state._meta.run_id}.${String(index).padStart(2, "0")}.${skillName}.json`,
  );
  writeFileSync(file, JSON.stringify(state, null, 2));
  state._meta.checkpoints.push(file);
  return file;
}

// base-assert (frozen) — runs the assertions a skill declares.
// Failure always halts; it never silently continues. Deterministic skills
// pay zero judge overhead (the judge boundary is a separate skill in v0.1.0).

import type { AssertionResult, Skill, State } from "../types.js";

export class AssertionError extends Error {
  constructor(
    readonly skill: string,
    readonly failures: AssertionResult[],
  ) {
    super(`base-assert: ${failures.length} assertion(s) failed in "${skill}"`);
    this.name = "AssertionError";
  }
}

/** Run every assertion declared by the skill. Throws on the first failing set. */
export function runAssertions(state: State, skill: Skill): void {
  const failures: AssertionResult[] = [];
  for (const assertion of skill.assertions) {
    const result = assertion.check(state);
    if (!result.ok) failures.push(result);
  }
  if (failures.length > 0) throw new AssertionError(skill.name, failures);
}

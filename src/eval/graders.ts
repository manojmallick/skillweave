// Grader factories — deterministic checks over a run's outcome, plus a
// judge-based (LLM-rubric) grader that reads the boundary judge's verdict.

import type { State } from "../types.js";
import type { Grader } from "./types.js";

/** The run reached the given terminal status. */
export function expectStatus(status: "success" | "halted"): Grader {
  return (snap) => {
    const passed = snap.status === status;
    return { score: passed ? 1 : 0, passed, detail: `status ${snap.status}` };
  };
}

/** The run halted at a specific skill (a robustness / negative-case check). */
export function expectHaltedAt(skill: string): Grader {
  return (snap) => {
    const passed = snap.status === "halted" && snap.haltedAt === skill;
    return { score: passed ? 1 : 0, passed, detail: `halted at ${snap.haltedAt ?? "(none)"}` };
  };
}

/** The boundary judge passed (an LLM-rubric grader — groundedness). */
export function expectGrounded(): Grader {
  return (snap) => {
    const passed = snap.state.judge?.passed === true;
    return {
      score: snap.state.judge?.score ?? 0,
      passed,
      detail: `judge ${snap.state.judge?.score ?? "n/a"}`,
    };
  };
}

/** The judge score is at least `min` (score = the judge score itself). */
export function minJudgeScore(min: number): Grader {
  return (snap) => {
    const score = snap.state.judge?.score ?? 0;
    return { score, passed: score >= min, detail: `judge ${score} ${score >= min ? ">=" : "<"} ${min}` };
  };
}

/** A custom predicate over the final STATE. */
export function expectState(label: string, predicate: (state: State) => boolean): Grader {
  return (snap) => {
    const passed = predicate(snap.state);
    return { score: passed ? 1 : 0, passed, detail: label };
  };
}

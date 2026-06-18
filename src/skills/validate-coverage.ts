// validate-coverage (deterministic) — maps to SigMap `validate`.
// Checks whether the parsed blocks are sufficient context for the task.
// Asserts coverage_score >= 0.70 before the chain proceeds.

import type { Coverage, Skill, State } from "../types.js";

const THRESHOLD = 0.7;

function assess(state: State): Coverage {
  const blocks = state.content_blocks ?? [];
  const reasons: string[] = [];
  let score = 0;

  if (blocks.length >= 2) {
    score += 0.34;
  } else {
    reasons.push("fewer than 2 content blocks");
  }

  if (blocks.some((b) => b.type === "heading")) {
    score += 0.33;
  } else {
    reasons.push("no heading/title block");
  }

  const words = blocks.reduce((a, b) => a + b.text.split(/\s+/).length, 0);
  if (words >= 20) {
    score += 0.33;
  } else {
    reasons.push(`only ${words} words total (need >= 20)`);
  }

  score = Number(score.toFixed(2));
  return { score, sufficient: score >= THRESHOLD, reasons };
}

export const validateCoverage: Skill = {
  name: "validate-coverage",
  execution_class: "deterministic",
  does: "checks whether content blocks are sufficient context for the task",
  does_not: "extract content, score groundedness, or call an LLM",
  state_read: ["content_blocks"],
  state_write: ["coverage"],
  assertions: [
    {
      statement: "coverage_score >= 0.70",
      check: (s: State) => ({
        statement: "coverage_score >= 0.70",
        ok: s.coverage?.sufficient === true,
        detail: `score ${s.coverage?.score} — ${s.coverage?.reasons.join("; ") || "ok"}`,
      }),
    },
  ],
  async run(state: State) {
    const coverage = assess(state);
    return {
      writes: { coverage },
      summary: `coverage ${coverage.score} (${coverage.sufficient ? "sufficient" : "insufficient"})`,
      cost: 0,
    };
  },
};
